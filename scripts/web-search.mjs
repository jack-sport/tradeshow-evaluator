#!/usr/bin/env node
/**
 * Brave web search for show research, shared-throttled and logged.
 *
 * Usage:  node scripts/web-search.mjs "<query>" [--count 8]
 * Prints JSON: [{ title, url, snippet }]. Reads BRAVE_API_KEY from .env.local and never prints it.
 * Calls from any number of processes are spaced at least 1.2 s apart (Brave free plan), using a lock
 * file, and every query is appended to data/ai-research/search-log.jsonl.
 */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const countIndex = args.indexOf("--count");
const count = countIndex >= 0 ? Math.min(20, Number(args[countIndex + 1]) || 8) : 8;
const query = args.filter((_, i) => i !== countIndex && i !== countIndex + 1).join(" ").trim();
if (!query) { console.error('Usage: node scripts/web-search.mjs "<query>" [--count 8]'); process.exit(2); }

const env = readFileSync(resolve(root, ".env.local"), "utf8");
const key = env.match(/^BRAVE_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!key) { console.error("BRAVE_API_KEY is not set in .env.local"); process.exit(2); }

const researchDir = resolve(root, "data/ai-research");
mkdirSync(researchDir, { recursive: true });
const lock = resolve(researchDir, ".search.lock");
const stamp = resolve(researchDir, ".search.last");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function throttle() {
  for (;;) {
    try {
      closeSync(openSync(lock, "wx"));
      break;
    } catch {
      // Clear a lock left by a crashed process.
      try { if (Date.now() - statSync(lock).mtimeMs > 15_000) unlinkSync(lock); } catch { /* gone already */ }
      await sleep(150);
    }
  }
  const last = existsSync(stamp) ? Number(readFileSync(stamp, "utf8")) || 0 : 0;
  const wait = last + 1200 - Date.now();
  if (wait > 0) await sleep(wait);
}

await throttle();
let results = [];
let status = 0;
try {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
  const response = await fetch(url, { headers: { Accept: "application/json", "X-Subscription-Token": key } });
  status = response.status;
  if (response.ok) {
    const body = await response.json();
    results = (body.web?.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: [r.description, ...(r.extra_snippets || [])].filter(Boolean).join(" … ").replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " "),
    }));
  }
} finally {
  writeFileSync(stamp, String(Date.now()));
  try { unlinkSync(lock); } catch { /* already released */ }
}
appendFileSync(resolve(researchDir, "search-log.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), query, status, results: results.length })}\n`);
if (status !== 200) { console.error(`Search failed: HTTP ${status}`); process.exit(1); }
console.log(JSON.stringify(results, null, 2));

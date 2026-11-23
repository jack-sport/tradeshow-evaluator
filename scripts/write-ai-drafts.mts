/**
 * Write the AI evaluator's draft assessments from data/ai-drafts/*.json into Supabase.
 *
 * Usage:  npm run ai:drafts                      (all draft files)
 *         npm run ai:drafts -- <source_id> ...   (selected events)
 *
 * Each file is named <source_id>.json (the workbook's Event ID) and looks like:
 *   {
 *     "source_id": "tpm-2027",
 *     "tier": "major" | "regional" | "other",
 *     "recommendation": "exhibit" | "sales_only" | "skip",
 *     "rationale": "Overall reasoning…",
 *     "ratings": { "<criterion label>": { "rating": 1-5 or null (Unknown), "basis": "Why / source" } }
 *   }
 *
 * Every active criterion must be answered. Scores are calculated with the app's own lib/scoring.ts.
 * Evaluations are always saved as drafts, so they never count toward team results.
 * The event's tier is set and marked provisional unless someone has already confirmed a tier.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { scoreSection, type Ratings } from "../lib/scoring.ts";
import type { Criterion } from "../lib/types.ts";

const ROOT = resolve(import.meta.dirname, "..");
const DRAFTS = join(ROOT, "data", "ai-drafts");
const AI_EMAIL = "ai@scorecard.invalid"; // reserved .invalid domain: cannot receive mail or be used to sign in

interface DraftFile {
  source_id: string;
  tier: "major" | "regional" | "other";
  recommendation: "exhibit" | "sales_only" | "skip";
  rationale: string;
  ratings: Record<string, { rating: number | null; basis: string }>;
}

function env(key: string) {
  const line = readFileSync(join(ROOT, ".env.local"), "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} missing from .env.local`);
  return line.slice(key.length + 1).trim();
}

const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureAiProfile(): Promise<string> {
  const { data: existing } = await supabase.from("profiles").select("id").eq("is_ai", true).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase.auth.admin.createUser({
    email: AI_EMAIL,
    password: randomBytes(24).toString("base64url"), // never shared; the account is not meant to sign in
    email_confirm: true,
    user_metadata: { full_name: "AI" },
  });
  if (error) throw error;
  const { error: profileError } = await supabase.from("profiles")
    .update({ is_ai: true, role: "member", full_name: "AI" }).eq("id", data.user.id);
  if (profileError) throw profileError;
  console.log("Created the AI evaluator account.");
  return data.user.id;
}

function validate(draft: DraftFile, criteria: Criterion[], file: string) {
  const problems: string[] = [];
  if (!["major", "regional", "other"].includes(draft.tier)) problems.push(`bad tier "${draft.tier}"`);
  if (!["exhibit", "sales_only", "skip"].includes(draft.recommendation)) problems.push(`bad recommendation "${draft.recommendation}"`);
  if (!draft.rationale?.trim()) problems.push("missing rationale");
  const labels = new Set(criteria.map((c) => c.label));
  for (const label of Object.keys(draft.ratings || {})) if (!labels.has(label)) problems.push(`unknown criterion "${label}"`);
  for (const criterion of criteria) {
    const answer = draft.ratings?.[criterion.label];
    if (!answer) { problems.push(`missing "${criterion.label}"`); continue; }
    if (answer.rating !== null && !(Number.isInteger(answer.rating) && answer.rating >= 1 && answer.rating <= 5)) problems.push(`bad rating for "${criterion.label}"`);
    if (!answer.basis?.trim()) problems.push(`no basis for "${criterion.label}"`);
  }
  if (problems.length) throw new Error(`${file}: ${problems.join("; ")}`);
}

async function main() {
  const wanted = process.argv.slice(2);
  const files = readdirSync(DRAFTS).filter((f) => f.endsWith(".json"))
    .filter((f) => !wanted.length || wanted.includes(f.replace(/\.json$/, "")));
  if (!files.length) throw new Error("No draft files found.");

  const aiId = await ensureAiProfile();
  const { data: criteriaRows, error: criteriaError } = await supabase.from("criteria").select("*").eq("active", true).order("sort_order");
  if (criteriaError) throw criteriaError;
  const criteria = criteriaRows as Criterion[];

  // Validate everything before writing anything.
  const drafts = files.map((file) => {
    const draft = JSON.parse(readFileSync(join(DRAFTS, file), "utf8")) as DraftFile;
    validate(draft, criteria, file);
    return draft;
  });

  for (const draft of drafts) {
    const { data: event, error: eventError } = await supabase.from("events")
      .select("id,name,event_tier,tier_provisional").eq("source_id", draft.source_id).maybeSingle();
    if (eventError) throw eventError;
    if (!event) { console.warn(`SKIP ${draft.source_id}: no event with that Event ID`); continue; }

    const ratings: Ratings = {};
    for (const c of criteria) ratings[c.id] = draft.ratings[c.label].rating;
    const opportunity = scoreSection(criteria, ratings, "opportunity");
    const exhibit = scoreSection(criteria, ratings, "exhibit");

    const { data: saved, error } = await supabase.from("evaluations").upsert({
      event_id: event.id, evaluator_id: aiId, status: "draft", submitted_at: null,
      recommendation: draft.recommendation, comments: draft.rationale,
      opportunity_score: opportunity.score, exhibit_score: exhibit.score,
      opportunity_coverage: opportunity.coverage, exhibit_coverage: exhibit.coverage,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id,evaluator_id" }).select("id").single();
    if (error) throw error;
    await supabase.from("evaluation_responses").delete().eq("evaluation_id", saved.id);
    const { error: responseError } = await supabase.from("evaluation_responses").insert(criteria.map((c) => ({
      evaluation_id: saved.id, criterion_id: c.id, rating: draft.ratings[c.label].rating, comment: draft.ratings[c.label].basis,
    })));
    if (responseError) throw responseError;

    // Only set the tier while it is unconfirmed (still provisional, or never set).
    if (event.tier_provisional || event.event_tier === "other") {
      await supabase.from("events").update({ event_tier: draft.tier, tier_provisional: true }).eq("id", event.id);
    }
    console.log(`${event.name}: ${draft.recommendation} · opportunity ${opportunity.score ?? "—"} (${opportunity.coverage}% rated) · exhibit ${exhibit.score ?? "—"} (${exhibit.coverage}% rated)`);
  }
}

main().catch((error) => { console.error(error.message || error); process.exit(1); });

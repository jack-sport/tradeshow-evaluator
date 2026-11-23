/**
 * Start a person's assessment from the AI draft, with their own changes. Saved as a DRAFT under
 * that person's name, so they review it in the app and submit it themselves.
 *
 * Usage:  npm run adopt:ai -- <changes.json>
 *
 * changes.json:
 *   {
 *     "source_id": "tpm-2027",
 *     "evaluator_name": "Full Name",            // must match a profile's full name
 *     "recommendation": "sales_only",          // optional; defaults to the AI's
 *     "comments": "Overall rationale",         // optional; defaults to a note that it started from the AI draft
 *     "ratings": { "<criterion label>": { "rating": 1-5 or null, "comment": "why" } }
 *   }
 * Criteria not listed keep the AI's rating and basis. Scores use the app's own lib/scoring.ts.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { scoreSection, type Ratings } from "../lib/scoring.ts";
import type { Criterion } from "../lib/types.ts";

const ROOT = resolve(import.meta.dirname, "..");
const env = (key: string) => {
  const line = readFileSync(join(ROOT, ".env.local"), "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} missing from .env.local`);
  return line.slice(key.length + 1).trim();
};
const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface Changes {
  source_id: string;
  evaluator_name: string;
  recommendation?: "exhibit" | "sales_only" | "skip";
  comments?: string;
  ratings?: Record<string, { rating: number | null; comment?: string }>;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run adopt:ai -- <changes.json>");
  const changes = JSON.parse(readFileSync(resolve(file), "utf8")) as Changes;

  const { data: person } = await supabase.from("profiles").select("id,full_name").eq("full_name", changes.evaluator_name).eq("is_ai", false).maybeSingle();
  if (!person) throw new Error(`No person named "${changes.evaluator_name}"`);
  const { data: ai } = await supabase.from("profiles").select("id").eq("is_ai", true).single();
  const { data: event } = await supabase.from("events").select("id,name").eq("source_id", changes.source_id).single();
  if (!event) throw new Error(`No event ${changes.source_id}`);
  const { data: aiEval } = await supabase.from("evaluations").select("*").eq("event_id", event.id).eq("evaluator_id", ai!.id).single();
  if (!aiEval) throw new Error(`No AI draft for ${changes.source_id}`);
  const { data: aiResponses } = await supabase.from("evaluation_responses").select("criterion_id,rating,comment").eq("evaluation_id", aiEval.id);
  const { data: criteriaRows } = await supabase.from("criteria").select("*").eq("active", true).order("sort_order");
  const criteria = criteriaRows as Criterion[];

  const labels = new Set(criteria.map((c) => c.label));
  for (const label of Object.keys(changes.ratings || {})) if (!labels.has(label)) throw new Error(`Unknown criterion "${label}"`);

  const byId = new Map((aiResponses || []).map((r) => [r.criterion_id, r]));
  const ratings: Ratings = {};
  const responses = criteria.map((c) => {
    const change = changes.ratings?.[c.label];
    const base = byId.get(c.id);
    const rating = change ? change.rating : base?.rating ?? null;
    ratings[c.id] = rating;
    return { criterion_id: c.id, rating, comment: change ? change.comment ?? null : base?.comment ? `AI: ${base.comment}` : null };
  });
  const opportunity = scoreSection(criteria, ratings, "opportunity");
  const exhibit = scoreSection(criteria, ratings, "exhibit");

  const { data: existing } = await supabase.from("evaluations").select("status").eq("event_id", event.id).eq("evaluator_id", person.id).maybeSingle();
  if (existing?.status === "submitted") throw new Error(`${person.full_name} already submitted ${event.name}; not overwriting.`);

  const { data: saved, error } = await supabase.from("evaluations").upsert({
    event_id: event.id, evaluator_id: person.id, status: "draft", submitted_at: null,
    recommendation: changes.recommendation ?? aiEval.recommendation,
    comments: changes.comments ?? "Started from the AI draft; changed where noted.",
    opportunity_score: opportunity.score, exhibit_score: exhibit.score,
    opportunity_coverage: opportunity.coverage, exhibit_coverage: exhibit.coverage,
    updated_at: new Date().toISOString(),
  }, { onConflict: "event_id,evaluator_id" }).select("id").single();
  if (error) throw error;
  await supabase.from("evaluation_responses").delete().eq("evaluation_id", saved.id);
  const { error: responseError } = await supabase.from("evaluation_responses").insert(responses.map((r) => ({ ...r, evaluation_id: saved.id })));
  if (responseError) throw responseError;
  console.log(`${person.full_name} · ${event.name}: draft saved · opportunity ${opportunity.score} (${opportunity.coverage}% rated) · exhibit ${exhibit.score} (${exhibit.coverage}% rated)`);
}

main().catch((error) => { console.error(error.message || error); process.exit(1); });

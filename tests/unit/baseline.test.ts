import { describe, expect, it } from "vitest";
import { buildBaseline } from "@/lib/baseline";
import type { Evaluation, Event, Participation, Recommendation } from "@/lib/types";

const event = (id: string, ends_on: string | null, participation: Participation): Event => ({
  id, name: id, location: null, starts_on: ends_on, ends_on, event_tier: "other", status: "active",
  exhibit_cost: null, sales_only_cost: null, high_value_targets: null, notes: null, participation,
});
const evaluation = (event_id: string, recommendation: Recommendation | null, opportunity_coverage = 80): Evaluation => ({
  id: `e-${event_id}`, event_id, evaluator_id: "ai", status: "draft", recommendation, comments: null,
  opportunity_score: 60, exhibit_score: 40, opportunity_coverage, exhibit_coverage: 80, submitted_at: null, updated_at: "2026-11-20",
});

describe("baseline report", () => {
  const events = [
    event("exhibit-match", "2026-03-01", "exhibited"),
    event("attend-mismatch", "2026-04-01", "attended"),
    event("skip-match-lowdata", "2026-05-01", "did_not_attend"),
    event("unknown", "2026-06-01", "unknown"),
    event("no-ai", "2026-07-01", "attended"),
    event("future", "2027-02-01", "exhibited"),
  ];
  const evaluations = [
    evaluation("exhibit-match", "exhibit"),
    evaluation("attend-mismatch", "skip"),
    evaluation("skip-match-lowdata", "skip", 30),
    evaluation("unknown", "exhibit"),
    evaluation("future", "skip"),
  ];
  const summary = buildBaseline(events, evaluations, "2026-11-20");

  it("only includes past events", () => expect(summary.rows.map((row) => row.event.id)).not.toContain("future"));
  it("compares only where both sides are known", () => {
    expect(summary.compared).toBe(3);
    expect(summary.matches).toBe(2);
  });
  it("reports agreement separately for sufficient data", () => {
    expect(summary.comparedSufficient).toBe(2);
    expect(summary.matchesSufficient).toBe(1);
  });
  it("fills the actual-vs-recommended matrix", () => {
    expect(summary.matrix.exhibit.exhibit).toBe(1);
    expect(summary.matrix.sales_only.skip).toBe(1);
    expect(summary.matrix.skip.skip).toBe(1);
  });
  it("counts gaps", () => {
    expect(summary.unknownParticipation).toBe(1);
    expect(summary.missingEvaluation).toBe(1);
  });
});

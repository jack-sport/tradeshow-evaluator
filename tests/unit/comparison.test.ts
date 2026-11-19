import { describe, expect, it } from "vitest";
import { buildComparison } from "@/lib/comparison";
import type { PeerEvaluation } from "@/lib/types";

function item(id: string, opportunity: number | null, exhibit: number | null, recommendation: PeerEvaluation["recommendation"]): PeerEvaluation {
  return { id, event_id: "show", evaluator_id: id, status: "submitted", recommendation, comments: null, opportunity_score: opportunity, exhibit_score: exhibit, submitted_at: "2026-01-01", updated_at: "2026-01-01", profiles: { full_name: id }, evaluation_responses: [] };
}

describe("team comparison", () => {
  it("calculates averages, spread, and recommendation counts", () => {
    const result = buildComparison([item("A", 80, 60, "exhibit"), item("B", 100, 80, "sales_only")]);
    expect(result.opportunity).toBe(90);
    expect(result.exhibit).toBe(70);
    expect(result.spread).toBe(20);
    expect(result.recommendations.map((entry) => entry.count)).toEqual([1, 1, 0]);
  });
  it("handles no submitted evaluations without invalid numbers", () => {
    const result = buildComparison([]);
    expect(result).toMatchObject({ opportunity: 0, exhibit: 0, spread: 0 });
  });
  it("ignores null scores when averaging and calculating spread", () => {
    const result = buildComparison([item("A", null, null, "skip"), item("B", 75, 50, "skip")]);
    expect(result.opportunity).toBe(75);
    expect(result.spread).toBe(0);
  });
});

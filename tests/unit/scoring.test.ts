import { describe, expect, it } from "vitest";
import { calculateScore, formatDateRange, isPastEvent, participationAsRecommendation, recommendationLabel, scoreLabel, scoreSection } from "@/lib/scoring";
import type { Criterion } from "@/lib/types";

const criteria: Criterion[] = [
  { id: "a", section: "opportunity", category: "Test", label: "A", description: "", weight: 75, sort_order: 1 },
  { id: "b", section: "opportunity", category: "Test", label: "B", description: "", weight: 25, sort_order: 2 },
  { id: "c", section: "exhibit", category: "Test", label: "C", description: "", weight: 100, sort_order: 3 },
];

describe("weighted scoring", () => {
  it("normalizes all fives to 100", () => expect(calculateScore(criteria, { a: 5, b: 5 }, "opportunity")).toBe(100));
  it("applies criterion weights", () => expect(calculateScore(criteria, { a: 4, b: 2 }, "opportunity")).toBe(70));
  it("keeps sections independent", () => expect(calculateScore(criteria, { a: 5, b: 5, c: 3 }, "exhibit")).toBe(60));
  it("returns zero for an empty section", () => expect(calculateScore([], {}, "opportunity")).toBe(0));
});

describe("display helpers", () => {
  it("labels every recommendation", () => {
    expect(recommendationLabel("exhibit")).toBe("Exhibit + Sales");
    expect(recommendationLabel("sales_only")).toBe("Sales Only");
    expect(recommendationLabel("skip")).toBe("Skip");
  });
  it("formats a date range", () => expect(formatDateRange("2026-09-22", "2026-09-24")).toContain("Sep"));
});

describe("unknown ratings", () => {
  it("leaves unknown criteria out instead of counting them as zero", () => {
    // Only A (weight 75) is rated: score is A's rating alone, coverage 75%.
    expect(scoreSection(criteria, { a: 4, b: null }, "opportunity")).toEqual({ score: 80, coverage: 75, sufficient: true });
  });
  it("flags coverage below 50% as insufficient", () => {
    expect(scoreSection(criteria, { a: null, b: 5 }, "opportunity")).toEqual({ score: 100, coverage: 25, sufficient: false });
  });
  it("returns a null score when nothing is rated", () => {
    expect(scoreSection(criteria, { a: null, b: null }, "opportunity")).toEqual({ score: null, coverage: 0, sufficient: false });
  });
  it("ignores out-of-range values", () => expect(scoreSection(criteria, { a: 9, b: 5 }, "opportunity").coverage).toBe(25));
  it("labels scores with their coverage", () => {
    expect(scoreLabel(70, 100)).toBe("70.0");
    expect(scoreLabel(70, 55)).toBe("70.0 · 55% rated");
    expect(scoreLabel(70, 49.9)).toBe("Insufficient data");
    expect(scoreLabel(null, 0)).toBe("—");
  });
});

describe("past and upcoming events", () => {
  it("treats an event as past after its end date", () => {
    expect(isPastEvent({ starts_on: "2026-11-17", ends_on: "2026-11-19" }, "2026-11-20")).toBe(true);
    expect(isPastEvent({ starts_on: "2026-11-17", ends_on: "2026-11-20" }, "2026-11-20")).toBe(false);
    expect(isPastEvent({ starts_on: "2026-11-01", ends_on: null }, "2026-11-20")).toBe(true);
    expect(isPastEvent({ starts_on: null, ends_on: null }, "2026-11-20")).toBe(false);
  });
  it("maps participation to the matching recommendation", () => {
    expect(participationAsRecommendation("exhibited")).toBe("exhibit");
    expect(participationAsRecommendation("attended")).toBe("sales_only");
    expect(participationAsRecommendation("did_not_attend")).toBe("skip");
    expect(participationAsRecommendation("unknown")).toBeNull();
  });
});

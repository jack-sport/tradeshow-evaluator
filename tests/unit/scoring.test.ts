import { describe, expect, it } from "vitest";
import { calculateScore, formatDateRange, recommendationLabel } from "@/lib/scoring";
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

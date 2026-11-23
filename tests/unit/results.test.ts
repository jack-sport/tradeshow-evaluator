import { describe, expect, it } from "vitest";
import { formatRoi, goalProgress, resultMetrics } from "@/lib/results";

describe("post-show result metrics", () => {
  // JAXPORT's 2026 Breakbulk Americas post-show sheet: 4 staff, 16 show hours, 167 contacts, $23,164 total.
  const bba = resultMetrics({ staff_count: 4, show_hours: 16, contacts: 167, actual_cost: 23164 });
  it("matches the Breakbulk Americas sheet", () => {
    expect(bba.staffHours).toBe(64);
    expect(bba.interactionCapacity).toBe(192);
    expect(bba.capacityUtilization).toBeCloseTo(0.8698, 3);
    expect(bba.costPerContact).toBeCloseTo(138.71, 2);
    expect(bba.fieldCallSavings).toBeCloseTo(76368, 0);
    expect(bba.softDollarRoi).toBeCloseTo(3.297, 3);
  });
  // 2026 RILA sheet: 3 staff, 10 hours, 59 contacts, $19,416.30.
  it("matches the RILA sheet", () => {
    const rila = resultMetrics({ staff_count: 3, show_hours: 10, contacts: 59, actual_cost: 19416.3 });
    expect(rila.interactionCapacity).toBe(90);
    expect(rila.costPerContact).toBeCloseTo(329.09, 2);
    expect(rila.softDollarRoi).toBeCloseTo(0.811, 3);
  });
  it("returns nulls instead of invalid numbers when data is missing", () => {
    expect(resultMetrics({ staff_count: null, show_hours: null, contacts: 0, actual_cost: 5000 })).toMatchObject({
      interactionCapacity: null, capacityUtilization: null, costPerContact: null, softDollarRoi: null,
    });
  });
  it("calculates hard-dollar ROI like the sheets' Potential HD ROI", () => {
    const metrics = resultMetrics({ staff_count: 3, show_hours: 10, contacts: 59, actual_cost: 20000, lead_revenue_value: 50000 });
    expect(metrics.grossMargin).toBe(30000);
    expect(metrics.hardDollarRoi).toBe(1.5);
    expect(formatRoi(metrics.hardDollarRoi)).toBe("150%");
    expect(formatRoi(bba.softDollarRoi)).toBe("330%");
  });
  it("leaves hard-dollar ROI blank until the revenue value is entered (the RILA sheet shows -100%)", () => {
    const rila = resultMetrics({ staff_count: 3, show_hours: 10, contacts: 59, actual_cost: 19416.3 });
    expect(rila.hardDollarRoi).toBeNull();
    expect(rila.grossMargin).toBeNull();
    expect(resultMetrics({ staff_count: 3, show_hours: 10, contacts: 59, actual_cost: 19416.3, lead_revenue_value: 0 }).hardDollarRoi).toBe(-1);
  });
});

describe("goal vs. actual", () => {
  it("reports actual as a share of the goal", () => {
    expect(goalProgress(15, 12)).toEqual({ goal: 15, actual: 12, ratio: 0.8 });
    expect(goalProgress(10, 14).ratio).toBe(1.4);
  });
  it("has no ratio when the goal or actual is missing, or the goal is zero", () => {
    expect(goalProgress(null, 12)).toEqual({ goal: null, actual: 12, ratio: null });
    expect(goalProgress(15, null).ratio).toBeNull();
    expect(goalProgress(0, 5).ratio).toBeNull();
    expect(goalProgress(15, 0).ratio).toBe(0);
  });
});

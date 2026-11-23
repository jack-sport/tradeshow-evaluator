import { describe, expect, it } from "vitest";
import { budgetImpact, scenarioShows } from "@/lib/budget";
import type { BudgetSettings } from "@/lib/costs";
import type { Evaluation, Event, EventResults } from "@/lib/types";

const settings: BudgetSettings = {
  fiscal_year: 2027,
  allocation: { travel: 5000, fees: 3000, exhibit: 2000, sponsorship: 0, entertainment: 500 },
  staff: { sales_people: 7, marketing_people: 1, show_days_per_person: 100 },
  rates: {
    travel_per_person: { local: 0, florida: 1000, southeast: 1500, gulf: 1500, midwest: 1500, northeast: 2000, west: 3000, caribbean: 2000, latam: 4000, europe: 4000, asia: 5000, international: 6000 },
    travel_days: { local: 0, florida: 1, southeast: 1, gulf: 1, midwest: 1, northeast: 1, west: 2, caribbean: 2, latam: 2, europe: 2, asia: 3, international: 2 },
    default_people: { sales_only: 1, exhibit: 2 },
    exhibit_defaults: { tabletop: { space: 2000, shipping_setup: 500 }, booth: { space: 7000, shipping_setup: 6000 } },
    unknown_registration_per_person: 1000,
    entertainment_per_show: 100,
  },
};
const event = (id: string, starts_on: string, participation: Event["participation"], extra: Partial<Event> = {}): Event => ({
  id, name: `Show ${id}`, location: null, starts_on, ends_on: starts_on, event_tier: "regional", status: "active", exhibit_cost: null,
  sales_only_cost: null, high_value_targets: null, notes: null, participation, region: "florida", exhibit_kind: "tabletop", ...extra,
});
const evaluation = (event_id: string, recommendation: Evaluation["recommendation"], score = 60): Evaluation => ({
  id: `e-${event_id}`, event_id, evaluator_id: "x", status: "draft", recommendation, comments: null, opportunity_score: score, exhibit_score: score - 10, submitted_at: null, updated_at: "2026-01-01",
});
const events = [event("past", "2026-11-01", "exhibited"), event("a", "2027-03-01", "attended"), event("b", "2027-03-01", "exhibited"), event("c", "2027-04-01", "unknown")];
const results: EventResults[] = [{ event_id: "past", participation: "exhibited", staff_count: 3, show_hours: 10, contacts: 50, meetings: 5, qualified_leads: null, opportunities: null, actual_cost: 9000, notes: null }];
const ai = [evaluation("past", "skip"), evaluation("a", "exhibit", 80), evaluation("b", "skip"), evaluation("c", "sales_only")];
const TODAY = "2026-11-24";

describe("scenarios", () => {
  it("keeps past shows as they happened and follows the scenario for upcoming ones", () => {
    const plan = scenarioShows(events, results, ai, [], "plan", TODAY);
    expect(plan.map((show) => show.option)).toEqual(["exhibit", "sales_only", "exhibit", "undecided"]);
    expect(plan[0]).toMatchObject({ past: true, actualCost: 9000, value: 60 });
    const aiPlan = scenarioShows(events, results, ai, [], "ai", TODAY);
    expect(aiPlan.map((show) => show.option)).toEqual(["exhibit", "exhibit", null, "sales_only"]);
    const mine = scenarioShows(events, results, ai, [evaluation("b", "sales_only")], "mine", TODAY);
    expect(mine.map((show) => show.option)).toEqual(["exhibit", "undecided", "sales_only", "undecided"]);
  });
});

describe("budget impact on a show page", () => {
  const shows = scenarioShows(events, results, ai, [], "plan", TODAY);
  it("shows what each option leaves of the allocation and flags marketing overlaps", () => {
    const impact = budgetImpact("a", shows, settings)!;
    expect(impact.option).toBe("sales_only");
    expect(impact.thisCost).toBe(1000 + 1000 + 100);
    expect(impact.ifSalesOnly.remaining).toBe(impact.allocated - impact.planned);
    expect(impact.ifExhibit!.cost).toBeGreaterThan(impact.ifSalesOnly.cost);
    expect(impact.overlappingExhibits).toEqual(["Show b"]);
  });
  it("treats an undecided show as not yet in the plan", () => {
    const impact = budgetImpact("c", shows, settings)!;
    expect(impact.thisCost).toBeNull();
    expect(impact.ifSalesOnly.remaining).toBe(impact.allocated - impact.planned - impact.ifSalesOnly.cost);
  });
});

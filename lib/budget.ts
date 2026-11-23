import { estimate, rollup, type BudgetSettings, type Option, type PortfolioShow } from "./costs";
import { isPastEvent } from "./scoring";
import type { Evaluation, Event, EventResults, Recommendation } from "./types";

export type Scenario = "plan" | "ai" | "mine";
export const SCENARIOS: Array<[Scenario, string, string]> = [
  ["plan", "Current plan", "What JAXPORT plans per the events workbook (Exhibited / Attended / Did not attend)."],
  ["ai", "AI recommendations", "Every upcoming show as the AI draft recommends."],
  ["mine", "Your recommendations", "Every upcoming show as you recommended in your own assessments."],
];

const fromRecommendation = (rec: Recommendation | null | undefined): Option | null | "undecided" =>
  rec === "exhibit" ? "exhibit" : rec === "sales_only" ? "sales_only" : rec === "skip" ? null : "undecided";
const fromParticipation = (value: Event["participation"]): Option | null | "undecided" =>
  value === "exhibited" ? "exhibit" : value === "attended" ? "sales_only" : value === "did_not_attend" ? null : "undecided";

/**
 * The shows of one scenario. Past shows always count as what actually happened (and their actual cost
 * when recorded); upcoming shows follow the scenario. Cut-first ranking uses the AI scores, which exist
 * for every show.
 */
export function scenarioShows(
  events: Event[], results: EventResults[], ai: Evaluation[], own: Evaluation[], scenario: Scenario, today: string,
): PortfolioShow[] {
  const resultMap = new Map(results.map((row) => [row.event_id, row]));
  const aiMap = new Map(ai.map((row) => [row.event_id, row]));
  const ownMap = new Map(own.map((row) => [row.event_id, row]));
  return events.map((event) => {
    const past = isPastEvent(event, today);
    const result = resultMap.get(event.id);
    const aiEval = aiMap.get(event.id);
    const happened = fromParticipation(result?.participation && result.participation !== "unknown" ? result.participation : event.participation);
    const option = past ? happened
      : scenario === "plan" ? fromParticipation(event.participation)
      : scenario === "ai" ? fromRecommendation(aiEval?.recommendation)
      : fromRecommendation(ownMap.get(event.id)?.recommendation);
    return {
      ...event,
      past,
      option,
      actualCost: result?.actual_cost === null || result?.actual_cost === undefined ? null : Number(result.actual_cost),
      value: aiEval?.opportunity_score === null || aiEval?.opportunity_score === undefined ? null : Number(aiEval.opportunity_score),
      exhibitValue: aiEval?.exhibit_score === null || aiEval?.exhibit_score === undefined ? null : Number(aiEval.exhibit_score),
    };
  });
}

export interface BudgetImpact {
  fiscalYear: number;
  allocated: number;
  planned: number;
  /** This show's cost in the current plan (0 if not going, null if undecided). */
  thisCost: number | null;
  option: Option | null | "undecided";
  /** Cost of each option for this show, and how far the year would be from its allocation with it. */
  ifSalesOnly: { cost: number; remaining: number };
  ifExhibit: { cost: number; remaining: number } | null;
  salesDaysLeft: number;
  marketingDaysLeft: number;
  /** Other exhibit shows in the plan whose dates overlap this one (the marketing traveler can't do both). */
  overlappingExhibits: string[];
}

/** How one show's options sit against the fiscal year's current plan. */
export function budgetImpact(showId: string, shows: PortfolioShow[], settings: BudgetSettings): BudgetImpact | null {
  const show = shows.find((item) => item.id === showId);
  if (!show) return null;
  const plan = rollup(shows, settings);
  const line = plan.shows.find((item) => item.show.id === showId);
  const thisCost = line ? line.cost : show.option === "undecided" ? null : 0;
  const others = plan.planned - (thisCost ?? 0);
  const sales = estimate(show, settings, "sales_only");
  const exhibit = show.exhibit_kind === "none" ? null : estimate(show, settings, "exhibit");
  const overlaps = (other: PortfolioShow) => {
    if (!show.starts_on || !other.starts_on) return false;
    const end = (item: PortfolioShow) => item.ends_on || item.starts_on!;
    return other.starts_on <= end(show) && show.starts_on <= end(other);
  };
  return {
    fiscalYear: settings.fiscal_year,
    allocated: plan.allocated,
    planned: plan.planned,
    thisCost,
    option: show.option,
    ifSalesOnly: { cost: sales.total, remaining: plan.allocated - others - sales.total },
    ifExhibit: exhibit ? { cost: exhibit.total, remaining: plan.allocated - others - exhibit.total } : null,
    salesDaysLeft: plan.staff.salesCapacity - plan.staff.salesDays,
    marketingDaysLeft: plan.staff.marketingCapacity - plan.staff.marketingDays,
    overlappingExhibits: plan.shows.filter((item) => item.show.id !== showId && item.show.option === "exhibit" && overlaps(item.show)).map((item) => item.show.name),
  };
}

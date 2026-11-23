import type { EventResults } from "./types";

/**
 * Average cost of a North America B2B field sales call (Center for Exhibition Industry Research),
 * as used in JAXPORT's post-show metrics sheets.
 */
export const FIELD_SALES_CALL_COST = 596;

/** Conservative interactions per hour per staffer (the sheets use 3 / 4 / 5 for conservative / moderate / aggressive). */
export const INTERACTIONS_PER_STAFF_HOUR = 3;

export interface ResultMetrics {
  staffHours: number | null;
  interactionCapacity: number | null;
  /** contacts ÷ capacity, 0-1+ */
  capacityUtilization: number | null;
  costPerContact: number | null;
  /** (field call cost − cost per contact) × contacts ÷ total cost: savings vs. visiting each contact individually. */
  softDollarRoi: number | null;
  /** Total savings in dollars vs. field sales calls. */
  fieldCallSavings: number | null;
  /** Potential revenue value of leads − total cost (the sheets' "Potential Gross Margin"). */
  grossMargin: number | null;
  /** Gross margin ÷ total cost (the sheets' "Potential HD ROI"). */
  hardDollarRoi: number | null;
}

const has = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && !Number.isNaN(Number(value));

type MetricInputs = Pick<EventResults, "staff_count" | "show_hours" | "contacts" | "actual_cost"> & Partial<Pick<EventResults, "lead_revenue_value">>;

export function resultMetrics(results: MetricInputs): ResultMetrics {
  const staff = has(results.staff_count) ? Number(results.staff_count) : null;
  const hours = has(results.show_hours) ? Number(results.show_hours) : null;
  const contacts = has(results.contacts) ? Number(results.contacts) : null;
  const cost = has(results.actual_cost) ? Number(results.actual_cost) : null;
  const revenue = has(results.lead_revenue_value) ? Number(results.lead_revenue_value) : null;
  const staffHours = staff !== null && hours !== null ? staff * hours : null;
  const interactionCapacity = staffHours !== null ? staffHours * INTERACTIONS_PER_STAFF_HOUR : null;
  const capacityUtilization = interactionCapacity && contacts !== null ? contacts / interactionCapacity : null;
  const costPerContact = cost !== null && contacts ? cost / contacts : null;
  const fieldCallSavings = costPerContact !== null && contacts !== null ? (FIELD_SALES_CALL_COST - costPerContact) * contacts : null;
  const softDollarRoi = fieldCallSavings !== null && cost ? fieldCallSavings / cost : null;
  // Left blank (not zero) until the revenue value is entered, so an empty field never shows −100%.
  const grossMargin = revenue !== null && cost !== null ? revenue - cost : null;
  const hardDollarRoi = grossMargin !== null && cost ? grossMargin / cost : null;
  return { staffHours, interactionCapacity, capacityUtilization, costPerContact, softDollarRoi, fieldCallSavings, grossMargin, hardDollarRoi };
}

export interface GoalProgress {
  goal: number | null;
  actual: number | null;
  /** actual ÷ goal (1 = goal met), or null when either side is missing or the goal is 0. */
  ratio: number | null;
}

/** Compare a pre-show goal with the post-show actual. */
export function goalProgress(goal: number | null | undefined, actual: number | null | undefined): GoalProgress {
  const g = has(goal) ? Number(goal) : null;
  const a = has(actual) ? Number(actual) : null;
  return { goal: g, actual: a, ratio: g && a !== null ? a / g : null };
}

/** ROI as a whole percentage, matching the sheets' format: 3.297 → "330%". */
export function formatRoi(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100).toLocaleString()}%`;
}

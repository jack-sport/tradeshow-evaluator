import { goalProgress, resultMetrics } from "./results";
import { PARTICIPATION_LABELS, isPastEvent, participationAsRecommendation, recommendationLabel } from "./scoring";
import type { Evaluation, Event, EventResults, Participation, Recommendation } from "./types";

/** One show on the dashboard: everything the cards, the table and the spreadsheet download need. */
export interface PortfolioRow {
  id: string;
  name: string;
  location: string | null;
  starts_on: string | null;
  ends_on: string | null;
  tier: Event["event_tier"];
  tierProvisional: boolean;
  past: boolean;
  participation: Participation;
  aiRecommendation: Recommendation | null;
  aiScore: number | null;
  aiCoverage: number | null;
  /** Past shows: did the AI's recommendation match what JAXPORT did? null when either is unknown. */
  aiMatch: boolean | null;
  myStatus: MyStatus;
  myRecommendation: Recommendation | null;
  myOpportunity: number | null;
  myOpportunityCoverage: number | null;
  myExhibit: number | null;
  myExhibitCoverage: number | null;
  exhibitCost: number | null;
  salesOnlyCost: number | null;
  /** Estimated cost of the current plan: exhibit cost if exhibiting, sales-only cost if attending, 0 if not going. */
  planCost: number | null;
  meetingGoal: number | null;
  contactGoal: number | null;
  hasResults: boolean;
  meetings: number | null;
  contacts: number | null;
  actualCost: number | null;
  costPerContact: number | null;
  hardDollarRoi: number | null;
  softDollarRoi: number | null;
  /** met: every goal with an actual was reached; missed: at least one was not; null: nothing to compare. */
  goalOutcome: "met" | "missed" | null;
}

export type MyStatus = "not_started" | "draft" | "submitted";
export const MY_STATUS_LABELS: Record<MyStatus, string> = { not_started: "Not started", draft: "Draft", submitted: "Submitted" };

const num = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" || Number.isNaN(Number(value)) ? null : Number(value);

/** Only the viewer's own evaluation and the AI's are used: peer scores stay locked, as on the show page. */
export function buildRows(events: Event[], own: Evaluation[], ai: Evaluation[], results: EventResults[], today: string): PortfolioRow[] {
  const ownMap = new Map(own.map((item) => [item.event_id, item]));
  const aiMap = new Map(ai.map((item) => [item.event_id, item]));
  const resultMap = new Map(results.map((item) => [item.event_id, item]));
  return events.map((event) => {
    const mine = ownMap.get(event.id);
    const aiEval = aiMap.get(event.id);
    const result = resultMap.get(event.id);
    const metrics = result ? resultMetrics(result) : null;
    const past = isPastEvent(event, today);
    const actual = participationAsRecommendation(event.participation);
    const aiRecommendation = aiEval?.recommendation || null;
    const goals = [goalProgress(event.meeting_goal, result?.meetings), goalProgress(event.contact_goal, result?.contacts)]
      .filter((goal) => goal.ratio !== null);
    return {
      id: event.id,
      name: event.name,
      location: event.location,
      starts_on: event.starts_on,
      ends_on: event.ends_on,
      tier: event.event_tier,
      tierProvisional: Boolean(event.tier_provisional),
      past,
      participation: event.participation || "unknown",
      aiRecommendation,
      aiScore: num(aiEval?.opportunity_score),
      aiCoverage: num(aiEval?.opportunity_coverage),
      aiMatch: past && actual && aiRecommendation ? actual === aiRecommendation : null,
      myStatus: mine?.status === "submitted" ? "submitted" : mine ? "draft" : "not_started",
      myRecommendation: mine?.recommendation || null,
      myOpportunity: num(mine?.opportunity_score),
      myOpportunityCoverage: num(mine?.opportunity_coverage),
      myExhibit: num(mine?.exhibit_score),
      myExhibitCoverage: num(mine?.exhibit_coverage),
      exhibitCost: num(event.exhibit_cost),
      salesOnlyCost: num(event.sales_only_cost),
      planCost: event.participation === "exhibited" ? num(event.exhibit_cost) : event.participation === "attended" ? num(event.sales_only_cost) : event.participation === "did_not_attend" ? 0 : null,
      meetingGoal: num(event.meeting_goal),
      contactGoal: num(event.contact_goal),
      hasResults: Boolean(result),
      meetings: num(result?.meetings),
      contacts: num(result?.contacts),
      actualCost: num(result?.actual_cost),
      costPerContact: metrics?.costPerContact ?? null,
      hardDollarRoi: metrics?.hardDollarRoi ?? null,
      softDollarRoi: metrics?.softDollarRoi ?? null,
      goalOutcome: goals.length === 0 ? null : goals.every((goal) => (goal.ratio as number) >= 1) ? "met" : "missed",
    };
  });
}

// ---- Filters (kept in the page address so a view can be bookmarked or shared) ----

export interface PortfolioFilters {
  q: string;
  when: "all" | "upcoming" | "past";
  tier: "all" | Event["event_tier"];
  participation: "all" | Participation;
  ai: "all" | Recommendation | "none";
  mine: "all" | Recommendation | "none";
  status: "all" | MyStatus;
  results: "all" | "has_results" | "no_results" | "goal_met" | "goal_missed";
}

export type ViewMode = "cards" | "table";
export type SortDirection = "asc" | "desc";
export interface PortfolioState extends PortfolioFilters {
  view: ViewMode;
  sort: string | null;
  dir: SortDirection;
}

export const DEFAULT_STATE: PortfolioState = {
  q: "", when: "all", tier: "all", participation: "all", ai: "all", mine: "all", status: "all", results: "all",
  view: "table", sort: null, dir: "asc",
};

const RECOMMENDATION_VALUES = ["exhibit", "sales_only", "skip", "none"];
const ALLOWED: Record<keyof Omit<PortfolioState, "q" | "sort">, string[]> = {
  when: ["upcoming", "past"],
  tier: ["major", "regional", "other"],
  participation: ["exhibited", "attended", "did_not_attend", "unknown"],
  ai: RECOMMENDATION_VALUES,
  mine: RECOMMENDATION_VALUES,
  status: ["not_started", "draft", "submitted"],
  results: ["has_results", "no_results", "goal_met", "goal_missed"],
  view: ["cards"],
  dir: ["desc"],
};

/** Read the state from the page address, ignoring anything unexpected. */
export function parseState(params: Record<string, string | string[] | undefined>): PortfolioState {
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const state: PortfolioState = { ...DEFAULT_STATE, q: (get("q") || "").slice(0, 100) };
  for (const [key, allowed] of Object.entries(ALLOWED)) {
    const value = get(key);
    if (value && allowed.includes(value)) (state as unknown as Record<string, string>)[key] = value;
  }
  const sort = get("sort");
  if (sort && COLUMN_KEYS.has(sort)) state.sort = sort;
  return state;
}

/** The page address for a state: only values that differ from the defaults. */
export function stateToQuery(state: PortfolioState): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value !== null && value !== DEFAULT_STATE[key as keyof PortfolioState] && String(value).trim() !== "") params.set(key, String(value).trim());
  }
  if (!state.sort) params.delete("dir");
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function activeFilterCount(state: PortfolioFilters) {
  return (["when", "tier", "participation", "ai", "mine", "status", "results"] as const)
    .filter((key) => state[key] !== "all").length + (state.q.trim() ? 1 : 0);
}

export function filterRows(rows: PortfolioRow[], filters: PortfolioFilters): PortfolioRow[] {
  const words = filters.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (words.length) {
      const haystack = `${row.name} ${row.location || ""}`.toLowerCase();
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    if (filters.when === "upcoming" && row.past) return false;
    if (filters.when === "past" && !row.past) return false;
    if (filters.tier !== "all" && row.tier !== filters.tier) return false;
    if (filters.participation !== "all" && row.participation !== filters.participation) return false;
    if (filters.ai !== "all" && (row.aiRecommendation || "none") !== filters.ai) return false;
    if (filters.mine !== "all" && (row.myRecommendation || "none") !== filters.mine) return false;
    if (filters.status !== "all" && row.myStatus !== filters.status) return false;
    if (filters.results === "has_results" && !row.hasResults) return false;
    if (filters.results === "no_results" && row.hasResults) return false;
    if (filters.results === "goal_met" && row.goalOutcome !== "met") return false;
    if (filters.results === "goal_missed" && row.goalOutcome !== "missed") return false;
    return true;
  });
}

// ---- Columns ----

export interface Column {
  key: string;
  label: string;
  /** The value sorted on; null/undefined always sorts last. */
  sortValue: (row: PortfolioRow) => string | number | null;
  numeric?: boolean;
  /** Always shown; can't be hidden with the column picker. */
  locked?: boolean;
  /** One-line explanation shown as a tooltip on the column heading. */
  description?: string;
}

const describe = (item: Column, description: string): Column => ({ ...item, description });

const TIER_ORDER: Record<string, number> = { major: 0, regional: 1, other: 2 };
const RECOMMENDATION_ORDER: Record<string, number> = { exhibit: 0, sales_only: 1, skip: 2 };
const PARTICIPATION_ORDER: Record<string, number> = { exhibited: 0, attended: 1, did_not_attend: 2, unknown: 3 };
const STATUS_ORDER: Record<MyStatus, number> = { submitted: 0, draft: 1, not_started: 2 };

const column = (key: string, label: string, sortValue: Column["sortValue"], numeric = false): Column => ({ key, label, sortValue, numeric });
const show: Column = { ...column("name", "Show", (row) => row.name.toLowerCase()), locked: true };
const dates = column("date", "Dates", (row) => row.starts_on);
const location = column("location", "Location", (row) => row.location?.toLowerCase() || null);
const tier = column("tier", "Tier", (row) => TIER_ORDER[row.tier]);
const ai = describe(column("ai", "AI recommendation", (row) => (row.aiRecommendation ? RECOMMENDATION_ORDER[row.aiRecommendation] : null)),
  "The AI evaluator's draft call: Exhibit + Sales, Sales Only or Skip.");

/** Planning columns for upcoming shows. */
export const UPCOMING_COLUMNS: Column[] = [
  show, dates, location, tier,
  column("participation", "Plan", (row) => PARTICIPATION_ORDER[row.participation]),
  ai,
  describe(column("ai_score", "AI opportunity score", (row) => row.aiScore, true),
    "The AI's 0–100 score from its weighted ratings on the 15 opportunity criteria."),
  describe(column("ai_coverage", "AI % rated", (row) => row.aiCoverage, true),
    "Share of the criteria weight the AI could rate; the rest was marked Unknown. Under 50% is flagged as low."),
  column("mine", "Your recommendation", (row) => (row.myRecommendation ? RECOMMENDATION_ORDER[row.myRecommendation] : null)),
  column("my_opportunity", "Your opportunity score", (row) => row.myOpportunity, true),
  column("my_coverage", "Your % rated", (row) => row.myOpportunityCoverage, true),
  column("my_exhibit", "Your exhibit value score", (row) => row.myExhibit, true),
  column("status", "Your status", (row) => STATUS_ORDER[row.myStatus]),
  column("exhibit_cost", "Exhibit cost", (row) => row.exhibitCost, true),
  column("sales_cost", "Sales-only cost", (row) => row.salesOnlyCost, true),
  describe(column("plan_cost", "Plan cost", (row) => row.planCost, true),
    "Estimated cost of the current plan: the exhibit cost if exhibiting, the sales-only cost if attending, $0 if not going."),
  column("meeting_goal", "Meeting goal", (row) => row.meetingGoal, true),
  column("contact_goal", "Contact goal", (row) => row.contactGoal, true),
];

/** Results columns for past shows. */
export const PAST_COLUMNS: Column[] = [
  show, dates, tier,
  column("participation", "JAXPORT did", (row) => PARTICIPATION_ORDER[row.participation]),
  ai,
  describe(column("ai_match", "AI matched?", (row) => (row.aiMatch === null ? null : row.aiMatch ? 0 : 1)),
    "Whether the AI's recommendation matches what JAXPORT actually did at this show."),
  column("meetings", "Meetings / goal", (row) => row.meetings, true),
  column("contacts", "Contacts / goal", (row) => row.contacts, true),
  column("actual_cost", "Actual cost", (row) => row.actualCost, true),
  column("cost_per_contact", "Cost per contact", (row) => row.costPerContact, true),
  column("hard_roi", "Hard-dollar ROI", (row) => row.hardDollarRoi, true),
  column("soft_roi", "Soft-dollar ROI", (row) => row.softDollarRoi, true),
];

const COLUMN_KEYS = new Set([...UPCOMING_COLUMNS, ...PAST_COLUMNS].map((item) => item.key));

/** The columns to show, given the keys the viewer has hidden (locked columns always show). */
export function visibleColumns(columns: Column[], hidden: string[]): Column[] {
  return columns.filter((item) => item.locked || !hidden.includes(item.key));
}

/**
 * Sort by a column; rows without a value always go last. With no sort (or a column this table
 * lacks), the default order applies: upcoming soonest first, past most recent first.
 */
export function sortRows(rows: PortfolioRow[], columns: Column[], sort: string | null, dir: SortDirection, past: boolean): PortfolioRow[] {
  const selected = columns.find((item) => item.key === sort);
  const byDate = (a: PortfolioRow, b: PortfolioRow) => {
    const left = a.starts_on || "9999";
    const right = b.starts_on || "9999";
    return (left < right ? -1 : left > right ? 1 : a.name.localeCompare(b.name)) * (past ? -1 : 1);
  };
  if (!selected) return [...rows].sort(byDate);
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = selected.sortValue(a);
    const right = selected.sortValue(b);
    if (left === null || left === undefined) return right === null || right === undefined ? byDate(a, b) : 1;
    if (right === null || right === undefined) return -1;
    if (left < right) return -sign;
    if (left > right) return sign;
    return byDate(a, b);
  });
}

// ---- Spreadsheet download ----

const roiPercent = (value: number | null) => (value === null ? null : Math.round(value * 100));
const dollars = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);

const CSV_COLUMNS: Array<[string, (row: PortfolioRow) => string | number | null]> = [
  ["Show", (row) => row.name],
  ["Start date", (row) => row.starts_on],
  ["End date", (row) => row.ends_on],
  ["Location", (row) => row.location],
  ["Upcoming or past", (row) => (row.past ? "Past" : "Upcoming")],
  ["Tier", (row) => `${row.tier}${row.tierProvisional ? " (provisional)" : ""}`],
  ["Plan / JAXPORT did", (row) => PARTICIPATION_LABELS[row.participation]],
  ["AI recommendation", (row) => (row.aiRecommendation ? recommendationLabel(row.aiRecommendation) : null)],
  ["AI opportunity score", (row) => row.aiScore],
  ["AI % rated", (row) => row.aiCoverage],
  ["AI matched what JAXPORT did", (row) => (row.aiMatch === null ? null : row.aiMatch ? "Yes" : "No")],
  ["Your status", (row) => MY_STATUS_LABELS[row.myStatus]],
  ["Your recommendation", (row) => (row.myRecommendation ? recommendationLabel(row.myRecommendation) : null)],
  ["Your opportunity score", (row) => row.myOpportunity],
  ["Your % rated", (row) => row.myOpportunityCoverage],
  ["Your exhibit value score", (row) => row.myExhibit],
  ["Exhibit cost ($)", (row) => row.exhibitCost],
  ["Sales-only cost ($)", (row) => row.salesOnlyCost],
  ["Plan cost ($)", (row) => row.planCost],
  ["Meeting goal", (row) => row.meetingGoal],
  ["Meetings held", (row) => row.meetings],
  ["Contact goal", (row) => row.contactGoal],
  ["Contacts", (row) => row.contacts],
  ["Goals", (row) => (row.goalOutcome === "met" ? "Met" : row.goalOutcome === "missed" ? "Missed" : null)],
  ["Actual cost ($)", (row) => dollars(row.actualCost)],
  ["Cost per contact ($)", (row) => dollars(row.costPerContact)],
  ["Hard-dollar ROI (%)", (row) => roiPercent(row.hardDollarRoi)],
  ["Soft-dollar ROI (%)", (row) => roiPercent(row.softDollarRoi)],
];

function csvCell(value: string | number | null) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Quote anything with separators, and neutralize leading formula characters so Excel shows text, not a formula.
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value === "string" ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV for the given rows (already filtered and sorted), with a byte-order mark so Excel reads it as UTF-8. */
export function toCsv(rows: PortfolioRow[]): string {
  const lines = [CSV_COLUMNS.map(([label]) => csvCell(label)).join(",")];
  for (const row of rows) lines.push(CSV_COLUMNS.map(([, value]) => csvCell(value(row))).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

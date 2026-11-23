import type { Criterion, CriterionSection } from "./types";

export const RATING_LABELS: Record<number, string> = {
  1: "Very weak",
  2: "Weak",
  3: "Moderate",
  4: "Strong",
  5: "Exceptional",
};

/** Scores below this share of rated weight are labeled "Insufficient data". */
export const INSUFFICIENT_COVERAGE = 50;

/** A criterion's rating: 1-5, or null/undefined when unknown or unanswered. */
export type Ratings = Record<string, number | null | undefined>;

export interface SectionScore {
  /** 0-100 over the rated criteria only, or null when nothing was rated. */
  score: number | null;
  /** Share (0-100) of the section's weight that was rated. */
  coverage: number;
  /** False when coverage is below INSUFFICIENT_COVERAGE. */
  sufficient: boolean;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const isRating = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

export function scoreSection(criteria: Criterion[], ratings: Ratings, section: CriterionSection): SectionScore {
  const selected = criteria.filter((criterion) => criterion.section === section);
  const totalWeight = selected.reduce((sum, criterion) => sum + Number(criterion.weight), 0);
  const rated = selected.filter((criterion) => isRating(ratings[criterion.id]));
  const ratedWeight = rated.reduce((sum, criterion) => sum + Number(criterion.weight), 0);
  const weighted = rated.reduce((sum, criterion) => sum + (ratings[criterion.id] as number) * Number(criterion.weight), 0);
  const coverage = totalWeight ? round1((ratedWeight / totalWeight) * 100) : 0;
  return {
    score: ratedWeight ? round1((weighted / (5 * ratedWeight)) * 100) : null,
    coverage,
    sufficient: coverage >= INSUFFICIENT_COVERAGE,
  };
}

/** Score over rated criteria only (unknown ratings are left out, not counted as zero). */
export function calculateScore(criteria: Criterion[], ratings: Ratings, section: CriterionSection) {
  return scoreSection(criteria, ratings, section).score ?? 0;
}

/** "68.0", "68.0 · 55% rated", or "Insufficient data" for display. */
export function scoreLabel(score: number | null | undefined, coverage: number | null | undefined) {
  if (score === null || score === undefined) return "—";
  if (coverage === null || coverage === undefined || coverage >= 100) return Number(score).toFixed(1);
  if (coverage < INSUFFICIENT_COVERAGE) return "Insufficient data";
  return `${Number(score).toFixed(1)} · ${Math.round(coverage)}% rated`;
}

export function recommendationLabel(value: string | null) {
  if (value === "exhibit") return "Exhibit + Sales";
  if (value === "sales_only") return "Sales Only";
  if (value === "skip") return "Skip";
  return "Not selected";
}

export const PARTICIPATION_LABELS: Record<string, string> = {
  exhibited: "Exhibited",
  attended: "Attended (sales only)",
  did_not_attend: "Did not attend",
  unknown: "Unknown",
};

/** The recommendation that matches what JAXPORT did, for baseline comparisons. */
export function participationAsRecommendation(value: string | null | undefined) {
  if (value === "exhibited") return "exhibit";
  if (value === "attended") return "sales_only";
  if (value === "did_not_attend") return "skip";
  return null;
}

/** An event is past once its end date (or start date) is before today; undated events are upcoming. */
export function isPastEvent(event: { starts_on: string | null; ends_on: string | null }, today: string) {
  const last = event.ends_on || event.starts_on;
  return Boolean(last && last < today);
}

/** Today's date as YYYY-MM-DD in Eastern time (JAXPORT's time zone). */
export function todayIso(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

export function formatMoney(value: number | null | undefined) {
  return value === null || value === undefined ? "Not estimated" : `$${Math.round(Number(value)).toLocaleString()}`;
}

export function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "Date not set";
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const startDate = new Date(`${start}T12:00:00`);
  if (!end || end === start) return startDate.toLocaleDateString("en-US", options);
  const endDate = new Date(`${end}T12:00:00`);
  return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${endDate.toLocaleDateString("en-US", options)}`;
}

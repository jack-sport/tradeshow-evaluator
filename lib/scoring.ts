import type { Criterion, CriterionSection } from "./types";

export const RATING_LABELS: Record<number, string> = {
  1: "Very weak",
  2: "Weak",
  3: "Moderate",
  4: "Strong",
  5: "Exceptional",
};

export function calculateScore(
  criteria: Criterion[],
  ratings: Record<string, number>,
  section: CriterionSection,
) {
  const selected = criteria.filter((criterion) => criterion.section === section);
  const weighted = selected.reduce(
    (sum, criterion) => sum + (ratings[criterion.id] || 0) * criterion.weight,
    0,
  );
  const totalWeight = selected.reduce((sum, criterion) => sum + criterion.weight, 0);
  return totalWeight ? Math.round((weighted / (5 * totalWeight)) * 1000) / 10 : 0;
}

export function recommendationLabel(value: string | null) {
  if (value === "exhibit") return "Exhibit + Sales";
  if (value === "sales_only") return "Sales Only";
  if (value === "skip") return "Skip";
  return "Not selected";
}

export function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "Date not set";
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const startDate = new Date(`${start}T12:00:00`);
  if (!end || end === start) return startDate.toLocaleDateString("en-US", options);
  const endDate = new Date(`${end}T12:00:00`);
  return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${endDate.toLocaleDateString("en-US", options)}`;
}

import type { PeerEvaluation } from "./types";

export function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number");
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

export function buildComparison(evaluations: PeerEvaluation[]) {
  const opportunityValues = evaluations.map((item) => item.opportunity_score);
  const numericOpportunity = opportunityValues.filter((value): value is number => typeof value === "number");
  return {
    opportunity: average(opportunityValues),
    exhibit: average(evaluations.map((item) => item.exhibit_score)),
    spread: numericOpportunity.length
      ? Math.max(...numericOpportunity) - Math.min(...numericOpportunity)
      : 0,
    recommendations: ["exhibit", "sales_only", "skip"].map((value) => ({
      value,
      count: evaluations.filter((item) => item.recommendation === value).length,
    })),
  };
}

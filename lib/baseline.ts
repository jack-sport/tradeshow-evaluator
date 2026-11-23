import { INSUFFICIENT_COVERAGE, isPastEvent, participationAsRecommendation } from "./scoring";
import type { Evaluation, Event, Recommendation } from "./types";

export const RECOMMENDATIONS: Recommendation[] = ["exhibit", "sales_only", "skip"];

export interface BaselineRow {
  event: Event;
  evaluation: Evaluation | null;
  /** What JAXPORT did, expressed as a recommendation; null when unknown. */
  actual: Recommendation | null;
  /** true/false when both sides are known, null otherwise. */
  match: boolean | null;
  /** The evaluation rests on less than INSUFFICIENT_COVERAGE of the opportunity weight. */
  lowData: boolean;
}

export interface BaselineSummary {
  rows: BaselineRow[];
  compared: number;
  matches: number;
  /** Same counts limited to evaluations with sufficient data. */
  comparedSufficient: number;
  matchesSufficient: number;
  /** matrix[actual][recommended] = count */
  matrix: Record<Recommendation, Record<Recommendation, number>>;
  missingEvaluation: number;
  unknownParticipation: number;
}

/** Compare one evaluator's recommendations (e.g. the AI) with what JAXPORT did at past events. */
export function buildBaseline(events: Event[], evaluations: Evaluation[], today: string): BaselineSummary {
  const byEvent = new Map(evaluations.map((evaluation) => [evaluation.event_id, evaluation]));
  const matrix = Object.fromEntries(
    RECOMMENDATIONS.map((actual) => [actual, Object.fromEntries(RECOMMENDATIONS.map((rec) => [rec, 0]))]),
  ) as BaselineSummary["matrix"];
  const rows: BaselineRow[] = events
    .filter((event) => isPastEvent(event, today))
    .map((event) => {
      const evaluation = byEvent.get(event.id) || null;
      const actual = participationAsRecommendation(event.participation) as Recommendation | null;
      const recommended = evaluation?.recommendation || null;
      const match = actual && recommended ? actual === recommended : null;
      const coverage = evaluation?.opportunity_coverage;
      const lowData = Boolean(evaluation && typeof coverage === "number" && coverage < INSUFFICIENT_COVERAGE);
      if (actual && recommended) matrix[actual][recommended] += 1;
      return { event, evaluation, actual, match, lowData };
    });
  const comparedRows = rows.filter((row) => row.match !== null);
  const sufficientRows = comparedRows.filter((row) => !row.lowData);
  return {
    rows,
    compared: comparedRows.length,
    matches: comparedRows.filter((row) => row.match).length,
    comparedSufficient: sufficientRows.length,
    matchesSufficient: sufficientRows.filter((row) => row.match).length,
    matrix,
    missingEvaluation: rows.filter((row) => !row.evaluation?.recommendation).length,
    unknownParticipation: rows.filter((row) => !row.actual).length,
  };
}

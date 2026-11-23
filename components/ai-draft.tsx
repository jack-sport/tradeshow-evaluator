import { Bot } from "lucide-react";
import { RATING_LABELS, recommendationLabel, scoreLabel } from "@/lib/scoring";
import type { Criterion, Evaluation, ResponseRow } from "@/lib/types";

/** Read-only view of the AI evaluator's draft. It doesn't count toward team results. */
export function AiDraft({ evaluation, responses, criteria }: { evaluation: Evaluation; responses: ResponseRow[]; criteria: Criterion[] }) {
  const byCriterion = new Map(responses.map((response) => [response.criterion_id, response]));
  const unknown = responses.filter((response) => response.rating === null).length;
  return (
    <section className="ai-draft">
      <div className="ai-draft-hero">
        <div>
          <div className="eyebrow"><Bot size={14} /> AI draft · not part of team results</div>
          <h2>AI first-pass assessment</h2>
          <p>A starting point from public information and general industry knowledge. {unknown > 0 && `${unknown} of ${criteria.length} criteria are Unknown.`}</p>
        </div>
        <div className="team-scores">
          <div><strong>{scoreLabel(evaluation.opportunity_score, evaluation.opportunity_coverage)}</strong><small>Opportunity</small></div>
          <div><strong>{scoreLabel(evaluation.exhibit_score, evaluation.exhibit_coverage)}</strong><small>Exhibit value</small></div>
          <div><strong className="ai-rec">{recommendationLabel(evaluation.recommendation)}</strong><small>AI recommendation</small></div>
        </div>
      </div>
      {evaluation.comments && <p className="ai-rationale">{evaluation.comments}</p>}
      <details>
        <summary>Show ratings and the reasoning behind each</summary>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Criterion</th><th>Rating</th><th>Basis</th></tr></thead>
            <tbody>
              {criteria.map((criterion) => {
                const response = byCriterion.get(criterion.id);
                const rating = response?.rating;
                return (
                  <tr key={criterion.id}>
                    <td><small>{criterion.category}</small>{criterion.label}</td>
                    <td className="nowrap">{rating ? `${rating} · ${RATING_LABELS[rating]}` : response ? "Unknown" : "—"}</td>
                    <td>{response?.comment || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

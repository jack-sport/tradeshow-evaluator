import { recommendationLabel } from "@/lib/scoring";
import { buildComparison } from "@/lib/comparison";
import type { Criterion, PeerEvaluation } from "@/lib/types";

export function Comparison({ evaluations, criteria }: { evaluations: PeerEvaluation[]; criteria: Criterion[] }) {
  const { opportunity, exhibit, spread, recommendations: counts } = buildComparison(evaluations);
  return (
    <section className="comparison">
      <div className="comparison-hero">
        <div><div className="eyebrow">Team result · {evaluations.length} submitted</div><h2>Where the team stands</h2></div>
        <div className="team-scores"><div><strong>{opportunity.toFixed(1)}</strong><small>Avg. opportunity</small></div><div><strong>{exhibit.toFixed(1)}</strong><small>Avg. exhibit value</small></div><div><strong>{spread.toFixed(1)}</strong><small>Opportunity spread</small></div></div>
      </div>
      <div className="recommendation-bars">
        {counts.map(({ value, count }) => <div key={value}><span>{recommendationLabel(value)}</span><div className="bar"><i style={{ width: `${evaluations.length ? count / evaluations.length * 100 : 0}%` }} /></div><strong>{count}</strong></div>)}
      </div>
      <div className="table-wrap"><table><thead><tr><th>Evaluator</th><th>Opportunity</th><th>Exhibit value</th><th>Recommendation</th><th>Rationale</th></tr></thead><tbody>{evaluations.map((item) => <tr key={item.id}><td>{item.profiles?.full_name || "Team member"}</td><td>{item.opportunity_score?.toFixed(1)}</td><td>{item.exhibit_score?.toFixed(1)}</td><td><span className="pill">{recommendationLabel(item.recommendation)}</span></td><td>{item.comments || "—"}</td></tr>)}</tbody></table></div>
      <h3 className="subheading">Criterion-level comparison</h3>
      <div className="table-wrap"><table><thead><tr><th>Criterion</th>{evaluations.map((item) => <th key={item.id}>{item.profiles?.full_name?.split(" ")[0]}</th>)}<th>Spread</th></tr></thead><tbody>{criteria.map((criterion) => { const values = evaluations.map((item) => item.evaluation_responses.find((response) => response.criterion_id === criterion.id)?.rating || 0); return <tr key={criterion.id}><td><small>{criterion.category}</small>{criterion.label}</td>{values.map((value, index) => <td key={index}>{value || "—"}</td>)}<td className={Math.max(...values) - Math.min(...values) >= 2 ? "variance" : ""}>{Math.max(...values) - Math.min(...values)}</td></tr>; })}</tbody></table></div>
    </section>
  );
}

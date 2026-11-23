import { recommendationLabel, scoreLabel } from "@/lib/scoring";
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
      <div className="table-wrap"><table><thead><tr><th>Evaluator</th><th>Opportunity</th><th>Exhibit value</th><th>Recommendation</th><th>Rationale</th></tr></thead><tbody>{evaluations.map((item) => <tr key={item.id}><td>{item.profiles?.full_name || "Team member"}</td><td>{scoreLabel(item.opportunity_score, item.opportunity_coverage)}</td><td>{scoreLabel(item.exhibit_score, item.exhibit_coverage)}</td><td><span className="pill">{recommendationLabel(item.recommendation)}</span></td><td>{item.comments || "—"}</td></tr>)}</tbody></table></div>
      <h3 className="subheading">Criterion-level comparison <small className="muted-note">? = Unknown, left out of spreads and averages</small></h3>
      <div className="table-wrap"><table><thead><tr><th>Criterion</th>{evaluations.map((item) => <th key={item.id}>{item.profiles?.full_name?.split(" ")[0]}</th>)}<th>Spread</th></tr></thead><tbody>{criteria.map((criterion) => { const responses = evaluations.map((item) => item.evaluation_responses.find((response) => response.criterion_id === criterion.id)); const rated = responses.map((response) => response?.rating).filter((value): value is number => typeof value === "number"); const spread = rated.length ? Math.max(...rated) - Math.min(...rated) : 0; return <tr key={criterion.id}><td><small>{criterion.category}</small>{criterion.label}</td>{responses.map((response, index) => <td key={index}>{!response ? "—" : response.rating === null ? "?" : response.rating}</td>)}<td className={spread >= 2 ? "variance" : ""}>{rated.length ? spread : "—"}</td></tr>; })}</tbody></table></div>
    </section>
  );
}

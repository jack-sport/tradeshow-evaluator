import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RECOMMENDATIONS, buildBaseline } from "@/lib/baseline";
import { PARTICIPATION_LABELS, formatDateRange, recommendationLabel, scoreLabel, todayIso } from "@/lib/scoring";
import type { Evaluation, Event } from "@/lib/types";

export default async function BaselinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: events }, { data: aiProfile }] = await Promise.all([
    supabase.from("events").select("*").eq("status", "active").order("starts_on", { ascending: false }),
    supabase.from("profiles").select("id").eq("is_ai", true).maybeSingle(),
  ]);
  const { data: aiEvaluations } = aiProfile
    ? await supabase.from("evaluations").select("*").eq("evaluator_id", aiProfile.id)
    : { data: [] };
  const summary = buildBaseline((events as Event[]) || [], (aiEvaluations as Evaluation[]) || [], todayIso());
  const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

  return (
    <main className="page-shell narrow">
      <section className="hero">
        <div>
          <div className="eyebrow">Scorecard check</div>
          <h1>Baseline report</h1>
          <p>The AI draft&apos;s recommendation for each past event, next to what JAXPORT actually did. A match means the scorecard agrees with the team&apos;s past choice, not that the choice was right. The mismatches are the ones worth discussing.</p>
        </div>
      </section>

      <section className="baseline-stats">
        <div><strong>{pct(summary.matches, summary.compared)}</strong><small>Agreement ({summary.matches} of {summary.compared} compared)</small></div>
        <div><strong>{pct(summary.matchesSufficient, summary.comparedSufficient)}</strong><small>Agreement where data was sufficient ({summary.matchesSufficient} of {summary.comparedSufficient})</small></div>
        <div><strong>{summary.unknownParticipation}</strong><small>Past events with unknown participation</small></div>
        <div><strong>{summary.missingEvaluation}</strong><small>Past events without an AI recommendation</small></div>
      </section>

      <h3 className="subheading">What JAXPORT did vs. what the AI recommended</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>JAXPORT did ↓ / AI recommended →</th>{RECOMMENDATIONS.map((rec) => <th key={rec}>{recommendationLabel(rec)}</th>)}</tr></thead>
          <tbody>
            {RECOMMENDATIONS.map((actual) => (
              <tr key={actual}>
                <td><strong>{recommendationLabel(actual)}</strong></td>
                {RECOMMENDATIONS.map((rec) => <td key={rec} className={actual === rec ? "match-cell" : summary.matrix[actual][rec] ? "variance" : ""}>{summary.matrix[actual][rec]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="subheading">Every past event</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Event</th><th>JAXPORT did</th><th>AI recommended</th><th>Opportunity</th><th>Exhibit value</th><th>Result</th></tr></thead>
          <tbody>
            {summary.rows.map(({ event, evaluation, match, lowData }) => (
              <tr key={event.id}>
                <td><Link href={`/events/${event.id}`}><strong>{event.name}</strong></Link><small className="plain">{formatDateRange(event.starts_on, event.ends_on)}</small></td>
                <td>{PARTICIPATION_LABELS[event.participation || "unknown"]}</td>
                <td>{evaluation ? recommendationLabel(evaluation.recommendation) : "—"}</td>
                <td className="nowrap">{scoreLabel(evaluation?.opportunity_score, evaluation?.opportunity_coverage)}</td>
                <td className="nowrap">{scoreLabel(evaluation?.exhibit_score, evaluation?.exhibit_coverage)}</td>
                <td>{match === null ? "Not compared" : match ? <span className="pill match">Match</span> : <span className="pill mismatch">Mismatch</span>}{lowData && <small className="plain">Low data</small>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

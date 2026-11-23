import { ClipboardCheck } from "lucide-react";
import { saveEventGoals, saveEventResults } from "@/app/actions";
import { FIELD_SALES_CALL_COST, INTERACTIONS_PER_STAFF_HOUR, formatRoi, goalProgress, resultMetrics, type GoalProgress } from "@/lib/results";
import { PARTICIPATION_LABELS, formatMoney } from "@/lib/scoring";
import type { EventResults as Results } from "@/lib/types";

const money = (value: number | null) => (value === null ? "—" : `${value < 0 ? "−" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`);
const count = (value: number | null | undefined) => (value === null || value === undefined ? "—" : Number(value).toLocaleString());

export interface EventGoals {
  meetings: number | null;
  contacts: number | null;
}

/** One goal-vs-actual tile: "12 / 15" with the percentage of goal, or just the goal before the show. */
function GoalTile({ label, progress, showActual }: { label: string; progress: GoalProgress; showActual: boolean }) {
  const { goal, actual, ratio } = progress;
  let value: string;
  let detail: string;
  if (!showActual || actual === null) {
    value = goal === null ? "—" : count(goal);
    detail = goal === null ? `${label} goal not set` : `${label} goal`;
  } else if (goal === null) {
    value = count(actual);
    detail = `${label} · no goal set`;
  } else {
    value = `${count(actual)} / ${count(goal)}`;
    detail = `${label} vs. goal${ratio === null ? "" : ` · ${Math.round(ratio * 100)}%`}`;
  }
  const met = showActual && ratio !== null && ratio >= 1;
  return <div className={met ? "goal-met" : undefined}><strong>{value}</strong><small>{detail}</small></div>;
}

/** Pre-show goals and post-show results for one event: read-only for everyone, edit forms for administrators. */
export function EventResults({ eventId, goals, results, isAdmin, isPast }: { eventId: string; goals: EventGoals; results: Results | null; isAdmin: boolean; isPast: boolean }) {
  const hasGoals = goals.meetings !== null || goals.contacts !== null;
  if (!results && !hasGoals && !isAdmin) return null;
  const showResults = Boolean(results) || isPast;
  const metrics = results ? resultMetrics(results) : null;
  const meetings = goalProgress(goals.meetings, results?.meetings);
  const contacts = goalProgress(goals.contacts, results?.contacts);
  const resultsAction = saveEventResults.bind(null, eventId);
  const goalsAction = saveEventGoals.bind(null, eventId);
  return (
    <section className="results-card">
      <div className="admin-heading"><ClipboardCheck /><div>
        <h2>{showResults ? "Goals and post-show results" : "Pre-show goals"}</h2>
        <p>{showResults ? "Goals set before the show against what actually happened, for the baseline and for next year's scores." : "Set before the show; compared with actual meetings and contacts afterward."}</p>
      </div></div>

      <h3 className="results-subhead">Goals{showResults ? " vs. actual" : ""}</h3>
      <div className="goal-grid">
        <GoalTile label="Meetings" progress={meetings} showActual={Boolean(results)} />
        <GoalTile label="Contacts" progress={contacts} showActual={Boolean(results)} />
      </div>
      {isAdmin && (
        <details className="results-edit">
          <summary>{hasGoals ? "Edit goals" : "Set goals"}</summary>
          <form action={goalsAction} className="stack">
            <div className="two-col">
              <label>Meeting goal<input type="number" min="0" name="meeting_goal" defaultValue={goals.meetings ?? ""} /></label>
              <label>Contact goal (cards / scans)<input type="number" min="0" name="contact_goal" defaultValue={goals.contacts ?? ""} /></label>
            </div>
            <button className="button primary">Save goals</button>
          </form>
        </details>
      )}

      {showResults && (
        <>
          <h3 className="results-subhead">Results</h3>
          {results && metrics ? (
            <>
              <div className="results-grid">
                <div><strong>{PARTICIPATION_LABELS[results.participation || "unknown"]}</strong><small>Participation</small></div>
                <div><strong>{count(results.staff_count)}</strong><small>Staff</small></div>
                <div><strong>{count(results.qualified_leads)}</strong><small>Qualified leads</small></div>
                <div><strong>{count(results.opportunities)}</strong><small>Opportunities</small></div>
                <div><strong>{formatMoney(results.actual_cost)}</strong><small>Actual total cost</small></div>
                <div><strong>{money(metrics.costPerContact)}</strong><small>Cost per contact</small></div>
                <div><strong>{metrics.capacityUtilization === null ? "—" : `${Math.round(metrics.capacityUtilization * 100)}%`}</strong><small>Booth capacity used</small></div>
                <div><strong>{formatMoney(results.lead_revenue_value)}</strong><small>Potential revenue value of leads</small></div>
              </div>
              <div className="roi-grid">
                <div>
                  <strong>{formatRoi(metrics.hardDollarRoi)}</strong><small>Hard-dollar ROI</small>
                  <p>{metrics.hardDollarRoi === null
                    ? "Enter the potential revenue value of leads to calculate."
                    : `(Lead revenue value − total cost) ÷ total cost = ${money(metrics.grossMargin)} potential gross margin.`}</p>
                </div>
                <div>
                  <strong>{formatRoi(metrics.softDollarRoi)}</strong><small>Soft-dollar ROI</small>
                  <p>(${FIELD_SALES_CALL_COST} field sales call − cost per contact) × contacts ÷ total cost{metrics.fieldCallSavings !== null && ` = ${money(metrics.fieldCallSavings)} saved vs. visiting each contact`}.</p>
                </div>
              </div>
              <p className="results-note">
                Capacity assumes {INTERACTIONS_PER_STAFF_HOUR} interactions per staffer per show hour
                {metrics.interactionCapacity !== null && ` (${count(metrics.interactionCapacity)} possible)`}. The ${FIELD_SALES_CALL_COST} field sales call cost is from CEIR.
              </p>
              {results.notes && <p className="ai-rationale">{results.notes}</p>}
            </>
          ) : <p className="results-note">No results recorded yet.</p>}
          {isAdmin && (
            <details className="results-edit">
              <summary>{results ? "Edit results" : "Record results"}</summary>
              <form action={resultsAction} className="stack">
                <label>What JAXPORT did<select name="participation" defaultValue={results?.participation || "unknown"}>
                  <option value="exhibited">Exhibited</option><option value="attended">Attended (sales only)</option>
                  <option value="did_not_attend">Did not attend</option><option value="unknown">Unknown</option>
                </select></label>
                <div className="two-col">
                  <label>Staff<input type="number" min="0" name="staff_count" defaultValue={results?.staff_count ?? ""} /></label>
                  <label>Show hours<input type="number" min="0" step="0.5" name="show_hours" defaultValue={results?.show_hours ?? ""} /></label>
                  <label>Contacts (cards / scans)<input type="number" min="0" name="contacts" defaultValue={results?.contacts ?? ""} /></label>
                  <label>Meetings held<input type="number" min="0" name="meetings" defaultValue={results?.meetings ?? ""} /></label>
                  <label>Qualified leads<input type="number" min="0" name="qualified_leads" defaultValue={results?.qualified_leads ?? ""} /></label>
                  <label>Opportunities<input type="number" min="0" name="opportunities" defaultValue={results?.opportunities ?? ""} /></label>
                  <label>Actual total cost ($)<input type="number" min="0" step="0.01" name="actual_cost" defaultValue={results?.actual_cost ?? ""} /></label>
                  <label>Potential revenue value of leads ($)<input type="number" min="0" step="0.01" name="lead_revenue_value" defaultValue={results?.lead_revenue_value ?? ""} /></label>
                </div>
                <label>Notes<textarea name="notes" rows={3} defaultValue={results?.notes || ""} placeholder="Who attended, notable meetings, follow-ups, anything next year's evaluators should know." /></label>
                <button className="button primary">Save results</button>
              </form>
            </details>
          )}
        </>
      )}
    </section>
  );
}

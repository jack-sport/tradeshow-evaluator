import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarRange, CheckCircle2, RefreshCw, Scissors, Settings2, Users, Wallet } from "lucide-react";
import { recalculateEstimates, saveBudgetSettings } from "@/app/actions";
import { SCENARIOS, scenarioShows, type Scenario } from "@/lib/budget";
import { getBudgetSettings } from "@/lib/budget-store";
import {
  BUDGET_LINES, EXHIBIT_KINDS, REGIONS, estimate, estimateQuality, fiscalYearLabel, fiscalYearOf, fiscalYearRange, rollup, whatFits,
  type BudgetSettings, type Rollup,
} from "@/lib/costs";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange, todayIso } from "@/lib/scoring";
import type { Evaluation, Event, EventResults, Profile } from "@/lib/types";

const usd = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const fmtDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Meter({ used, total }: { used: number; total: number }) {
  const share = total > 0 ? used / total : 0;
  return <div className="meter" aria-hidden><i style={{ width: `${Math.min(100, share * 100)}%` }} className={share > 1 ? "over" : share > 0.9 ? "near" : undefined} /></div>;
}

function Tile({ label, value, detail, used, total }: { label: string; value: string; detail: string; used: number; total: number }) {
  const over = used > total;
  return (
    <div className={`budget-tile${over ? " over" : ""}`}>
      <small>{label}</small><strong>{value}</strong><Meter used={used} total={total} /><span>{detail}</span>
    </div>
  );
}

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ fy?: string; scenario?: string; saved?: string; count?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const today = todayIso();
  const fy = Number(params.fy) || fiscalYearOf(today);
  const scenario: Scenario = SCENARIOS.some(([key]) => key === params.scenario) ? params.scenario as Scenario : "plan";
  const [from, to] = fiscalYearRange(fy);

  const [{ data: profile }, settings, { data: events }, { data: results }, { data: aiProfile }, { data: own }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    getBudgetSettings(supabase, fy),
    supabase.from("events").select("*").eq("status", "active").gte("starts_on", from).lte("starts_on", to).order("starts_on"),
    supabase.from("event_results").select("*"),
    supabase.from("profiles").select("id").eq("is_ai", true).maybeSingle(),
    supabase.from("evaluations").select("*").eq("evaluator_id", user.id),
  ]);
  const { data: ai } = aiProfile ? await supabase.from("evaluations").select("*").eq("evaluator_id", aiProfile.id) : { data: [] };
  const isAdmin = (profile as Profile)?.role === "admin";
  if (!settings) return <main className="page-shell narrow"><p>No budget settings yet.</p></main>;

  const build = (key: Scenario) => scenarioShows((events || []) as Event[], (results || []) as EventResults[], (ai || []) as Evaluation[], (own || []) as Evaluation[], key, today);
  const all = Object.fromEntries(SCENARIOS.map(([key]) => [key, rollup(build(key), settings)])) as Record<Scenario, Rollup>;
  const current = all[scenario];
  const fit = whatFits(current, settings);
  const remaining = current.allocated - current.planned;
  const partial = current.shows.filter((line) => !line.usesActual && line.estimate && estimateQuality(line.estimate) !== "Complete").length;
  const href = (changes: Record<string, string | number>) => `/budget?${new URLSearchParams({ fy: String(fy), scenario, ...Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <main className="page-shell budget-page">
      {params.saved && <div className="success-banner">{params.saved === "settings" ? "Budget settings saved and estimates recalculated." : `Recalculated estimates for ${params.count || 0} shows.`}</div>}
      <section className="budget-hero">
        <div>
          <div className="eyebrow">Portfolio budget & staff capacity</div>
          <h1>{fiscalYearLabel(fy)} budget & capacity</h1>
          <p>{formatDateRange(from, to)}. Checks the whole show schedule against the show allocation and the team&apos;s show days. Each show&apos;s own value is scored separately on its page.</p>
        </div>
        <nav className="fy-switch" aria-label="Fiscal year">
          {[fy - 1, fy, fy + 1].map((year) => <Link key={year} href={href({ fy: year })} aria-current={year === fy ? "page" : undefined}>{fiscalYearLabel(year)}</Link>)}
        </nav>
      </section>

      <section className="scenario-tabs" aria-label="Scenario">
        {SCENARIOS.map(([key, label, description]) => (
          <Link key={key} href={href({ scenario: key })} aria-current={key === scenario ? "page" : undefined} title={description}>
            <b>{label}</b>
            <span>{usd(all[key].planned)} · {all[key].staff.salesDays + all[key].staff.marketingDays} staff days · {all[key].staff.exhibitShows} exhibits</span>
          </Link>
        ))}
      </section>
      <p className="scenario-note">{SCENARIOS.find(([key]) => key === scenario)?.[2]} Past shows count as what actually happened, at their actual cost where recorded.</p>

      <section className="budget-tiles">
        <Tile label="Planned cost" value={usd(current.planned)} used={current.planned} total={current.allocated}
          detail={`${remaining >= 0 ? `${usd(remaining)} left of` : `${usd(-remaining)} over`} the ${usd(current.allocated)} show allocation · ${usd(current.actualToDate)} spent to date`} />
        <Tile label="Sales & management show days" value={`${Math.round(current.staff.salesDays)} / ${current.staff.salesCapacity}`} used={current.staff.salesDays} total={current.staff.salesCapacity}
          detail={`${settings.staff.sales_people} travelers × ${settings.staff.show_days_per_person} days · ${pct(current.staff.salesDays, current.staff.salesCapacity)}% used`} />
        <Tile label="Marketing traveler (exhibits)" value={`${Math.round(current.staff.marketingDays)} / ${current.staff.marketingCapacity}`} used={current.staff.marketingDays} total={current.staff.marketingCapacity}
          detail={`${current.staff.exhibitShows} exhibit shows · ${pct(current.staff.marketingDays, current.staff.marketingCapacity)}% used`} />
        <div className="budget-tile">
          <small>Not yet decided</small><strong>{current.undecided.length}</strong>
          <span>{current.undecided.length ? "upcoming shows with no decision, not counted above" : "every show has a decision"}{partial ? ` · ${partial} estimates are partial` : ""}</span>
        </div>
      </section>

      <div className="budget-columns">
        <section className="results-card">
          <div className="admin-heading"><Wallet /><div><h2>By budget line</h2><p>Show allocation per Cost Center 190 line. Actual costs are spread across lines in the estimate&apos;s proportions.</p></div></div>
          <table className="budget-lines">
            <thead><tr><th>Line</th><th className="num">Allocated</th><th className="num">Planned</th><th className="num">Left</th><th aria-label="Share used" /></tr></thead>
            <tbody>
              {BUDGET_LINES.map(({ key, label, account }) => {
                const line = current.lines[key];
                return (
                  <tr key={key} className={line.planned > line.allocated ? "over" : undefined}>
                    <td>{label}<small>{account}</small></td><td className="num">{usd(line.allocated)}</td><td className="num">{usd(line.planned)}</td>
                    <td className="num">{usd(line.allocated - line.planned)}</td><td><Meter used={line.planned} total={line.allocated} /></td>
                  </tr>
                );
              })}
              <tr className="total"><td>Total</td><td className="num">{usd(current.allocated)}</td><td className="num">{usd(current.planned)}</td><td className="num">{usd(remaining)}</td><td><Meter used={current.planned} total={current.allocated} /></td></tr>
            </tbody>
          </table>
        </section>

        <section className="results-card">
          <div className="admin-heading"><Users /><div><h2>Staff conflicts</h2><p>Days when overlapping shows need more travelers than the team has (show dates only).</p></div></div>
          {current.conflicts.length === 0 ? <p className="ok-line"><CheckCircle2 size={18} /> No date conflicts in this scenario.</p> : (
            <ul className="conflicts">
              {current.conflicts.map((conflict, index) => (
                <li key={index}><AlertTriangle size={16} />
                  <div><b>{conflict.kind === "marketing" ? "Marketing traveler double-booked" : "Not enough sales travelers"}</b>
                    <span>{fmtDate(conflict.from)}{conflict.to !== conflict.from ? `–${fmtDate(conflict.to)}` : ""}: {conflict.shows.join(", ")} need {conflict.needed}, {conflict.available} available</span></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="results-card">
        <div className="admin-heading"><Scissors /><div><h2>What fits</h2><p>If this scenario is over the allocation or staff time, the changes that give up the least value per dollar: downgrading exhibits first, then skipping shows. Value is the AI&apos;s opportunity score (exhibit score for downgrades). Past shows aren&apos;t changed.</p></div></div>
        {fit.actions.length === 0 ? <p className="ok-line"><CheckCircle2 size={18} /> This scenario fits the allocation and staff time.</p> : (
          <>
            <ol className="fit-list">
              {fit.actions.map((action) => (
                <li key={`${action.show.id}-${action.action}`}>
                  <Link href={`/events/${action.show.id}`}>{action.show.name}</Link>
                  <span>{action.action === "sales_only" ? "Attend without exhibiting" : "Skip"} · saves {usd(action.saves)}{action.savesSalesDays + action.savesMarketingDays > 0 ? ` and ${action.savesSalesDays + action.savesMarketingDays} staff days` : ""} · {action.action === "sales_only" ? "exhibit" : "opportunity"} score {action.action === "sales_only" ? action.show.exhibitValue ?? "—" : action.show.value ?? "—"}</span>
                </li>
              ))}
            </ol>
            {!fit.fits && <p className="results-note">Even with these changes the scenario doesn&apos;t fit; past shows can&apos;t be changed.</p>}
          </>
        )}
      </section>

      <section className="results-card">
        <div className="admin-heading"><CalendarRange /><div><h2>Shows in {fiscalYearLabel(fy)}</h2><p>{current.shows.length} taking part{current.undecided.length ? `, ${current.undecided.length} undecided` : ""}. Open a show to see its prices and sources.</p></div></div>
        <div className="table-wrap">
          <table className="budget-shows">
            <thead><tr><th>Show</th><th>Dates</th><th>Plan</th><th className="num">People</th><th className="num">Staff days</th><th className="num">Cost</th><th>Estimate</th></tr></thead>
            <tbody>
              {current.shows.map(({ show, estimate: e, cost, usesActual }) => (
                <tr key={show.id}>
                  <td><Link href={`/events/${show.id}`}>{show.name}</Link></td>
                  <td>{formatDateRange(show.starts_on, show.ends_on)}</td>
                  <td>{show.option === "exhibit" ? `Exhibit (${EXHIBIT_KINDS.find(([k]) => k === (show.exhibit_kind || "booth"))?.[1].toLowerCase()})` : "Sales only"}{show.past ? " · past" : ""}</td>
                  <td className="num">{e ? `${e.salesTravelers}${e.marketingTravelers ? " + 1" : ""}` : "—"}</td>
                  <td className="num">{e ? e.staffDays.sales + e.staffDays.marketing : "—"}</td>
                  <td className="num">{usd(cost)}</td>
                  <td>{usesActual ? <span className="quality complete">Actual cost</span> : e ? <span className={estimateQuality(e) === "Complete" ? "quality complete" : "quality partial"}>{estimateQuality(e)}</span> : "—"}</td>
                </tr>
              ))}
              {current.undecided.map((show) => {
                const sales = estimate(show, settings, "sales_only");
                const exhibit = show.exhibit_kind === "none" ? null : estimate(show, settings, "exhibit");
                return (
                  <tr key={show.id} className="undecided">
                    <td><Link href={`/events/${show.id}`}>{show.name}</Link></td><td>{formatDateRange(show.starts_on, show.ends_on)}</td>
                    <td>Undecided</td><td className="num">—</td><td className="num">—</td>
                    <td className="num">{usd(sales.total)}{exhibit ? ` / ${usd(exhibit.total)}` : ""}</td>
                    <td><span className="results-note">Sales only{exhibit ? " / exhibit" : ""}, not counted</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <BudgetSettingsPanel settings={settings} isAdmin={isAdmin} fy={fy} />
    </main>
  );
}

function BudgetSettingsPanel({ settings, isAdmin, fy }: { settings: BudgetSettings; isAdmin: boolean; fy: number }) {
  const save = saveBudgetSettings.bind(null, fy);
  const recalc = recalculateEstimates.bind(null, fy);
  const kinds = Object.keys(settings.rates.exhibit_defaults);
  return (
    <section className="results-card">
      <div className="admin-heading"><Settings2 /><div><h2>Allocation, staff & rates</h2><p>{settings.notes || "Settings for this fiscal year."}</p></div></div>
      {!isAdmin ? (
        <p className="results-note">Show allocation {usd(Object.values(settings.allocation).reduce((a, b) => a + Number(b), 0))} · {settings.staff.sales_people} sales/management travelers and {settings.staff.marketing_people} marketing traveler, up to {settings.staff.show_days_per_person} show days each. Administrators can change these.</p>
      ) : (
        <>
          <form action={recalc}><button className="button secondary"><RefreshCw size={16} /> Recalculate stored estimates</button></form>
          <details className="results-edit">
            <summary>Edit allocation, staff and rates</summary>
            <form action={save} className="stack settings-form">
              <fieldset><legend>Show allocation by budget line ($)</legend><div className="settings-grid">
                {BUDGET_LINES.map(({ key, label, account }) => <label key={key}>{label} ({account})<input type="number" min="0" step="100" name={`allocation_${key}`} defaultValue={settings.allocation[key]} /></label>)}
              </div></fieldset>
              <fieldset><legend>Staff</legend><div className="settings-grid">
                <label>Sales & management travelers<input type="number" min="0" name="sales_people" defaultValue={settings.staff.sales_people} /></label>
                <label>Marketing travelers (exhibits)<input type="number" min="0" name="marketing_people" defaultValue={settings.staff.marketing_people} /></label>
                <label>Show days per person per year<input type="number" min="0" name="show_days_per_person" defaultValue={settings.staff.show_days_per_person} /></label>
                <label>Default people, sales only<input type="number" min="0" name="people_sales_only" defaultValue={settings.rates.default_people.sales_only} /></label>
                <label>Default sales people, exhibit<input type="number" min="0" name="people_exhibit" defaultValue={settings.rates.default_people.exhibit} /></label>
              </div></fieldset>
              <fieldset><legend>Travel by region (per person, and travel days added to show days)</legend><div className="settings-grid regions">
                {REGIONS.map(([key, label]) => (
                  <div key={key} className="region-row"><span>{label}</span>
                    <label>$<input type="number" min="0" step="10" name={`travel_${key}`} defaultValue={settings.rates.travel_per_person[key]} aria-label={`${label} travel per person`} /></label>
                    <label>days<input type="number" min="0" name={`days_${key}`} defaultValue={settings.rates.travel_days[key]} aria-label={`${label} travel days`} /></label>
                  </div>
                ))}
              </div></fieldset>
              <fieldset><legend>Defaults when a show&apos;s price isn&apos;t known ($)</legend><div className="settings-grid">
                <label>Registration per person<input type="number" min="0" name="unknown_registration" defaultValue={settings.rates.unknown_registration_per_person} /></label>
                <label>Entertainment per show<input type="number" min="0" name="entertainment_per_show" defaultValue={settings.rates.entertainment_per_show} /></label>
                {kinds.map((kind) => (
                  <div key={kind} className="region-row"><span>{EXHIBIT_KINDS.find(([k]) => k === kind)?.[1] || kind}</span>
                    <label>space<input type="number" min="0" step="100" name={`space_${kind}`} defaultValue={settings.rates.exhibit_defaults[kind as keyof typeof settings.rates.exhibit_defaults]?.space} /></label>
                    <label>shipping<input type="number" min="0" step="100" name={`shipping_${kind}`} defaultValue={settings.rates.exhibit_defaults[kind as keyof typeof settings.rates.exhibit_defaults]?.shipping_setup} /></label>
                  </div>
                ))}
              </div></fieldset>
              <label>Notes<textarea name="notes" rows={3} defaultValue={settings.notes || ""} /></label>
              <button className="button primary">Save and recalculate</button>
            </form>
          </details>
        </>
      )}
    </section>
  );
}

import { Wallet } from "lucide-react";
import { saveEventDetails } from "@/app/actions";
import {
  COST_ITEM_LABELS, COST_SOURCE_LABELS, EXHIBIT_KINDS, REGIONS, estimate, estimateQuality, fiscalYearLabel,
  type BudgetSettings, type CostItemKey, type Estimate,
} from "@/lib/costs";
import Link from "next/link";
import type { BudgetImpact } from "@/lib/budget";
import { PARTICIPATION_LABELS, formatDateRange } from "@/lib/scoring";
import type { Event } from "@/lib/types";

const usd = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
const ITEM_KEYS: CostItemKey[] = ["registration", "exhibit_space", "sponsorship", "shipping_setup"];

function OptionSummary({ title, e }: { title: string; e: Estimate }) {
  const people = `${e.salesTravelers} sales${e.marketingTravelers ? " + 1 marketing" : ""}`;
  const parts = [
    ["Registration", e.items.registration], ["Exhibit space", e.items.space], ["Sponsorship", e.items.sponsorship],
    ["Shipping & setup", e.items.shipping], ["Travel", e.items.travel], ["Entertainment", e.items.entertainment],
  ].filter(([, value]) => Number(value) > 0) as Array<[string, number]>;
  const quality = estimateQuality(e);
  return (
    <div className="option-estimate">
      <small>{title}</small>
      <strong>{usd(e.total)}</strong>
      <span>{people} · {e.daysPerPerson} days each · {e.staffDays.sales + e.staffDays.marketing} staff days</span>
      <span className="option-items">{parts.map(([label, value]) => `${label} ${usd(value)}`).join(" · ")}</span>
      <span className={quality === "Complete" ? "quality complete" : "quality partial"}>{quality}</span>
    </div>
  );
}

/** Cost estimate and staffing for one show, with the admin edit form. */
/** Where this show's options leave the fiscal year's plan: money left, staff days left, marketing overlaps. */
function ImpactNote({ impact }: { impact: BudgetImpact }) {
  const fy = fiscalYearLabel(impact.fiscalYear);
  const left = (remaining: number) => (remaining >= 0 ? `${usd(remaining)} left` : `${usd(-remaining)} over`);
  const planLabel = impact.option === "exhibit" ? "exhibiting" : impact.option === "sales_only" ? "attending (sales only)" : impact.option === "undecided" ? "undecided" : "not going";
  return (
    <div className={`impact-note${impact.ifSalesOnly.remaining < 0 || (impact.ifExhibit && impact.ifExhibit.remaining < 0 && impact.option === "exhibit") ? " over" : ""}`}>
      <b>{fy} budget impact</b>
      <span>Current plan: {planLabel}. The {fy} plan totals {usd(impact.planned)} of the {usd(impact.allocated)} show allocation.</span>
      <span>With this show as sales only: {left(impact.ifSalesOnly.remaining)}{impact.ifExhibit ? `; exhibiting: ${left(impact.ifExhibit.remaining)}` : ""}.</span>
      <span>Show days left in the plan: {Math.round(impact.salesDaysLeft)} sales & management, {Math.round(impact.marketingDaysLeft)} marketing.</span>
      {impact.overlappingExhibits.length > 0 && <span className="warn">The marketing traveler is already planned for {impact.overlappingExhibits.join(", ")} on overlapping dates.</span>}
      <Link href={`/budget?fy=${impact.fiscalYear}`}>Open the {fy} budget</Link>
    </div>
  );
}

export function ShowCosts({ event, settings, isAdmin, impact }: { event: Event; settings: BudgetSettings | null; isAdmin: boolean; impact?: BudgetImpact | null }) {
  if (!settings) return null;
  const sales = estimate(event, settings, "sales_only");
  const exhibit = event.exhibit_kind === "none" ? null : estimate(event, settings, "exhibit");
  const items = event.cost_items || {};
  const sources = ITEM_KEYS.filter((key) => items[key]?.amount !== null && items[key]?.amount !== undefined);
  const action = saveEventDetails.bind(null, event.id);
  const defaults = settings.rates.default_people;
  return (
    <section className="results-card show-costs">
      <div className="admin-heading"><Wallet /><div>
        <h2>Cost & staffing</h2>
        <p>Estimated with {fiscalYearLabel(settings.fiscal_year)} rates. Prices come from the show&apos;s website where found; gaps use defaults and are marked.</p>
      </div></div>
      {!event.region && <p className="cost-note missing">No travel region set, so the estimate leaves out travel.{isAdmin ? " Set one under Edit show details." : ""}</p>}
      <div className="estimate-grid">
        <OptionSummary title="Sales only" e={sales} />
        {exhibit ? <OptionSummary title={`Exhibit (${EXHIBIT_KINDS.find(([k]) => k === (event.exhibit_kind || "booth"))?.[1].toLowerCase()})`} e={exhibit} /> : <div className="option-estimate"><small>Exhibit</small><strong>—</strong><span>No exhibit option at this show.</span></div>}
      </div>
      {impact && <ImpactNote impact={impact} />}
      {sources.length > 0 && (
        <ul className="price-sources">
          {sources.map((key) => {
            const item = items[key]!;
            return (
              <li key={key}><b>{COST_ITEM_LABELS[key]}:</b> {usd(Number(item.amount))} · {COST_SOURCE_LABELS[item.source || "assumption"]}
                {item.url && <> · <a href={item.url} target="_blank" rel="noreferrer">source</a></>}
                {item.checked_on && <> · checked {item.checked_on}</>}{item.note && <> · {item.note}</>}</li>
            );
          })}
        </ul>
      )}
      {(event.package_includes || (event.included_registrations ?? 0) > 0) && (
        <p className="results-note"><b>Package includes:</b> {[(event.included_registrations ?? 0) > 0 ? `${event.included_registrations} registrations` : null, event.package_includes].filter(Boolean).join("; ")}</p>
      )}

      {isAdmin && (
        <details className="results-edit">
          <summary>Edit show details</summary>
          <form action={action} className="stack details-form">
            <div className="workbook-fields">
              <b>From the v4 events workbook</b> (change them there, then re-import): {event.name} · {formatDateRange(event.starts_on, event.ends_on)} · {event.location || "No location"} · {PARTICIPATION_LABELS[event.participation || "unknown"]}{event.web_address ? <> · <a href={event.web_address} target="_blank" rel="noreferrer">website</a></> : null}
            </div>
            <div className="two-col">
              <label>Portfolio tier<select name="event_tier" defaultValue={event.event_tier}><option value="major">Major</option><option value="regional">Regional / specialty</option><option value="other">Other</option></select></label>
              <label>High-value targets<input type="number" min="0" name="high_value_targets" defaultValue={event.high_value_targets ?? ""} /></label>
              <label>Travel region<select name="region" defaultValue={event.region || ""}><option value="">Not set</option>{REGIONS.map(([value, label]) => <option key={value} value={value}>{label} ({usd(settings.rates.travel_per_person[value] ?? 0)}/person)</option>)}</select></label>
              <label>Exhibit option<select name="exhibit_kind" defaultValue={event.exhibit_kind || ""}><option value="">Not set (booth assumed)</option>{EXHIBIT_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Sales/management travelers (current plan)<input type="number" min="0" max={settings.staff.sales_people} name="sales_people" defaultValue={event.sales_people ?? ""} placeholder={`Default: ${defaults.sales_only} sales only, ${defaults.exhibit} exhibit`} /></label>
              <label>Marketing traveler (exhibit only)<select name="marketing_traveler" defaultValue={event.marketing_traveler === true ? "yes" : event.marketing_traveler === false ? "no" : ""}><option value="">Default: goes when exhibiting</option><option value="yes">Goes</option><option value="no">Doesn&apos;t go</option></select></label>
            </div>
            <fieldset className="price-items">
              <legend>Prices (website first; budget or earlier cost file if the website has none)</legend>
              {ITEM_KEYS.map((key) => {
                const item = items[key];
                return (
                  <div className="price-row" key={key}>
                    <label>{COST_ITEM_LABELS[key]} ($)<input type="number" min="0" step="1" name={`${key}_amount`} defaultValue={item?.amount ?? ""} /></label>
                    <label>Source<select name={`${key}_source`} defaultValue={item?.source || "website"}>{Object.entries(COST_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label>Link<input type="url" name={`${key}_url`} defaultValue={item?.url || ""} placeholder="https://" /></label>
                    <label>Note<input name={`${key}_note`} defaultValue={item?.note || ""} /></label>
                  </div>
                );
              })}
            </fieldset>
            <div className="two-col">
              <label>Registrations included with the exhibit<input type="number" min="0" name="included_registrations" defaultValue={event.included_registrations ?? 0} /></label>
              <label>Package also includes<input name="package_includes" defaultValue={event.package_includes || ""} placeholder="Attendee list, meeting room, logo in app" /></label>
            </div>
            <label>Notes<textarea name="notes" rows={2} defaultValue={event.notes || ""} /></label>
            <button className="button primary">Save details</button>
          </form>
        </details>
      )}
    </section>
  );
}

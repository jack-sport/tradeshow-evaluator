/**
 * Load show prices and cost inputs into the app, then recalculate each show's stored estimate.
 *
 * Usage:  npm run costs:load              (write)
 *         npm run costs:load -- --dry-run (print what would change)
 *
 * Order of preference for each price:
 *   1. The show's official website: data/ai-research/costs/<source_id>.json (official prices only).
 *   2. Earlier work in docs/budget-work: website fees researched on 2026-11-20 (with their links),
 *      then the FY27 budget's registration line for the show ("budget").
 *   3. Nothing: the estimate falls back to the default rates and marks the item as assumed.
 * Travel region, exhibit type and staffing come from docs/budget-work/cost-assumptions.json.
 * Only empty fields are filled, so edits made in the app are kept.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { REGIONS, fiscalYearOf, storedEstimate, type BudgetSettings, type CostInputs, type CostItem, type CostItemKey, type ExhibitKind } from "../lib/costs.ts";

const ROOT = resolve(import.meta.dirname, "..");
const DRY = process.argv.includes("--dry-run");

function env(key: string) {
  const line = readFileSync(join(ROOT, ".env.local"), "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} missing from .env.local`);
  return line.slice(key.length + 1).trim();
}
const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
const readJson = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

interface ResearchOption { kind: string; name?: string; amount: number | null; url?: string; official?: boolean; edition?: number; included_registrations?: number; includes?: string; /** Set during review for prices per square metre or per item, not package totals. */ per_unit?: boolean }
interface Research {
  checked_on?: string;
  registration?: { amount: number | null; rate?: string; url?: string; official?: boolean; edition?: number; note?: string } | null;
  exhibit_options?: ResearchOption[];
  shipping_setup?: { amount: number | null; url?: string; official?: boolean } | null;
  package_includes?: string | null;
}

const assumptions = readJson("docs/budget-work/cost-assumptions.json").events as Record<string, {
  region?: string; fee?: number; budget_registration?: number; people?: number; exhibit?: string;
  exhibit_space?: number; exhibit_shipping?: number; people_exhibit?: number; note?: string;
}>;
const earlierFees = Object.fromEntries((readJson("docs/budget-work/registration-research.json").fees as Array<{ source_id: string; fee_usd: number | null; source?: string }>)
  .map((fee) => [fee.source_id, fee]));
/** Prices from editions before this year are too old to use (the estimate falls back instead). */
const OLDEST_EDITION = 2025;
const current = (item?: { edition?: number } | null) => !item?.edition || item.edition >= OLDEST_EDITION;

const KIND: Record<string, ExhibitKind> = { none: "none", tabletop: "tabletop", booth: "booth", sponsor: "sponsorship", sponsorship: "sponsorship", pavilion: "pavilion", reception: "reception" };
const KIND_ORDER: ExhibitKind[] = ["tabletop", "booth", "pavilion", "sponsorship", "reception"];

function research(sourceId: string): Research | null {
  const path = join(ROOT, "data/ai-research/costs", `${sourceId}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

/** The official exhibit option matching the expected kind, else the first available in KIND_ORDER. */
function pickOption(options: ResearchOption[], expected: ExhibitKind | undefined) {
  const usable = options.filter((option) => option.official && typeof option.amount === "number" && KIND[option.kind] && current(option) && !option.per_unit);
  const byKind = (kind: ExhibitKind) => usable.filter((option) => KIND[option.kind] === kind).sort((a, b) => Number(a.amount) - Number(b.amount))[0];
  if (expected && expected !== "none" && byKind(expected)) return byKind(expected);
  for (const kind of KIND_ORDER) if (byKind(kind)) return byKind(kind);
  return null;
}

const { data: events, error } = await supabase.from("events").select("*").eq("status", "active");
if (error) throw error;
const { data: settingsRows } = await supabase.from("budget_settings").select("*").order("fiscal_year");
const settingsFor = (fy: number) => {
  const rows = (settingsRows || []) as BudgetSettings[];
  const match = [...rows].reverse().find((row) => row.fiscal_year <= fy) || rows[0];
  return match ? { ...match, fiscal_year: fy } : null;
};

const tally = { events: 0, website: 0, earlier: 0, budget: 0, exhibitPrices: 0 };
for (const event of events || []) {
  const a = assumptions[event.source_id];
  const r = research(event.source_id);
  if (!a && !r) continue;
  const items: Partial<Record<CostItemKey, CostItem>> = { ...(event.cost_items || {}) };
  const update: Record<string, unknown> = {};
  const checked = r?.checked_on || "2026-11-23";

  // Registration: official website research > earlier website research > budget line.
  if (!items.registration) {
    const reg = r?.registration;
    const earlier = earlierFees[event.source_id];
    if (reg?.official && typeof reg.amount === "number" && current(reg)) {
      items.registration = { amount: reg.amount, source: "website", url: reg.url, checked_on: checked, note: [reg.rate, reg.edition ? `${reg.edition} edition` : null, reg.note].filter(Boolean).join("; ") || undefined };
      tally.website += 1;
    } else if (earlier && typeof earlier.fee_usd === "number") {
      items.registration = { amount: earlier.fee_usd, source: earlier.source ? "website" : "cost_file", url: earlier.source, checked_on: "2026-11-20", note: "Researched 2026-11-20" };
      tally.earlier += 1;
    } else if (a && typeof a.budget_registration === "number") {
      const people = Math.max(1, a.people || 1);
      items.registration = { amount: Math.round(a.budget_registration / people), source: "budget", note: `FY27 budget line${people > 1 ? `, split across ${people} people` : ""}` };
      tally.budget += 1;
    } else if (a && typeof a.fee === "number") {
      items.registration = { amount: a.fee, source: "cost_file", note: "Earlier cost file" };
      tally.earlier += 1;
    }
  }

  // Exhibit option and its price: official website only (otherwise the estimate uses the default rates).
  const expected = a?.exhibit ? KIND[a.exhibit] : undefined;
  const option = r?.exhibit_options ? pickOption(r.exhibit_options, expected) : null;
  if (!event.exhibit_kind) update.exhibit_kind = option ? KIND[option.kind] : expected ?? null;
  if (option && !items.exhibit_space) {
    items.exhibit_space = { amount: Number(option.amount), source: "website", url: option.url, checked_on: checked, note: [option.name, option.edition ? `${option.edition} edition` : null].filter(Boolean).join("; ") || undefined };
    if (!event.included_registrations && option.included_registrations) update.included_registrations = option.included_registrations;
    tally.exhibitPrices += 1;
  }
  // No official exhibit price: fall back to the earlier cost file (budget lines and 2026 actuals).
  if (!items.exhibit_space && typeof a?.exhibit_space === "number" && a.exhibit_space > 0) {
    items.exhibit_space = { amount: a.exhibit_space, source: "cost_file", note: a.note ? `Earlier cost file: ${a.note}` : "Earlier cost file" };
  }
  if (!items.shipping_setup && r?.shipping_setup?.official && typeof r.shipping_setup.amount === "number") {
    items.shipping_setup = { amount: r.shipping_setup.amount, source: "website", url: r.shipping_setup.url, checked_on: checked };
  } else if (!items.shipping_setup && typeof a?.exhibit_shipping === "number" && a.exhibit_shipping > 0) {
    items.shipping_setup = { amount: a.exhibit_shipping, source: "cost_file", note: "Earlier cost file" };
  }
  if (!event.package_includes) {
    const includes = [option?.includes, r?.package_includes].filter(Boolean).join("; ");
    if (includes) update.package_includes = includes;
  }
  if (!event.region && a?.region && REGIONS.some(([value]) => value === a.region)) update.region = a.region;
  // Two or more people at a sales-only show is the exception, so carry it over when the earlier work recorded it.
  // Exhibit staffing in the cost file counts everyone, including the marketing traveler.
  if (event.sales_people === null && event.participation === "exhibited" && a?.people_exhibit) update.sales_people = Math.min(Math.max(1, a.people_exhibit - 1), 7);
  else if (event.sales_people === null && a?.people && a.people > 1 && event.participation !== "exhibited") update.sales_people = Math.min(a.people, 7);
  update.cost_items = items;

  const merged = { ...event, ...update } as CostInputs & { starts_on: string | null };
  const settings = settingsFor(fiscalYearOf(event.starts_on || "2026-11-23"));
  const totals = merged.region && settings ? storedEstimate(merged, settings) : {};
  tally.events += 1;
  if (DRY) {
    console.log(`${event.source_id}: region=${merged.region} kind=${merged.exhibit_kind} reg=${items.registration?.amount ?? "-"}(${items.registration?.source ?? "-"}) space=${items.exhibit_space?.amount ?? "-"} → sales $${(totals as { sales_only_cost?: number }).sales_only_cost ?? "-"} / exhibit $${(totals as { exhibit_cost?: number }).exhibit_cost ?? "-"}`);
    continue;
  }
  const { error: updateError } = await supabase.from("events").update({ ...update, ...totals }).eq("id", event.id);
  if (updateError) throw updateError;
}
console.log(`${DRY ? "Would update" : "Updated"} ${tally.events} shows. Registration: ${tally.website} from show websites (new research), ${tally.earlier} from earlier research or cost file, ${tally.budget} from the budget. Exhibit prices from show websites: ${tally.exhibitPrices}.`);

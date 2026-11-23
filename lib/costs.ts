/**
 * Show cost estimates, budget roll-up and staff capacity.
 *
 * Each show's estimate is built from its own inputs (region, staffing, priced items) and the fiscal
 * year's rates. Priced items carry their source, in order of preference: the show's official website,
 * then the budget or the earlier cost file, then an assumption (a default from the rates).
 */

export const REGIONS = [
  ["local", "Jacksonville (local)"], ["florida", "Florida"], ["southeast", "U.S. Southeast"], ["gulf", "U.S. Gulf"],
  ["midwest", "U.S. Midwest"], ["northeast", "U.S. Northeast"], ["west", "U.S. West Coast"], ["caribbean", "Caribbean"],
  ["latam", "Latin America"], ["europe", "Europe"], ["asia", "Asia"], ["international", "Other international"],
] as const;
export type Region = (typeof REGIONS)[number][0];

export const EXHIBIT_KINDS = [
  ["none", "No exhibit option"], ["tabletop", "Tabletop"], ["booth", "Booth"], ["pavilion", "Pavilion space"],
  ["sponsorship", "Sponsorship"], ["reception", "Reception / hosted event"],
] as const;
export type ExhibitKind = (typeof EXHIBIT_KINDS)[number][0];

/** Budget lines that pay for shows (FY27 Cost Center 190 accounts). */
export const BUDGET_LINES = [
  { key: "travel", label: "Travel & per diem", account: "5630" },
  { key: "fees", label: "Registration & exhibit fees", account: "5645" },
  { key: "exhibit", label: "Exhibit shipping, setup & receptions", account: "5673" },
  { key: "sponsorship", label: "Sponsorships", account: "5655" },
  { key: "entertainment", label: "Customer entertainment", account: "5650" },
] as const;
export type Line = (typeof BUDGET_LINES)[number]["key"];
export type Lines = Record<Line, number>;
const emptyLines = (): Lines => ({ travel: 0, fees: 0, exhibit: 0, sponsorship: 0, entertainment: 0 });

export type CostSource = "website" | "budget" | "cost_file" | "assumption";
export const COST_SOURCE_LABELS: Record<CostSource, string> = {
  website: "Show website", budget: "Budget", cost_file: "Earlier cost file", assumption: "Assumption",
};
export interface CostItem { amount: number | null; source?: CostSource; url?: string; checked_on?: string; note?: string }
export type CostItemKey = "registration" | "exhibit_space" | "sponsorship" | "shipping_setup";
export const COST_ITEM_LABELS: Record<CostItemKey, string> = {
  registration: "Registration (per person)", exhibit_space: "Exhibit space / package", sponsorship: "Sponsorship", shipping_setup: "Shipping & setup",
};

export interface BudgetSettings {
  fiscal_year: number;
  allocation: Lines;
  staff: { sales_people: number; marketing_people: number; show_days_per_person: number };
  rates: {
    travel_per_person: Record<Region, number>;
    travel_days: Record<Region, number>;
    default_people: { sales_only: number; exhibit: number };
    exhibit_defaults: Partial<Record<ExhibitKind, { space: number; shipping_setup: number }>>;
    unknown_registration_per_person: number;
    entertainment_per_show: number;
  };
  notes?: string | null;
}

export interface CostInputs {
  starts_on: string | null;
  ends_on: string | null;
  region?: Region | null;
  exhibit_kind?: ExhibitKind | null;
  /** Planned sales/management travelers for the current plan's option (the other option uses the default). */
  sales_people?: number | null;
  marketing_traveler?: boolean | null;
  /** The plan, which decides which option sales_people applies to (exhibited = exhibit, anything else = sales only). */
  participation?: "exhibited" | "attended" | "did_not_attend" | "unknown" | null;
  cost_items?: Partial<Record<CostItemKey, CostItem>> | null;
  included_registrations?: number | null;
}

export type Option = "sales_only" | "exhibit";

export interface Estimate {
  option: Option;
  total: number;
  lines: Lines;
  /** The same total by item, for display: registrations, exhibit space, shipping, sponsorship, travel, entertainment. */
  items: { registration: number; space: number; shipping: number; sponsorship: number; travel: number; entertainment: number };
  salesTravelers: number;
  marketingTravelers: number;
  /** Show days (inclusive of both dates) plus travel days for the region. */
  daysPerPerson: number;
  staffDays: { sales: number; marketing: number };
  /** Inputs filled with a default from the rates. */
  assumed: string[];
  /** Inputs with no value at all (the estimate leaves them out). */
  missing: string[];
}

const DAY = 86_400_000;
export function showDays(start: string | null, end: string | null) {
  if (!start) return 1;
  const days = Math.round((Date.parse(`${end || start}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / DAY) + 1;
  return Math.max(1, days);
}

const amountOf = (item?: CostItem | null) =>
  item && item.amount !== null && item.amount !== undefined && !Number.isNaN(Number(item.amount)) ? Number(item.amount) : null;

/** Estimate one participation option for a show. */
export function estimate(show: CostInputs, settings: BudgetSettings, option: Option): Estimate {
  const { rates } = settings;
  const items = show.cost_items || {};
  const assumed: string[] = [];
  const missing: string[] = [];
  const lines = emptyLines();
  const detail = { registration: 0, space: 0, shipping: 0, sponsorship: 0, travel: 0, entertainment: 0 };

  const plannedOption: Option = show.participation === "exhibited" ? "exhibit" : "sales_only";
  const salesTravelers = Math.max(0, (option === plannedOption ? show.sales_people : null) ?? rates.default_people[option]);
  const marketingTravelers = option === "exhibit" && show.marketing_traveler !== false && settings.staff.marketing_people > 0 ? 1 : 0;
  const travelers = salesTravelers + marketingTravelers;

  if (show.region) lines.travel = travelers * (rates.travel_per_person[show.region] ?? 0);
  else missing.push("region");

  let registration = amountOf(items.registration);
  if (registration === null) {
    registration = rates.unknown_registration_per_person;
    assumed.push("registration fee");
  }
  const paidRegistrations = option === "exhibit" ? Math.max(0, travelers - (show.included_registrations || 0)) : travelers;
  lines.fees += paidRegistrations * registration;
  detail.registration = paidRegistrations * registration;

  if (option === "exhibit") {
    const kind: ExhibitKind = show.exhibit_kind && show.exhibit_kind !== "none" ? show.exhibit_kind : "booth";
    if (!show.exhibit_kind || show.exhibit_kind === "none") assumed.push(show.exhibit_kind === "none" ? "exhibit option (none listed)" : "exhibit type");
    const defaults = rates.exhibit_defaults[kind] || rates.exhibit_defaults.booth || { space: 0, shipping_setup: 0 };
    let space = amountOf(items.exhibit_space);
    if (space === null) { space = defaults.space; if (space > 0) assumed.push(`${kind} price`); }
    // A sponsorship package is paid from the sponsorship line; other exhibit space from fees.
    // Sponsorship packages are paid from the sponsorship line, hosted receptions from promotional materials
    // (as the FY27 budget does for the TPM reception), and exhibit space from registration & fees.
    if (kind === "sponsorship") { lines.sponsorship += space; detail.sponsorship += space; }
    else if (kind === "reception") { lines.exhibit += space; detail.space = space; }
    else { lines.fees += space; detail.space = space; }
    let shipping = amountOf(items.shipping_setup);
    if (shipping === null) { shipping = defaults.shipping_setup; if (shipping > 0) assumed.push("shipping & setup"); }
    lines.exhibit += shipping;
    detail.shipping = shipping;
    const sponsorship = amountOf(items.sponsorship);
    if (sponsorship !== null && kind !== "sponsorship") { lines.sponsorship += sponsorship; detail.sponsorship += sponsorship; }
  }

  lines.entertainment = rates.entertainment_per_show;
  detail.travel = lines.travel;
  detail.entertainment = lines.entertainment;
  const daysPerPerson = showDays(show.starts_on, show.ends_on) + (show.region ? rates.travel_days[show.region] ?? 0 : 0);
  return {
    option,
    total: Object.values(lines).reduce((sum, value) => sum + value, 0),
    lines,
    items: detail,
    salesTravelers,
    marketingTravelers,
    daysPerPerson,
    staffDays: { sales: salesTravelers * daysPerPerson, marketing: marketingTravelers * daysPerPerson },
    assumed,
    missing,
  };
}

/** "Complete", or what the estimate had to assume or leave out. */
export function estimateQuality(e: Estimate) {
  if (!e.assumed.length && !e.missing.length) return "Complete";
  const parts = [...e.missing.map((item) => `missing ${item}`), ...e.assumed.map((item) => `assumed ${item}`)];
  return `Partial: ${parts.join(", ")}`;
}

// ---- Fiscal years (October through September) ----

/** FY27 = Oct 1, 2026 – Sep 30, 2027. */
export function fiscalYearOf(date: string) {
  const [year, month] = date.split("-").map(Number);
  return month >= 10 ? year + 1 : year;
}
export function fiscalYearRange(fy: number): [string, string] {
  return [`${fy - 1}-10-01`, `${fy}-09-30`];
}
export const fiscalYearLabel = (fy: number) => `FY${String(fy).slice(-2)}`;

// ---- Portfolio roll-up ----

export interface PortfolioShow extends CostInputs {
  id: string;
  name: string;
  past: boolean;
  /** What this scenario does at the show; null = not taking part; "undecided" = no decision yet. */
  option: Option | null | "undecided";
  /** Actual total cost recorded after the show, if any. */
  actualCost?: number | null;
  /** Value used to decide what to cut first (e.g. the AI opportunity score, 0-100). */
  value?: number | null;
  exhibitValue?: number | null;
}

export interface PlannedLine { show: PortfolioShow; estimate: Estimate | null; cost: number; usesActual: boolean }

export interface Rollup {
  shows: PlannedLine[];
  undecided: PortfolioShow[];
  lines: Record<Line, { allocated: number; planned: number }>;
  allocated: number;
  planned: number;
  /** Recorded actual costs to date (past shows with results). */
  actualToDate: number;
  staff: { salesDays: number; salesCapacity: number; marketingDays: number; marketingCapacity: number; exhibitShows: number };
  conflicts: Conflict[];
}

export function rollup(shows: PortfolioShow[], settings: BudgetSettings): Rollup {
  const lines = Object.fromEntries(BUDGET_LINES.map(({ key }) => [key, { allocated: Number(settings.allocation[key] || 0), planned: 0 }])) as Rollup["lines"];
  const planned: PlannedLine[] = [];
  for (const show of shows) {
    if (show.option !== "sales_only" && show.option !== "exhibit") continue;
    const est = estimate(show, settings, show.option);
    const actual = show.past && typeof show.actualCost === "number" ? show.actualCost : null;
    // Actual costs aren't split by line; spread them in the estimate's proportions so line totals stay comparable.
    const scale = actual !== null && est.total > 0 ? actual / est.total : 1;
    for (const { key } of BUDGET_LINES) lines[key].planned += est.lines[key] * scale;
    planned.push({ show, estimate: est, cost: actual ?? est.total, usesActual: actual !== null });
  }
  const capacity = settings.staff.show_days_per_person;
  const exhibitLines = planned.filter((line) => line.show.option === "exhibit");
  return {
    shows: planned,
    undecided: shows.filter((show) => show.option === "undecided"),
    lines,
    allocated: Object.values(lines).reduce((sum, line) => sum + line.allocated, 0),
    planned: planned.reduce((sum, line) => sum + line.cost, 0),
    actualToDate: planned.filter((line) => line.usesActual).reduce((sum, line) => sum + line.cost, 0),
    staff: {
      salesDays: planned.reduce((sum, line) => sum + (line.estimate?.staffDays.sales || 0), 0),
      salesCapacity: settings.staff.sales_people * capacity,
      marketingDays: planned.reduce((sum, line) => sum + (line.estimate?.staffDays.marketing || 0), 0),
      marketingCapacity: settings.staff.marketing_people * capacity,
      exhibitShows: exhibitLines.length,
    },
    conflicts: findConflicts(planned, settings),
  };
}

// ---- Date conflicts ----

export interface Conflict {
  kind: "sales" | "marketing";
  from: string;
  to: string;
  shows: string[];
  needed: number;
  available: number;
}

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** Days when overlapping shows need more travelers than the team has (show dates only, not travel days). */
export function findConflicts(planned: PlannedLine[], settings: BudgetSettings): Conflict[] {
  const byDay = new Map<string, PlannedLine[]>();
  for (const line of planned) {
    if (!line.show.starts_on || !line.estimate) continue;
    const days = showDays(line.show.starts_on, line.show.ends_on);
    for (let i = 0; i < days; i += 1) {
      const day = addDays(line.show.starts_on, i);
      byDay.set(day, [...(byDay.get(day) || []), line]);
    }
  }
  const conflicts: Conflict[] = [];
  const check = (kind: Conflict["kind"], available: number, need: (line: PlannedLine) => number) => {
    let open: Conflict | null = null;
    for (const day of [...byDay.keys()].sort()) {
      const lines = (byDay.get(day) || []).filter((line) => need(line) > 0);
      const needed = lines.reduce((sum, line) => sum + need(line), 0);
      const names = lines.map((line) => line.show.name).sort();
      if (needed > available && lines.length > 1) {
        if (open && open.to === addDays(day, -1) && open.shows.join("|") === names.join("|")) open.to = day;
        else { open = { kind, from: day, to: day, shows: names, needed, available }; conflicts.push(open); }
        open.needed = Math.max(open.needed, needed);
      } else open = null;
    }
  };
  check("sales", settings.staff.sales_people, (line) => line.estimate?.salesTravelers || 0);
  check("marketing", settings.staff.marketing_people, (line) => line.estimate?.marketingTravelers || 0);
  return conflicts;
}

// ---- What fits ----

export interface FitAction {
  show: PortfolioShow;
  action: "sales_only" | "skip";
  saves: number;
  savesSalesDays: number;
  savesMarketingDays: number;
  /** Value given up per $1,000 saved (lower = cut first). */
  valuePerThousand: number;
}

/**
 * If a scenario is over its total allocation or staff capacity, suggest the cheapest changes in value:
 * first downgrading exhibits to sales only, then skipping shows, lowest value per dollar first.
 * Past shows aren't changed.
 */
export function whatFits(result: Rollup, settings: BudgetSettings) {
  let overBudget = result.planned - result.allocated;
  let overSales = result.staff.salesDays - result.staff.salesCapacity;
  let overMarketing = result.staff.marketingDays - result.staff.marketingCapacity;
  const actions: FitAction[] = [];
  if (overBudget <= 0 && overSales <= 0 && overMarketing <= 0) return { fits: true, actions, overBudget, overSales, overMarketing };

  const upcoming = result.shows.filter((line) => !line.show.past && line.estimate);
  const candidates: FitAction[] = [];
  for (const line of upcoming) {
    const est = line.estimate as Estimate;
    if (line.show.option === "exhibit") {
      const sales = estimate(line.show, settings, "sales_only");
      const saves = est.total - sales.total;
      if (saves > 0) candidates.push({
        show: line.show, action: "sales_only", saves,
        savesSalesDays: est.staffDays.sales - sales.staffDays.sales, savesMarketingDays: est.staffDays.marketing,
        valuePerThousand: ((line.show.exhibitValue ?? 50) / saves) * 1000,
      });
    }
    candidates.push({
      show: line.show, action: "skip", saves: est.total, savesSalesDays: est.staffDays.sales, savesMarketingDays: est.staffDays.marketing,
      valuePerThousand: est.total > 0 ? ((line.show.value ?? 50) / est.total) * 1000 : Infinity,
    });
  }
  // Downgrades first (the show still happens), then skips; within each, least value per dollar first.
  candidates.sort((a, b) => (a.action === b.action ? a.valuePerThousand - b.valuePerThousand : a.action === "sales_only" ? -1 : 1));
  const changed = new Set<string>();
  for (const candidate of candidates) {
    if (overBudget <= 0 && overSales <= 0 && overMarketing <= 0) break;
    if (changed.has(candidate.show.id)) continue;
    const helps = (overBudget > 0 && candidate.saves > 0) || (overSales > 0 && candidate.savesSalesDays > 0) || (overMarketing > 0 && candidate.savesMarketingDays > 0);
    if (!helps) continue;
    actions.push(candidate);
    changed.add(candidate.show.id);
    overBudget -= candidate.saves;
    overSales -= candidate.savesSalesDays;
    overMarketing -= candidate.savesMarketingDays;
  }
  return { fits: overBudget <= 0 && overSales <= 0 && overMarketing <= 0, actions, overBudget, overSales, overMarketing };
}

/**
 * The totals stored on the event (exhibit_cost, sales_only_cost and their line items), so pages that only
 * read the event, like the assessment form, show the current estimate. Item keys match the form's labels.
 */
export function storedEstimate(show: CostInputs, settings: BudgetSettings) {
  const sales = estimate(show, settings, "sales_only");
  const exhibit = estimate(show, settings, "exhibit");
  const breakdown = (e: Estimate) => Object.fromEntries(Object.entries({
    registration: e.items.registration, booth_sponsorship: e.items.space + e.items.sponsorship, travel_lodging: e.items.travel,
    freight_drayage: e.items.shipping, entertainment: e.items.entertainment,
  }).filter(([, value]) => value > 0).map(([key, value]) => [key, Math.round(value)]));
  return {
    sales_only_cost: Math.round(sales.total),
    exhibit_cost: show.exhibit_kind === "none" ? null : Math.round(exhibit.total),
    sales_cost_breakdown: breakdown(sales),
    exhibit_cost_breakdown: show.exhibit_kind === "none" ? {} : breakdown(exhibit),
  };
}

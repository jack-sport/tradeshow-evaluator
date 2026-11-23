import { describe, expect, it } from "vitest";
import { type BudgetSettings, type PortfolioShow, estimate, estimateQuality, fiscalYearOf, fiscalYearRange, rollup, showDays, whatFits } from "@/lib/costs";

const settings: BudgetSettings = {
  fiscal_year: 2027,
  allocation: { travel: 10000, fees: 5000, exhibit: 3000, sponsorship: 1000, entertainment: 500 },
  staff: { sales_people: 7, marketing_people: 1, show_days_per_person: 100 },
  rates: {
    travel_per_person: { local: 0, florida: 1150, southeast: 1620, gulf: 1825, midwest: 1620, northeast: 2160, west: 3000, caribbean: 2160, latam: 4000, europe: 4320, asia: 5000, international: 6480 },
    travel_days: { local: 0, florida: 1, southeast: 1, gulf: 1, midwest: 1, northeast: 1, west: 2, caribbean: 2, latam: 2, europe: 2, asia: 3, international: 2 },
    default_people: { sales_only: 1, exhibit: 2 },
    exhibit_defaults: { tabletop: { space: 2500, shipping_setup: 1000 }, booth: { space: 7300, shipping_setup: 6300 } },
    unknown_registration_per_person: 1000,
    entertainment_per_show: 150,
  },
};

const website = (amount: number) => ({ amount, source: "website" as const, url: "https://example.org/register" });

describe("show cost estimates", () => {
  const show = { starts_on: "2027-02-21", ends_on: "2027-02-24", region: "florida" as const, exhibit_kind: "booth" as const,
    cost_items: { registration: website(1300), exhibit_space: website(7750), shipping_setup: website(1456) }, included_registrations: 2 };

  it("counts show days inclusively", () => {
    expect(showDays("2027-02-21", "2027-02-24")).toBe(4);
    expect(showDays("2027-02-21", null)).toBe(1);
    expect(showDays(null, null)).toBe(1);
  });

  it("estimates sales only: one person by default", () => {
    const e = estimate(show, settings, "sales_only");
    expect(e.lines).toEqual({ travel: 1150, fees: 1300, exhibit: 0, sponsorship: 0, entertainment: 150 });
    expect(e.total).toBe(2600);
    expect(e.staffDays).toEqual({ sales: 5, marketing: 0 });
    expect(estimateQuality(e)).toBe("Complete");
  });

  it("estimates an exhibit: 2 sales plus the marketing traveler, less included registrations", () => {
    const e = estimate(show, settings, "exhibit");
    expect(e.salesTravelers + e.marketingTravelers).toBe(3);
    expect(e.lines.travel).toBe(3450);
    expect(e.lines.fees).toBe(1300 + 7750); // one paid registration (3 travelers, 2 included) + booth
    expect(e.lines.exhibit).toBe(1456);
    expect(e.staffDays).toEqual({ sales: 10, marketing: 5 });
  });

  it("uses planned staffing and leaves out the marketing traveler when told", () => {
    const e = estimate({ ...show, participation: "exhibited", sales_people: 1, marketing_traveler: false }, settings, "exhibit");
    expect(e.marketingTravelers).toBe(0);
    expect(e.lines.travel).toBe(1150);
  });

  it("fills gaps with defaults and says so", () => {
    const e = estimate({ starts_on: "2027-03-01", ends_on: "2027-03-03", region: null }, settings, "exhibit");
    expect(e.missing).toEqual(["region"]);
    expect(e.assumed).toEqual(["registration fee", "exhibit type", "booth price", "shipping & setup"]);
    expect(e.lines.fees).toBe(3 * 1000 + 7300);
    expect(estimateQuality(e)).toMatch(/^Partial: missing region, assumed registration fee/);
  });

  it("pays a hosted reception from the promotional (exhibit) line", () => {
    const e = estimate({ ...show, exhibit_kind: "reception", cost_items: { registration: website(500), exhibit_space: website(18000), shipping_setup: website(0) } }, settings, "exhibit");
    expect(e.lines.exhibit).toBe(18000);
  });
  it("pays a sponsorship package from the sponsorship line", () => {
    const e = estimate({ ...show, exhibit_kind: "sponsorship", cost_items: { registration: website(500), exhibit_space: website(4000) } }, settings, "exhibit");
    expect(e.lines.sponsorship).toBe(4000);
    expect(e.lines.fees).toBe(500);
  });
});

describe("fiscal years", () => {
  it("runs October through September", () => {
    expect(fiscalYearOf("2026-10-01")).toBe(2027);
    expect(fiscalYearOf("2027-09-30")).toBe(2027);
    expect(fiscalYearOf("2027-10-01")).toBe(2028);
    expect(fiscalYearRange(2027)).toEqual(["2026-10-01", "2027-09-30"]);
  });
});

describe("portfolio roll-up", () => {
  const base = { region: "southeast" as const, cost_items: { registration: website(1000) } };
  const shows: PortfolioShow[] = [
    { ...base, id: "a", name: "Show A", starts_on: "2027-03-01", ends_on: "2027-03-02", past: false, option: "exhibit", value: 80, exhibitValue: 40, exhibit_kind: "tabletop" },
    { ...base, id: "b", name: "Show B", starts_on: "2027-03-02", ends_on: "2027-03-03", past: false, option: "exhibit", value: 60, exhibitValue: 70, exhibit_kind: "tabletop" },
    { ...base, id: "c", name: "Show C", starts_on: "2026-11-01", ends_on: "2026-11-01", past: true, option: "sales_only", actualCost: 4000 },
    { ...base, id: "d", name: "Show D", starts_on: "2027-05-01", ends_on: "2027-05-01", past: false, option: "undecided" },
    { ...base, id: "e", name: "Show E", starts_on: "2027-06-01", ends_on: "2027-06-01", past: false, option: null },
  ];
  const result = rollup(shows, settings);

  it("adds planned costs, uses actuals for past shows, and lists undecided shows", () => {
    expect(result.shows.map((line) => line.show.id)).toEqual(["a", "b", "c"]);
    expect(result.undecided.map((show) => show.id)).toEqual(["d"]);
    expect(result.actualToDate).toBe(4000);
    const a = result.shows[0].cost; // 3 × 1620 travel + 3 × 1000 reg + 2500 tabletop + 1000 shipping + 150
    expect(a).toBe(4860 + 3000 + 2500 + 1000 + 150);
    expect(result.planned).toBe(a * 2 + 4000);
    const lineSum = Object.values(result.lines).reduce((sum, line) => sum + line.planned, 0);
    expect(lineSum).toBeCloseTo(result.planned, 6);
  });

  it("counts staff days and the exhibit shows needing the marketing traveler", () => {
    expect(result.staff.marketingDays).toBe(3 + 3);
    expect(result.staff.exhibitShows).toBe(2);
    expect(result.staff.salesCapacity).toBe(700);
  });

  it("flags overlapping exhibit shows that both need the one marketing traveler", () => {
    expect(result.conflicts).toEqual([{ kind: "marketing", from: "2027-03-02", to: "2027-03-02", shows: ["Show A", "Show B"], needed: 2, available: 1 }]);
  });

  it("suggests the lowest-value changes until the scenario fits", () => {
    const fit = whatFits(result, settings);
    expect(result.planned).toBeGreaterThan(result.allocated);
    expect(fit.actions[0]).toMatchObject({ action: "sales_only" });
    expect(fit.actions[0].show.id).toBe("a"); // lower exhibit value than B
    expect(fit.fits).toBe(true);
    expect(whatFits(rollup(shows.slice(2), settings), settings).actions).toEqual([]);
  });
});

describe("planned staffing", () => {
  const show = { starts_on: "2027-03-01", ends_on: "2027-03-02", region: "gulf" as const, exhibit_kind: "booth" as const, sales_people: 3 };
  it("applies to the planned option only; the other option uses the default", () => {
    expect(estimate({ ...show, participation: "exhibited" }, settings, "exhibit").salesTravelers).toBe(3);
    expect(estimate({ ...show, participation: "exhibited" }, settings, "sales_only").salesTravelers).toBe(1);
    expect(estimate({ ...show, participation: "attended" }, settings, "sales_only").salesTravelers).toBe(3);
    expect(estimate({ ...show, participation: "attended" }, settings, "exhibit").salesTravelers).toBe(2);
  });
});

describe("what fits ordering", () => {
  it("downgrades exhibits before skipping any show, even a cheap-per-point one", () => {
    const base = { region: "southeast" as const, exhibit_kind: "tabletop" as const, cost_items: { registration: website(1000) } };
    const shows: PortfolioShow[] = [
      { ...base, id: "x", name: "High value exhibit", starts_on: "2027-03-01", ends_on: "2027-03-01", past: false, option: "exhibit", value: 90, exhibitValue: 80 },
      { ...base, id: "y", name: "Sales show", starts_on: "2027-04-01", ends_on: "2027-04-01", past: false, option: "sales_only", value: 20 },
    ];
    const tight = { ...settings, allocation: { travel: 4000, fees: 2000, exhibit: 0, sponsorship: 0, entertainment: 300 } };
    const fit = whatFits(rollup(shows, tight), tight);
    expect(fit.actions[0]).toMatchObject({ action: "sales_only" });
    expect(fit.actions[0].show.id).toBe("x");
  });
});

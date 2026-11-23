import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, PAST_COLUMNS, UPCOMING_COLUMNS, buildRows, filterRows, parseState, sortRows, stateToQuery, toCsv, visibleColumns } from "@/lib/portfolio";
import type { Evaluation, Event, EventResults } from "@/lib/types";

const event = (id: string, name: string, starts_on: string | null, extra: Partial<Event> = {}): Event => ({
  id, name, location: "Orlando, FL", starts_on, ends_on: starts_on, event_tier: "regional", status: "active",
  exhibit_cost: null, sales_only_cost: null, high_value_targets: null, notes: null, participation: "unknown", ...extra,
});
const evaluation = (event_id: string, extra: Partial<Evaluation> = {}): Evaluation => ({
  id: `ev-${event_id}`, event_id, evaluator_id: "me", status: "draft", recommendation: null, comments: null,
  opportunity_score: null, exhibit_score: null, submitted_at: null, updated_at: "2026-01-01", ...extra,
});
const result = (event_id: string, extra: Partial<EventResults> = {}): EventResults => ({
  event_id, participation: "exhibited", staff_count: 3, show_hours: 10, contacts: null, meetings: null,
  qualified_leads: null, opportunities: null, actual_cost: null, notes: null, ...extra,
});

const TODAY = "2026-11-23";
const events = [
  event("rila", "RILA LINK", "2026-02-22", { event_tier: "major", participation: "exhibited", meeting_goal: 10, contact_goal: 50 }),
  event("bba", "Breakbulk Americas", "2026-09-29", { event_tier: "major", location: "Houston, TX", participation: "exhibited", meeting_goal: 20 }),
  event("tpm", "TPM 2027", "2027-03-01", { event_tier: "major", location: "Long Beach, CA", exhibit_cost: 40000 }),
  event("csa", "Caribbean Shipping Association", "2027-05-10", { location: "Guadeloupe", exhibit_cost: 12000 }),
  event("tbd", "Undated Summit", null),
];
const rows = buildRows(
  events,
  [evaluation("tpm", { status: "submitted", recommendation: "exhibit", opportunity_score: 80 }), evaluation("csa")],
  [evaluation("rila", { evaluator_id: "ai", recommendation: "exhibit", opportunity_score: 70 }), evaluation("bba", { evaluator_id: "ai", recommendation: "skip" })],
  [result("rila", { meetings: 12, contacts: 59, actual_cost: 19416.3, lead_revenue_value: 50000 }), result("bba", { meetings: 15, contacts: 167, actual_cost: 23164 })],
  TODAY,
);
const byId = (id: string) => rows.find((row) => row.id === id)!;

describe("dashboard rows", () => {
  it("joins events, own and AI evaluations, and results", () => {
    expect(byId("rila")).toMatchObject({ past: true, aiRecommendation: "exhibit", aiMatch: true, myStatus: "not_started", hasResults: true, goalOutcome: "met" });
    expect(byId("rila").hardDollarRoi).toBeCloseTo(1.575, 3);
    expect(byId("bba")).toMatchObject({ aiMatch: false, goalOutcome: "missed" });
    expect(byId("tpm")).toMatchObject({ past: false, myStatus: "submitted", myRecommendation: "exhibit", myOpportunity: 80, aiMatch: null, goalOutcome: null });
    expect(byId("csa").myStatus).toBe("draft");
    expect(byId("tbd").past).toBe(false);
  });
});

describe("search and filters", () => {
  const names = (state: Partial<typeof DEFAULT_STATE>) => filterRows(rows, { ...DEFAULT_STATE, ...state }).map((row) => row.id).sort();
  it("searches name and location, every word must match", () => {
    expect(names({ q: "breakbulk" })).toEqual(["bba"]);
    expect(names({ q: "houston" })).toEqual(["bba"]);
    expect(names({ q: "  long   BEACH " })).toEqual(["tpm"]);
    expect(names({ q: "rila houston" })).toEqual([]);
  });
  it("filters by when, tier, participation, recommendations, status and results", () => {
    expect(names({ when: "past" })).toEqual(["bba", "rila"]);
    expect(names({ when: "upcoming" })).toEqual(["csa", "tbd", "tpm"]);
    expect(names({ tier: "major", when: "upcoming" })).toEqual(["tpm"]);
    expect(names({ participation: "unknown" })).toEqual(["csa", "tbd", "tpm"]);
    expect(names({ ai: "skip" })).toEqual(["bba"]);
    expect(names({ ai: "none" })).toEqual(["csa", "tbd", "tpm"]);
    expect(names({ mine: "exhibit" })).toEqual(["tpm"]);
    expect(names({ status: "not_started" })).toEqual(["bba", "rila", "tbd"]);
    expect(names({ results: "goal_met" })).toEqual(["rila"]);
    expect(names({ results: "goal_missed" })).toEqual(["bba"]);
    expect(names({ results: "no_results" })).toEqual(["csa", "tbd", "tpm"]);
  });
});

describe("sorting", () => {
  const upcoming = rows.filter((row) => !row.past);
  const past = rows.filter((row) => row.past);
  it("defaults to soonest upcoming first (undated last) and most recent past first", () => {
    expect(sortRows(upcoming, UPCOMING_COLUMNS, null, "asc", false).map((row) => row.id)).toEqual(["tpm", "csa", "tbd"]);
    expect(sortRows(past, PAST_COLUMNS, null, "asc", true).map((row) => row.id)).toEqual(["bba", "rila"]);
  });
  it("sorts by a column in either direction and keeps blanks last", () => {
    expect(sortRows(upcoming, UPCOMING_COLUMNS, "exhibit_cost", "desc", false).map((row) => row.id)).toEqual(["tpm", "csa", "tbd"]);
    expect(sortRows(upcoming, UPCOMING_COLUMNS, "exhibit_cost", "asc", false).map((row) => row.id)).toEqual(["csa", "tpm", "tbd"]);
    expect(sortRows(past, PAST_COLUMNS, "soft_roi", "desc", true).map((row) => row.id)).toEqual(["bba", "rila"]);
    expect(sortRows(past, PAST_COLUMNS, "hard_roi", "asc", true).map((row) => row.id)).toEqual(["rila", "bba"]);
  });
  it("uses the default order when the table lacks the sort column", () => {
    expect(sortRows(past, PAST_COLUMNS, "exhibit_cost", "desc", true).map((row) => row.id)).toEqual(["bba", "rila"]);
  });
});

describe("page address", () => {
  it("round-trips state and ignores unexpected values", () => {
    const state = { ...DEFAULT_STATE, q: "rila", when: "past" as const, view: "cards" as const, sort: "soft_roi", dir: "desc" as const };
    const query = stateToQuery(state);
    expect(query).toBe("?q=rila&when=past&view=cards&sort=soft_roi&dir=desc");
    expect(parseState(Object.fromEntries(new URLSearchParams(query)))).toEqual(state);
    expect(parseState({ when: "someday", tier: ["major", "other"], sort: "drop table", view: "list" })).toEqual({ ...DEFAULT_STATE, tier: "major" });
    expect(DEFAULT_STATE.view).toBe("table");
    expect(parseState({ view: "table" }).view).toBe("table");
    expect(stateToQuery(DEFAULT_STATE)).toBe("");
  });
});

describe("spreadsheet download", () => {
  it("writes a header and one line per row with raw numbers, escaping text safely", () => {
    const csv = toCsv([byId("rila"), { ...byId("tbd"), name: '=HYPERLINK("x"), "quoted"' }]);
    expect(csv.startsWith("﻿Show,Start date,")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("RILA LINK,2026-02-22,2026-02-22,\"Orlando, FL\",Past,major,Exhibited,Exhibit + Sales,70,");
    expect(lines[1]).toContain(",10,12,50,59,Met,19416.3,329.09,158,81");
    expect(lines[2].startsWith(`"'=HYPERLINK(""x""), ""quoted"""`)).toBe(true);
  });
});

describe("column choice", () => {
  it("splits scores from % rated so each can be sorted", () => {
    const labels = UPCOMING_COLUMNS.map((item) => item.label);
    expect(labels).toEqual(expect.arrayContaining(["AI opportunity score", "AI % rated", "Your opportunity score", "Your % rated"]));
    expect(parseState({ sort: "ai_coverage" }).sort).toBe("ai_coverage");
  });
  it("hides chosen columns but always keeps the show name", () => {
    const keys = visibleColumns(PAST_COLUMNS, ["name", "tier", "soft_roi", "not-a-column"]).map((item) => item.key);
    expect(keys[0]).toBe("name");
    expect(keys).not.toContain("tier");
    expect(keys).not.toContain("soft_roi");
    expect(keys).toHaveLength(PAST_COLUMNS.length - 2);
  });
});

describe("column tooltips", () => {
  it("explains every AI column in one line", () => {
    const aiColumns = [...UPCOMING_COLUMNS, ...PAST_COLUMNS].filter((item) => item.label.startsWith("AI "));
    expect(aiColumns.map((item) => item.key).sort()).toEqual(["ai", "ai", "ai_coverage", "ai_match", "ai_score"]);
    for (const item of aiColumns) {
      expect(item.description, item.label).toBeTruthy();
      expect(item.description).not.toContain("\n");
    }
  });
});

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Bot, CalendarDays, Columns3, Download, Info, LayoutGrid, MapPin, Plus, RotateCcw, Search, Table2, X } from "lucide-react";
import {
  DEFAULT_STATE, MY_STATUS_LABELS, PAST_COLUMNS, UPCOMING_COLUMNS, activeFilterCount, filterRows, sortRows, stateToQuery, toCsv, visibleColumns,
  type Column, type PortfolioRow, type PortfolioState,
} from "@/lib/portfolio";
import { formatRoi } from "@/lib/results";
import { INSUFFICIENT_COVERAGE, PARTICIPATION_LABELS, formatDateRange, recommendationLabel, scoreLabel } from "@/lib/scoring";

// Fixed locale so the server and browser render identical text.
const fmt = (value: number | null) => (value === null ? "—" : value.toLocaleString("en-US"));
const usd = (value: number | null) => (value === null ? "—" : `$${Math.round(value).toLocaleString("en-US")}`);
const score = (value: number | null) => (value === null ? "—" : value.toFixed(1));
/** "85%", flagged when under half the weight was rated (the score is then labeled "Insufficient data" elsewhere). */
function coverage(value: number | null) {
  if (value === null) return "—";
  const low = value < INSUFFICIENT_COVERAGE;
  return <span className={low ? "low-data" : undefined} title={low ? "Under half the criteria weight was rated: insufficient data" : undefined}>{Math.round(value)}%{low ? " · low" : ""}</span>;
}
/** "12 / 15", green when the goal was met. */
function pair(actual: number | null, goal: number | null) {
  if (goal === null) return fmt(actual);
  const met = actual !== null && goal > 0 && actual >= goal;
  return <span className={met ? "match-yes" : undefined}>{fmt(actual)} / {fmt(goal)}</span>;
}

function Card({ row }: { row: PortfolioRow }) {
  const label = row.myStatus === "submitted" ? "View comparison" : row.myStatus === "draft" ? "Continue assessment" : "Start assessment";
  return (
    <article className="event-card">
      <div className="card-top"><span className={`tier ${row.tier}`}>{row.tier}</span><span className={`status ${row.myStatus === "submitted" ? "complete" : row.myStatus === "draft" ? "draft" : "open"}`}>{MY_STATUS_LABELS[row.myStatus]}</span></div>
      <h3>{row.name}</h3>
      <div className="event-meta"><span><CalendarDays size={16} />{formatDateRange(row.starts_on, row.ends_on)}</span>{row.location && <span><MapPin size={16} />{row.location}</span>}</div>
      <div className="card-facts">
        <span><b>{row.past ? "JAXPORT did" : "Plan"}</b>{PARTICIPATION_LABELS[row.participation]}</span>
        {row.aiRecommendation && <span><b><Bot size={13} /> AI draft</b>{recommendationLabel(row.aiRecommendation)} · {scoreLabel(row.aiScore, row.aiCoverage)}</span>}
      </div>
      {row.myStatus !== "not_started" ? (
        <div className="score-strip">
          <div><strong>{scoreLabel(row.myOpportunity, row.myOpportunityCoverage)}</strong><small>Opportunity</small></div>
          <div><strong>{scoreLabel(row.myExhibit, row.myExhibitCoverage)}</strong><small>Exhibit value</small></div>
          <div className="recommend"><strong>{recommendationLabel(row.myRecommendation)}</strong><small>Your recommendation</small></div>
        </div>
      ) : <div className="empty-state"><Plus size={18} /> Add your assessment</div>}
      <Link className="card-link" href={`/events/${row.id}`}>{label}<ArrowRight size={17} /></Link>
    </article>
  );
}

function cell(row: PortfolioRow, key: string) {
  switch (key) {
    case "name": return <Link href={`/events/${row.id}`} onClick={(event) => event.stopPropagation()}>{row.name}</Link>;
    case "date": return formatDateRange(row.starts_on, row.ends_on);
    case "location": return row.location || "—";
    case "tier": return <span className={`tier ${row.tier}`}>{row.tier}</span>;
    case "participation": return PARTICIPATION_LABELS[row.participation];
    case "ai": return row.aiRecommendation ? recommendationLabel(row.aiRecommendation) : "—";
    case "ai_score": return score(row.aiScore);
    case "ai_coverage": return coverage(row.aiCoverage);
    case "ai_match": return row.aiMatch === null ? "—" : <span className={row.aiMatch ? "match-yes" : "match-no"}>{row.aiMatch ? "Yes" : "No"}</span>;
    case "mine": return row.myRecommendation ? recommendationLabel(row.myRecommendation) : "—";
    case "my_opportunity": return score(row.myOpportunity);
    case "my_coverage": return coverage(row.myOpportunityCoverage);
    case "my_exhibit": return score(row.myExhibit);
    case "status": return MY_STATUS_LABELS[row.myStatus];
    case "exhibit_cost": return usd(row.exhibitCost);
    case "sales_cost": return usd(row.salesOnlyCost);
    case "plan_cost": return usd(row.planCost);
    case "meeting_goal": return fmt(row.meetingGoal);
    case "contact_goal": return fmt(row.contactGoal);
    case "meetings": return pair(row.meetings, row.meetingGoal);
    case "contacts": return pair(row.contacts, row.contactGoal);
    case "actual_cost": return usd(row.actualCost);
    case "cost_per_contact": return usd(row.costPerContact);
    case "hard_roi": return formatRoi(row.hardDollarRoi);
    case "soft_roi": return formatRoi(row.softDollarRoi);
    default: return null;
  }
}

/** Dollar columns totaled in the table footer, for the shows currently listed. */
const TOTAL_KEYS: Record<string, (row: PortfolioRow) => number | null> = {
  exhibit_cost: (row) => row.exhibitCost, sales_cost: (row) => row.salesOnlyCost, plan_cost: (row) => row.planCost, actual_cost: (row) => row.actualCost,
};

function ShowTable({ rows, columns, state, onSort }: { rows: PortfolioRow[]; columns: Column[]; state: PortfolioState; onSort: (column: Column) => void }) {
  const router = useRouter();
  return (
    <div className="table-wrap portfolio-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = state.sort === column.key;
              const Icon = active ? (state.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th key={column.key} aria-sort={active ? (state.dir === "asc" ? "ascending" : "descending") : "none"} className={[column.numeric ? "num" : "", column.description ? "has-tip" : ""].join(" ").trim() || undefined}>
                  <button type="button" onClick={() => onSort(column)} className={active ? "active" : undefined} aria-describedby={column.description ? `tip-${column.key}` : undefined}>
                    {column.label}{column.description && <Info size={12} className="tip-icon" aria-hidden />}<Icon size={13} aria-hidden />
                  </button>
                  {column.description && <span role="tooltip" id={`tip-${column.key}`} className="column-tip">{column.description}</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} onClick={() => router.push(`/events/${row.id}`)}>
              {columns.map((column) => <td key={column.key} className={column.numeric ? "num" : undefined}>{cell(row, column.key)}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            {columns.map((column, index) => {
              const total = TOTAL_KEYS[column.key];
              if (index === 0) return <td key={column.key}>Total · {rows.length} shows</td>;
              if (!total) return <td key={column.key} />;
              const values = rows.map(total).filter((value): value is number => value !== null);
              return <td key={column.key} className="num">{values.length ? usd(values.reduce((sum, value) => sum + value, 0)) : "—"}</td>;
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** "Columns" menu: tick the columns to show. Choices are remembered in this browser. */
function ColumnPicker({ columns, hidden, onChange }: { columns: Column[]; hidden: string[]; onChange: (hidden: string[]) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      const details = ref.current;
      if (!details?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, []);
  const shown = visibleColumns(columns, hidden).length;
  const toggle = (key: string) => onChange(hidden.includes(key) ? hidden.filter((item) => item !== key) : [...hidden, key]);
  return (
    <details className="column-picker" ref={ref}>
      <summary><Columns3 size={16} /> Columns <span>{shown} of {columns.length}</span></summary>
      <div className="picker-panel">
        {columns.map((column) => (
          <label key={column.key} className={column.locked ? "locked" : undefined}>
            <input type="checkbox" checked={column.locked || !hidden.includes(column.key)} disabled={column.locked} onChange={() => toggle(column.key)} />
            {column.label}{column.locked && <small>always shown</small>}
          </label>
        ))}
        <button type="button" className="link-button" onClick={() => onChange([])} disabled={hidden.length === 0}><RotateCcw size={14} /> Show all</button>
      </div>
    </details>
  );
}

type HiddenColumns = { upcoming: string[]; past: string[] };
const COLUMNS_STORAGE_KEY = "portfolio-hidden-columns-v1";

function Select<K extends keyof PortfolioState>({ label, name, state, update, options }: {
  label: string; name: K; state: PortfolioState; update: (patch: Partial<PortfolioState>) => void; options: Array<[string, string]>;
}) {
  return (
    <label className={state[name] !== "all" ? "filter-on" : undefined}>{label}
      <select value={String(state[name])} onChange={(event) => update({ [name]: event.target.value } as Partial<PortfolioState>)}>
        <option value="all">All</option>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  );
}

const RECOMMENDATION_OPTIONS: Array<[string, string]> = [["exhibit", "Exhibit + Sales"], ["sales_only", "Sales Only"], ["skip", "Skip"], ["none", "None yet"]];

/** The dashboard's show list: cards or a sortable table, with search, filters and a spreadsheet download. */
export function Portfolio({ rows, initialState }: { rows: PortfolioRow[]; initialState: PortfolioState }) {
  const [state, setState] = useState<PortfolioState>(initialState);
  const update = (patch: Partial<PortfolioState>) => {
    const next = { ...state, ...patch };
    setState(next);
    window.history.replaceState(null, "", `${window.location.pathname}${stateToQuery(next)}`);
  };
  const filtered = useMemo(() => filterRows(rows, state), [rows, state]);
  const upcoming = useMemo(() => sortRows(filtered.filter((row) => !row.past), UPCOMING_COLUMNS, state.view === "table" ? state.sort : null, state.dir, false), [filtered, state]);
  const past = useMemo(() => sortRows(filtered.filter((row) => row.past), PAST_COLUMNS, state.view === "table" ? state.sort : null, state.dir, true), [filtered, state]);
  const filterCount = activeFilterCount(state);
  // Hidden columns are a per-browser preference; load after the first render so server and browser HTML match.
  const [hidden, setHidden] = useState<HiddenColumns>({ upcoming: [], past: [] });
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(COLUMNS_STORAGE_KEY) || "null");
      if (saved && Array.isArray(saved.upcoming) && Array.isArray(saved.past)) setHidden({ upcoming: saved.upcoming, past: saved.past });
    } catch { /* storage unavailable: show every column */ }
  }, []);
  const setHiddenFor = (table: keyof HiddenColumns, keys: string[]) => {
    const next = { ...hidden, [table]: keys };
    setHidden(next);
    try { window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next)); } catch { /* not remembered, still applied */ }
  };

  const onSort = (column: Column) => {
    if (state.sort === column.key) update({ dir: state.dir === "asc" ? "desc" : "asc" });
    else update({ sort: column.key, dir: column.numeric ? "desc" : "asc" });
  };
  const clear = () => update({ ...DEFAULT_STATE, view: state.view, sort: state.sort, dir: state.dir });
  const download = () => {
    const blob = new Blob([toCsv([...upcoming, ...past])], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jaxport-trade-shows-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const section = (table: keyof HiddenColumns, title: string, description: string, list: PortfolioRow[], columns: Column[], extraClass = "") => (
    <>
      <section className={`section-heading ${extraClass}`}>
        <div><h2>{title}</h2><p>{description}</p></div>
        {state.view === "table" && <ColumnPicker columns={columns} hidden={hidden[table]} onChange={(keys) => setHiddenFor(table, keys)} />}
      </section>
      {list.length === 0 ? <p className="portfolio-empty">No {title.toLowerCase().split(" ")[0]} shows match these filters.</p>
        : state.view === "table" ? <ShowTable rows={list} columns={visibleColumns(columns, hidden[table])} state={state} onSort={onSort} />
        : <div className="event-grid">{list.map((row) => <Card key={row.id} row={row} />)}</div>}
    </>
  );

  return (
    <>
      <section className="portfolio-toolbar" aria-label="Find shows">
        <div className="toolbar-top">
          <label className="search-box"><Search size={17} aria-hidden /><span className="sr-only">Search shows</span>
            <input type="search" placeholder="Search show name or location" value={state.q} onChange={(event) => update({ q: event.target.value })} />
          </label>
          <div className="view-toggle" role="group" aria-label="View">
            <button type="button" aria-pressed={state.view === "cards"} onClick={() => update({ view: "cards" })}><LayoutGrid size={16} /> Cards</button>
            <button type="button" aria-pressed={state.view === "table"} onClick={() => update({ view: "table" })}><Table2 size={16} /> Table</button>
          </div>
        </div>
        <div className="filter-row">
          <Select label="When" name="when" state={state} update={update} options={[["upcoming", "Upcoming"], ["past", "Past"]]} />
          <Select label="Tier" name="tier" state={state} update={update} options={[["major", "Major"], ["regional", "Regional"], ["other", "Other"]]} />
          <Select label="Participation" name="participation" state={state} update={update} options={[["exhibited", "Exhibited / will exhibit"], ["attended", "Attended / sales only"], ["did_not_attend", "Did not attend / skip"], ["unknown", "Unknown"]]} />
          <Select label="AI recommendation" name="ai" state={state} update={update} options={RECOMMENDATION_OPTIONS} />
          <Select label="Your recommendation" name="mine" state={state} update={update} options={RECOMMENDATION_OPTIONS} />
          <Select label="Your status" name="status" state={state} update={update} options={[["not_started", "Not started"], ["draft", "Draft"], ["submitted", "Submitted"]]} />
          <Select label="Results" name="results" state={state} update={update} options={[["has_results", "Has results"], ["no_results", "No results yet"], ["goal_met", "Goals met"], ["goal_missed", "Goal missed"]]} />
        </div>
        <div className="toolbar-bottom">
          <p aria-live="polite"><strong>{filtered.length}</strong> of {rows.length} shows{filterCount > 0 && <> · {filterCount} filter{filterCount === 1 ? "" : "s"} on <button type="button" className="link-button" onClick={clear}><X size={14} /> Clear</button></>}</p>
          <button type="button" className="button secondary" onClick={download} disabled={filtered.length === 0}><Download size={16} /> Download as spreadsheet</button>
        </div>
      </section>

      {state.when !== "past" && section("upcoming", "Upcoming events", `${upcoming.length} shows under consideration`, upcoming, UPCOMING_COLUMNS)}
      {state.when !== "upcoming" && section("past", "Past events (baseline)", `${past.length} events scored to check the scorecard against what JAXPORT actually did`, past, PAST_COLUMNS, state.when === "past" ? "" : "past-heading")}
    </>
  );
}

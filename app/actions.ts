"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreSection, type Ratings } from "@/lib/scoring";
import { getBudgetSettings } from "@/lib/budget-store";
import { BUDGET_LINES, EXHIBIT_KINDS, REGIONS, fiscalYearOf, fiscalYearRange, storedEstimate, type BudgetSettings, type CostItem, type CostItemKey, type CostInputs } from "@/lib/costs";
import type { Criterion, Recommendation, ResponseRow } from "@/lib/types";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function requireAdmin() {
  const { supabase, user } = await currentUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Administrator access required");
  return { supabase, user };
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function updatePassword(formData: FormData) {
  const { supabase } = await currentUser();
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirmation") || "");
  if (password.length < 10) redirect("/set-password?error=Password%20must%20be%20at%20least%2010%20characters.");
  if (password !== confirmation) redirect("/set-password?error=Passwords%20do%20not%20match.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/set-password?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function saveEvaluation(eventId: string, formData: FormData) {
  const { supabase, user } = await currentUser();
  const submit = formData.get("intent") === "submit";
  const { data: criteria, error: criteriaError } = await supabase
    .from("criteria").select("*").eq("active", true).order("sort_order");
  if (criteriaError) throw criteriaError;
  // Each criterion is answered with 1-5 or "unknown" (stored as a null rating).
  const ratings: Ratings = {};
  const responses = (criteria as Criterion[]).flatMap((criterion): ResponseRow[] => {
    const raw = String(formData.get(`rating_${criterion.id}`) || "");
    const comment = String(formData.get(`comment_${criterion.id}`) || "") || null;
    if (raw === "unknown") {
      ratings[criterion.id] = null;
      return [{ criterion_id: criterion.id, rating: null, comment }];
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 5) return [];
    ratings[criterion.id] = value;
    return [{ criterion_id: criterion.id, rating: value, comment }];
  });
  if (submit && responses.length !== criteria.length) throw new Error("Answer every criterion (a rating or Unknown) before submitting.");
  const recommendation = formData.get("recommendation") as Recommendation | null;
  if (submit && !["exhibit", "sales_only", "skip"].includes(recommendation || "")) throw new Error("Select a recommendation.");

  const opportunity = scoreSection(criteria as Criterion[], ratings, "opportunity");
  const exhibit = scoreSection(criteria as Criterion[], ratings, "exhibit");
  const evaluation = {
    event_id: eventId,
    evaluator_id: user.id,
    status: submit ? "submitted" : "draft",
    recommendation: recommendation || null,
    comments: String(formData.get("comments") || "") || null,
    opportunity_score: opportunity.score,
    exhibit_score: exhibit.score,
    opportunity_coverage: opportunity.coverage,
    exhibit_coverage: exhibit.coverage,
    submitted_at: submit ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { data: saved, error } = await supabase.from("evaluations")
    .upsert(evaluation, { onConflict: "event_id,evaluator_id" }).select("id").single();
  if (error) throw error;
  await supabase.from("evaluation_responses").delete().eq("evaluation_id", saved.id);
  if (responses.length) {
    const { error: responseError } = await supabase.from("evaluation_responses")
      .insert(responses.map((response) => ({ ...response, evaluation_id: saved.id })));
    if (responseError) throw responseError;
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  redirect(`/events/${eventId}?saved=${submit ? "submitted" : "draft"}`);
}

export async function createEvent(formData: FormData) {
  const { supabase } = await requireAdmin();
  const exhibitBreakdown = {
    booth_sponsorship: Number(formData.get("exhibit_booth") || 0),
    registration: Number(formData.get("exhibit_registration") || 0),
    travel_lodging: Number(formData.get("exhibit_travel") || 0),
    freight_drayage: Number(formData.get("exhibit_freight") || 0),
    show_services: Number(formData.get("exhibit_services") || 0),
    graphics_materials: Number(formData.get("exhibit_graphics") || 0),
    entertainment: Number(formData.get("exhibit_entertainment") || 0),
    staff_time: Number(formData.get("exhibit_staff") || 0),
  };
  const salesBreakdown = {
    registration: Number(formData.get("sales_registration") || 0),
    travel_lodging: Number(formData.get("sales_travel") || 0),
    entertainment: Number(formData.get("sales_entertainment") || 0),
    staff_time: Number(formData.get("sales_staff") || 0),
  };
  const total = (prefix: string, breakdown: Record<string, number>) => {
    const entered = [...formData.keys()].some((key) => key.startsWith(prefix) && String(formData.get(key) || "").trim() !== "");
    return entered ? Object.values(breakdown).reduce((sum, value) => sum + value, 0) : null;
  };
  const targets = String(formData.get("high_value_targets") || "").trim();
  const optional = (key: string) => {
    const raw = String(formData.get(key) ?? "").trim();
    return raw === "" ? null : Number(raw);
  };
  const { error } = await supabase.from("events").insert({
    name: String(formData.get("name")),
    location: String(formData.get("location") || "") || null,
    starts_on: String(formData.get("starts_on") || "") || null,
    ends_on: String(formData.get("ends_on") || "") || null,
    event_tier: String(formData.get("event_tier") || "other"),
    exhibit_cost: total("exhibit_", exhibitBreakdown),
    sales_only_cost: total("sales_", salesBreakdown),
    exhibit_cost_breakdown: exhibitBreakdown,
    sales_cost_breakdown: salesBreakdown,
    high_value_targets: targets === "" ? null : Number(targets),
    meeting_goal: optional("meeting_goal"),
    contact_goal: optional("contact_goal"),
    notes: String(formData.get("notes") || "") || null,
    web_address: String(formData.get("web_address") || "") || null,
    participation: ["exhibited", "attended", "did_not_attend"].includes(String(formData.get("participation")))
      ? String(formData.get("participation")) : "unknown",
    participation_notes: String(formData.get("participation_notes") || "") || null,
  });
  if (error) throw error;
  revalidatePath("/dashboard");
  redirect("/admin?created=event");
}

export async function inviteUser(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const email = String(formData.get("email"));
  const fullName = String(formData.get("full_name"));
  const role = String(formData.get("role") || "member");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
    redirectTo: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  });
  if (error) throw error;
  if (data.user) await admin.from("profiles").upsert({ id: data.user.id, full_name: fullName, role });
  revalidatePath("/admin");
  redirect("/admin?created=user");
}

export async function saveEventResults(eventId: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const num = (key: string) => {
    const raw = String(formData.get(key) ?? "").trim();
    return raw === "" ? null : Number(raw);
  };
  const participation = String(formData.get("participation") || "unknown");
  const { error } = await supabase.from("event_results").upsert({
    event_id: eventId,
    participation: ["exhibited", "attended", "did_not_attend", "unknown"].includes(participation) ? participation : "unknown",
    staff_count: num("staff_count"),
    show_hours: num("show_hours"),
    contacts: num("contacts"),
    meetings: num("meetings"),
    qualified_leads: num("qualified_leads"),
    opportunities: num("opportunities"),
    actual_cost: num("actual_cost"),
    lead_revenue_value: num("lead_revenue_value"),
    notes: String(formData.get("notes") || "") || null,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "event_id" });
  if (error) throw error;
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}?saved=results`);
}

/** Pre-show goals, compared with post-show meetings and contacts. */
export async function saveEventGoals(eventId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const num = (key: string) => {
    const raw = String(formData.get(key) ?? "").trim();
    return raw === "" ? null : Number(raw);
  };
  const { error } = await supabase.from("events").update({
    meeting_goal: num("meeting_goal"),
    contact_goal: num("contact_goal"),
  }).eq("id", eventId);
  if (error) throw error;
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}?saved=goals`);
}

const COST_ITEM_KEYS: CostItemKey[] = ["registration", "exhibit_space", "sponsorship", "shipping_setup"];
const COST_SOURCES = ["website", "budget", "cost_file", "assumption"];

/**
 * Admin edits to a show's details, staffing and priced items. Name, dates, location, website and
 * participation come from the v4 events workbook and aren't changed here. Saving recalculates the
 * stored cost estimates.
 */
export async function saveEventDetails(eventId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const num = (key: string) => (text(key) === "" ? null : Number(text(key)));
  const { data: current, error: loadError } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (loadError) throw loadError;

  const today = new Date().toISOString().slice(0, 10);
  const previous = (current.cost_items || {}) as Partial<Record<CostItemKey, CostItem>>;
  const costItems: Partial<Record<CostItemKey, CostItem>> = {};
  for (const key of COST_ITEM_KEYS) {
    const amount = num(`${key}_amount`);
    if (amount === null) continue;
    const source = COST_SOURCES.includes(text(`${key}_source`)) ? text(`${key}_source`) as CostItem["source"] : "assumption";
    const url = text(`${key}_url`) || undefined;
    const unchanged = previous[key]?.amount === amount && previous[key]?.source === source && previous[key]?.url === url;
    costItems[key] = {
      amount, source, url, note: text(`${key}_note`) || undefined,
      checked_on: unchanged ? previous[key]?.checked_on : today,
    };
  }
  const region = text("region");
  const exhibitKind = text("exhibit_kind");
  const marketing = text("marketing_traveler");
  const tier = text("event_tier");
  const update = {
    event_tier: ["major", "regional", "other"].includes(tier) ? tier : current.event_tier,
    high_value_targets: num("high_value_targets"),
    notes: text("notes") || null,
    region: REGIONS.some(([value]) => value === region) ? region : null,
    exhibit_kind: EXHIBIT_KINDS.some(([value]) => value === exhibitKind) ? exhibitKind : null,
    sales_people: num("sales_people"),
    marketing_traveler: marketing === "yes" ? true : marketing === "no" ? false : null,
    cost_items: costItems,
    included_registrations: num("included_registrations") ?? 0,
    package_includes: text("package_includes") || null,
  };
  // Estimates need a region; shows without one keep whatever totals were entered by hand.
  let totals = {};
  if (update.region) {
    const settings = await getBudgetSettings(supabase, fiscalYearOf(current.starts_on || today));
    if (settings) totals = storedEstimate({ ...current, ...update } as CostInputs, settings);
  }
  const { error } = await supabase.from("events").update({ ...update, ...totals }).eq("id", eventId);
  if (error) throw error;
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  redirect(`/events/${eventId}?saved=details`);
}

/** Save a fiscal year's show allocation, staff limits and cost rates, then recalculate that year's estimates. */
export async function saveBudgetSettings(fiscalYear: number, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const current = await getBudgetSettings(supabase, fiscalYear);
  if (!current) throw new Error("No budget settings to start from.");
  const num = (key: string, fallback: number) => {
    const raw = String(formData.get(key) ?? "").trim();
    const value = Number(raw);
    return raw === "" || Number.isNaN(value) || value < 0 ? fallback : value;
  };
  const allocation = Object.fromEntries(BUDGET_LINES.map(({ key }) => [key, num(`allocation_${key}`, current.allocation[key] ?? 0)])) as BudgetSettings["allocation"];
  const staff = {
    sales_people: Math.round(num("sales_people", current.staff.sales_people)),
    marketing_people: Math.round(num("marketing_people", current.staff.marketing_people)),
    show_days_per_person: Math.round(num("show_days_per_person", current.staff.show_days_per_person)),
  };
  const rates: BudgetSettings["rates"] = {
    ...current.rates,
    travel_per_person: Object.fromEntries(REGIONS.map(([key]) => [key, num(`travel_${key}`, current.rates.travel_per_person[key] ?? 0)])) as BudgetSettings["rates"]["travel_per_person"],
    travel_days: Object.fromEntries(REGIONS.map(([key]) => [key, Math.round(num(`days_${key}`, current.rates.travel_days[key] ?? 0))])) as BudgetSettings["rates"]["travel_days"],
    default_people: { sales_only: Math.round(num("people_sales_only", current.rates.default_people.sales_only)), exhibit: Math.round(num("people_exhibit", current.rates.default_people.exhibit)) },
    exhibit_defaults: Object.fromEntries(Object.entries(current.rates.exhibit_defaults).map(([kind, value]) => [kind, {
      space: num(`space_${kind}`, value?.space ?? 0), shipping_setup: num(`shipping_${kind}`, value?.shipping_setup ?? 0),
    }])),
    unknown_registration_per_person: num("unknown_registration", current.rates.unknown_registration_per_person),
    entertainment_per_show: num("entertainment_per_show", current.rates.entertainment_per_show),
  };
  const { error } = await supabase.from("budget_settings").upsert({
    fiscal_year: fiscalYear, allocation, staff, rates, notes: String(formData.get("notes") || "") || current.notes || null,
    updated_by: user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "fiscal_year" });
  if (error) throw error;
  await recalculate(supabase, fiscalYear);
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  redirect(`/budget?fy=${fiscalYear}&saved=settings`);
}

/** Recalculate stored estimates for every show in the fiscal year that has a travel region. */
export async function recalculateEstimates(fiscalYear: number) {
  const { supabase } = await requireAdmin();
  const count = await recalculate(supabase, fiscalYear);
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  redirect(`/budget?fy=${fiscalYear}&saved=recalculated&count=${count}`);
}

async function recalculate(supabase: Awaited<ReturnType<typeof createClient>>, fiscalYear: number) {
  const settings = await getBudgetSettings(supabase, fiscalYear);
  if (!settings) return 0;
  const [from, to] = fiscalYearRange(fiscalYear);
  const { data: events, error } = await supabase.from("events").select("*").eq("status", "active").gte("starts_on", from).lte("starts_on", to).not("region", "is", null);
  if (error) throw error;
  for (const event of events || []) {
    const { error: updateError } = await supabase.from("events").update(storedEstimate(event as CostInputs, settings)).eq("id", event.id);
    if (updateError) throw updateError;
  }
  return (events || []).length;
}

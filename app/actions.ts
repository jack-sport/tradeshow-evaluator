"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateScore } from "@/lib/scoring";
import type { Criterion, Recommendation } from "@/lib/types";

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
  const ratings: Record<string, number> = {};
  const responses = (criteria as Criterion[]).flatMap((criterion) => {
    const value = Number(formData.get(`rating_${criterion.id}`));
    if (!Number.isInteger(value) || value < 1 || value > 5) return [];
    ratings[criterion.id] = value;
    return [{ criterion_id: criterion.id, rating: value, comment: String(formData.get(`comment_${criterion.id}`) || "") || null }];
  });
  if (submit && responses.length !== criteria.length) throw new Error("Rate every criterion before submitting.");
  const recommendation = formData.get("recommendation") as Recommendation | null;
  if (submit && !["exhibit", "sales_only", "skip"].includes(recommendation || "")) throw new Error("Select a recommendation.");

  const evaluation = {
    event_id: eventId,
    evaluator_id: user.id,
    status: submit ? "submitted" : "draft",
    recommendation: recommendation || null,
    comments: String(formData.get("comments") || "") || null,
    opportunity_score: calculateScore(criteria as Criterion[], ratings, "opportunity"),
    exhibit_score: calculateScore(criteria as Criterion[], ratings, "exhibit"),
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
  const { error } = await supabase.from("events").insert({
    name: String(formData.get("name")),
    location: String(formData.get("location") || "") || null,
    starts_on: String(formData.get("starts_on") || "") || null,
    ends_on: String(formData.get("ends_on") || "") || null,
    event_tier: String(formData.get("event_tier") || "other"),
    exhibit_cost: Object.values(exhibitBreakdown).reduce((sum, value) => sum + value, 0),
    sales_only_cost: Object.values(salesBreakdown).reduce((sum, value) => sum + value, 0),
    exhibit_cost_breakdown: exhibitBreakdown,
    sales_cost_breakdown: salesBreakdown,
    high_value_targets: Number(formData.get("high_value_targets") || 0),
    notes: String(formData.get("notes") || "") || null,
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

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, Lock, MapPin, Users } from "lucide-react";
import { AiDraft } from "@/components/ai-draft";
import { EventResults } from "@/components/event-results";
import { ShowCosts } from "@/components/show-costs";
import { getBudgetSettings } from "@/lib/budget-store";
import { budgetImpact, scenarioShows } from "@/lib/budget";
import { fiscalYearOf, fiscalYearRange } from "@/lib/costs";
import { EvaluationForm } from "@/components/evaluation-form";
import { Comparison } from "@/components/comparison";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PARTICIPATION_LABELS, formatDateRange, formatMoney, isPastEvent, todayIso } from "@/lib/scoring";
import { canViewPeerResults } from "@/lib/access";
import type { Criterion, Evaluation, Event, EventResults as Results, PeerEvaluation, Profile, ResponseRow } from "@/lib/types";

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: event }, { data: criteria }, { data: evaluation }, { data: profile }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single(),
    supabase.from("criteria").select("*").eq("active", true).order("sort_order"),
    supabase.from("evaluations").select("*").eq("event_id", id).eq("evaluator_id", user.id).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);
  if (!event) notFound();
  let responses: ResponseRow[] = [];
  if (evaluation) {
    const result = await supabase.from("evaluation_responses").select("criterion_id,rating,comment").eq("evaluation_id", evaluation.id);
    responses = result.data || [];
  }
  // The AI evaluator's draft is visible to everyone (see the AI policies in the migrations).
  const { data: aiProfile } = await supabase.from("profiles").select("id").eq("is_ai", true).maybeSingle();
  let aiEvaluation: Evaluation | null = null;
  let aiResponses: ResponseRow[] = [];
  if (aiProfile) {
    const { data } = await supabase.from("evaluations").select("*").eq("event_id", id).eq("evaluator_id", aiProfile.id).maybeSingle();
    aiEvaluation = data as Evaluation | null;
    if (aiEvaluation) {
      const result = await supabase.from("evaluation_responses").select("criterion_id,rating,comment").eq("evaluation_id", aiEvaluation.id);
      aiResponses = result.data || [];
    }
  }
  const { data: results } = await supabase.from("event_results").select("*").eq("event_id", id).maybeSingle();
  const canCompare = canViewPeerResults(evaluation?.status || null, (profile as Profile)?.role || "member");
  let peers: PeerEvaluation[] = [];
  if (canCompare) {
    const admin = createAdminClient();
    const { data } = await admin.from("evaluations")
      .select("*, profiles(full_name), evaluation_responses(criterion_id,rating)")
      .eq("event_id", id).eq("status", "submitted").order("submitted_at");
    peers = ((data || []) as PeerEvaluation[]).filter((peer) => peer.evaluator_id !== aiProfile?.id);
  }
  const typedEvent = event as Event;
  const past = isPastEvent(typedEvent, todayIso());
  const settings = await getBudgetSettings(supabase, fiscalYearOf(typedEvent.starts_on || todayIso()));
  const isAdmin = (profile as Profile)?.role === "admin";
  let impact = null;
  if (settings && typedEvent.starts_on) {
    const [from, to] = fiscalYearRange(settings.fiscal_year);
    const [{ data: fyEvents }, { data: fyResults }] = await Promise.all([
      supabase.from("events").select("*").eq("status", "active").gte("starts_on", from).lte("starts_on", to),
      supabase.from("event_results").select("*"),
    ]);
    impact = budgetImpact(id, scenarioShows((fyEvents || []) as Event[], (fyResults || []) as Results[], [], [], "plan", todayIso()), settings);
  }
  return (
    <main className="page-shell narrow">
      <Link href="/dashboard" className="back-link"><ArrowLeft size={16} /> All events</Link>
      {saved && <div className="success-banner">{saved === "submitted" ? "Assessment submitted. Team results are now visible." : saved === "results" ? "Post-show results saved." : saved === "goals" ? "Goals saved." : saved === "details" ? "Show details saved and costs recalculated." : "Draft saved."}</div>}
      <section className="event-title">
        <div><div className="eyebrow">{past ? "Past" : "Upcoming"} · {typedEvent.event_tier} event{typedEvent.tier_provisional ? " (provisional tier)" : ""}</div><h1>{typedEvent.name}</h1><div className="event-meta"><span><CalendarDays size={16} />{formatDateRange(typedEvent.starts_on, typedEvent.ends_on)}</span>{typedEvent.location && <span><MapPin size={16} />{typedEvent.location}</span>}{typedEvent.web_address && <a href={typedEvent.web_address} target="_blank" rel="noreferrer"><ExternalLink size={16} />Event site</a>}</div><p className="participation-line"><Users size={16} /><strong>{past ? "What JAXPORT did:" : "Current plan:"}</strong> {PARTICIPATION_LABELS[typedEvent.participation || "unknown"]}{typedEvent.participation_notes ? ` — ${typedEvent.participation_notes}` : ""}</p></div>
        <div className="economics"><div><small>Exhibit cost</small><strong>{formatMoney(typedEvent.exhibit_cost)}</strong></div><div><small>Sales-only cost</small><strong>{formatMoney(typedEvent.sales_only_cost)}</strong></div><div><small>High-value targets</small><strong>{typedEvent.high_value_targets ?? "Not estimated"}</strong></div></div>
      </section>
      <ShowCosts event={typedEvent} settings={settings} isAdmin={isAdmin} impact={past ? null : impact} />
      <EventResults eventId={id} goals={{ meetings: typedEvent.meeting_goal ?? null, contacts: typedEvent.contact_goal ?? null }} results={results as Results | null} isAdmin={(profile as Profile)?.role === "admin"} isPast={past} />
      {aiEvaluation && <AiDraft evaluation={aiEvaluation} responses={aiResponses} criteria={(criteria || []) as Criterion[]} />}
      <EvaluationForm eventId={id} criteria={(criteria || []) as Criterion[]} evaluation={evaluation as Evaluation | null} responses={responses}
        costs={{ exhibit: typedEvent.exhibit_cost, salesOnly: typedEvent.sales_only_cost, exhibitBreakdown: typedEvent.exhibit_cost_breakdown, salesBreakdown: typedEvent.sales_cost_breakdown }} />
      {canCompare ? <Comparison evaluations={peers} criteria={(criteria || []) as Criterion[]} /> : <section className="locked"><Lock size={28} /><h2>Team comparison is locked</h2><p>Submit your independent assessment to see names, scores, recommendations, and the criteria where opinions differ.</p></section>}
    </main>
  );
}

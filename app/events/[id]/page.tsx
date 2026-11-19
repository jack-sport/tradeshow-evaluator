import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Lock, MapPin } from "lucide-react";
import { EvaluationForm } from "@/components/evaluation-form";
import { Comparison } from "@/components/comparison";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateRange } from "@/lib/scoring";
import { canViewPeerResults } from "@/lib/access";
import type { Criterion, Evaluation, Event, PeerEvaluation, Profile, ResponseRow } from "@/lib/types";

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
  const canCompare = canViewPeerResults(evaluation?.status || null, (profile as Profile)?.role || "member");
  let peers: PeerEvaluation[] = [];
  if (canCompare) {
    const admin = createAdminClient();
    const { data } = await admin.from("evaluations")
      .select("*, profiles(full_name), evaluation_responses(criterion_id,rating)")
      .eq("event_id", id).eq("status", "submitted").order("submitted_at");
    peers = (data || []) as PeerEvaluation[];
  }
  const typedEvent = event as Event;
  return (
    <main className="page-shell narrow">
      <Link href="/dashboard" className="back-link"><ArrowLeft size={16} /> All events</Link>
      {saved && <div className="success-banner">{saved === "submitted" ? "Assessment submitted. Team results are now visible." : "Draft saved."}</div>}
      <section className="event-title">
        <div><div className="eyebrow">{typedEvent.event_tier} event</div><h1>{typedEvent.name}</h1><div className="event-meta"><span><CalendarDays size={16} />{formatDateRange(typedEvent.starts_on, typedEvent.ends_on)}</span>{typedEvent.location && <span><MapPin size={16} />{typedEvent.location}</span>}</div></div>
        <div className="economics"><div><small>Exhibit cost</small><strong>${typedEvent.exhibit_cost.toLocaleString()}</strong></div><div><small>Sales-only cost</small><strong>${typedEvent.sales_only_cost.toLocaleString()}</strong></div><div><small>High-value targets</small><strong>{typedEvent.high_value_targets}</strong></div></div>
      </section>
      <EvaluationForm eventId={id} criteria={(criteria || []) as Criterion[]} evaluation={evaluation as Evaluation | null} responses={responses} />
      {canCompare ? <Comparison evaluations={peers} criteria={(criteria || []) as Criterion[]} /> : <section className="locked"><Lock size={28} /><h2>Team comparison is locked</h2><p>Submit your independent assessment to see names, scores, recommendations, and the criteria where opinions differ.</p></section>}
    </main>
  );
}

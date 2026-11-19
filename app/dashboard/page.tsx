import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin, Plus, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange, recommendationLabel } from "@/lib/scoring";
import type { Evaluation, Event, Profile } from "@/lib/types";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: events }, { data: ownEvaluations }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("events").select("*").eq("status", "active").order("starts_on", { ascending: true, nullsFirst: false }),
    supabase.from("evaluations").select("*").eq("evaluator_id", user.id),
  ]);
  const typedProfile = profile as Profile;
  const evaluationMap = new Map((ownEvaluations as Evaluation[] || []).map((item) => [item.event_id, item]));

  return (
    <main className="page-shell">
      <section className="hero">
        <div><div className="eyebrow">Annual exhibit portfolio</div><h1>Welcome, {typedProfile?.full_name?.split(" ")[0] || "Evaluator"}.</h1><p>Assess each event independently. Team comparisons unlock after you submit.</p></div>
        {typedProfile?.role === "admin" && <Link className="button secondary" href="/admin"><Shield size={17} /> Administration</Link>}
      </section>

      <section className="section-heading"><div><h2>Active events</h2><p>{events?.length || 0} shows under consideration</p></div></section>
      <div className="event-grid">
        {(events as Event[] || []).map((event) => {
          const evaluation = evaluationMap.get(event.id);
          const submitted = evaluation?.status === "submitted";
          return (
            <article className="event-card" key={event.id}>
              <div className="card-top"><span className={`tier ${event.event_tier}`}>{event.event_tier}</span><span className={`status ${submitted ? "complete" : evaluation ? "draft" : "open"}`}>{submitted ? "Submitted" : evaluation ? "Draft" : "Not started"}</span></div>
              <h3>{event.name}</h3>
              <div className="event-meta"><span><CalendarDays size={16} />{formatDateRange(event.starts_on, event.ends_on)}</span>{event.location && <span><MapPin size={16} />{event.location}</span>}</div>
              {evaluation ? (
                <div className="score-strip">
                  <div><strong>{evaluation.opportunity_score?.toFixed(1)}</strong><small>Opportunity</small></div>
                  <div><strong>{evaluation.exhibit_score?.toFixed(1)}</strong><small>Exhibit value</small></div>
                  <div className="recommend"><strong>{recommendationLabel(evaluation.recommendation)}</strong><small>Your recommendation</small></div>
                </div>
              ) : <div className="empty-state"><Plus size={18} /> Add your assessment</div>}
              <Link className="card-link" href={`/events/${event.id}`}>{submitted ? "View comparison" : evaluation ? "Continue assessment" : "Start assessment"}<ArrowRight size={17} /></Link>
            </article>
          );
        })}
      </div>
    </main>
  );
}

import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Comparison } from "@/components/comparison";
import { EvaluationForm } from "@/components/evaluation-form";
import type { Criterion, Evaluation, PeerEvaluation, ResponseRow } from "@/lib/types";

const criteria: Criterion[] = [
  { id: "c1", section: "opportunity", category: "Business development", label: "High-value target accounts", description: "Number and concentration of identifiable priority prospects realistically accessible at the event.", weight: 55, sort_order: 10 },
  { id: "c2", section: "opportunity", category: "Strategic alignment", label: "Cargo priority alignment", description: "Fit with current cargo growth priorities and active trade lanes.", weight: 45, sort_order: 20 },
  { id: "c3", section: "exhibit", category: "Incremental booth value", label: "Qualified booth traffic", description: "Likelihood that priority targets will visit or engage at the booth.", weight: 60, sort_order: 30 },
  { id: "c4", section: "exhibit", category: "Economics", label: "Exhibit cost efficiency", description: "Incremental cost relative to qualified meetings and visibility.", weight: 40, sort_order: 40 },
];

const responses: ResponseRow[] = criteria.map((criterion, index) => ({ criterion_id: criterion.id, rating: [4, 5, 3, 4][index], comment: null }));
const evaluation: Evaluation = { id: "e1", event_id: "show-1", evaluator_id: "u1", status: "submitted", recommendation: "exhibit", comments: "Strong target concentration and proven meeting access.", opportunity_score: 89, exhibit_score: 76, submitted_at: "2026-09-20T12:00:00Z", updated_at: "2026-09-20T12:00:00Z" };
const peers: PeerEvaluation[] = [
  { ...evaluation, profiles: { full_name: "Jordan Lee" }, evaluation_responses: responses.map(({ criterion_id, rating }) => ({ criterion_id, rating })) },
  { ...evaluation, id: "e2", evaluator_id: "u2", recommendation: "sales_only", opportunity_score: 78, exhibit_score: 59, comments: "Excellent event, but meetings do not depend on a booth.", profiles: { full_name: "Morgan Patel" }, evaluation_responses: responses.map(({ criterion_id, rating }, index) => ({ criterion_id, rating: Math.max(1, (rating ?? 3) - (index % 2)) })) },
  { ...evaluation, id: "e3", evaluator_id: "u3", opportunity_score: 92, exhibit_score: 81, comments: "One of the strongest concentrations of priority accounts.", profiles: { full_name: "Casey Rivera" }, evaluation_responses: responses.map(({ criterion_id, rating }) => ({ criterion_id, rating: Math.min(5, (rating ?? 3) + 1) })) },
];

function DashboardPreview() {
  const events = [
    ["RILA LINK", "Orlando, Florida", "Major", "Submitted", "89.0", "76.0", "Exhibit + Sales"],
    ["Breakbulk Americas", "Houston, Texas", "Major", "Draft", "82.0", "68.0", "Sales Only"],
    ["CADEXCO Exporter Summit", "San José, Costa Rica", "Regional", "Not started", null, null, null],
  ];
  return <main className="page-shell"><section className="hero"><div><div className="eyebrow">Annual exhibit portfolio</div><h1>Welcome, Jordan.</h1><p>Assess each event independently. Team comparisons unlock after you submit.</p></div><button className="button secondary">Administration</button></section><section className="section-heading"><div><h2>Active events</h2><p>3 shows under consideration</p></div></section><div className="event-grid">{events.map(([name, location, tier, status, opportunity, exhibit, recommendation]) => <article className="event-card" key={name}><div className="card-top"><span className={`tier ${tier?.toLowerCase()}`}>{tier}</span><span className={`status ${status === "Submitted" ? "complete" : status === "Draft" ? "draft" : "open"}`}>{status}</span></div><h3>{name}</h3><div className="event-meta"><span><CalendarDays size={16} />Sep. 22–24, 2026</span><span><MapPin size={16} />{location}</span></div>{opportunity ? <div className="score-strip"><div><strong>{opportunity}</strong><small>Opportunity</small></div><div><strong>{exhibit}</strong><small>Exhibit value</small></div><div className="recommend"><strong>{recommendation}</strong><small>Your recommendation</small></div></div> : <div className="empty-state">Add your assessment</div>}<span className="card-link">{status === "Submitted" ? "View comparison" : "Start assessment"}<ArrowRight size={17} /></span></article>)}</div></main>;
}

function AssessmentPreview() {
  return <main className="page-shell narrow"><section className="event-title"><div><div className="eyebrow">Major event</div><h1>RILA LINK</h1><div className="event-meta"><span><CalendarDays size={16} />Sep. 22–24, 2026</span><span><MapPin size={16} />Orlando, Florida</span></div></div><div className="economics"><div><small>Exhibit cost</small><strong>$38,500</strong></div><div><small>Sales-only cost</small><strong>$8,200</strong></div><div><small>High-value targets</small><strong>42</strong></div></div></section><EvaluationForm eventId="show-1" criteria={criteria} evaluation={evaluation} responses={responses} /><Comparison evaluations={peers} criteria={criteria} /></main>;
}

export default async function TestPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.VISUAL_TEST_MODE !== "true") notFound();
  const { view } = await searchParams;
  return view === "assessment" ? <AssessmentPreview /> : <DashboardPreview />;
}

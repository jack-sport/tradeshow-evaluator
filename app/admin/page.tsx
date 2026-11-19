import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarPlus, UserPlus } from "lucide-react";
import { createEvent, inviteUser } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");
  const [{ data: profiles }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,role,created_at").order("full_name"),
    supabase.from("events").select("id,name,event_tier,status,starts_on").order("starts_on"),
  ]);
  return (
    <main className="page-shell narrow">
      <Link href="/dashboard" className="back-link"><ArrowLeft size={16} /> Dashboard</Link>
      <section className="hero"><div><div className="eyebrow">Administration</div><h1>Manage the scorecard.</h1><p>Add events and invite named evaluators.</p></div></section>
      {created && <div className="success-banner">{created === "user" ? "Invitation sent." : "Event created."}</div>}
      <div className="admin-grid">
        <section className="admin-card"><div className="admin-heading"><CalendarPlus /><div><h2>Add an event</h2><p>Line items automatically calculate fully loaded totals.</p></div></div><form action={createEvent} className="stack"><label>Event name<input name="name" required /></label><label>Location<input name="location" placeholder="City, State or Country" /></label><div className="two-col"><label>Start date<input type="date" name="starts_on" /></label><label>End date<input type="date" name="ends_on" /></label></div><label>Portfolio tier<select name="event_tier"><option value="major">Major</option><option value="regional">Regional / specialty</option><option value="other">Other</option></select></label><div className="cost-group"><h3>Exhibit + Sales cost</h3><div className="two-col"><label>Booth / sponsorship<input type="number" min="0" step="100" name="exhibit_booth" /></label><label>Registration<input type="number" min="0" step="100" name="exhibit_registration" /></label><label>Travel / lodging / per diem<input type="number" min="0" step="100" name="exhibit_travel" /></label><label>Freight / drayage<input type="number" min="0" step="100" name="exhibit_freight" /></label><label>Show services / AV / internet<input type="number" min="0" step="100" name="exhibit_services" /></label><label>Graphics / promo materials<input type="number" min="0" step="100" name="exhibit_graphics" /></label><label>Client entertainment<input type="number" min="0" step="100" name="exhibit_entertainment" /></label><label>Estimated staff time<input type="number" min="0" step="100" name="exhibit_staff" /></label></div></div><div className="cost-group"><h3>Sales Only cost</h3><div className="two-col"><label>Registration<input type="number" min="0" step="100" name="sales_registration" /></label><label>Travel / lodging / per diem<input type="number" min="0" step="100" name="sales_travel" /></label><label>Client entertainment<input type="number" min="0" step="100" name="sales_entertainment" /></label><label>Estimated staff time<input type="number" min="0" step="100" name="sales_staff" /></label></div></div><label>Identifiable high-value targets<input type="number" min="0" name="high_value_targets" /></label><label>Notes<textarea name="notes" rows={3} /></label><button className="button primary">Create event</button></form></section>
        <section className="admin-card"><div className="admin-heading"><UserPlus /><div><h2>Invite evaluator</h2><p>Supabase sends a secure account invitation.</p></div></div><form action={inviteUser} className="stack"><label>Full name<input name="full_name" required /></label><label>Email<input type="email" name="email" required /></label><label>Role<select name="role"><option value="member">Evaluator</option><option value="admin">Administrator</option></select></label><button className="button primary">Send invitation</button></form><div className="simple-list"><h3>Current team</h3>{profiles?.map((person) => <div key={person.id}><span>{person.full_name}</span><small>{person.role}</small></div>)}</div></section>
      </div>
      <section className="admin-card full"><h2>Event inventory</h2><div className="simple-list">{events?.map((event) => <div key={event.id}><span>{event.name}</span><small>{event.event_tier} · {event.status}</small></div>)}</div></section>
    </main>
  );
}

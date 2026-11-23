import { redirect } from "next/navigation";
import { Portfolio } from "@/components/portfolio";
import { createClient } from "@/lib/supabase/server";
import { buildRows, parseState } from "@/lib/portfolio";
import { todayIso } from "@/lib/scoring";
import type { Evaluation, Event, EventResults, Profile } from "@/lib/types";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: events }, { data: ownEvaluations }, { data: aiProfile }, { data: results }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("events").select("*").eq("status", "active").order("starts_on", { ascending: true, nullsFirst: false }),
    supabase.from("evaluations").select("*").eq("evaluator_id", user.id),
    supabase.from("profiles").select("id").eq("is_ai", true).maybeSingle(),
    supabase.from("event_results").select("*"),
  ]);
  const { data: aiEvaluations } = aiProfile
    ? await supabase.from("evaluations").select("*").eq("evaluator_id", aiProfile.id)
    : { data: [] };
  const typedProfile = profile as Profile;
  // Only the viewer's own evaluations and the AI's: peer scores stay locked until the show page allows them.
  const rows = buildRows(
    (events as Event[]) || [],
    (ownEvaluations as Evaluation[]) || [],
    (aiEvaluations as Evaluation[]) || [],
    (results as EventResults[]) || [],
    todayIso(),
  );
  const initialState = parseState(await searchParams);

  return (
    <main className="page-shell">
      <section className="hero">
        <div><div className="eyebrow">Annual exhibit portfolio</div><h1>Welcome, {typedProfile?.full_name?.split(" ")[0] || "Evaluator"}.</h1><p>Assess each event independently. Team comparisons unlock after you submit. AI drafts are a starting point and don't count toward team results.</p></div>
      </section>
      <Portfolio rows={rows} initialState={initialState} />
    </main>
  );
}

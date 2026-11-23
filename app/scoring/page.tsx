import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FIELD_SALES_CALL_COST, INTERACTIONS_PER_STAFF_HOUR } from "@/lib/results";
import { INSUFFICIENT_COVERAGE, RATING_LABELS } from "@/lib/scoring";
import type { Criterion } from "@/lib/types";

const SECTIONS = [
  { key: "opportunity", title: "Event Opportunity", question: "Should JAXPORT take part in this show at all?" },
  { key: "exhibit", title: "Exhibit Value", question: "Would a booth add enough beyond attending to justify its cost?" },
] as const;

/** How the scorecard works. The criteria table is read from the database, so weights and definitions stay current. */
export default async function ScoringPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("criteria").select("*").eq("active", true).order("sort_order");
  const criteria = (data || []) as Criterion[];

  return (
    <main className="page-shell narrow scoring-guide">
      <section className="guide-intro">
        <div className="eyebrow">Scorecard guide</div>
        <h1>How scoring works</h1>
        <p>Each evaluator rates a show independently before seeing anyone else&apos;s view. The ratings roll up into two scores and a recommendation. After the show, actual results check how well the scorecard predicted value.</p>
        <nav className="guide-toc" aria-label="On this page">
          <a href="#mission">Who counts as a target</a><a href="#scores">The two scores</a><a href="#ratings">Ratings and Unknown</a>
          <a href="#math">How a score is calculated</a><a href="#recommendation">Recommendations</a><a href="#costs">Costs</a><a href="#budget">Budget and staff limits</a>
          <a href="#ai">AI drafts</a><a href="#visibility">Who sees what</a><a href="#post-show">Post-show results</a><a href="#criteria">All criteria</a>
        </nav>
      </section>

      <section className="guide-card" id="mission">
        <h2>Who counts as a target</h2>
        <p>JAXPORT&apos;s mission has two halves, and the scorecard weighs both equally:</p>
        <ul>
          <li><strong>Win ship calls:</strong> ocean carrier executives who decide services, networks and port calls.</li>
          <li><strong>Fill the ships:</strong> beneficial cargo owners (BCOs) and other routing decision-makers.</li>
        </ul>
        <p>Both groups count as high-value targets, and as existing customers when they already work with JAXPORT. Forwarders, customs brokers and 3PLs come next. A show doesn&apos;t need to cover every cargo type or trade: a strong match to one of JAXPORT&apos;s major initiatives counts for more than breadth.</p>
      </section>

      <section className="guide-card" id="scores">
        <h2>The two scores</h2>
        <div className="guide-two">
          {SECTIONS.map((section) => (
            <div key={section.key}>
              <h3>{section.title}</h3>
              <p>{section.question}</p>
              <small>{criteria.filter((item) => item.section === section.key).length} criteria · weights total 100</small>
            </div>
          ))}
        </div>
        <p>Each score runs from 0 to 100. Both appear on each show&apos;s page; the dashboard table shows the Opportunity scores.</p>
      </section>

      <section className="guide-card" id="ratings">
        <h2>Ratings and Unknown</h2>
        <p>Every criterion gets a rating from 1 to 5, or Unknown:</p>
        <ul className="guide-scale">
          {[1, 2, 3, 4, 5].map((rating) => <li key={rating}><b>{rating}</b>{RATING_LABELS[rating]}</li>)}
          <li><b>?</b>Unknown</li>
        </ul>
        <p>Choose <strong>Unknown</strong> when there&apos;s no real basis for a rating, and note what information would settle it. Unknown criteria are left out of the score rather than counted as zero, so a gap in knowledge doesn&apos;t drag a show down.</p>
      </section>

      <section className="guide-card" id="math">
        <h2>How a score is calculated</h2>
        <p>Each rating is multiplied by its criterion&apos;s weight. The total is divided by the most those rated criteria could have earned (a 5 on each), then scaled to 100:</p>
        <p className="guide-formula">Score = Σ (rating × weight) ÷ (5 × Σ weight of rated criteria) × 100</p>
        <p><strong>% rated</strong> is the share of the section&apos;s weight that got a 1–5 rating instead of Unknown. It shows how much evidence the score rests on.</p>
        <p className="guide-example">Example: criteria worth 85 of the 100 points are rated, and their weighted ratings average 3.5 out of 5. The score is 3.5 ÷ 5 × 100 = <strong>70.0</strong>, shown as &quot;70.0 · 85% rated.&quot; The other 15 points were Unknown.</p>
        <p>When less than {INSUFFICIENT_COVERAGE}% of the weight is rated, the score is shown as <strong>Insufficient data</strong> and flagged in orange in the dashboard table.</p>
      </section>

      <section className="guide-card" id="recommendation">
        <h2>Recommendations</h2>
        <p>Each evaluator also recommends one of three options. This is a judgment, not a score cutoff: a high Opportunity score with a low Exhibit Value score usually points to Sales Only.</p>
        <dl className="guide-defs">
          <dt>Exhibit + Sales</dt><dd>A physical presence (booth, tabletop, pavilion or branded meeting space) adds meaningful value beyond attending.</dd>
          <dt>Sales Only</dt><dd>Attend and hold meetings without exhibiting.</dd>
          <dt>Skip</dt><dd>The opportunity doesn&apos;t justify taking part.</dd>
        </dl>
      </section>

      <section className="guide-card" id="costs">
        <h2>Costs</h2>
        <p>Cost is rated twice, once in each section, because the two decisions have different costs:</p>
        <table className="guide-table">
          <thead><tr><th>Criterion</th><th>Question it answers</th><th>Costs it covers</th></tr></thead>
          <tbody>
            <tr><td>Cost and staff efficiency<small>Event Opportunity</small></td><td>Is the full cost of going at all worth the opportunity? Applies to sales-only attendance too.</td><td>Registration, travel, client entertainment, staff time</td></tr>
            <tr><td>Exhibit cost efficiency<small>Exhibit Value</small></td><td>Is the extra cost of a booth worth the added traffic, meetings and visibility?</td><td>Booth or sponsorship, freight, show services, graphics, plus the attending costs</td></tr>
          </tbody>
        </table>
        <p>Both count what the package includes: registrations that come with a booth, an attendee list for sponsors, meeting space or branding. A package with these is worth more than its price alone suggests.</p>
        <p>When a show has cost estimates, they appear next to these two criteria on the assessment form. Post-show costs (below) don&apos;t change anyone&apos;s rating; they help calibrate next year&apos;s.</p>
      </section>

      <section className="guide-card" id="budget">
        <h2>Budget and staff limits</h2>
        <p>Scores judge each show on its own. The <Link href="/budget">Budget &amp; capacity</Link> page checks the whole schedule for a fiscal year (October–September) against two limits:</p>
        <ul>
          <li><strong>Money:</strong> the share of each Cost Center 190 line set aside for shows (travel, registration and exhibit fees, exhibit shipping, sponsorships, entertainment).</li>
          <li><strong>People:</strong> five sales and two management travelers, plus one marketing traveler for exhibit shows, at up to 100 show days each. Overlapping shows that need more people than are available are flagged.</li>
        </ul>
        <p>Each show&apos;s estimate uses its region&apos;s travel rate per person, plus prices from the show&apos;s own website where found. When a price isn&apos;t published, the estimate uses the budget or an earlier estimate, then a default, and marks the estimate as partial. If a plan doesn&apos;t fit, the page suggests the changes that give up the least value per dollar.</p>
      </section>

      <section className="guide-card" id="ai">
        <h2>AI drafts</h2>
        <p>An AI evaluator drafts a first-pass assessment for each show from public sources, following the same criteria and principles. Each rating states what it rests on: a source link, general industry knowledge, or for Unknown, what would settle it.</p>
        <p>AI drafts are a starting point. They don&apos;t count toward team results. For past shows, the AI scores without looking up what JAXPORT did at that edition, so its recommendations can be checked against reality in the <Link href="/baseline">Baseline report</Link>.</p>
      </section>

      <section className="guide-card" id="visibility">
        <h2>Who sees what</h2>
        <ul>
          <li>You always see your own assessment and the AI draft.</li>
          <li>Other evaluators&apos; names, scores and recommendations stay hidden until you submit your own, so everyone rates independently. Administrators can see them to oversee the process.</li>
          <li>Post-show goals and results are visible to everyone. Administrators enter them.</li>
        </ul>
      </section>

      <section className="guide-card" id="post-show">
        <h2>Post-show results</h2>
        <p>After a show, administrators record what happened. These figures don&apos;t feed the scores; they show whether the scorecard pointed the right way.</p>
        <table className="guide-table">
          <thead><tr><th>Measure</th><th>How it&apos;s calculated</th></tr></thead>
          <tbody>
            <tr><td>Goals vs. actual</td><td>Meetings and contacts against the goals set before the show (e.g. 12 / 15 = 80%).</td></tr>
            <tr><td>Booth capacity used</td><td>Contacts ÷ (staff × show hours × {INTERACTIONS_PER_STAFF_HOUR} interactions per staffer per hour)</td></tr>
            <tr><td>Cost per contact</td><td>Actual total cost ÷ contacts</td></tr>
            <tr><td>Soft-dollar ROI</td><td>(${FIELD_SALES_CALL_COST} field sales call − cost per contact) × contacts ÷ actual cost. What meeting these contacts at the show saved compared with visiting each one. The ${FIELD_SALES_CALL_COST} figure is CEIR&apos;s average North American B2B field sales call.</td></tr>
            <tr><td>Hard-dollar ROI</td><td>(Potential revenue value of leads − actual cost) ÷ actual cost. Left blank until the revenue value is entered.</td></tr>
          </tbody>
        </table>
      </section>

      <section className="guide-card" id="criteria">
        <h2>All criteria</h2>
        {SECTIONS.map((section) => (
          <div key={section.key} className="guide-criteria">
            <h3>{section.title}</h3>
            <table className="guide-table">
              <thead><tr><th>Criterion</th><th className="num">Weight</th><th>What it measures</th></tr></thead>
              <tbody>
                {criteria.filter((item) => item.section === section.key).map((item) => (
                  <tr key={item.id}><td>{item.label}<small>{item.category}</small></td><td className="num">{Number(item.weight)}</td><td>{item.description}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </main>
  );
}

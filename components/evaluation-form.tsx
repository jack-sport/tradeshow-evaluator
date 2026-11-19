import { saveEvaluation } from "@/app/actions";
import { RATING_LABELS } from "@/lib/scoring";
import type { Criterion, Evaluation, ResponseRow } from "@/lib/types";

export function EvaluationForm({ eventId, criteria, evaluation, responses }: { eventId: string; criteria: Criterion[]; evaluation: Evaluation | null; responses: ResponseRow[] }) {
  const responseMap = new Map(responses.map((response) => [response.criterion_id, response]));
  const action = saveEvaluation.bind(null, eventId);
  const sections = [
    { key: "opportunity", title: "Event Opportunity", intro: "Does this show merit JAXPORT participation?" },
    { key: "exhibit", title: "Exhibit Value", intro: "What does a booth accomplish beyond sales attendance?" },
  ] as const;
  return (
    <form action={action} className="evaluation-form">
      {sections.map((section) => (
        <section className="form-section" key={section.key}>
          <div className="form-section-heading"><div><span className="step-label">{section.key === "opportunity" ? "Score 1" : "Score 2"}</span><h2>{section.title}</h2><p>{section.intro}</p></div><span className="weight-total">100 points</span></div>
          <div className="criteria-list">
            {criteria.filter((criterion) => criterion.section === section.key).map((criterion) => {
              const existing = responseMap.get(criterion.id);
              return (
                <fieldset className="criterion" key={criterion.id}>
                  <legend><span><small>{criterion.category}</small>{criterion.label}</span><strong>{criterion.weight}%</strong></legend>
                  <p>{criterion.description}</p>
                  <div className="rating-row">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <label className="rating" key={rating} title={RATING_LABELS[rating]}>
                        <input type="radio" name={`rating_${criterion.id}`} value={rating} defaultChecked={existing?.rating === rating} required />
                        <span><b>{rating}</b><small>{RATING_LABELS[rating]}</small></span>
                      </label>
                    ))}
                  </div>
                  <input className="criterion-comment" name={`comment_${criterion.id}`} defaultValue={existing?.comment || ""} placeholder="Optional note about this rating" />
                </fieldset>
              );
            })}
          </div>
        </section>
      ))}
      <section className="form-section decision-section">
        <div className="form-section-heading"><div><span className="step-label">Recommendation</span><h2>What should JAXPORT do?</h2></div></div>
        <div className="decision-grid">
          {[
            ["exhibit", "Exhibit + Sales", "The booth adds meaningful value."],
            ["sales_only", "Sales Only", "Attend and meet without exhibiting."],
            ["skip", "Skip", "The opportunity does not justify participation."],
          ].map(([value, label, detail]) => (
            <label className="decision-card" key={value}>
              <input type="radio" name="recommendation" value={value} defaultChecked={evaluation?.recommendation === value} required />
              <span><strong>{label}</strong><small>{detail}</small></span>
            </label>
          ))}
        </div>
        <label className="full-label">Overall rationale<textarea name="comments" rows={4} defaultValue={evaluation?.comments || ""} placeholder="Explain the factors that most influenced your recommendation." /></label>
      </section>
      <div className="sticky-actions"><span>{evaluation?.status === "submitted" ? "Submitted — you may revise and resubmit." : "Submit to unlock the team comparison."}</span><div><button className="button secondary" name="intent" value="draft" formNoValidate>Save draft</button><button className="button primary" name="intent" value="submit">Submit assessment</button></div></div>
    </form>
  );
}

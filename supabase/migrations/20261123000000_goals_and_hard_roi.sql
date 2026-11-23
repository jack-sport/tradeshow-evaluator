-- Pre-show goals (set on the event before the show) and the revenue input for hard-dollar ROI.
-- Goals are compared with event_results.meetings and event_results.contacts after the show.
-- Hard-dollar ROI = (lead_revenue_value - actual_cost) / actual_cost, as in JAXPORT's post-show
-- metrics sheets; it is calculated in the app (lib/results.ts), not stored.
alter table public.events
  add column meeting_goal integer check (meeting_goal >= 0),
  add column contact_goal integer check (contact_goal >= 0);

alter table public.event_results
  add column lead_revenue_value numeric(14,2) check (lead_revenue_value >= 0);

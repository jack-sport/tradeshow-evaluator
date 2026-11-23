-- Unknown ratings, past/upcoming participation tracking, imported events, and the AI evaluator.

-- 1. "Unknown" rating: a response with a null rating means the evaluator does not know.
--    The existing check (rating between 1 and 5) already allows null.
alter table public.evaluation_responses alter column rating drop not null;

-- Share of each section's weight that was actually rated (0-100). Scores are calculated
-- over rated criteria only, so coverage says how much of the scorecard they rest on.
alter table public.evaluations
  add column opportunity_coverage numeric(5,1),
  add column exhibit_coverage numeric(5,1);

-- 2. Event details: costs and targets can be "not estimated" (null) instead of 0.
alter table public.events
  alter column exhibit_cost drop not null, alter column exhibit_cost drop default,
  alter column sales_only_cost drop not null, alter column sales_only_cost drop default,
  alter column high_value_targets drop not null, alter column high_value_targets drop default;

-- What JAXPORT actually did (past events) or currently plans (upcoming events).
create type public.participation as enum ('exhibited', 'attended', 'did_not_attend', 'unknown');

alter table public.events
  add column source_id text unique,               -- Event ID from the master workbook, for re-imports
  add column web_address text,
  add column participation public.participation not null default 'unknown',
  add column participation_notes text,
  add column tier_provisional boolean not null default false;

-- 3. AI evaluator: a non-login account whose draft scores everyone can read.
alter table public.profiles add column is_ai boolean not null default false;

create or replace function public.is_ai_evaluator(uid uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists(select 1 from public.profiles where id = uid and is_ai) $$;

create policy "signed in users view AI evaluations" on public.evaluations
  for select to authenticated using (public.is_ai_evaluator(evaluator_id));

create policy "signed in users view AI responses" on public.evaluation_responses
  for select to authenticated using (
    exists(select 1 from public.evaluations e where e.id = evaluation_id and public.is_ai_evaluator(e.evaluator_id))
  );

-- Post-show results: what actually happened at an event, entered by administrators after the show.
-- Mirrors JAXPORT's post-show metrics sheets (staff, show hours, contacts, total cost) and adds
-- meetings, leads and opportunities. Derived metrics (capacity, cost per contact, soft-dollar ROI)
-- are calculated in the app (lib/results.ts), not stored.
create table public.event_results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  participation public.participation,          -- what JAXPORT actually did at this edition
  staff_count integer check (staff_count >= 0),
  show_hours numeric(6,1) check (show_hours >= 0),
  contacts integer check (contacts >= 0),      -- business cards / scanned badges
  meetings integer check (meetings >= 0),
  qualified_leads integer check (qualified_leads >= 0),
  opportunities integer check (opportunities >= 0),
  actual_cost numeric(12,2) check (actual_cost >= 0),
  cost_breakdown jsonb not null default '{}'::jsonb,
  notes text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.event_results enable row level security;
create policy "signed in users view event results" on public.event_results
  for select to authenticated using (true);
create policy "admins manage event results" on public.event_results
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

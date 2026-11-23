-- Budget and staff capacity: cost inputs and planned staffing on each show, and one settings row per
-- fiscal year (show allocation by budget line, staff limits, cost rates). Cost estimates are calculated
-- in the app (lib/costs.ts) from these inputs; exhibit_cost and sales_only_cost hold the latest totals.

alter table public.events
  -- Travel region, for the per-person travel rate and travel days.
  add column region text check (region in ('local','florida','southeast','gulf','midwest','northeast','west','caribbean','latam','europe','asia','international')),
  -- What an exhibit presence would be at this show.
  add column exhibit_kind text check (exhibit_kind in ('none','tabletop','booth','sponsorship','pavilion','reception')),
  -- Planned sales/management travelers (null = default for the participation type).
  add column sales_people integer check (sales_people between 0 and 7),
  -- Whether the marketing traveler goes (exhibit shows only; null = yes when exhibiting).
  add column marketing_traveler boolean,
  -- Priced items, each {amount, source, url, checked_on, note}. Keys: registration (per person),
  -- exhibit_space, sponsorship, shipping_setup. Source: website | budget | cost_file | assumption.
  add column cost_items jsonb not null default '{}'::jsonb,
  -- Registrations that come with the exhibit package, and anything else it includes (attendee list, meeting space).
  add column included_registrations integer not null default 0 check (included_registrations >= 0),
  add column package_includes text;

create table public.budget_settings (
  fiscal_year integer primary key,           -- 2027 = FY27 (Oct 1, 2026 - Sep 30, 2027)
  allocation jsonb not null default '{}'::jsonb,  -- dollars for shows by line: travel, fees, exhibit, sponsorship, entertainment
  staff jsonb not null default '{}'::jsonb,       -- sales_people, marketing_people, show_days_per_person
  rates jsonb not null default '{}'::jsonb,       -- travel_per_person, travel_days, default_people, exhibit_defaults, ...
  notes text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.budget_settings enable row level security;
create policy "signed in users view budget settings" on public.budget_settings
  for select to authenticated using (true);
create policy "admins manage budget settings" on public.budget_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- A starting settings row so the Budget page has something to edit. The allocation is left at $0:
-- each organization enters its own on the Budget page. Rates are planning defaults, also editable.
insert into public.budget_settings (fiscal_year, allocation, staff, rates, notes) values (
  2027,
  '{"travel": 0, "fees": 0, "exhibit": 0, "sponsorship": 0, "entertainment": 0}',
  '{"sales_people": 7, "marketing_people": 1, "show_days_per_person": 100}',
  '{
    "travel_per_person": {"local": 0, "florida": 1150, "southeast": 1620, "gulf": 1825, "midwest": 1620, "northeast": 2160, "west": 3000, "caribbean": 2160, "latam": 4000, "europe": 4320, "asia": 5000, "international": 6480},
    "travel_days": {"local": 0, "florida": 1, "southeast": 1, "gulf": 1, "midwest": 1, "northeast": 1, "west": 2, "caribbean": 2, "latam": 2, "europe": 2, "asia": 3, "international": 2},
    "default_people": {"sales_only": 1, "exhibit": 2},
    "exhibit_defaults": {"tabletop": {"space": 2500, "shipping_setup": 1000}, "booth": {"space": 7300, "shipping_setup": 6300}, "pavilion": {"space": 5000, "shipping_setup": 3000}, "sponsorship": {"space": 0, "shipping_setup": 0}, "reception": {"space": 0, "shipping_setup": 0}},
    "unknown_registration_per_person": 1000,
    "entertainment_per_show": 150
  }',
  'Starting settings. Enter the show allocation for each budget line, and check staff and rates, on the Budget page.'
);

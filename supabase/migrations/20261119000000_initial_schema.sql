-- Run once in the Supabase SQL Editor for a new project.
create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'member');
create type public.event_tier as enum ('major', 'regional', 'other');
create type public.event_status as enum ('active', 'archived');
create type public.evaluation_status as enum ('draft', 'submitted');
create type public.recommendation as enum ('exhibit', 'sales_only', 'skip');
create type public.criterion_section as enum ('opportunity', 'exhibit');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'member',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(), name text not null,
  location text, starts_on date, ends_on date,
  event_tier public.event_tier not null default 'other',
  status public.event_status not null default 'active',
  exhibit_cost numeric(12,2) not null default 0,
  sales_only_cost numeric(12,2) not null default 0,
  exhibit_cost_breakdown jsonb not null default '{}'::jsonb,
  sales_cost_breakdown jsonb not null default '{}'::jsonb,
  high_value_targets integer not null default 0 check (high_value_targets >= 0),
  notes text, created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);

create table public.criteria (
  id uuid primary key default gen_random_uuid(),
  section public.criterion_section not null, category text not null,
  label text not null, description text not null default '',
  weight numeric(5,2) not null check (weight > 0), sort_order integer not null,
  active boolean not null default true, unique(section, sort_order)
);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  evaluator_id uuid not null references public.profiles(id) on delete cascade,
  status public.evaluation_status not null default 'draft',
  recommendation public.recommendation, comments text,
  opportunity_score numeric(5,1), exhibit_score numeric(5,1),
  submitted_at timestamptz, updated_at timestamptz not null default now(),
  unique(event_id, evaluator_id)
);

create table public.evaluation_responses (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  criterion_id uuid not null references public.criteria(id),
  rating integer not null check (rating between 1 and 5), comment text,
  unique(evaluation_id, criterion_id)
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(id, full_name, role) values(new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), coalesce((new.raw_user_meta_data->>'role')::public.user_role,'member')) on conflict (id) do nothing; return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.criteria enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_responses enable row level security;

create policy "signed in users view profiles" on public.profiles for select to authenticated using (true);
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "signed in users view events" on public.events for select to authenticated using (true);
create policy "admins manage events" on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "signed in users view criteria" on public.criteria for select to authenticated using (true);
create policy "admins manage criteria" on public.criteria for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users view own evaluations" on public.evaluations for select to authenticated using (evaluator_id=auth.uid() or public.is_admin());
create policy "users create own evaluations" on public.evaluations for insert to authenticated with check (evaluator_id=auth.uid());
create policy "users update own evaluations" on public.evaluations for update to authenticated using (evaluator_id=auth.uid()) with check (evaluator_id=auth.uid());
create policy "users manage own responses" on public.evaluation_responses for all to authenticated using (exists(select 1 from public.evaluations e where e.id=evaluation_id and (e.evaluator_id=auth.uid() or public.is_admin()))) with check (exists(select 1 from public.evaluations e where e.id=evaluation_id and (e.evaluator_id=auth.uid() or public.is_admin())));

insert into public.criteria(section,category,label,description,weight,sort_order) values
('opportunity','Business development','High-value target accounts','Number and concentration of identifiable priority prospects realistically accessible at the event.',15,10),
('opportunity','Business development','Audience composition and quality','Presence of BCOs first, ocean carriers second, and forwarders, customs brokers and 3PLs third.',10,20),
('opportunity','Business development','Attendee access and meeting setting','Availability and usefulness of lists, matchmaking, and advance outreach rights.',8,30),
('opportunity','Business development','Relevant audience size','Scale of the relevant audience rather than total event attendance.',5,40),
('opportunity','Business development','Historical commercial results','Prior meetings, qualified leads, opportunities, wins or cargo influence.',7,50),
('opportunity','Relationship management','Existing customers and accounts','Access to important current customers and active accounts.',8,60),
('opportunity','Relationship management','Carriers and strategic partners','Access to ocean carriers and partners that matter to JAXPORT strategy.',7,70),
('opportunity','Relationship management','Historical relationship value','Evidence the event strengthens relationships difficult to reach elsewhere.',5,80),
('opportunity','Brand awareness','Speaking or panel opportunity','Ability to provide credible thought leadership to the target audience.',5,90),
('opportunity','Brand awareness','Visibility with the right audience','Meaningful exposure among decision-makers rather than general impressions.',4,100),
('opportunity','Brand awareness','Sponsorship or exhibit prominence','Quality and exclusivity of available visibility placements.',3,110),
('opportunity','Brand awareness','Marketing amplification','Pre/post email, content, PR, social, photography and video potential.',3,120),
('opportunity','Strategic alignment','Cargo priority alignment','Fit with current container, reefer, breakbulk, auto, forest products or other priorities.',5,130),
('opportunity','Strategic alignment','Geographic and trade-lane alignment','Fit with markets and trade lanes JAXPORT is actively working to grow.',5,140),
('opportunity','Economics','Cost and staff efficiency','Fully loaded cost and staffing burden relative to the accessible opportunity.',10,150),
('exhibit','Incremental booth value','Qualified booth traffic','Likelihood that priority targets will visit or engage at the booth.',25,210),
('exhibit','Incremental booth value','Meaningful exhibit meetings','Suitability of the exhibit for scheduled, productive conversations.',20,220),
('exhibit','Incremental booth value','Exhibit-specific brand visibility','Awareness gained specifically because JAXPORT has a physical presence.',15,230),
('exhibit','Evidence','Historical exhibit-generated results','Past leads, opportunities, relationship gains or wins attributable to exhibiting.',15,240),
('exhibit','Integration','Speaking and sponsorship integration','Ability to connect the booth with speaking, content or sponsored programming.',10,250),
('exhibit','Market context','Competitive and category presence','Value of participating alongside relevant ports and service providers.',5,260),
('exhibit','Economics','Exhibit cost efficiency','Incremental exhibit cost relative to qualified traffic, meetings and visibility.',10,270);

-- After creating the first user in Authentication > Users, make that person an administrator:
-- update public.profiles set role='admin' where id='<AUTH USER UUID>';

begin;

create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employment_statuses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.wage_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.overtime_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.employees
  add column if not exists job_description_id uuid references public.job_descriptions(id) on delete set null,
  add column if not exists job_description text,
  add column if not exists employment_status_id uuid references public.employment_statuses(id) on delete set null,
  add column if not exists employment_status text,
  add column if not exists wage_category_id uuid references public.wage_categories(id) on delete set null,
  add column if not exists overtime_rule_id uuid references public.overtime_rules(id) on delete set null;

create unique index if not exists uq_job_descriptions_org_name on public.job_descriptions(org_id, lower(name));
create unique index if not exists uq_employment_statuses_org_name on public.employment_statuses(org_id, lower(name));
create unique index if not exists uq_wage_categories_org_name on public.wage_categories(org_id, lower(name));
create unique index if not exists uq_overtime_rules_org_name on public.overtime_rules(org_id, lower(name));

alter table public.job_descriptions enable row level security;
alter table public.employment_statuses enable row level security;
alter table public.wage_categories enable row level security;
alter table public.overtime_rules enable row level security;

drop policy if exists "job_descriptions select" on public.job_descriptions;
create policy "job_descriptions select" on public.job_descriptions
for select using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
);

drop policy if exists "job_descriptions manage" on public.job_descriptions;
create policy "job_descriptions manage" on public.job_descriptions
for all using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
)
with check (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
);

drop policy if exists "employment_statuses select" on public.employment_statuses;
create policy "employment_statuses select" on public.employment_statuses
for select using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
);

drop policy if exists "employment_statuses manage" on public.employment_statuses;
create policy "employment_statuses manage" on public.employment_statuses
for all using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
)
with check (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
);

drop policy if exists "wage_categories select" on public.wage_categories;
create policy "wage_categories select" on public.wage_categories
for select using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
);

drop policy if exists "wage_categories manage" on public.wage_categories;
create policy "wage_categories manage" on public.wage_categories
for all using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
)
with check (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
);

drop policy if exists "overtime_rules select" on public.overtime_rules;
create policy "overtime_rules select" on public.overtime_rules
for select using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
);

drop policy if exists "overtime_rules manage" on public.overtime_rules;
create policy "overtime_rules manage" on public.overtime_rules
for all using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
)
with check (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
);

commit;

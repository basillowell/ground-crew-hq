begin;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.worker_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.workforce_roles
  add column if not exists active boolean not null default true;

alter table public.work_locations
  add column if not exists org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists active boolean not null default true;

alter table public.shift_templates
  add column if not exists org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists active boolean not null default true;

update public.shift_templates
set
  start_time = coalesce(start_time, nullif(start, '')::time),
  end_time = coalesce(end_time, nullif("end", '')::time)
where start_time is null or end_time is null;

create unique index if not exists uq_departments_org_name on public.departments(org_id, lower(name));
create unique index if not exists uq_employee_groups_org_name on public.employee_groups(org_id, lower(name));
create unique index if not exists uq_worker_types_org_name on public.worker_types(org_id, lower(name));
create index if not exists idx_work_locations_org_id on public.work_locations(org_id);
create index if not exists idx_shift_templates_org_id on public.shift_templates(org_id);

alter table public.departments enable row level security;
alter table public.employee_groups enable row level security;
alter table public.worker_types enable row level security;
alter table public.work_locations enable row level security;
alter table public.shift_templates enable row level security;

drop policy if exists "departments select" on public.departments;
create policy "departments select" on public.departments
for select using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
);

drop policy if exists "departments manage" on public.departments;
create policy "departments manage" on public.departments
for all using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
)
with check (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
);

drop policy if exists "employee_groups select" on public.employee_groups;
create policy "employee_groups select" on public.employee_groups
for select using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
);

drop policy if exists "employee_groups manage" on public.employee_groups;
create policy "employee_groups manage" on public.employee_groups
for all using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
)
with check (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
);

drop policy if exists "worker_types select" on public.worker_types;
create policy "worker_types select" on public.worker_types
for select using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
);

drop policy if exists "worker_types manage" on public.worker_types;
create policy "worker_types manage" on public.worker_types
for all using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
)
with check (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
);

drop policy if exists "work_locations select" on public.work_locations;
create policy "work_locations select" on public.work_locations
for select using (
  org_id is null
  or org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
);

drop policy if exists "work_locations manage" on public.work_locations;
create policy "work_locations manage" on public.work_locations
for all using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
)
with check (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
);

drop policy if exists "shift_templates select" on public.shift_templates;
create policy "shift_templates select" on public.shift_templates
for select using (
  org_id is null
  or org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
);

drop policy if exists "shift_templates manage" on public.shift_templates;
create policy "shift_templates manage" on public.shift_templates
for all using (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
)
with check (
  org_id = (select au.org_id from public.app_users au where au.id = auth.uid())
  and (select au.role from public.app_users au where au.id = auth.uid()) in ('admin', 'manager')
);

commit;

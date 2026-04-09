create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'starter',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'trialing',
  created_at timestamptz not null default now()
);

alter table public.properties add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.employees add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.app_users add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.schedule_entries add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.assignments add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.tasks add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.equipment_units add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.notes add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.program_settings add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.clock_events add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create index if not exists idx_properties_org_id on public.properties(org_id);
create index if not exists idx_employees_org_id on public.employees(org_id);
create index if not exists idx_app_users_org_id on public.app_users(org_id);
create index if not exists idx_schedule_entries_org_id on public.schedule_entries(org_id);
create index if not exists idx_assignments_org_id on public.assignments(org_id);
create index if not exists idx_tasks_org_id on public.tasks(org_id);
create index if not exists idx_equipment_units_org_id on public.equipment_units(org_id);
create index if not exists idx_notes_org_id on public.notes(org_id);
create index if not exists idx_program_settings_org_id on public.program_settings(org_id);
create index if not exists idx_clock_events_org_id on public.clock_events(org_id);

create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select org_id
  from public.app_users
  where id = auth.uid() and status = 'active'
  limit 1
$$;

create or replace function public.can_manage_property(target_property_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_users au
    join public.employees e on e.id = au.employee_id
    where au.id = auth.uid()
      and au.status = 'active'
      and au.role in ('admin', 'manager')
      and au.org_id = public.current_org_id()
      and e.property_id = target_property_id
      and e.org_id = au.org_id
  )
$$;

create or replace function public.can_read_property(target_property_id uuid)
returns boolean
language sql
stable
as $$
  select public.can_manage_property(target_property_id)
    or exists (
      select 1
      from public.employees e
      where e.id = public.current_employee_id()
        and e.property_id = target_property_id
        and e.org_id = public.current_org_id()
    )
$$;

alter table public.organizations enable row level security;

drop policy if exists "organizations select" on public.organizations;
create policy "organizations select"
on public.organizations
for select
using (id = public.current_org_id());

drop policy if exists "organizations manage" on public.organizations;
create policy "organizations manage"
on public.organizations
for all
using (id = public.current_org_id() and public.current_user_role() in ('admin', 'manager'))
with check (id = public.current_org_id() and public.current_user_role() in ('admin', 'manager'));

drop policy if exists "properties select" on public.properties;
create policy "properties select"
on public.properties
for select
using (org_id = public.current_org_id() and public.can_read_property(id));

drop policy if exists "properties manage" on public.properties;
create policy "properties manage"
on public.properties
for all
using (org_id = public.current_org_id() and public.can_manage_property(id))
with check (org_id = public.current_org_id() and public.can_manage_property(id));

drop policy if exists "employees select" on public.employees;
create policy "employees select"
on public.employees
for select
using (org_id = public.current_org_id() and (public.can_manage_property(property_id) or id = public.current_employee_id()));

drop policy if exists "employees manage" on public.employees;
create policy "employees manage"
on public.employees
for all
using (org_id = public.current_org_id() and public.can_manage_property(property_id))
with check (org_id = public.current_org_id() and public.can_manage_property(property_id));

drop policy if exists "app_users select" on public.app_users;
create policy "app_users select"
on public.app_users
for select
using (
  org_id = public.current_org_id()
  and (
    employee_id = public.current_employee_id()
    or public.can_manage_property((select e.property_id from public.employees e where e.id = app_users.employee_id and e.org_id = app_users.org_id))
  )
);

drop policy if exists "app_users manage" on public.app_users;
create policy "app_users manage"
on public.app_users
for all
using (
  org_id = public.current_org_id()
  and public.can_manage_property((select e.property_id from public.employees e where e.id = app_users.employee_id and e.org_id = app_users.org_id))
)
with check (
  org_id = public.current_org_id()
  and public.can_manage_property((select e.property_id from public.employees e where e.id = app_users.employee_id and e.org_id = app_users.org_id))
);

drop policy if exists "schedule_entries select" on public.schedule_entries;
create policy "schedule_entries select"
on public.schedule_entries
for select
using (org_id = public.current_org_id() and (public.can_manage_property(property_id) or employee_id = public.current_employee_id()));

drop policy if exists "schedule_entries manage" on public.schedule_entries;
create policy "schedule_entries manage"
on public.schedule_entries
for all
using (org_id = public.current_org_id() and public.can_manage_property(property_id))
with check (org_id = public.current_org_id() and public.can_manage_property(property_id));

drop policy if exists "assignments select" on public.assignments;
create policy "assignments select"
on public.assignments
for select
using (org_id = public.current_org_id() and (public.can_manage_property(property_id) or employee_id = public.current_employee_id()));

drop policy if exists "assignments manage" on public.assignments;
create policy "assignments manage"
on public.assignments
for all
using (org_id = public.current_org_id() and public.can_manage_property(property_id))
with check (org_id = public.current_org_id() and public.can_manage_property(property_id));

drop policy if exists "tasks select" on public.tasks;
create policy "tasks select"
on public.tasks
for select
using (org_id = public.current_org_id() and public.can_read_property(property_id));

drop policy if exists "tasks manage" on public.tasks;
create policy "tasks manage"
on public.tasks
for all
using (org_id = public.current_org_id() and public.can_manage_property(property_id))
with check (org_id = public.current_org_id() and public.can_manage_property(property_id));

drop policy if exists "equipment_units select" on public.equipment_units;
create policy "equipment_units select"
on public.equipment_units
for select
using (org_id = public.current_org_id() and public.can_read_property(property_id));

drop policy if exists "equipment_units manage" on public.equipment_units;
create policy "equipment_units manage"
on public.equipment_units
for all
using (org_id = public.current_org_id() and public.can_manage_property(property_id))
with check (org_id = public.current_org_id() and public.can_manage_property(property_id));

drop policy if exists "notes select" on public.notes;
create policy "notes select"
on public.notes
for select
using (org_id = public.current_org_id() and public.can_read_property(property_id));

drop policy if exists "notes manage" on public.notes;
create policy "notes manage"
on public.notes
for all
using (org_id = public.current_org_id() and public.can_manage_property(property_id))
with check (org_id = public.current_org_id() and public.can_manage_property(property_id));

drop policy if exists "program_settings select" on public.program_settings;
create policy "program_settings select"
on public.program_settings
for select
using (org_id = public.current_org_id());

drop policy if exists "program_settings manage" on public.program_settings;
create policy "program_settings manage"
on public.program_settings
for all
using (org_id = public.current_org_id() and public.current_user_role() in ('admin', 'manager'))
with check (org_id = public.current_org_id() and public.current_user_role() in ('admin', 'manager'));

drop policy if exists "clock_events select" on public.clock_events;
create policy "clock_events select"
on public.clock_events
for select
using (org_id = public.current_org_id() and (public.can_manage_property(property_id) or employee_id = public.current_employee_id()));

drop policy if exists "clock_events insert" on public.clock_events;
create policy "clock_events insert"
on public.clock_events
for insert
with check (org_id = public.current_org_id() and (public.can_manage_property(property_id) or employee_id = public.current_employee_id()));

drop policy if exists "clock_events manage" on public.clock_events;
create policy "clock_events manage"
on public.clock_events
for all
using (org_id = public.current_org_id() and public.can_manage_property(property_id))
with check (org_id = public.current_org_id() and public.can_manage_property(property_id));

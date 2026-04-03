create extension if not exists pgcrypto;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  logo_initials text not null default 'GC',
  color text not null default '#166534',
  city text not null default '',
  state text not null default '',
  latitude double precision,
  longitude double precision,
  acreage numeric not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.properties add column if not exists latitude double precision;
alter table public.properties add column if not exists longitude double precision;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  role text not null default 'Crew',
  department text not null default 'Maintenance',
  status text not null default 'active',
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  role text not null check (role in ('admin', 'manager', 'employee')),
  department text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  date date not null,
  shift_start time not null,
  shift_end time not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'General',
  status text not null default 'active',
  priority integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  date date not null,
  location text,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  type text not null,
  status text not null default 'available',
  location text,
  last_serviced date,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  type text not null default 'general',
  title text not null,
  content text not null default '',
  location text,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.program_settings (
  id uuid primary key default gen_random_uuid(),
  app_name text not null default 'Ground Crew HQ',
  client_label text not null default '',
  primary_color text not null default '#166534',
  accent_color text not null default '#d1fae5',
  sidebar_color text not null default '#111827',
  font_theme_preset text not null default 'modern-sans',
  logo_url text,
  default_department text not null default 'Maintenance',
  created_at timestamptz not null default now()
);

create table if not exists public.clock_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  event_type text not null check (event_type in ('in', 'out', 'break')),
  "timestamp" timestamptz not null default now(),
  location_lat double precision,
  location_lng double precision
);

create index if not exists idx_employees_property_id on public.employees(property_id);
create index if not exists idx_app_users_employee_id on public.app_users(employee_id);
create index if not exists idx_schedule_entries_date_property on public.schedule_entries(date, property_id);
create index if not exists idx_assignments_date_property on public.assignments(date, property_id);
create index if not exists idx_tasks_property_id on public.tasks(property_id);
create index if not exists idx_equipment_units_property_id on public.equipment_units(property_id);
create index if not exists idx_notes_property_id on public.notes(property_id);
create index if not exists idx_clock_events_property_time on public.clock_events(property_id, "timestamp");
create index if not exists idx_clock_events_employee_time on public.clock_events(employee_id, "timestamp");

create or replace function public.current_employee_id()
returns uuid
language sql
stable
as $$
  select employee_id
  from public.app_users
  where id = auth.uid() and status = 'active'
  limit 1
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select role
  from public.app_users
  where id = auth.uid() and status = 'active'
  limit 1
$$;

create or replace function public.current_property_id()
returns uuid
language sql
stable
as $$
  select e.property_id
  from public.app_users au
  join public.employees e on e.id = au.employee_id
  where au.id = auth.uid() and au.status = 'active'
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
      and e.property_id = target_property_id
  )
$$;

create or replace function public.can_read_property(target_property_id uuid)
returns boolean
language sql
stable
as $$
  select public.can_manage_property(target_property_id)
    or public.current_property_id() = target_property_id
$$;

alter table public.properties enable row level security;
alter table public.employees enable row level security;
alter table public.app_users enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.assignments enable row level security;
alter table public.tasks enable row level security;
alter table public.equipment_units enable row level security;
alter table public.notes enable row level security;
alter table public.program_settings enable row level security;
alter table public.clock_events enable row level security;

drop policy if exists "properties select" on public.properties;
create policy "properties select"
on public.properties
for select
using (public.can_read_property(id));

drop policy if exists "properties manage" on public.properties;
create policy "properties manage"
on public.properties
for all
using (public.can_manage_property(id))
with check (public.can_manage_property(id));

drop policy if exists "employees select" on public.employees;
create policy "employees select"
on public.employees
for select
using (public.can_manage_property(property_id) or id = public.current_employee_id());

drop policy if exists "employees manage" on public.employees;
create policy "employees manage"
on public.employees
for all
using (public.can_manage_property(property_id))
with check (public.can_manage_property(property_id));

drop policy if exists "app_users select" on public.app_users;
create policy "app_users select"
on public.app_users
for select
using (
  employee_id = public.current_employee_id()
  or public.can_manage_property((select e.property_id from public.employees e where e.id = app_users.employee_id))
);

drop policy if exists "app_users manage" on public.app_users;
create policy "app_users manage"
on public.app_users
for all
using (public.can_manage_property((select e.property_id from public.employees e where e.id = app_users.employee_id)))
with check (public.can_manage_property((select e.property_id from public.employees e where e.id = app_users.employee_id)));

drop policy if exists "schedule_entries select" on public.schedule_entries;
create policy "schedule_entries select"
on public.schedule_entries
for select
using (public.can_manage_property(property_id) or employee_id = public.current_employee_id());

drop policy if exists "schedule_entries manage" on public.schedule_entries;
create policy "schedule_entries manage"
on public.schedule_entries
for all
using (public.can_manage_property(property_id))
with check (public.can_manage_property(property_id));

drop policy if exists "assignments select" on public.assignments;
create policy "assignments select"
on public.assignments
for select
using (public.can_manage_property(property_id) or employee_id = public.current_employee_id());

drop policy if exists "assignments manage" on public.assignments;
create policy "assignments manage"
on public.assignments
for all
using (public.can_manage_property(property_id))
with check (public.can_manage_property(property_id));

drop policy if exists "tasks select" on public.tasks;
create policy "tasks select"
on public.tasks
for select
using (public.can_read_property(property_id));

drop policy if exists "tasks manage" on public.tasks;
create policy "tasks manage"
on public.tasks
for all
using (public.can_manage_property(property_id))
with check (public.can_manage_property(property_id));

drop policy if exists "equipment_units select" on public.equipment_units;
create policy "equipment_units select"
on public.equipment_units
for select
using (public.can_read_property(property_id));

drop policy if exists "equipment_units manage" on public.equipment_units;
create policy "equipment_units manage"
on public.equipment_units
for all
using (public.can_manage_property(property_id))
with check (public.can_manage_property(property_id));

drop policy if exists "notes select" on public.notes;
create policy "notes select"
on public.notes
for select
using (public.can_read_property(property_id));

drop policy if exists "notes manage" on public.notes;
create policy "notes manage"
on public.notes
for all
using (public.can_manage_property(property_id))
with check (public.can_manage_property(property_id));

drop policy if exists "program_settings select" on public.program_settings;
create policy "program_settings select"
on public.program_settings
for select
using (auth.uid() is not null);

drop policy if exists "program_settings manage" on public.program_settings;
create policy "program_settings manage"
on public.program_settings
for all
using (public.current_user_role() in ('admin', 'manager'))
with check (public.current_user_role() in ('admin', 'manager'));

drop policy if exists "clock_events select" on public.clock_events;
create policy "clock_events select"
on public.clock_events
for select
using (public.can_manage_property(property_id) or employee_id = public.current_employee_id());

drop policy if exists "clock_events insert" on public.clock_events;
create policy "clock_events insert"
on public.clock_events
for insert
with check (public.can_manage_property(property_id) or employee_id = public.current_employee_id());

drop policy if exists "clock_events manage" on public.clock_events;
create policy "clock_events manage"
on public.clock_events
for all
using (public.can_manage_property(property_id))
with check (public.can_manage_property(property_id));

create table if not exists public.equipment_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  name text not null,
  short_name text,
  category text default 'General',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.equipment_types enable row level security;

drop policy if exists "equipment_types select" on public.equipment_types;
create policy "equipment_types select"
on public.equipment_types
for select
using (
  org_id = public.current_org_id()
);

drop policy if exists "equipment_types manage" on public.equipment_types;
create policy "equipment_types manage"
on public.equipment_types
for all
using (
  org_id = public.current_org_id()
  and public.current_user_role() in ('admin', 'manager')
)
with check (
  org_id = public.current_org_id()
  and public.current_user_role() in ('admin', 'manager')
);

alter table public.equipment_units
add column if not exists equipment_type_id uuid references public.equipment_types(id) on delete set null,
add column if not exists unit_name text,
add column if not exists notes text,
add column if not exists active boolean not null default true;

create index if not exists idx_equipment_units_type_id on public.equipment_units(equipment_type_id);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  equipment_unit_id uuid not null references public.equipment_units(id) on delete restrict,
  title text not null,
  description text,
  status text not null default 'open',
  priority text not null default 'medium',
  cost numeric default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.work_orders enable row level security;

drop policy if exists "work_orders select" on public.work_orders;
create policy "work_orders select"
on public.work_orders
for select
using (
  org_id = public.current_org_id()
);

drop policy if exists "work_orders manage" on public.work_orders;
create policy "work_orders manage"
on public.work_orders
for all
using (
  org_id = public.current_org_id()
  and public.current_user_role() in ('admin', 'manager')
)
with check (
  org_id = public.current_org_id()
  and public.current_user_role() in ('admin', 'manager')
);

create index if not exists idx_work_orders_property_id on public.work_orders(property_id);
create index if not exists idx_work_orders_equipment_unit_id on public.work_orders(equipment_unit_id);

begin;

alter table public.weather_locations
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists org_id uuid references public.organizations(id),
  add column if not exists is_active boolean not null default true;

alter table public.weather_locations enable row level security;

drop policy if exists "weather_locations_org_scope" on public.weather_locations;
drop policy if exists "weather_locations_select_org_scope" on public.weather_locations;
drop policy if exists "weather_locations select" on public.weather_locations;
drop policy if exists "weather_locations manage" on public.weather_locations;

create policy "weather_locations select"
on public.weather_locations
for select
using (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
    limit 1
  )
);

create policy "weather_locations manage"
on public.weather_locations
for all
using (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
    limit 1
  )
  and (
    select au.role
    from public.app_users au
    where au.id = auth.uid()
    limit 1
  ) = any (array['admin', 'manager'])
)
with check (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
    limit 1
  )
  and (
    select au.role
    from public.app_users au
    where au.id = auth.uid()
    limit 1
  ) = any (array['admin', 'manager'])
);

insert into public.weather_locations (name, property, area, latitude, longitude, org_id, is_active)
select
  'Sarasota Polo Club',
  'b50b42cd-903e-4280-9373-1d9cae97b2b3',
  'Main',
  27.3364,
  -82.5307,
  'bb13da4a-d2de-4fc9-ad5a-bfd266e08807',
  true
where not exists (
  select 1
  from public.weather_locations wl
  where wl.org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid
    and lower(wl.name) = lower('Sarasota Polo Club')
);

commit;

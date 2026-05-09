begin;

alter table public.weather_locations
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists org_id uuid references public.organizations(id),
  add column if not exists address text;

alter table public.weather_locations enable row level security;

drop policy if exists "weather_locations_org_scope" on public.weather_locations;
create policy "weather_locations_org_scope"
on public.weather_locations
for all
using (
  org_id is not null
  and org_id::text = coalesce(auth.jwt() ->> 'org_id', '')
)
with check (
  org_id is not null
  and org_id::text = coalesce(auth.jwt() ->> 'org_id', '')
);

commit;

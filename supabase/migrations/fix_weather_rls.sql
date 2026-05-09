begin;

alter table public.weather_locations enable row level security;

drop policy if exists "weather_locations_select_org_scope" on public.weather_locations;
create policy "weather_locations_select_org_scope"
on public.weather_locations
for select
using (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

commit;

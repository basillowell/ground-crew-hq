begin;

-- Remove existing RLS policies on the targeted tables so we can apply one stable pattern.
do $$
declare
  target_table text;
  policy_name text;
begin
  foreach target_table in array array[
    'program_settings',
    'weather_locations',
    'weather_stations',
    'weather_daily_logs'
  ]
  loop
    for policy_name in
      select pol.policyname
      from pg_policies pol
      where pol.schemaname = 'public'
        and pol.tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, target_table);
    end loop;
  end loop;
end $$;

alter table public.program_settings enable row level security;
alter table public.weather_locations enable row level security;
alter table public.weather_stations enable row level security;
alter table public.weather_daily_logs enable row level security;

-- program_settings
create policy "program_settings_select_org_scope"
on public.program_settings
for select
using (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

create policy "program_settings_insert_org_scope"
on public.program_settings
for insert
with check (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

create policy "program_settings_update_org_scope"
on public.program_settings
for update
using (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
)
with check (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

-- weather_locations
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

create policy "weather_locations_insert_org_scope"
on public.weather_locations
for insert
with check (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

create policy "weather_locations_update_org_scope"
on public.weather_locations
for update
using (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
)
with check (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

-- weather_stations
create policy "weather_stations_select_org_scope"
on public.weather_stations
for select
using (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

create policy "weather_stations_insert_org_scope"
on public.weather_stations
for insert
with check (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

create policy "weather_stations_update_org_scope"
on public.weather_stations
for update
using (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
)
with check (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

-- weather_daily_logs
create policy "weather_daily_logs_select_org_scope"
on public.weather_daily_logs
for select
using (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

create policy "weather_daily_logs_insert_org_scope"
on public.weather_daily_logs
for insert
with check (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

create policy "weather_daily_logs_update_org_scope"
on public.weather_daily_logs
for update
using (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
)
with check (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

commit;

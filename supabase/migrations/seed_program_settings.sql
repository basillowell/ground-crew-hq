begin;

create unique index if not exists idx_program_settings_org_id_unique
  on public.program_settings (org_id);

insert into public.program_settings (
  org_id,
  app_name,
  weather_default_latitude,
  weather_default_longitude,
  weather_default_address,
  weather_preferred_provider
)
values (
  'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid,
  'Ground Crew HQ',
  27.3364,
  -82.5307,
  'Sarasota, Florida',
  'open-meteo'
)
on conflict (org_id) do update
set
  app_name = excluded.app_name,
  weather_default_latitude = excluded.weather_default_latitude,
  weather_default_longitude = excluded.weather_default_longitude,
  weather_default_address = excluded.weather_default_address,
  weather_preferred_provider = excluded.weather_preferred_provider;

alter table public.program_settings enable row level security;

drop policy if exists "program_settings_select_org_scope" on public.program_settings;
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

commit;

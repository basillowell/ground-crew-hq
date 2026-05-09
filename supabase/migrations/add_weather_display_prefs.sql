begin;

create table if not exists public.weather_display_prefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  location_id uuid references public.weather_locations(id) on delete set null,
  enabled_widgets text[] not null default array[
    'current',
    'hourly_forecast',
    'wind',
    'precipitation',
    'humidity',
    'uv_index',
    'feels_like',
    '7day_forecast'
  ],
  widget_order text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint chk_weather_display_prefs_org_id_not_empty check (org_id is not null)
);

alter table public.weather_display_prefs enable row level security;

drop policy if exists "weather_display_prefs select" on public.weather_display_prefs;
create policy "weather_display_prefs select"
on public.weather_display_prefs
for select
using (
  (
    user_id = auth.uid()
    and org_id = public.current_org_id()
  )
  or (
    org_id = public.current_org_id()
    and public.current_user_role() in ('admin', 'manager')
  )
);

drop policy if exists "weather_display_prefs manage" on public.weather_display_prefs;
create policy "weather_display_prefs manage"
on public.weather_display_prefs
for all
using (
  (
    user_id = auth.uid()
    and org_id = public.current_org_id()
  )
  or (
    org_id = public.current_org_id()
    and public.current_user_role() in ('admin', 'manager')
  )
)
with check (
  (
    user_id = auth.uid()
    and org_id = public.current_org_id()
  )
  or (
    org_id = public.current_org_id()
    and public.current_user_role() in ('admin', 'manager')
  )
);

create index if not exists idx_weather_display_prefs_org_user
  on public.weather_display_prefs (org_id, user_id);

commit;

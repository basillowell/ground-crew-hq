begin;

alter table public.program_settings
  add column if not exists weather_default_location_name text,
  add column if not exists weather_default_address text,
  add column if not exists weather_default_latitude numeric,
  add column if not exists weather_default_longitude numeric,
  add column if not exists weather_preferred_provider text default 'open-meteo',
  add column if not exists weather_enabled_panels text[] default array[
    'current-conditions',
    'hourly-forecast',
    'daily-forecast',
    'wind',
    'rain',
    'alerts',
    'turf-risk-notes'
  ]::text[];

update public.program_settings
set
  weather_default_location_name = coalesce(weather_default_location_name, 'Sarasota Polo Club'),
  weather_default_address = coalesce(weather_default_address, '8201 Polo Club Lane, Sarasota, FL 34240'),
  weather_default_latitude = coalesce(weather_default_latitude, 27.316),
  weather_default_longitude = coalesce(weather_default_longitude, -82.402),
  weather_preferred_provider = coalesce(weather_preferred_provider, 'open-meteo'),
  weather_enabled_panels = coalesce(
    weather_enabled_panels,
    array['current-conditions','hourly-forecast','daily-forecast','wind','rain','alerts','turf-risk-notes']::text[]
  );

commit;

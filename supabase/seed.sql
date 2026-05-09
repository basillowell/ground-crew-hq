begin;

-- Seed 2-3 org-scoped work orders for Ground Crew HQ.
-- Uses existing equipment units so FK constraints remain valid.
with target_equipment as (
  select eu.id as equipment_unit_id, eu.org_id, eu.property_id
  from public.equipment_units eu
  where eu.org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid
  order by eu.created_at nulls last, eu.id
  limit 3
),
seed_rows as (
  select
    te.org_id,
    te.property_id,
    te.equipment_unit_id,
    concat('WO-', row_number() over (order by te.equipment_unit_id), ' Daily Field Readiness') as title,
    'Seeded work order for initial workboard operations coverage.'::text as description,
    'open'::text as status,
    case
      when row_number() over (order by te.equipment_unit_id) = 1 then 'high'
      when row_number() over (order by te.equipment_unit_id) = 2 then 'medium'
      else 'low'
    end as priority
  from target_equipment te
)
insert into public.work_orders (
  org_id,
  property_id,
  equipment_unit_id,
  title,
  description,
  status,
  priority
)
select
  sr.org_id,
  sr.property_id,
  sr.equipment_unit_id,
  sr.title,
  sr.description,
  sr.status,
  sr.priority
from seed_rows sr
where not exists (
  select 1
  from public.work_orders wo
  where wo.org_id = sr.org_id
    and lower(wo.title) = lower(sr.title)
);

commit;

-- Verification
select
  count(*) as seeded_work_orders_count
from public.work_orders
where org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid;

begin;

-- Ensure Sarasota weather location exists for station linkage (idempotent).
insert into public.weather_locations (
  id,
  org_id,
  property_id,
  name,
  property,
  area,
  latitude,
  longitude
)
select
  'd2f8c7a2-5e66-4f0e-9ab9-86fb6d3fb7f1'::uuid,
  p.org_id,
  p.id,
  'Sarasota Polo Club - Main Course',
  p.name,
  'Main Course',
  27.316,
  -82.402
from public.properties p
where p.org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid
  and lower(p.name) like '%sarasota%'
on conflict (id) do nothing;

-- Seed Sarasota-area weather stations (idempotent).
with target_location as (
  select wl.id as location_id, wl.org_id
  from public.weather_locations wl
  where wl.org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid
    and (
      lower(wl.name) like '%sarasota%'
      or lower(coalesce(wl.property, '')) like '%sarasota%'
    )
  order by wl.name
  limit 1
)
insert into public.weather_stations (
  id,
  location_id,
  org_id,
  name,
  provider,
  provider_type,
  station_code,
  latitude,
  longitude,
  time_zone,
  station_category,
  distance_miles,
  is_primary,
  status
)
select
  station_seed.id,
  tl.location_id,
  tl.org_id,
  station_seed.name,
  station_seed.provider,
  station_seed.provider_type,
  station_seed.station_code,
  station_seed.latitude,
  station_seed.longitude,
  station_seed.time_zone,
  station_seed.station_category,
  station_seed.distance_miles,
  station_seed.is_primary,
  station_seed.status
from target_location tl
cross join (
  values
    (
      'd6a3d8d3-1f8b-4d1b-9c55-2ff9b8b43110'::uuid,
      'Sarasota NWS/NOAA Operational Point'::text,
      'NOAA/NWS'::text,
      'noaa'::text,
      'SRQ-NWS-01'::text,
      27.336,
      -82.531,
      'America/New_York'::text,
      'regional'::text,
      8.3::numeric,
      true,
      'online'::text
    ),
    (
      '8f2dc5e8-8b0f-40cf-a0d7-018ce3d6c2be'::uuid,
      'Sarasota Coastal NOAA Backup'::text,
      'NOAA/NWS'::text,
      'noaa'::text,
      'SRQ-NWS-02'::text,
      27.265,
      -82.546,
      'America/New_York'::text,
      'regional'::text,
      12.1::numeric,
      false,
      'online'::text
    )
) as station_seed(
  id,
  name,
  provider,
  provider_type,
  station_code,
  latitude,
  longitude,
  time_zone,
  station_category,
  distance_miles,
  is_primary,
  status
)
on conflict (id) do nothing;

commit;

-- Verification
select
  count(*) as seeded_weather_stations_count
from public.weather_stations
where org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid;

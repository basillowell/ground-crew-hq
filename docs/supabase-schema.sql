create table if not exists public.employees (
  id text primary key,
  "firstName" text not null,
  "lastName" text not null,
  "group" text not null,
  role text not null,
  wage numeric not null default 0,
  phone text not null default '',
  email text not null default '',
  photo text not null default '',
  status text not null default 'active',
  department text not null,
  language text not null default 'English',
  "workerType" text not null default 'full-time',
  "hireDate" date not null
);

create table if not exists public.tasks (
  id text primary key,
  name text not null,
  category text not null,
  duration integer not null default 0,
  color text not null,
  icon text not null
);

create table if not exists public.equipment_units (
  id text primary key,
  "typeId" text not null,
  "unitNumber" text not null,
  status text not null,
  "assignedTo" text,
  location text not null,
  hours numeric not null default 0,
  "lastService" date not null,
  "nextService" date not null
);

create table if not exists public.schedule_entries (
  id text primary key,
  "employeeId" text not null,
  "date" date not null,
  "shiftStart" text not null,
  "shiftEnd" text not null,
  status text not null
);

create table if not exists public.assignments (
  id text primary key,
  "employeeId" text not null,
  "taskId" text not null,
  "equipmentId" text,
  "date" date not null,
  "startTime" text not null,
  duration integer not null default 0,
  area text not null
);

create table if not exists public.notes (
  id text primary key,
  type text not null,
  title text not null,
  content text not null,
  author text not null,
  "date" date not null,
  location text
);

create table if not exists public.weather_locations (
  id text primary key,
  name text not null,
  property text not null,
  area text not null
);

create table if not exists public.weather_stations (
  id text primary key,
  "locationId" text not null,
  name text not null,
  provider text not null,
  "stationCode" text not null,
  "isPrimary" boolean not null default false,
  status text not null
);

create table if not exists public.weather_daily_logs (
  id text primary key,
  "locationId" text not null,
  "stationId" text,
  "date" date not null,
  "currentConditions" text not null,
  forecast text not null,
  "rainfallTotal" numeric not null default 0,
  temperature numeric not null default 0,
  humidity numeric not null default 0,
  wind numeric not null default 0,
  et numeric not null default 0,
  source text not null,
  notes text
);

create table if not exists public.manual_rainfall_entries (
  id text primary key,
  "locationId" text not null,
  "date" date not null,
  "rainfallAmount" numeric not null default 0,
  "enteredBy" text not null,
  notes text
);

create table if not exists public.chemical_products (
  id text primary key,
  name text not null,
  "productType" text not null,
  "targetUse" text not null,
  "rateUnit" text not null
);

create table if not exists public.application_areas (
  id text primary key,
  name text not null,
  property text not null,
  "weatherLocationId" text not null
);

create table if not exists public.chemical_application_logs (
  id text primary key,
  "applicationDate" date not null,
  "startTime" text not null,
  "endTime" text not null,
  "areaId" text not null,
  "targetPest" text not null,
  "agronomicPurpose" text not null,
  "carrierVolume" numeric not null default 0,
  "areaTreated" numeric not null default 0,
  "areaUnit" text not null,
  "applicatorId" text not null,
  "equipmentUsedId" text,
  "weatherLogId" text,
  notes text not null default ''
);

create table if not exists public.chemical_application_tank_mix_items (
  id text primary key,
  "applicationLogId" text not null,
  "productId" text not null,
  "rateApplied" numeric not null default 0,
  "rateUnit" text not null,
  "totalQuantityUsed" numeric not null default 0
);

create table if not exists public.program_settings (
  id text primary key,
  "organizationName" text not null,
  "defaultDepartment" text not null,
  "timeZone" text not null,
  "fiscalYearStart" text not null,
  "enableMobileApp" boolean not null default true,
  "overtimeTracking" boolean not null default true,
  "equipmentQrCodes" boolean not null default true
);

create table if not exists public.department_options (
  id text primary key,
  name text not null
);

create table if not exists public.group_options (
  id text primary key,
  name text not null,
  color text not null
);

create table if not exists public.work_locations (
  id text primary key,
  name text not null
);

create table if not exists public.shift_templates (
  id text primary key,
  name text not null,
  start text not null,
  "end" text not null,
  days text[] not null default '{}'
);

alter table public.employees enable row level security;
alter table public.tasks enable row level security;
alter table public.equipment_units enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.assignments enable row level security;
alter table public.notes enable row level security;
alter table public.weather_locations enable row level security;
alter table public.weather_stations enable row level security;
alter table public.weather_daily_logs enable row level security;
alter table public.manual_rainfall_entries enable row level security;
alter table public.chemical_products enable row level security;
alter table public.application_areas enable row level security;
alter table public.chemical_application_logs enable row level security;
alter table public.chemical_application_tank_mix_items enable row level security;
alter table public.program_settings enable row level security;
alter table public.department_options enable row level security;
alter table public.group_options enable row level security;
alter table public.work_locations enable row level security;
alter table public.shift_templates enable row level security;

drop policy if exists "public full access employees" on public.employees;
create policy "public full access employees" on public.employees for all using (true) with check (true);

drop policy if exists "public full access tasks" on public.tasks;
create policy "public full access tasks" on public.tasks for all using (true) with check (true);

drop policy if exists "public full access equipment_units" on public.equipment_units;
create policy "public full access equipment_units" on public.equipment_units for all using (true) with check (true);

drop policy if exists "public full access schedule_entries" on public.schedule_entries;
create policy "public full access schedule_entries" on public.schedule_entries for all using (true) with check (true);

drop policy if exists "public full access assignments" on public.assignments;
create policy "public full access assignments" on public.assignments for all using (true) with check (true);

drop policy if exists "public full access notes" on public.notes;
create policy "public full access notes" on public.notes for all using (true) with check (true);

drop policy if exists "public full access weather_locations" on public.weather_locations;
create policy "public full access weather_locations" on public.weather_locations for all using (true) with check (true);

drop policy if exists "public full access weather_stations" on public.weather_stations;
create policy "public full access weather_stations" on public.weather_stations for all using (true) with check (true);

drop policy if exists "public full access weather_daily_logs" on public.weather_daily_logs;
create policy "public full access weather_daily_logs" on public.weather_daily_logs for all using (true) with check (true);

drop policy if exists "public full access manual_rainfall_entries" on public.manual_rainfall_entries;
create policy "public full access manual_rainfall_entries" on public.manual_rainfall_entries for all using (true) with check (true);

drop policy if exists "public full access chemical_products" on public.chemical_products;
create policy "public full access chemical_products" on public.chemical_products for all using (true) with check (true);

drop policy if exists "public full access application_areas" on public.application_areas;
create policy "public full access application_areas" on public.application_areas for all using (true) with check (true);

drop policy if exists "public full access chemical_application_logs" on public.chemical_application_logs;
create policy "public full access chemical_application_logs" on public.chemical_application_logs for all using (true) with check (true);

drop policy if exists "public full access chemical_application_tank_mix_items" on public.chemical_application_tank_mix_items;
create policy "public full access chemical_application_tank_mix_items" on public.chemical_application_tank_mix_items for all using (true) with check (true);

drop policy if exists "public full access program_settings" on public.program_settings;
create policy "public full access program_settings" on public.program_settings for all using (true) with check (true);

drop policy if exists "public full access department_options" on public.department_options;
create policy "public full access department_options" on public.department_options for all using (true) with check (true);

drop policy if exists "public full access group_options" on public.group_options;
create policy "public full access group_options" on public.group_options for all using (true) with check (true);

drop policy if exists "public full access work_locations" on public.work_locations;
create policy "public full access work_locations" on public.work_locations for all using (true) with check (true);

drop policy if exists "public full access shift_templates" on public.shift_templates;
create policy "public full access shift_templates" on public.shift_templates for all using (true) with check (true);

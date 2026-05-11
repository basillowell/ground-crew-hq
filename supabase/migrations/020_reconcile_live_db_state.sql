begin;

-- SECTION 1: RLS helper functions (rewrite to app_users lookup)
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.app_users WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.app_users WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT employee_id FROM public.app_users WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.auth_app_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.app_users WHERE id = auth.uid() LIMIT 1
$$;

-- SECTION 2: app_users RLS fix (remove circular dependency)
DROP POLICY IF EXISTS "app_users select" ON public.app_users;
DROP POLICY IF EXISTS "app_users manage" ON public.app_users;
CREATE POLICY "app_users select" ON public.app_users
  FOR SELECT USING (auth.uid() = id OR auth.role() = 'service_role');
CREATE POLICY "app_users manage" ON public.app_users
  FOR ALL USING (auth.uid() = id OR auth.role() = 'service_role');

-- SECTION 3: weather_locations missing columns
ALTER TABLE public.weather_locations
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.weather_locations
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.weather_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "weather_locations select" ON public.weather_locations;
DROP POLICY IF EXISTS "weather_locations manage" ON public.weather_locations;
DROP POLICY IF EXISTS "public full access weather_locations" ON public.weather_locations;
CREATE POLICY "weather_locations select" ON public.weather_locations
  FOR SELECT USING (org_id = (SELECT org_id FROM public.app_users WHERE id = auth.uid())
    OR auth.role() = 'service_role');
CREATE POLICY "weather_locations manage" ON public.weather_locations
  FOR ALL USING (org_id = (SELECT org_id FROM public.app_users WHERE id = auth.uid())
    OR auth.role() = 'service_role');

-- SECTION 4: weather_display_prefs table
CREATE TABLE IF NOT EXISTS public.weather_display_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid REFERENCES auth.users(id),
  location_id text,
  enabled_widgets text[] DEFAULT ARRAY[
    'current-conditions','hourly-forecast','daily-forecast',
    'wind','rain','alerts','turf-risk-notes'],
  widget_order text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.weather_display_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "weather_display_prefs select" ON public.weather_display_prefs;
DROP POLICY IF EXISTS "weather_display_prefs manage" ON public.weather_display_prefs;
CREATE POLICY "weather_display_prefs select" ON public.weather_display_prefs
  FOR SELECT USING (org_id = (SELECT org_id FROM public.app_users WHERE id = auth.uid())
    OR auth.role() = 'service_role');
CREATE POLICY "weather_display_prefs manage" ON public.weather_display_prefs
  FOR ALL USING (org_id = (SELECT org_id FROM public.app_users WHERE id = auth.uid())
    OR auth.role() = 'service_role');

-- SECTION 5: scheduler_settings table
CREATE TABLE IF NOT EXISTS public.scheduler_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  default_shift_start time DEFAULT '05:00',
  default_shift_end time DEFAULT '13:30',
  default_shift_days text[] DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  min_shift_hours numeric DEFAULT 4,
  max_shift_hours numeric DEFAULT 10,
  overtime_threshold_hours numeric DEFAULT 40,
  crew_start_time_buffer_minutes int DEFAULT 0,
  notes text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.scheduler_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduler_settings select" ON public.scheduler_settings;
DROP POLICY IF EXISTS "scheduler_settings manage" ON public.scheduler_settings;
CREATE POLICY "scheduler_settings select" ON public.scheduler_settings
  FOR SELECT USING (org_id = (SELECT org_id FROM public.app_users WHERE id = auth.uid()));
CREATE POLICY "scheduler_settings manage" ON public.scheduler_settings
  FOR ALL USING (org_id = (SELECT org_id FROM public.app_users WHERE id = auth.uid())
    AND (SELECT role FROM public.app_users WHERE id = auth.uid()) = ANY(ARRAY['admin','manager']));

-- SECTION 6: Remove duplicate "public full access" policies
DROP POLICY IF EXISTS "public full access shift_templates" ON public.shift_templates;
DROP POLICY IF EXISTS "public full access work_locations" ON public.work_locations;
DROP POLICY IF EXISTS "public full access manual_rainfall_entries" ON public.manual_rainfall_entries;
DROP POLICY IF EXISTS "public full access weather_stations" ON public.weather_stations;
DROP POLICY IF EXISTS "public full access weather_daily_logs" ON public.weather_daily_logs;
DROP POLICY IF EXISTS "public full access chemical_products" ON public.chemical_products;
DROP POLICY IF EXISTS "public full access application_areas" ON public.application_areas;
DROP POLICY IF EXISTS "public full access chemical_application_logs" ON public.chemical_application_logs;
DROP POLICY IF EXISTS "public full access chemical_application_tank_mix_items" ON public.chemical_application_tank_mix_items;
DROP POLICY IF EXISTS "public full access department_options" ON public.department_options;
DROP POLICY IF EXISTS "public full access group_options" ON public.group_options;

-- SECTION 7: Remove duplicate program_settings policies
DROP POLICY IF EXISTS "program_settings_insert_org_scope" ON public.program_settings;
DROP POLICY IF EXISTS "program_settings_select_org_scope" ON public.program_settings;
DROP POLICY IF EXISTS "program_settings_update_org_scope" ON public.program_settings;

-- SECTION 8: Seed data (idempotent)
INSERT INTO public.weather_locations (id, name, property, area, latitude, longitude, org_id, is_active)
SELECT gen_random_uuid()::text, 'Sarasota Polo Club',
  'b50b42cd-903e-4280-9373-1d9cae97b2b3', 'Main',
  27.3364, -82.5307, 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.weather_locations
  WHERE org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid
);

INSERT INTO public.scheduler_settings (org_id, default_shift_start, default_shift_end)
VALUES ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807', '05:00', '13:30')
ON CONFLICT DO NOTHING;

INSERT INTO public.weather_display_prefs (org_id, user_id, enabled_widgets)
VALUES ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807',
  '9078c42b-e938-4994-a88f-f77df3de2ead',
  ARRAY['current-conditions','hourly-forecast','daily-forecast',
        'wind','rain','alerts','turf-risk-notes'])
ON CONFLICT DO NOTHING;

commit;

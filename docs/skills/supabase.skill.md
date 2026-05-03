# Supabase Skill — Ground Crew HQ

## Project
- Project URL: https://fjqeekwisnbpxgebrnpl.supabase.co
- Client import: import { supabase } from '@/lib/supabase'

## 24 Production Tables
organizations, app_users, employees, properties,
schedule_entries, assignments, tasks, equipment_units,
clock_events, notes, program_settings, department_options,
group_options, role_options, language_options, shift_templates,
work_locations, weather_locations, weather_stations,
weather_daily_logs, manual_rainfall_entries,
chemical_application_logs, chemical_products,
chemical_application_tank_mix_items

## Every Write Must Include
- org_id: currentUser?.orgId (from useAuth())
- property_id: currentPropertyId (from useAuth(), where column exists)

## After Every Mutation
queryClient.invalidateQueries({ queryKey: ['table-name'] })

## RLS Bypass Pattern (admin + manager full access)
CREATE POLICY "table manage" ON public.table_name
FOR ALL
USING (
  org_id = current_org_id()
  AND current_user_role() IN ('admin', 'manager')
)
WITH CHECK (
  org_id = current_org_id()
  AND current_user_role() IN ('admin', 'manager')
);

## Auth Functions Available in Postgres
- current_org_id() → returns org_id for auth.uid()
- current_employee_id() → returns employee_id for auth.uid()
- current_user_role() → returns role for auth.uid()

## Query Pattern
// Always use hooks from supabase-queries.ts
const { data, isLoading } = useEmployees(currentPropertyId, orgId)

// Direct mutation pattern
const { error } = await supabase
  .from('employees')
  .upsert({ ...fields, org_id: currentUser?.orgId })
if (error) throw error
await queryClient.invalidateQueries({ queryKey: ['employees'] })

## New Table Checklist
1. Add to 001_initial_schema.sql or new migration file
2. Add org_id column with FK to organizations
3. Add RLS policy using admin/manager bypass pattern
4. Add fetch function to supabase-queries.ts
5. Add useXxx hook wrapping the fetch function
6. Test with real Supabase data before shipping

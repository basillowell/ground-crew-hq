# Supabase Skill - Ground Crew HQ

## Project
- Project URL: https://fjqeekwisnbpxgebrnpl.supabase.co
- Client import: `import { supabase } from '@/lib/supabase'`
- Full schema reference: `docs/dev/live-db-state.md`

## Key Tables Queried by supabase-queries.ts
organizations, app_users, employees, properties,
schedule_entries, assignments, tasks, equipment_units,
clock_events, notes, program_settings,
departments, employee_groups, workforce_roles,
language_options, shift_templates, work_locations,
worker_types, job_descriptions, employment_statuses,
wage_categories, overtime_rules,
weather_locations, weather_stations, weather_daily_logs,
manual_rainfall_entries,
chemical_application_logs, chemical_products,
chemical_application_tank_mix_items,
application_areas, property_class_options,
invoices, clients, messages

NOTE: department_options, group_options, role_options are LEGACY fallback
tables. Active queries hit departments, employee_groups, workforce_roles first.

## Every Write Must Include
- `org_id: orgId` from `useAuth()` where the table has `org_id`.
- `property_id: currentPropertyId` from `useAuth()` only where the column is NOT NULL.
- Property inserts must use a submitting/loading guard so double-clicks, Enter-key repeats, or slow responses cannot create duplicate rows.

## Tasks Are Org-Wide
- `tasks.property_id` is nullable as of migration `006_tasks_org_wide.sql`.
- Do NOT require `property_id` when writing to `tasks`; it is optional.
- `useTasks()` ignores the propertyId param, must never filter by `property_id`, and fetches by org only.
- Call `useTasks(_propertyId, orgId)` with `orgId` directly. Do not gate task loading behind `isOrgReady`.

## After Every Mutation
```typescript
queryClient.invalidateQueries({ queryKey: ['table-name'] })
```

## RLS Bypass Pattern (admin + manager full access)
```sql
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
```

## Auth Functions Available in Postgres
- `current_org_id()` returns org_id for auth.uid()
- `current_employee_id()` returns employee_id for auth.uid()
- `current_user_role()` returns role for auth.uid()

## Query Pattern
Always use hooks from `supabase-queries.ts`:
```typescript
const { data, isLoading } = useEmployees(currentPropertyId, orgId)
```

Direct mutation pattern:
```typescript
const { error } = await supabase
  .from('employees')
  .upsert({ ...fields, org_id: orgId })
if (error) throw error
await queryClient.invalidateQueries({ queryKey: ['employees'] })
```

## New Table Checklist
1. Stop and report `DB_CHANGE_REQUIRED`; Codex does not create migrations.
2. After Basil confirms the schema exists, add a fetch function to `supabase-queries.ts`.
3. Add a `useXxx` hook wrapping the fetch function.
4. Test with real Supabase data before shipping.

## Self-Service Pattern (never hardcode org data)
Every new org row, property row, and weather_location row
must be created by the user through the app UI.
Never seed data for a specific org in application code.
Seed files in `supabase/seeds/` are for development only.

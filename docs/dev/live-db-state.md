# Ground Crew HQ — Live DB State
# Maintained by Claude · Updated: May 13, 2026
# Read this only when your task touches Supabase queries.

---

## Connection
- Project: fjqeekwisnbpxgebrnpl.supabase.co
- Org: Ground Crew HQ · Plan: starter
- Org ID: read from useAuth() — never hardcode

## Auth Pattern
```typescript
// app_users RLS: auth.uid() = id OR auth.role() = 'service_role'
// All 37 tables have RLS enabled
// Never read org_id from JWT — always from app_users via useAuth()
```

## Helper Functions (SECURITY DEFINER — never redefine)
```sql
current_org_id()      → SELECT org_id FROM app_users WHERE id = auth.uid()
current_user_role()   → SELECT role FROM app_users WHERE id = auth.uid()
current_employee_id() → SELECT employee_id FROM app_users WHERE id = auth.uid()
auth_app_user_id()    → SELECT id FROM app_users WHERE id = auth.uid()
```

## Key Tables & Columns

### app_users
id (uuid), org_id, role, employee_id, department, status

### employees
id, org_id, first_name, last_name, role, department, status

### schedule_entries
id, org_id, employee_id, property_id, date, shift_start, shift_end, status, notes

### scheduler_settings (1 row — id: 48336e91)
org_id, default_shift_start (05:00), default_shift_end (13:30)
operational_day_start (07:30), operational_day_end (16:00)
operational_days [mon,tue,wed,thu,fri,sat]
min_shift_hours (4), max_shift_hours (10), overtime_threshold_hours (40)
property_id (b50b42cd)

### shift_templates (4 rows — id: text, default: gen_random_uuid()::text)
id, org_id, name, start (text), end (text), days (text[]), active
⚠️ cols are "start" and "end" — NOT start_time/end_time
⚠️ NO created_at column — order by name

### tasks
id, org_id, property_id, name, description, category, status,
priority, color, estimated_hours, location

### assignments
id, org_id, employee_id, property_id, task_id, date, title,
location, status, notes, order_index,
estimated_hours, actual_hours, completed_at, start_time

### weather_locations (1 active row — id: 8c4f9cf0)
id (text), org_id, name, property, area, latitude, longitude, is_active

### weather_stations (1 row — id: 7b98c31e)
id (uuid), locationId → weather_locations.id (FK exists ✓)
name, provider, stationCode, isPrimary, status, latitude, longitude, timeZone

### weather_display_prefs (1 row — id: c2d495f6)
org_id, user_id, location_id, enabled_widgets (text[]), widget_order

### weather_daily_logs
id, locationId, stationId, date, currentConditions (nullable),
forecast (nullable), rainfallTotal, temperature, humidity, wind, et, source, notes

### program_settings (1 row — id: 017ce60a)
org_id, app_name, primary_color (#166534), accent_color,
sidebar_color, font_theme_preset, logo_url, default_department

### organizations (1 row — id: bb13da4a)
id, name (Ground Crew HQ), plan (starter)

### properties (1 row — id: b50b42cd)
id, org_id, name (Sarasota Polo Club), city, state,
latitude (27.3364), longitude (-82.5307), acreage (180)

### workforce_roles (6 rows)
Field Manager, Lead Technician, Field Staff,
Irrigation Specialist, Superintendent, Equipment Operator

## Key Foreign Keys
```
weather_stations.locationId → weather_locations.id ✓
weather_locations.org_id → organizations.id ✓
scheduler_settings.property_id → properties.id ✓
app_users.employee_id → employees.id ✓
```

## Standard RLS Query Patterns
```typescript
// Tables with org_id:
.eq('org_id', orgId)

// weather_daily_logs (linked via locationId):
.in('locationId', locationIds)

// app_users (no self-reference):
// policy: auth.uid() = id — just query directly, no extra filter needed
```

## Seed Data IDs (reference only — never hardcode in code)
```
Property:           b50b42cd-903e-4280-9373-1d9cae97b2b3
Weather location:   8c4f9cf0-1bcb-4801-bb75-e8233a154c35
Weather station:    7b98c31e-d9d2-41b7-bd94-c62519fe900b
Scheduler settings: 48336e91-8890-4596-aba2-cc19a9c855be
Program settings:   017ce60a (read org from useAuth())
```

# Ground Crew HQ — Live Database State
# AUTHORITATIVE SCHEMA REFERENCE — Last updated: May 17, 2026
# Supabase project: fjqeekwisnbpxgebrnpl
# ALL tables have RLS enabled

---

## ⚠️ CODEX SCHEMA VERIFICATION RULES

**These rules are MANDATORY. Violating them causes production crashes.**

### Rule S1 — NEVER assume a column exists
Before writing ANY Supabase query (.select, .insert, .update, .eq, .order),
verify EVERY column name against this file. If the column is not listed
below for that table, it DOES NOT EXIST. Do not guess. Do not invent columns.

### Rule S2 — NEVER delete data without confirmation
Before any .delete() call, the UI must show a confirmation dialog.
Never auto-delete. Never batch-delete without explicit user action.

### Rule S3 — Column name gotchas (these cause crashes)
- weather_locations.id is TEXT not UUID
- weather_locations uses "property" not "property_id"
- weather_locations uses "is_active" not "active"
- shift_templates.id is TEXT not UUID
- shift_templates uses "start" and "end" not "start_time" and "end_time"
- shift_templates has NO created_at column
- tasks.priority is INTEGER (1=high, 2=med, 3=low) not TEXT
- employees.status is TEXT ('active'/'inactive') — use this for filtering
- employees.active is BOOLEAN — redundant but exists, keep in sync with status
- schedule_entries uses "shift_start" and "shift_end" not "start" and "end"
- notes uses "type" not "category" for note classification
- task_requests uses "description" not "notes" for detail text
- task_requests uses "employee_id" not "submitted_by"
- weather_daily_logs uses camelCase columns (locationId, stationId, rainfallTotal, etc)

### Rule S4 — Time handling
Supabase returns times as "HH:MM:SS". Always .slice(0,5) before display.
Always display via formatTime() from src/utils/formatTime.ts for AM/PM.
Time INPUTS stay as HH:MM for browser compatibility.

### Rule S5 — Org scoping
Every query on a table with org_id MUST include .eq('org_id', orgId).
Never query without org scoping.

### Rule S6 — orgId guard
orgId from useAuth() is UNDEFINED on first render. Every query must guard:
  enabled: !!orgId (for react-query)
  if (!orgId) return; (for useEffect)
Show skeleton while orgId is undefined. NEVER show error state before orgId resolves.

### Rule S7 — Use .maybeSingle() not .single()
.single() throws an error when 0 rows are returned.
.maybeSingle() returns null when 0 rows are returned.
Always use .maybeSingle() for queries that might return no results.

### Rule S8 — Verify before writing new queries
If you need a column that is NOT in this file:
  STOP and report: CLAUDE_DB_REQUIRED: need column [name] on [table]
  Do NOT add .eq() or .select() on columns not listed here.

---

## organizations
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | |
| plan | text | NO | 'starter' |
| stripe_customer_id | text | YES | |
| stripe_subscription_id | text | YES | |
| subscription_status | text | NO | 'trialing' |
| created_at | timestamptz | NO | now() |

---

## properties
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | |
| short_name | text | NO | |
| logo_initials | text | NO | 'GC' |
| color | text | NO | '#166534' |
| city | text | NO | '' |
| state | text | NO | '' |
| latitude | float8 | YES | |
| longitude | float8 | YES | |
| acreage | numeric | NO | 0 |
| status | text | NO | 'active' |
| created_at | timestamptz | NO | now() |
| org_id | uuid | YES | |
| weather_location_label | text | YES | |

---

## app_users
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | (matches auth.uid()) |
| employee_id | uuid | NO | |
| role | text | NO | CHECK: admin, manager, employee, viewer |
| department | text | YES | |
| status | text | NO | 'active' |
| created_at | timestamptz | NO | now() |
| org_id | uuid | YES | |

---

## employees
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| property_id | uuid | NO | |
| first_name | text | NO | |
| last_name | text | NO | |
| role | text | NO | 'Crew' |
| department | text | NO | 'Maintenance' |
| status | text | NO | 'active' |
| phone | text | YES | |
| email | text | YES | |
| created_at | timestamptz | NO | now() |
| org_id | uuid | YES | |
| hourly_rate | numeric | YES | |
| job_description_id | uuid | YES | |
| job_description | text | YES | |
| employment_status_id | uuid | YES | |
| employment_status | text | YES | |
| wage_category_id | uuid | YES | |
| overtime_rule_id | uuid | YES | |
| group_id | uuid | YES | |
| group_name | text | YES | |
| role_id | uuid | YES | |
| department_id | uuid | YES | |
| language | text | YES | |
| worker_type_id | uuid | YES | |
| worker_type | text | YES | |
| portal_enabled | boolean | NO | false |
| login_email | text | YES | |
| default_location_id | text | YES | |
| preferred_shift_template_id | text | YES | |
| active | boolean | YES | true |
| employment_type | text | YES | 'full-time' |

---

## tasks
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| property_id | uuid | NO | |
| name | text | NO | |
| description | text | YES | |
| category | text | NO | 'General' |
| status | text | NO | 'active' |
| priority | integer | NO | 1 (1=high, 2=med, 3=low) |
| created_at | timestamptz | NO | now() |
| org_id | uuid | YES | |
| color | text | YES | |
| estimated_hours | numeric | YES | 1 |
| location | text | YES | |

---

## assignments
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| employee_id | uuid | NO | |
| property_id | uuid | NO | |
| task_id | uuid | YES | |
| date | date | NO | |
| location | text | YES | |
| status | text | NO | 'planned' |
| created_at | timestamptz | NO | now() |
| org_id | uuid | YES | |
| notes | text | YES | |
| order_index | integer | YES | |
| estimated_hours | numeric | YES | 0 |
| actual_hours | numeric | YES | 0 |
| completed_at | timestamptz | YES | |
| start_time | time | YES | |
| title | text | YES | |
| equipment_unit_id | uuid | YES | |

---

## schedule_entries
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| employee_id | uuid | NO | |
| property_id | uuid | NO | |
| date | date | NO | |
| shift_start | time | NO | ⚠️ NOT "start" |
| shift_end | time | NO | ⚠️ NOT "end" |
| status | text | NO | 'scheduled' |
| created_at | timestamptz | NO | now() |
| org_id | uuid | YES | |
| notes | text | YES | |

---

## shift_templates
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text | NO | gen_random_uuid()::text ⚠️ TEXT not UUID |
| name | text | NO | |
| start | text | NO | ⚠️ NOT "start_time" |
| end | text | NO | ⚠️ NOT "end_time" |
| days | text[] | NO | '{}' |
| org_id | uuid | YES | |
| start_time | time | YES | (legacy, nullable) |
| end_time | time | YES | (legacy, nullable) |
| active | boolean | NO | true |
| ⚠️ NO created_at column | | | |

---

## scheduler_settings
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO | |
| default_shift_start | time | YES | '05:00' |
| default_shift_end | time | YES | '13:30' |
| default_shift_days | text[] | YES | {mon,tue,wed,thu,fri} |
| min_shift_hours | numeric | YES | 4 |
| max_shift_hours | numeric | YES | 10 |
| overtime_threshold_hours | numeric | YES | 40 |
| crew_start_time_buffer_minutes | integer | YES | 0 |
| notes | text | YES | |
| updated_at | timestamptz | YES | now() |
| operational_day_start | time | YES | '05:00' |
| operational_day_end | time | YES | '18:00' |
| operational_days | text[] | YES | {mon,tue,wed,thu,fri,sat} |
| property_id | uuid | YES | |
| escalation_config | jsonb | YES | {equipment_overdue_days:90, coverage_warning_pct:50, wind_spray_cutoff_mph:10, rain_spray_cutoff_pct:40, heat_advisory_temp_f:95} |

---

## schedule_week_templates
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO | |
| name | text | NO | |
| template_data | jsonb | NO | '[]' |
| created_at | timestamptz | YES | now() |

---

## equipment_types
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO | |
| property_id | uuid | YES | |
| name | text | NO | |
| short_name | text | YES | |
| category | text | YES | 'General' |
| active | boolean | NO | true |
| created_at | timestamptz | NO | now() |

---

## equipment_units
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| property_id | uuid | NO | |
| name | text | NO | |
| type | text | NO | |
| status | text | NO | 'available' |
| location | text | YES | |
| last_serviced | date | YES | |
| created_at | timestamptz | NO | now() |
| org_id | uuid | YES | |
| equipment_type_id | uuid | YES | |
| unit_name | text | YES | |
| notes | text | YES | |
| active | boolean | NO | true |

---

## clock_events
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| employee_id | uuid | NO | |
| property_id | uuid | NO | |
| event_type | text | NO | ('clock_in' or 'clock_out') |
| timestamp | timestamptz | NO | now() |
| location_lat | float8 | YES | |
| location_lng | float8 | YES | |
| org_id | uuid | YES | |

---

## weather_locations
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text | NO | gen_random_uuid()::text ⚠️ TEXT not UUID |
| name | text | NO | |
| property | text | NO | ⚠️ NOT "property_id" — stores property UUID as text |
| area | text | NO | |
| latitude | numeric | YES | |
| longitude | numeric | YES | |
| org_id | uuid | YES | |
| is_active | boolean | YES | true ⚠️ NOT "active" |

---

## weather_display_prefs
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO | |
| user_id | uuid | YES | |
| location_id | text | YES | |
| enabled_widgets | text[] | YES | {current-conditions, hourly-forecast, daily-forecast, wind, rain, alerts, turf-risk-notes} |
| widget_order | text[] | YES | {} |
| updated_at | timestamptz | YES | now() |

---

## weather_daily_logs
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text | NO | ⚠️ camelCase columns throughout |
| locationId | text | NO | |
| stationId | text | YES | |
| date | date | NO | |
| currentConditions | text | YES | |
| forecast | text | YES | |
| rainfallTotal | numeric | NO | 0 |
| temperature | numeric | NO | 0 |
| humidity | numeric | NO | 0 |
| wind | numeric | NO | 0 |
| et | numeric | NO | 0 |
| source | text | NO | |
| notes | text | YES | |

---

## notes
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| property_id | uuid | NO | |
| type | text | NO | 'general' ⚠️ NOT "category" |
| title | text | NO | |
| content | text | NO | '' |
| location | text | YES | |
| created_by | uuid | YES | |
| created_at | timestamptz | NO | now() |
| org_id | uuid | YES | |

---

## task_requests
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | YES | |
| property_id | uuid | YES | |
| employee_id | uuid | YES | ⚠️ NOT "submitted_by" |
| date | date | NO | |
| title | text | NO | |
| description | text | YES | ⚠️ NOT "notes" |
| status | text | YES | 'pending' |
| priority | text | YES | 'medium' |
| created_at | timestamptz | YES | now() |

---

## safety_talks
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO | |
| property_id | uuid | YES | |
| topic | text | NO | |
| content | text | YES | |
| presented_by | uuid | YES | |
| presented_date | date | YES | |
| attendees | jsonb | YES | |
| created_at | timestamptz | YES | now() |

---

## messages
(schema not fully documented — check information_schema if needed)

---

## recurring_task_rules
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO | FK organizations |
| property_id | uuid | YES | FK properties |
| task_id | uuid | NO | FK tasks |
| employee_id | uuid | YES | FK employees (null = all scheduled crew) |
| days_of_week | text[] | NO | '{}' |
| active | boolean | NO | true |
| created_at | timestamptz | YES | now() |

---

## beta_feedback
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO | |
| user_id | uuid | NO | |
| page | text | YES | |
| feedback_type | text | YES | CHECK: bug, feature, general |
| message | text | NO | |
| rating | integer | YES | CHECK: 1-5 |
| created_at | timestamptz | YES | now() |

---

## Key IDs (for reference only — never hardcode)
- Org: bb13da4a-d2de-4fc9-ad5a-bfd266e08807 (Ground Crew HQ)
- Property: b50b42cd-903e-4280-9373-1d9cae97b2b3 (Sarasota Polo Club)
- Weather location: 8c4f9cf0-1bcb-4801-bb75-e8233a154c35
- Scheduler settings: 48336e91-8890-4596-aba2-cc19a9c855be
- Auth user (Basil): 9078c42b-e938-4994-a88f-f77df3de2ead
- Demo user: 9443a8b2-1564-4e08-85f0-c2a644bd9928

---

*This file is the single source of truth for all Supabase table schemas.*
*Codex MUST read this file before writing ANY Supabase query.*
*If a column is not listed here, it does not exist.*
*Last verified: May 17, 2026 via information_schema query.*

# live-db-state.md
> Authoritative DB schema for Ground Crew HQ — Supabase project `fjqeekwisnbpxgebrnpl`
> Last updated: 2026-07-14 (auto-generated from information_schema)
> Rule 10: All column names in queries must come from this file, never from memory.

---

## app_users
| column                | type        | nullable | default        |
|-----------------------|-------------|----------|----------------|
| id                    | uuid        | NO       |                |
| employee_id           | uuid        | NO       |                |
| role                  | text        | NO       |                |
| department            | text        | YES      |                |
| status                | text        | NO       | 'active'       |
| created_at            | timestamptz | NO       | now()          |
| org_id                | uuid        | YES      |                |
| theme_preset_override | text        | YES      |                |
| theme_custom_colors   | jsonb       | YES      |                |

> theme_preset_override: nullable, no FK. Stores a preset id (e.g. 'fairway',
> 'polo-green') matching an entry in src/lib/colorThemes.ts's COLOR_THEMES
> constant, or the literal string 'custom'. null = inherit the org's
> program_settings color/font default.

> theme_custom_colors: nullable jsonb, shape `{primaryColor, accentColor,
> sidebarColor}` (hex strings). Only meaningful when theme_preset_override
> is 'custom'. null/absent = no personal custom colors set. Added in
> migration 023_add_app_users_theme_custom_colors.sql.

---

## application_areas
| column            | type | nullable |
|-------------------|------|----------|
| id                | text | NO       |
| name              | text | NO       |
| property          | text | NO       |
| weatherLocationId | text | NO       |
| org_id            | uuid | YES      |

> ⚠️ camelCase column: `weatherLocationId` — always double-quote in raw SQL

---

## turf_mow_patterns
| column               | type        | nullable | default           |
|----------------------|-------------|----------|-------------------|
| id                   | uuid        | NO       | gen_random_uuid() |
| org_id               | uuid        | YES      |                   |
| application_area_id  | text        | NO       |                   |
| pattern              | text        | NO       |                   |
| rotation             | text        | NO       |                   |
| applied_by           | uuid        | YES      |                   |
| applied_at           | timestamptz | NO       | now()             |
| created_at           | timestamptz | NO       | now()             |

> FK: application_area_id -> application_areas.id (text, cascade delete —
> matches application_areas' text-id convention, do not use gen_random_uuid()).
> FK: applied_by -> employees.id.
> "Current" pattern per area = latest row by applied_at desc. "History" =
> full row list for that application_area_id.
> Live schema confirmed for Workboard Phase 6 Turf Management.
> application_area_id remains text to match application_areas.id.
> Current row is resolved by applied_at descending.

---

## assignments
| column              | type        | nullable | default    |
|---------------------|-------------|----------|------------|
| id                  | uuid        | NO       | gen_random_uuid() |
| employee_id         | uuid        | NO       |            |
| property_id         | uuid        | NO       |            |
| task_id             | uuid        | YES      |            |
| date                | date        | NO       |            |
| location            | text        | YES      |            |
| status              | text        | NO       | 'planned'  |
| created_at          | timestamptz | NO       | now()      |
| org_id              | uuid        | YES      |            |
| notes               | text        | YES      |            |
| order_index         | integer     | YES      |            |
| estimated_hours     | numeric     | YES      | 0          |
| actual_hours        | numeric     | YES      | 0          |
| completed_at        | timestamptz | YES      |            |
| start_time          | time        | YES      |            |
| title               | text        | YES      |            |
| equipment_unit_id   | uuid        | YES      |            |
| actual_start_at     | timestamptz | YES      |            |
| actual_completed_at | timestamptz | YES      |            |
| is_published        | boolean     | NO       | false      |
| published_at        | timestamptz | YES      |            |
| published_by        | uuid        | YES      |            |

---

## beta_feedback
| column        | type        | nullable | default |
|---------------|-------------|----------|---------|
| id            | uuid        | NO       | gen_random_uuid() |
| org_id        | uuid        | NO       |         |
| user_id       | uuid        | NO       |         |
| page          | text        | YES      |         |
| feedback_type | text        | YES      |         |
| message       | text        | NO       |         |
| rating        | integer     | YES      |         |
| created_at    | timestamptz | YES      | now()   |

---

## chemical_application_logs
| column                      | type        | nullable | default |
|-----------------------------|-------------|----------|---------|
| id                          | text        | NO       |         |
| application_date            | date        | NO       |         |
| start_time                  | text        | NO       |         |
| end_time                    | text        | NO       |         |
| area_id                     | text        | NO       |         |
| target_pest                 | text        | NO       |         |
| agronomic_purpose           | text        | NO       |         |
| carrier_volume              | numeric     | NO       | 0       |
| area_treated                | numeric     | NO       | 0       |
| area_unit                   | text        | NO       |         |
| applicator_id               | text        | NO       |         |
| equipment_used_id           | text        | YES      |         |
| weather_log_id              | text        | YES      |         |
| notes                       | text        | NO       | ''      |
| application_timestamp       | text        | NO       | ''      |
| application_method          | text        | NO       | ''      |
| total_mix_volume            | numeric     | NO       | 0       |
| applicator_license_number   | text        | NO       | ''      |
| supervisor_name             | text        | NO       | ''      |
| supervisor_license_number   | text        | NO       | ''      |
| weather_conditions_summary  | text        | NO       | ''      |
| wind_direction              | text        | NO       | ''      |
| wind_speed_at_application   | numeric     | NO       | 0       |
| temperature_at_application  | numeric     | NO       | 0       |
| humidity_at_application     | numeric     | NO       | 0       |
| restricted_entry_until      | text        | NO       | ''      |
| site_conditions             | text        | NO       | ''      |
| org_id                      | uuid        | YES      |         |
| property_id                 | uuid        | YES      |         |

> ⚠️ `id` is `text`, not uuid

---

## chemical_application_tank_mix_items
| column           | type    | nullable | default |
|------------------|---------|----------|---------|
| id               | text    | NO       |         |
| applicationLogId | text    | NO       |         |
| productId        | text    | NO       |         |
| rateApplied      | numeric | NO       | 0       |
| rateUnit         | text    | NO       |         |
| totalQuantityUsed| numeric | NO       | 0       |
| mixOrder         | integer | NO       | 1       |
| org_id           | uuid    | YES      |         |

> ⚠️ camelCase columns: `applicationLogId`, `productId`, `rateApplied`, `rateUnit`, `totalQuantityUsed`, `mixOrder` — always double-quote in raw SQL

---

## chemical_products
| column                     | type    | nullable | default |
|----------------------------|---------|----------|---------|
| id                         | text    | NO       |         |
| name                       | text    | NO       |         |
| product_type               | text    | NO       |         |
| target_use                 | text    | NO       |         |
| rate_unit                  | text    | NO       |         |
| epa_registration_number    | text    | NO       | ''      |
| formulation                | text    | NO       | ''      |
| signal_word                | text    | NO       | ''      |
| restricted_use             | boolean | NO       | false   |
| reentry_interval_hours     | numeric | NO       | 0       |
| pre_harvest_interval_hours | numeric | NO       | 0       |
| default_application_method | text    | NO       | ''      |
| org_id                     | uuid    | YES      |         |

> ⚠️ `id` is `text`, not uuid

---

## chemical_settings
| column                  | type        | nullable | default  |
|-------------------------|-------------|----------|----------|
| id                      | uuid        | NO       | gen_random_uuid() |
| org_id                  | uuid        | NO       |          |
| default_property_id     | uuid        | YES      |          |
| default_applicator_id   | uuid        | YES      |          |
| rei_notification_hours  | integer     | NO       | 12       |
| require_weather_log     | boolean     | NO       | false    |
| require_supervisor      | boolean     | NO       | false    |
| default_area_unit       | text        | NO       | 'acres'  |
| created_at              | timestamptz | NO       | now()    |
| updated_at              | timestamptz | NO       | now()    |

---

## clock_events
| column       | type        | nullable | default |
|--------------|-------------|----------|---------|
| id           | uuid        | NO       | gen_random_uuid() |
| employee_id  | uuid        | NO       |         |
| property_id  | uuid        | NO       |         |
| event_type   | text        | NO       |         |
| timestamp    | timestamptz | NO       | now()   |
| location_lat | float8      | YES      |         |
| location_lng | float8      | YES      |         |
| org_id       | uuid        | YES      |         |

---

## department_options
| column | type | nullable |
|--------|------|----------|
| id     | text | NO       |
| name   | text | NO       |

---

## departments
| column     | type        | nullable | default |
|------------|-------------|----------|---------|
| id         | uuid        | NO       | gen_random_uuid() |
| org_id     | uuid        | NO       |         |
| name       | text        | NO       |         |
| active     | boolean     | NO       | true    |
| created_at | timestamptz | NO       | now()   |

---

## employee_groups
| column     | type        | nullable | default |
|------------|-------------|----------|---------|
| id         | uuid        | NO       | gen_random_uuid() |
| org_id     | uuid        | NO       |         |
| name       | text        | NO       |         |
| active     | boolean     | NO       | true    |
| created_at | timestamptz | NO       | now()   |

---

## employees
| column                       | type        | nullable | default      |
|------------------------------|-------------|----------|--------------|
| id                           | uuid        | NO       | gen_random_uuid() |
| property_id                  | uuid        | NO       |              |
| first_name                   | text        | NO       |              |
| last_name                    | text        | NO       |              |
| role                         | text        | NO       | 'Crew'       |
| department                   | text        | NO       | 'Maintenance'|
| status                       | text        | NO       | 'active'     |
| phone                        | text        | YES      |              |
| email                        | text        | YES      |              |
| created_at                   | timestamptz | NO       | now()        |
| org_id                       | uuid        | YES      |              |
| hourly_rate                  | numeric     | YES      |              |
| job_description_id           | uuid        | YES      |              |
| job_description              | text        | YES      |              |
| employment_status_id         | uuid        | YES      |              |
| employment_status            | text        | YES      |              |
| wage_category_id             | uuid        | YES      |              |
| overtime_rule_id             | uuid        | YES      |              |
| group_id                     | uuid        | YES      |              |
| group_name                   | text        | YES      |              |
| role_id                      | uuid        | YES      |              |
| department_id                | uuid        | YES      |              |
| language                     | text        | YES      |              |
| worker_type_id               | uuid        | YES      |              |
| worker_type                  | text        | YES      |              |
| portal_enabled               | boolean     | NO       | false        |
| login_email                  | text        | YES      |              |
| default_location_id          | text        | YES      |              |
| preferred_shift_template_id  | text        | YES      |              |
| active                       | boolean     | YES      | true         |
| employment_type              | text        | YES      | 'full-time'  |

---

## employment_statuses
| column     | type        | nullable | default |
|------------|-------------|----------|---------|
| id         | uuid        | NO       | gen_random_uuid() |
| org_id     | uuid        | NO       |         |
| name       | text        | NO       |         |
| active     | boolean     | NO       | true    |
| created_at | timestamptz | NO       | now()   |

---

## equipment_types
| column      | type        | nullable | default   |
|-------------|-------------|----------|-----------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |           |
| property_id | uuid        | YES      |           |
| name        | text        | NO       |           |
| short_name  | text        | YES      |           |
| category    | text        | YES      | 'General' |
| active      | boolean     | NO       | true      |
| created_at  | timestamptz | NO       | now()     |

---

## equipment_units
| column              | type             | nullable | default            |
|---------------------|------------------|----------|--------------------|
| id                  | uuid             | NO       | gen_random_uuid()  |
| property_id         | uuid             | NO       |                    |
| name                | text             | NO       |                    |
| type                | text             | NO       |                    |
| status              | text             | NO       | 'available'        |
| location            | text             | YES      |                    |
| last_serviced       | date             | YES      |                    |
| created_at          | timestamptz      | NO       | now()              |
| org_id              | uuid             | YES      |                    |
| equipment_type_id   | uuid             | YES      |                    |
| unit_name           | text             | YES      |                    |
| notes               | text             | YES      |                    |
| active              | boolean          | NO       | true               |
| estimated_hours     | numeric          | YES      | 0                  |
| latitude            | double precision | YES      |                    |
| longitude           | double precision | YES      |                    |
| location_updated_at | timestamptz      | YES      |                    |
| qr_token            | uuid             | YES      | gen_random_uuid()  |

> qr_token has a unique index (equipment_units_qr_token_key) — used for mobile scan-to-login.

---

## fertilizer_application_logs
| column                | type        | nullable | default   |
|-----------------------|-------------|----------|-----------|
| id                    | uuid        | NO       | gen_random_uuid() |
| application_date      | date        | NO       |           |
| start_time            | text        | NO       |           |
| end_time              | text        | NO       |           |
| property_id           | uuid        | NO       |           |
| applicator_id         | uuid        | NO       |           |
| fertilizer_product_id | uuid        | NO       |           |
| rate                  | numeric     | NO       | 0         |
| rate_unit             | text        | NO       | 'lbs/acre'|
| application_speed     | numeric     | NO       | 0         |
| speed_unit            | text        | NO       | 'mph'     |
| area_treated          | numeric     | NO       | 0         |
| area_unit             | text        | NO       | 'acres'   |
| total_amount          | numeric     | NO       | 0         |
| equipment_used_id     | uuid        | YES      |           |
| notes                 | text        | NO       | ''        |
| org_id                | uuid        | YES      |           |
| created_at            | timestamptz | NO       | now()     |
| updated_at            | timestamptz | NO       | now()     |

> ⚠️ `id` is `uuid` (not `text` like the chemical_* logging tables) — safe to use `gen_random_uuid()` in inserts/tests.

---

## fertilizer_products
| column          | type        | nullable | default   |
|-----------------|-------------|----------|-----------|
| id              | uuid        | NO       | gen_random_uuid() |
| name            | text        | NO       |           |
| fertilizer_type | text        | NO       |           |
| rate_unit       | text        | NO       | 'lbs/acre'|
| org_id          | uuid        | YES      |           |
| created_at      | timestamptz | NO       | now()     |
| updated_at      | timestamptz | NO       | now()     |

> ⚠️ `id` is `uuid` (not `text` like `chemical_products`) — safe to use `gen_random_uuid()` in inserts/tests.

---

## group_options
| column | type | nullable |
|--------|------|----------|
| id     | text | NO       |
| name   | text | NO       |
| color  | text | NO       |

---

## job_descriptions
| column      | type        | nullable | default |
|-------------|-------------|----------|---------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |         |
| name        | text        | NO       |         |
| description | text        | YES      |         |
| active      | boolean     | NO       | true    |
| created_at  | timestamptz | NO       | now()   |

---

## manual_rainfall_entries
| column          | type    | nullable | default |
|-----------------|---------|----------|---------|
| id              | text    | NO       |         |
| location_id     | text    | NO       |         |
| date            | date    | NO       |         |
| rainfall_amount | numeric | NO       | 0       |
| entered_by      | text    | NO       |         |
| notes           | text    | YES      |         |

---

## notes
| column      | type        | nullable | default   |
|-------------|-------------|----------|-----------|
| id          | uuid        | NO       | gen_random_uuid() |
| property_id | uuid        | YES      |           |
| type        | text        | NO       | 'general' |
| title       | text        | NO       |           |
| content     | text        | NO       | ''        |
| location    | text        | YES      |           |
| created_by  | uuid        | YES      |           |
| created_at  | timestamptz | NO       | now()     |
| org_id      | uuid        | YES      |           |
| employee_id | uuid        | YES      |           |
| assignment_id | uuid        | YES      |           |

Scope chain: org-wide (property_id, employee_id, assignment_id all NULL) -> property-scoped (property_id set) -> employee-scoped (+ employee_id) -> task-scoped (+ assignment_id). A CHECK constraint (notes_scope_chain_check) enforces that employee_id/assignment_id can only be set when property_id is also set. RLS was updated so org-wide notes (property_id IS NULL) are usable by org admin/manager for writes and any org member for reads — property-scoped notes continue using the existing can_manage_property/can_read_property functions unchanged.

---

## organizations
| column                  | type        | nullable | default      |
|-------------------------|-------------|----------|--------------|
| id                      | uuid        | NO       | gen_random_uuid() |
| name                    | text        | NO       |              |
| plan                    | text        | NO       | 'starter'    |
| stripe_customer_id      | text        | YES      |              |
| stripe_subscription_id  | text        | YES      |              |
| subscription_status     | text        | NO       | 'trialing'   |
| created_at              | timestamptz | NO       | now()        |

---

## overtime_rules
| column      | type        | nullable | default |
|-------------|-------------|----------|---------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |         |
| name        | text        | NO       |         |
| description | text        | YES      |         |
| active      | boolean     | NO       | true    |
| created_at  | timestamptz | NO       | now()   |

---

## program_settings
| column                        | type        | nullable | default                    |
|-------------------------------|-------------|----------|----------------------------|
| id                            | uuid        | NO       | gen_random_uuid()          |
| app_name                      | text        | NO       | 'Ground Crew HQ'           |
| client_label                  | text        | NO       | ''                         |
| primary_color                 | text        | NO       | '#166534'                  |
| accent_color                  | text        | NO       | '#d1fae5'                  |
| sidebar_color                 | text        | NO       | '#111827'                  |
| font_theme_preset             | text        | NO       | 'modern-sans'              |
| logo_url                      | text        | YES      |                            |
| default_department            | text        | NO       | 'Maintenance'              |
| created_at                    | timestamptz | NO       | now()                      |
| org_id                        | uuid        | YES      |                            |
| weather_default_location_name | text        | YES      |                            |
| weather_default_address       | text        | YES      |                            |
| weather_default_latitude      | numeric     | YES      |                            |
| weather_default_longitude     | numeric     | YES      |                            |
| weather_preferred_provider    | text        | YES      | 'open-meteo'               |
| weather_enabled_panels        | text[]      | YES      | ['current-conditions', ...] |

---

## properties
| column                 | type        | nullable | default      |
|------------------------|-------------|----------|--------------|
| id                     | uuid        | NO       | gen_random_uuid() |
| name                   | text        | NO       |              |
| short_name             | text        | NO       |              |
| sort_order             | integer     | NO       | 0            |
| logo_initials          | text        | NO       | 'GC'         |
| color                  | text        | NO       | '#166534'    |
| city                   | text        | NO       | ''           |
| state                  | text        | NO       | ''           |
| latitude               | float8      | YES      |              |
| longitude              | float8      | YES      |              |
| acreage                | numeric     | NO       | 0            |
| status                 | text        | NO       | 'active'     |
| created_at             | timestamptz | NO       | now()        |
| org_id                 | uuid        | YES      |              |
| weather_location_label | text        | YES      |              |

sort_order persists manual drag-and-drop ordering, ascending.

RLS:
- INSERT uses an `org_id` membership check only because a new row has no existing property `id`.
- SELECT/UPDATE/DELETE use `can_manage_property(id)`.

---

## property_class_options
| column     | type        | nullable |
|------------|-------------|----------|
| id         | uuid        | NO       |
| org_id     | uuid        | YES      |
| name       | text        | NO       |
| created_at | timestamptz | YES      |

---

## recurring_task_rules
| column      | type        | nullable | default |
|-------------|-------------|----------|---------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |         |
| property_id | uuid        | YES      |         |
| task_id     | uuid        | NO       |         |
| employee_id | uuid        | YES      |         |
| days_of_week| text[]      | NO       | '{}'    |
| active      | boolean     | NO       | true    |
| created_at  | timestamptz | YES      | now()   |

---

## schedule_entries
| column      | type        | nullable | default      |
|-------------|-------------|----------|--------------|
| id          | uuid        | NO       | gen_random_uuid() |
| employee_id | uuid        | NO       |              |
| property_id | uuid        | NO       |              |
| date        | date        | NO       |              |
| shift_start | time        | NO       |              |
| shift_end   | time        | NO       |              |
| status      | text        | NO       | 'scheduled'  |
| created_at  | timestamptz | NO       | now()        |
| org_id      | uuid        | YES      |              |
| notes       | text        | YES      |              |

---

## schedule_week_templates
| column        | type        | nullable | default |
|---------------|-------------|----------|---------|
| id            | uuid        | NO       | gen_random_uuid() |
| org_id        | uuid        | NO       |         |
| name          | text        | NO       |         |
| template_data | jsonb       | NO       | '[]'    |
| created_at    | timestamptz | YES      | now()   |

---

## scheduler_settings
| column                        | type        | nullable | default                  |
|-------------------------------|-------------|----------|--------------------------|
| id                            | uuid        | NO       | gen_random_uuid()        |
| org_id                        | uuid        | NO       |                          |
| default_shift_start           | time        | YES      | '05:00:00'               |
| default_shift_end             | time        | YES      | '13:30:00'               |
| default_shift_days            | text[]      | YES      | ['mon','tue','wed','thu','fri'] |
| min_shift_hours               | numeric     | YES      | 4                        |
| max_shift_hours               | numeric     | YES      | 10                       |
| overtime_threshold_hours      | numeric     | YES      | 40                       |
| crew_start_time_buffer_minutes| integer     | YES      | 0                        |
| notes                         | text        | YES      |                          |
| updated_at                    | timestamptz | YES      | now()                    |
| operational_day_start         | time        | YES      | '05:00:00'               |
| operational_day_end           | time        | YES      | '18:00:00'               |
| operational_days              | text[]      | YES      | ['mon','tue','wed','thu','fri','sat'] |
| property_id                   | uuid        | YES      |                          |
| escalation_config             | jsonb       | YES      |                          |

---

## shift_templates
| column     | type        | nullable | default |
|------------|-------------|----------|---------|
| id         | text        | NO       | gen_random_uuid()::text |
| name       | text        | NO       |         |
| start      | text        | NO       |         |
| end        | text        | NO       |         |
| days       | text[]      | NO       | '{}'    |
| org_id     | uuid        | YES      |         |
| start_time | time        | YES      |         |
| end_time   | time        | YES      |         |
| active     | boolean     | NO       | true    |

---

## sop_checklist_items
| column      | type        | nullable | default |
|-------------|-------------|----------|---------|
| id          | uuid        | NO       | gen_random_uuid() |
| sop_id      | uuid        | NO       |         |
| org_id      | uuid        | NO       |         |
| label       | text        | NO       |         |
| order_index | integer     | NO       | 0       |
| is_required | boolean     | NO       | true    |
| created_at  | timestamptz | NO       | now()   |

---

## sop_completions
| column               | type        | nullable | default |
|----------------------|-------------|----------|---------|
| id                   | uuid        | NO       | gen_random_uuid() |
| assignment_id        | uuid        | NO       |         |
| sop_checklist_item_id| uuid        | NO       |         |
| employee_id          | uuid        | NO       |         |
| org_id               | uuid        | NO       |         |
| completed            | boolean     | NO       | false   |
| completed_at         | timestamptz | YES      |         |
| created_at           | timestamptz | NO       | now()   |

---

## sops
| column          | type        | nullable | default |
|-----------------|-------------|----------|---------|
| id              | uuid        | NO       | gen_random_uuid() |
| org_id          | uuid        | NO       |         |
| property_id     | uuid        | YES      |         |
| title           | text        | NO       |         |
| description     | text        | YES      |         |
| procedure_body  | text        | YES      |         |
| category        | text        | YES      |         |
| estimated_hours | numeric     | YES      | 0       |
| color           | text        | YES      |         |
| is_active       | boolean     | NO       | true    |
| created_by      | uuid        | YES      |         |
| created_at      | timestamptz | NO       | now()   |
| updated_at      | timestamptz | NO       | now()   |

---

## task_categories
| column     | type        | nullable | default |
|------------|-------------|----------|---------|
| id         | uuid        | NO       | gen_random_uuid() |
| org_id     | uuid        | NO       |         |
| name       | text        | NO       |         |
| sort_order | integer     | NO       | 0       |
| created_at | timestamptz | NO       | now()   |

Replaces the old localStorage-based `gcrew-task-categories-{orgId}` key — categories are now org-wide and shared across devices/users.

---

## task_requests
| column      | type        | nullable | default    |
|-------------|-------------|----------|------------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | YES      |            |
| property_id | uuid        | YES      |            |
| employee_id | uuid        | YES      |            |
| date        | date        | NO       |            |
| title       | text        | NO       |            |
| description | text        | YES      |            |
| status      | text        | YES      | 'pending'  |
| priority    | text        | YES      | 'medium'   |
| created_at  | timestamptz | YES      | now()      |

---

## tasks
| column          | type        | nullable | default   |
|-----------------|-------------|----------|-----------|
| id              | uuid        | NO       | gen_random_uuid() |
| property_id     | uuid        | NO       |           |
| name            | text        | NO       |           |
| description     | text        | YES      |           |
| category        | text        | NO       | 'General' |
| status          | text        | NO       | 'active'  |
| priority        | integer     | NO       | 1         |
| created_at      | timestamptz | NO       | now()     |
| org_id          | uuid        | YES      |           |
| color           | text        | YES      |           |
| estimated_hours | numeric     | YES      | 1         |
| location        | text        | YES      |           |

---

## wage_categories
| column      | type        | nullable | default |
|-------------|-------------|----------|---------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |         |
| name        | text        | NO       |         |
| description | text        | YES      |         |
| active      | boolean     | NO       | true    |
| created_at  | timestamptz | NO       | now()   |

---

## weather_daily_logs
| column           | type        | nullable | default |
|------------------|-------------|----------|---------|
| id               | text        | NO       |         |
| location_id      | text        | NO       |         |
| station_id       | text        | YES      |         |
| date             | date        | NO       |         |
| current_conditions| text       | YES      |         |
| forecast         | text        | YES      |         |
| rainfall_total   | numeric     | NO       | 0       |
| temperature      | numeric     | NO       | 0       |
| humidity         | numeric     | NO       | 0       |
| wind             | numeric     | NO       | 0       |
| et               | numeric     | NO       | 0       |
| source           | text        | NO       |         |
| notes            | text        | YES      |         |
| org_id           | uuid        | YES      |         |

---

## weather_display_prefs
| column          | type        | nullable | default |
|-----------------|-------------|----------|---------|
| id              | uuid        | NO       | gen_random_uuid() |
| org_id          | uuid        | NO       |         |
| user_id         | uuid        | YES      |         |
| location_id     | text        | YES      |         |
| enabled_widgets | text[]      | YES      | ['current-conditions', ...] |
| widget_order    | text[]      | YES      | '{}'    |
| updated_at      | timestamptz | YES      | now()   |

---

## weather_locations
| column           | type    | nullable | default          |
|------------------|---------|----------|------------------|
| id               | text    | NO       | gen_random_uuid()::text |
| name             | text    | NO       |                  |
| property         | text    | NO       |                  |
| area             | text    | YES      |                  |
| latitude         | numeric | YES      |                  |
| longitude        | numeric | YES      |                  |
| org_id           | uuid    | YES      |                  |
| is_active        | boolean | YES      | true             |
| timezone         | text    | NO       | 'UTC'            |
| is_default       | boolean | NO       | false            |
| forecast_provider| text    | NO       | 'auto'           |
| radar_provider   | text    | NO       | 'rainviewer'     |

> ⚠️ `id` is `text`, not uuid

---

## weather_stations
| column      | type    | nullable | default    |
|-------------|---------|----------|------------|
| id          | text    | NO       |            |
| locationId  | text    | NO       |            |
| name        | text    | NO       |            |
| provider    | text    | NO       |            |
| stationCode | text    | NO       |            |
| isPrimary   | boolean | NO       | false      |
| status      | text    | NO       |            |
| providerType| text    | NO       | 'manual'   |
| latitude    | numeric | YES      |            |
| longitude   | numeric | YES      |            |
| timeZone    | text    | NO       | ''         |

> ⚠️ camelCase columns: `locationId`, `stationCode`, `isPrimary`, `providerType`, `timeZone` — always double-quote in raw SQL

---

## work_locations
| column      | type    | nullable | default |
|-------------|---------|----------|---------|
| id          | text    | NO       |         |
| name        | text    | NO       |         |
| org_id      | uuid    | YES      |         |
| property_id | uuid    | YES      |         |
| active      | boolean | NO       | true    |

---

## work_orders
| column           | type        | nullable | default        |
|------------------|-------------|----------|----------------|
| id               | uuid        | NO       | gen_random_uuid() |
| org_id           | uuid        | NO       |                |
| property_id      | uuid        | NO       |                |
| equipment_unit_id| uuid        | NO       |                |
| title            | text        | NO       |                |
| description      | text        | YES      |                |
| status           | text        | NO       | 'open'         |
| priority         | text        | NO       | 'medium'       |
| cost             | numeric     | YES      | 0              |
| created_at       | timestamptz | NO       | now()          |
| completed_at     | timestamptz | YES      |                |
| wo_number        | serial      | NO       |                |
| category         | text        | NO       | 'preventative' |
| interval_hours   | numeric     | YES      |                |
| interval_days    | numeric     | YES      |                |
| due_at_hours     | numeric     | YES      |                |
| due_at_date      | date        | YES      |                |
| planned_status   | text        | NO       | 'not_started'  |

> category CHECK: ('preventative','repair')
> planned_status CHECK: ('not_started','in_progress','completed','skipped')

---

## equipment_specs
| column     | type        | nullable | default           |
|------------|-------------|----------|-------------------|
| id         | uuid        | NO       | gen_random_uuid() |
| org_id     | uuid        | YES      |                   |
| unit_id    | uuid        | NO       |                   |
| label      | text        | NO       |                   |
| value      | text        | NO       | ''                |
| sort_order | integer     | NO       | 0                 |
| created_at | timestamptz | NO       | now()             |

> FK: unit_id -> equipment_units.id (cascade delete)

---

## work_order_jobs
| column        | type        | nullable | default           |
|---------------|-------------|----------|-------------------|
| id            | uuid        | NO       | gen_random_uuid() |
| org_id        | uuid        | YES      |                   |
| work_order_id | uuid        | NO       |                   |
| label         | text        | NO       |                   |
| is_complete   | boolean     | NO       | false             |
| sort_order    | integer     | NO       | 0                 |
| created_at    | timestamptz | NO       | now()             |

> FK: work_order_id -> work_orders.id (cascade delete)

---

## equipment_favorites
| column            | type        | nullable | default           |
|-------------------|-------------|----------|-------------------|
| id                | uuid        | NO       | gen_random_uuid() |
| org_id            | uuid        | YES      |                   |
| employee_id       | uuid        | NO       |                   |
| equipment_type_id | uuid        | NO       |                   |
| sort_order        | integer     | NO       | 0                 |
| created_at        | timestamptz | NO       | now()             |

> UNIQUE(employee_id, equipment_type_id). FKs cascade delete on both.

---

## worker_types
| column     | type        | nullable | default |
|------------|-------------|----------|---------|
| id         | uuid        | NO       | gen_random_uuid() |
| org_id     | uuid        | NO       |         |
| name       | text        | NO       |         |
| active     | boolean     | NO       | true    |
| created_at | timestamptz | NO       | now()   |

---

## workforce_roles
| column      | type        | nullable | default |
|-------------|-------------|----------|---------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |         |
| name        | text        | NO       |         |
| description | text        | YES      |         |
| active      | boolean     | NO       | true    |
| created_at  | timestamptz | NO       | now()   |

---

## ⚠️ Special column notes (Rule 10 warnings)

| table | columns with non-standard casing | action |
|-------|----------------------------------|--------|
| application_areas | `weatherLocationId` | double-quote in raw SQL |
| chemical_application_tank_mix_items | `applicationLogId`, `productId`, `rateApplied`, `rateUnit`, `totalQuantityUsed`, `mixOrder` | double-quote in raw SQL |
| weather_stations | `locationId`, `stationCode`, `isPrimary`, `providerType`, `timeZone` | double-quote in raw SQL |
| chemical_application_logs | `id` is text, not uuid | do not use gen_random_uuid() |
| chemical_products | `id` is text, not uuid | do not use gen_random_uuid() |
| weather_locations | `id` is text, not uuid | cast: gen_random_uuid()::text |

---

## invoices
| column      | type        | nullable | default        |
|-------------|-------------|----------|----------------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |                |
| property_id | uuid        | YES      |                |
| employee_id | uuid        | YES      |                |
| status      | text        | NO       | 'draft'        |
| line_items  | jsonb       | NO       | '[]'           |
| subtotal    | numeric     | NO       | 0              |
| tax_rate    | numeric     | NO       | 0              |
| total       | numeric     | NO       | 0              |
| notes       | text        | YES      |                |
| created_at  | timestamptz | NO       | now()          |
| sent_at     | timestamptz | YES      |                |
| paid_at     | timestamptz | YES      |                |

> status CHECK: ('draft','sent','paid','void')

---

## messages
| column     | type        | nullable | default           |
|------------|-------------|----------|-------------------|
| id         | uuid        | NO       | gen_random_uuid() |
| org_id     | uuid        | NO       |                   |
| channel    | text        | NO       | 'general'         |
| sender_id  | uuid        | NO       |                   |
| body       | text        | NO       |                   |
| created_at | timestamptz | NO       | now()             |

> Realtime enabled via supabase_realtime publication.

---

## clients
| column        | type        | nullable | default           |
|---------------|-------------|----------|-------------------|
| id            | uuid        | NO       | gen_random_uuid() |
| org_id        | uuid        | NO       |                   |
| name          | text        | NO       |                   |
| email         | text        | YES      |                   |
| phone         | text        | YES      |                   |
| address       | text        | YES      |                   |
| client_token  | uuid        | NO       | gen_random_uuid() |
| notes         | text        | YES      |                   |
| active        | boolean     | NO       | true              |
| created_at    | timestamptz | NO       | now()             |

> public_token_read policy: FOR SELECT USING (true) — allows public portal reads by client_token.

---

## Table count: 46
## Last synced from: Supabase project fjqeekwisnbpxgebrnpl (equipment_module_v2 migration applied — added equipment_specs, work_order_jobs, equipment_favorites; extended equipment_units and work_orders)

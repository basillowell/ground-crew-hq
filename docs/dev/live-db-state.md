# live-db-state.md
> Authoritative DB schema for Ground Crew HQ — Supabase project `fjqeekwisnbpxgebrnpl`
> Last updated: 2026-07-23 (revenue chain Phase 1 applied by hand; see invoices)
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
| theme_darkness_override | numeric    | YES      |                |

> theme_preset_override: nullable, no FK. Stores a preset id (e.g. 'fairway',
> 'polo-green') matching an entry in src/lib/colorThemes.ts's COLOR_THEMES
> constant, or the literal string 'custom'. null = inherit the org's
> program_settings color/font default.

> theme_custom_colors: nullable jsonb, shape `{base, accent, contrast?}` —
> two hex strings + an optional 0-100 number. Only meaningful when
> theme_preset_override is 'custom'. null/absent = no personal custom colors set.
> Added in migration 023_add_app_users_theme_custom_colors.sql.
>
> Shape changed from `{primaryColor, accentColor, sidebarColor}` when the theme
> engine moved to OKLCH (base + accent + contrast). No data migration was run:
> zero personal custom-color records existed. Rows in the old shape fail
> parseCustomThemeColors() and return null, falling back to the preset — the
> intended degradation. The column is unconstrained jsonb, so that parse in
> src/lib/colorThemes.ts is the only validation boundary.

> theme_darkness_override: nullable numeric, 0-100 scale. Overrides the org-level
> program_settings.theme_darkness for this user. null = inherit org/default darkness.
>
> NAMING DRIFT (open decision): the engine now reads this as *contrast* — it sets
> both the surface ladder's spread and the WCAG ratio text must hit. The column
> name still says darkness. Not renamed; see program_settings.theme_darkness.

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
| approved_by         | uuid        | YES      |            |
| approved_at         | timestamptz | YES      |            |
| deleted_at          | timestamptz | YES      |            |
| deleted_by          | uuid        | YES      |            |
| work_order_id       | uuid        | YES      |            |
| task_work_order_id  | uuid        | YES      |            |

> approved_by: nullable FK -> employees.id. Supervisor who reviewed/approved
> this assignment's logged times. NULL = not yet approved. approved_at is the
> payroll audit timestamp for that approval.
>
> deleted_at: nullable soft-delete marker for assignments. NULL = active.
> deleted_by: nullable FK -> employees.id. Supervisor who soft-deleted the
> assignment.
>
> work_order_id (migration revenue_phase3_payments_and_job_link, 2026-07-24):
> nullable FK -> work_orders.id (decision O-2). Links the labor unit (an
> assignment's actual_hours) to the billed unit (a work order) so Job Costing can
> compute revenue-vs-cost per job. Nullable with no backfill: historical
> assignments stay NULL and simply don't roll up per-job until edited. Index
> assignments_work_order_id_idx.
>
> task_work_order_id (migration task_work_order_funnel_p0, 2026-08-11): nullable
> FK -> task_work_orders.id (on delete set null). Plan B link — assigning a task
> work order to an employee creates an assignment carrying this id, so it rides
> the workboard + job costing. DISTINCT from work_order_id (equipment).

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

## department_options — DROPPED 2026-07-23

Removed (migration drop_legacy_department_and_group_options). Abandoned legacy
option table with text ids (dep1, dep2, ...); fully superseded by `departments`
(same names, real UUIDs). No FKs, no app queries, was deny-all RLS. Row snapshot
preserved in the migration comment for restoration.

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
| applicator_license_number    | text        | YES      |              |

> applicator_license_number: nullable free text. On-file chemical/pesticide
> applicator license for this employee, independent of any license number
> typed into a specific chemical_application_logs entry. null = no license
> on file.

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
| property_id         | uuid             | YES      |                    |
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
| maintenance_interval_hours | numeric  | YES      |                    |
| hours_at_last_service | numeric       | YES      |                    |

> qr_token has a unique index (equipment_units_qr_token_key) — used for mobile scan-to-login.
> maintenance_interval_hours / hours_at_last_service added by equipment_maintenance_intervals
> migration. maintenance_interval_hours null = interval tracking not enabled for that unit.
> Due for service = (estimated_hours - hours_at_last_service) >= maintenance_interval_hours.
> Logging a service should set hours_at_last_service = estimated_hours at that point in time.
> property_id is nullable as of equipment_units_shared_property_nullable migration:
> null = "shared" equipment, usable/visible across all of an org's properties.
> Non-null = scoped to that one property, as before.
> RLS (both select and manage policies): null property_id rows are allowed for any
> active app_users row in the same org (manage additionally requires role
> admin/manager); non-null property_id rows still gate through
> can_read_property()/can_manage_property() as before. Application code should
> treat property_id === null as "shared across all properties," not as an error
> or an unassigned/incomplete record.

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

## group_options — DROPPED 2026-07-23

Removed (migration drop_legacy_department_and_group_options). Abandoned legacy
option table with text ids (grp1, grp2, ...); fully superseded by
`employee_groups` (same names, real UUIDs). No FKs, no app queries, was deny-all
RLS. Row snapshot (including color) preserved in the migration comment.

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

> RLS enabled, no policy = deny-all: the app cannot read or write this table, yet
> it holds 20 rows of real data. Kept deliberately (unlike the dropped
> department_options/group_options legacy tables) because it has no live
> equivalent. If manual rainfall entry is a wanted feature, it needs an
> org_isolation policy and a UI; if abandoned, it needs an explicit drop decision.

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
| theme_darkness                | numeric     | YES      |                            |
| pay_period_length_days        | integer     | NO       | 14                         |
| pay_period_anchor_date        | date        | NO       | '2024-01-01'               |
| onboarding_dismissed          | boolean     | NO       | false                      |

> onboarding_dismissed (migration program_settings_onboarding_dismissed, 2026-08-11): org-level flag —
> true once an admin/manager dismisses the "Getting Started" orientation panel or completes the basics.
> When false, the dismissible panel + guided-tour option show on the Command Center for admin/manager.
>
> pay_period_length_days / pay_period_anchor_date (migration program_settings_pay_period_config,
> 2026-08-11): org-configurable payroll period. length in days (14 = bi-weekly), and an anchor
> date (default 2024-01-01, a Monday) from which periods are computed deterministically — the org
> shifts the anchor to align to their real pay calendar. Consumed by the /app/payroll review page.
>
> theme_darkness: nullable numeric, 0-100 scale. Controls theme surface/card
> darkness at the org level. null = default 50.
>
> NAMING DRIFT (open decision): read as *contrast* by the OKLCH engine, not
> darkness. 50 reproduces the shipped design. Renaming to theme_contrast is a
> migration nobody has approved yet, so the name still says darkness.

> COLUMN REUSE (open decision): the theme is now two colors, but these three
> columns predate that. Current mapping, applied in AppLayout.applyBranding and
> SettingsPage:
>   - sidebar_color  -> `base`   (drives every surface's hue + chroma)
>   - primary_color  -> `accent` (buttons, links, ring, active states)
>   - accent_color   -> UNUSED. No longer read or written.
> So `base` lives in a column named sidebar_color, which is misleading. Options:
> rename the columns to base_color/accent_color, or leave the drift documented.
> Not decided — flagged rather than actioned.

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
| boundary_geojson       | jsonb       | YES      |              |
| calculated_acreage     | numeric     | YES      |              |

sort_order persists manual drag-and-drop ordering, ascending.

boundary_geojson is the client-writable surface (PostgREST reads/writes plain jsonb —
never touch `calculated_acreage` directly from application code).
calculated_acreage is a GENERATED ALWAYS STORED column derived from boundary_geojson
via extensions.ST_GeomFromGeoJSON/extensions.ST_Area (PostGIS lives in the `extensions`
schema as of 2026-07-30 — see postgis-relocation-runbook.md); DB-maintained and
read-only to the client. calculated_acreage is in acres and is a cross-check against
the manual acreage field — it never overwrites it. NULL boundary_geojson = boundary
not drawn yet.

The `boundary` geometry column and its GIST index (properties_boundary_gist_idx) were
dropped in the 2026-07-30 PostGIS relocation (unused by the app, which reads only
boundary_geojson + calculated_acreage). Recreate a geometry column + GIST index
qualified to `extensions` only if server-side spatial queries are ever added.

RLS:
- INSERT uses an `org_id` membership check only because a new row has no existing property `id`.
- SELECT/UPDATE/DELETE use `can_manage_property(id)`.

---

## projects
| column          | type        | nullable | default           |
|-----------------|-------------|----------|-------------------|
| id              | uuid        | NO       | gen_random_uuid() |
| org_id          | uuid        | NO       |                   |
| property_id     | uuid        | NO       |                   |
| name            | text        | NO       |                   |
| status          | text        | NO       | 'active'          |
| description     | text        | YES      |                   |
| start_date      | date        | YES      |                   |
| target_end_date | date        | YES      |                   |
| color           | text        | YES      |                   |
| created_at      | timestamptz | NO       | now()             |
| location_geojson| jsonb       | YES      |                   |
| area_geojson    | jsonb       | YES      |                   |
| calculated_area_acres | numeric | YES     |                   |

> FK: property_id -> properties.id. property_id is required (NOT NULL) — a project
> always belongs to exactly one property; this is not a hierarchical scope column.

> Map placement (migration project_map_pins_and_area, 2026-07-24). Same hybrid
> pattern as properties.boundary_geojson:
> - location_geojson / area_geojson are the ONLY columns application code writes.
>   Plain PostgREST jsonb. location_geojson is a GeoJSON Point (the map pin);
>   area_geojson is an optional GeoJSON Polygon for a per-project sub-area.
> - calculated_area_acres is GENERATED ALWAYS STORED and read-only to the client —
>   writes are rejected. Derived from area_geojson via extensions.ST_Area (PostGIS in
>   the `extensions` schema as of 2026-07-30). The `location`/`area` geometry columns
>   and their GIST indexes were dropped in the PostGIS relocation (unused); recreate
>   qualified to `extensions` if server-side spatial queries are added.
> - Decision: pins ship first, per-project areas are a later phase. Both columns
>   exist now so that phase needs no migration.

RLS: SELECT via can_read_property(property_id). INSERT requires active admin/manager
app_users row in the current org AND can_manage_property(property_id). UPDATE/DELETE
via can_manage_property(property_id).

---

## project_photos
| column            | type        | nullable | default           |
|-------------------|-------------|----------|-------------------|
| id                | uuid        | NO       | gen_random_uuid() |
| org_id            | uuid        | NO       |                   |
| property_id       | uuid        | NO       |                   |
| project_id        | uuid        | NO       |                   |
| timeline_event_id | uuid        | YES      |                   |
| storage_path      | text        | NO       |                   |
| caption           | text        | YES      |                   |
| content_type      | text        | YES      |                   |
| size_bytes        | bigint      | YES      |                   |
| uploaded_by       | uuid        | YES      |                   |
| sort_order        | integer     | NO       | 0                 |
| created_at        | timestamptz | NO       | now()             |

> Progress photos. A photo may attach to a TIMELINE EVENT (desktop: each dated
> entry carries its own before/during/after images) OR, as of Phase C-1
> (2026-07-25), directly to a PROJECT with timeline_event_id NULL (mobile field
> capture, where a crew photographs progress without a pre-made event).
> FKs: project_id -> projects.id CASCADE, timeline_event_id ->
> project_timeline_events.id CASCADE (nullable), uploaded_by -> employees.id.
> org_id and property_id are denormalised so RLS needs no join. storage_path UNIQUE.
>
> storage_path holds the object key inside the `project-photos` bucket and MUST
> follow `{org_id}/{project_id}/{uuid}.{ext}` — the storage policies match on the
> first path segment, so any other shape is rejected on upload.

RLS (relaxed for field capture, migration phase_c_field_photo_capture 2026-07-25):
- SELECT: can_read_property(property_id) — unchanged.
- INSERT: can_read_property(property_id) AND an active app_users row in the same
  org (ANY role). This lets a crew member upload for the property they are
  assigned to, not just admin/manager. The table is the property-fine gate.
- UPDATE/DELETE: can_manage_property(property_id) — still manager-only.
> Note: there are currently no employee-role app_users in the org, so the crew
> path is validated by policy logic only, not a live employee login (which does
> not exist yet). The admin path is validated end-to-end (rolled back).

---

## Storage bucket: project-photos

The project's first and currently only storage bucket.

| setting | value |
|---|---|
| public | **false** |
| file_size_limit | 10 MB |
| allowed_mime_types | image/jpeg, image/png, image/webp, image/heic, image/heif |

**Private by design.** These are customer site photos; a public bucket would make
every image readable by anyone holding a URL — the same failure class as the
`clients` `USING (true)` policy dropped in cc3fd91. Never flip `public` to true.
Serve images with `createSignedUrl`, not `getPublicUrl`.

Four policies on `storage.objects`, all filtered to `bucket_id = 'project-photos'`
and matching `(storage.foldername(name))[1] = public.current_org_id()::text`
(relaxed for field capture, migration phase_c_field_photo_capture 2026-07-25):
- SELECT: any active member of the owning org
- INSERT: any active member of the owning org (the admin/manager restriction was
  dropped so crews can upload; the project_photos TABLE policy is the real
  property-level gate — storage can only see the {org_id}/... path)
- UPDATE: still `current_user_role()` in (admin, manager)
- DELETE: `current_user_role()` in (admin, manager) OR `owner = auth.uid()` — a
  crew member can remove an object THEY uploaded, which keeps the upload-rollback
  path (delete the orphan if the table insert fails) working without granting
  them a general delete capability

Note the read scope is org-wide rather than per-property, because a storage policy
can only see the object path. The `project_photos` table remains the authoritative,
property-gated index of which photos belong where.

---

## project_timeline_events
| column      | type        | nullable | default           |
|-------------|-------------|----------|-------------------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |                   |
| project_id  | uuid        | NO       |                   |
| property_id | uuid        | NO       |                   |
| event_type  | text        | NO       |                   |
| title       | text        | NO       |                   |
| body        | text        | YES      |                   |
| event_date  | date        | NO       |                   |
| created_by  | uuid        | YES      |                   |
| created_at  | timestamptz | NO       | now()             |

> FK: project_id -> projects.id, property_id -> properties.id (denormalised for RLS
> gating — avoids a join through projects on every row-level check).

RLS: same pattern as projects — SELECT via can_read_property(property_id), INSERT
requires active admin/manager + can_manage_property(property_id), UPDATE/DELETE via
can_manage_property(property_id).

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
| default_break_minutes         | integer     | NO       | 30                       |
| default_break_paid            | boolean     | NO       | false                    |
| default_break_start_time      | time        | NO       | '11:00:00'               |

> default_break_minutes/default_break_paid/default_break_start_time: org-level
> break/lunch policy defaults for scheduler and downstream worked-hour
> calculations. Unpaid breaks are excluded from paid-hours/cost totals.

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
| sop_id          | uuid        | YES      |           |
| is_unpaid       | boolean     | NO       | false     |

> sop_id: nullable FK to sops.id. When set, this task has an associated
> SOP that should be surfaced to the assigned employee (see
> MobileFieldWorkspacePage.tsx) when they're working the task. null = no
> SOP required for this task.
>
> is_unpaid: excludes this task from paid-hours/cost totals when computing
> worked hours. Intended for break/lunch tasks.

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
| equipment_unit_id| uuid        | YES      |                |
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
| submitted_by     | uuid        | YES      |                |

> category CHECK: ('preventative','repair','general')
> equipment_unit_id is now nullable: null = a general crew-submitted work
> order (issue/request), not tied to a specific equipment unit. Non-null =
> equipment maintenance work order, as before.
> submitted_by: nullable FK to employees.id. Who submitted the work order
> (relevant for general/crew-submitted category, optional for equipment
> maintenance entries created by the system/admin).
> planned_status CHECK: ('not_started','in_progress','completed','skipped')

---

## task_work_orders
| column          | type        | nullable | default           |
|-----------------|-------------|----------|-------------------|
| id              | uuid        | NO       | gen_random_uuid() |
| org_id          | uuid        | NO       |                   |
| property_id     | uuid        | YES      |                   |
| client_id       | uuid        | YES      |                   |
| title           | text        | NO       |                   |
| description     | text        | YES      |                   |
| priority        | text        | NO       | 'medium'          |
| source          | text        | NO       | 'internal'        |
| funnel_stage    | text        | NO       | 'new'             |
| submitted_by    | uuid        | YES      |                   |
| reviewed_by     | uuid        | YES      |                   |
| accepted_at     | timestamptz | YES      |                   |
| rejected_reason | text        | YES      |                   |
| due_date        | date        | YES      |                   |
| created_at      | timestamptz | NO       | now()             |
| completed_at    | timestamptz | YES      |                   |
| punch_list      | text        | YES      |                   |
| equipment_unit_id | uuid      | YES      |                   |

> equipment_unit_id (migration equipment_due_task_work_order_bridge, 2026-08-11): nullable FK ->
> equipment_units.id (on delete set null). Set when a WO was auto-generated from a due equipment
> maintenance item; used for dedup + traceability. Null for client/internal WOs.
> migration task_work_order_funnel_p0 (2026-08-11). The CLIENT-REQUEST TASK work
> order funnel — DISTINCT from work_orders (which is equipment maintenance). A
> client-originated to-do a supervisor reviews/accepts, then assigns to an
> employee. Do NOT conflate the two tables.
> property_id: nullable FK -> properties.id (on delete set null). Must be set
> before assignment (assignments.property_id is NOT NULL).
> client_id: nullable FK -> clients.id (on delete set null). The requesting client.
> source: 'client' | 'internal' (app-enforced, no CHECK).
> funnel_stage: new -> in_review -> accepted | rejected -> assigned -> pending_verification -> completed
> (app-enforced, no CHECK). Deliberately separate from any operational status.
> pending_verification (2026-08-11): set automatically when the assigned employee marks
> their assignment done (see trigger below); supervisor then verifies to reach 'completed'.
> submitted_by / reviewed_by: uuid, no hard FK (mirrors work_orders.submitted_by).
> Indexes: task_work_orders_org_stage_idx (org_id, funnel_stage),
> task_work_orders_property_idx (property_id).
> RLS mirrors work_orders: "task_work_orders select" = org_id = current_org_id();
> "task_work_orders manage" (ALL) = org_id = current_org_id() AND
> current_user_role() IN ('admin','manager').
> Plan B assign link: assignments.task_work_order_id -> task_work_orders.id.

---

## DB function: assign_task_work_order(p_work_order_id uuid, p_employee_id uuid, p_date date) -> task_work_orders
> migration assign_task_work_order_rpc (2026-08-11). SECURITY INVOKER. Atomically
> assigns a task work order to an employee (Plan B): inserts an assignments row
> (status 'planned', task_work_order_id set; org_id/property_id/title copied from
> the WO) AND sets the WO funnel_stage='assigned', in one transaction. Guards: the
> WO must exist in the caller's org, have a non-null property_id, and be in
> funnel_stage 'accepted' — raises otherwise, which also prevents double-assign.
> Returns the updated task_work_orders row (single composite, not a set). Call via
> `.rpc('assign_task_work_order', { p_work_order_id, p_employee_id, p_date })`.
> RLS enforced as the caller: assignments 'manage' + task_work_orders 'manage'.

---

## DB trigger: trg_task_work_order_completion (on assignments)
> migration task_work_order_completion_trigger (2026-08-11). AFTER UPDATE OF status on
> assignments. Function sync_task_work_order_on_assignment_complete() — SECURITY DEFINER
> (so an employee's own-assignment update can cascade to task_work_orders, which employees
> cannot write via RLS). When an assignment with a non-null task_work_order_id changes
> status to 'done'/'completed', advances the linked work order funnel_stage from 'assigned'
> to 'pending_verification' (only from 'assigned', so re-saves are no-ops). Closes the funnel
> loop: employee completes -> WO awaits supervisor verification.

---

## DB function: return_task_work_order_for_rework(p_work_order_id uuid, p_punch_list text) -> task_work_orders
> migration task_work_order_return_for_rework (2026-08-11). SECURITY INVOKER. The
> completion-verify gate's rework path: when a supervisor reviews a pending_verification
> WO and it needs corrections, this atomically (1) reopens the linked assignment(s)
> (status 'done'/'completed' -> 'in_progress', completed_at=null, notes = the punch-list
> text so the crew see it in the field view), and (2) moves the WO funnel_stage
> 'pending_verification' -> 'assigned' and stores punch_list. Guards: WO must exist in the
> caller's org and be in 'pending_verification'. (task_work_orders.punch_list is a simple
> free-text corrections list.) Call via
> .rpc('return_task_work_order_for_rework', { p_work_order_id, p_punch_list }).

---

## DB functions: client work order submission (P4, public/anon)
> migration client_work_order_submission_rpcs (2026-08-11). Two SECURITY DEFINER functions for
> the public client request portal at /view/request/[token] (anon, no auth — same pattern as
> get_shared_estimate). Callable by the anon role BY DESIGN (accepted SECDEF baseline, like the
> shared estimate/invoice RPCs).
> - get_client_request_context(p_token uuid) -> jsonb { business_name (organizations.name),
>   client_name }. Validates p_token against clients.client_token WHERE active=true. Returns null
>   for an invalid/inactive token.
> - submit_client_work_order(p_token uuid, p_title text, p_description text) -> jsonb
>   { ok:true, id } | { ok:false, error:'invalid_link'|'title_required' }. Validates the token ->
>   active client, then inserts a task_work_orders row with org_id/client_id DERIVED from the token,
>   source='client', funnel_stage='new', priority='medium', property_id null (supervisor sets
>   priority/property/assignee during review). title capped at 200 chars. Everything sensitive is
>   server-derived — the client cannot set org/client/source. clients.client_token is NOT NULL
>   DEFAULT gen_random_uuid(), so every client already has a shareable request link.

---

## DB function: generate_due_equipment_work_orders() -> integer
> migration equipment_due_task_work_order_bridge (2026-08-11). SECURITY INVOKER. The equipment-due
> → task-funnel bridge. Scans equipment_units in the caller's org where maintenance_interval_hours > 0
> and (estimated_hours - hours_at_last_service) >= maintenance_interval_hours (same "due by usage
> hours" rule as EquipmentMaintenanceBadge), and for each due unit with NO open task_work_order
> (equipment_unit_id link, funnel_stage not in completed/rejected = dedup), inserts a task_work_order:
> source='equipment', funnel_stage='new', equipment_unit_id set, property_id copied from the unit,
> auto title "Service due — {name}". Returns the count created. Called MANUALLY (supervisor button) —
> no scheduler yet. Caveat: "due by hours" depends on equipment_units.estimated_hours being kept
> current (manual today; could be auto-accrued from assignments.actual_hours per equipment — backlog).

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
| column         | type        | nullable | default        |
|----------------|-------------|----------|----------------|
| id             | uuid        | NO       | gen_random_uuid() |
| org_id         | uuid        | NO       |                |
| property_id    | uuid        | YES      |                |
| employee_id    | uuid        | YES      |                |
| status         | text        | NO       | 'draft'        |
| subtotal       | numeric     | NO       | 0              |
| tax_rate       | numeric     | NO       | 0              |
| total          | numeric     | NO       | 0              |
| notes          | text        | YES      |                |
| created_at     | timestamptz | NO       | now()          |
| sent_at        | timestamptz | YES      |                |
| paid_at        | timestamptz | YES      |                |
| client_id      | uuid        | YES      |                |
| invoice_number | integer     | NO       | nextval(seq)   |
| contract_id    | uuid        | YES      |                |
| period_start   | date        | YES      |                |
| period_end     | date        | YES      |                |
| share_token    | uuid        | NO       | gen_random_uuid() |

> status CHECK: ('draft','sent','paid','void')
> share_token (Phase D-2): unguessable UNIQUE token for the public hosted invoice
> view. Read ONLY through get_shared_invoice(token); never expose the table to anon.

> Revenue Chain Phase 1 (migration revenue_phase1_invoice_client_link, 2026-07-23):
> - client_id: nullable FK -> clients.id. The client who pays. App layer requires
>   it on create; nullable only because there was nothing to backfill.
> - invoice_number: global serial (unique constraint invoices_invoice_number_key),
>   matching the work_orders.wo_number precedent. Not per-org sequential (O-5).
> - line_items (jsonb) was DROPPED — superseded by the normalized invoice_line_items
>   table arriving in Phase 2. Do not reference invoices.line_items; it no longer exists.
> RLS unchanged: org_isolation (ALL). Index invoices_client_id_idx on client_id.

> Revenue Chain Phase 3 note (2026-07-24): invoices.status/paid_at are now DERIVED
> from the payments table in the app layer — an invoice is fully paid when
> SUM(payments.amount) >= invoices.total. The columns still exist and are settable,
> but payment state is computed from payments, not hand-set.

> Revenue Chain Phase 4 (migration revenue_phase4_service_contracts, 2026-07-24):
> contract_id / period_start / period_end link an invoice to the service contract
> and billing period that generated it. UNIQUE partial index
> invoices_contract_period_key on (contract_id, period_start) WHERE contract_id IS
> NOT NULL — the idempotency guard that stops a generation re-run double-billing a
> period. All three are NULL for hand-created invoices.

---

## service_contracts
| column      | type        | nullable | default           |
|-------------|-------------|----------|-------------------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |                   |
| client_id   | uuid        | NO       |                   |
| property_id | uuid        | YES      |                   |
| name        | text        | NO       |                   |
| status      | text        | NO       | 'active'          |
| frequency   | text        | NO       |                   |
| start_date  | date        | NO       |                   |
| end_date    | date        | YES      |                   |
| pause_from  | date        | YES      |                   |
| pause_until | date        | YES      |                   |
| tax_rate    | numeric     | NO       | 0                 |
| notes       | text        | YES      |                   |
| created_at  | timestamptz | NO       | now()             |

> Recurring billing plan (decision D-E). status CHECK ('active','paused','ended');
> frequency CHECK ('weekly','biweekly','monthly','quarterly','seasonal').
> FKs: client_id -> clients.id (required), property_id -> properties.id (optional).
> tax_rate is a percentage (e.g. 10 = 10%), same convention as estimates/invoices.
> RLS: org_isolation (ALL).

---

## service_contract_line_items
| column      | type        | nullable | default           |
|-------------|-------------|----------|-------------------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |                   |
| contract_id | uuid        | NO       |                   |
| catalog_id  | uuid        | YES      |                   |
| description | text        | NO       |                   |
| quantity    | numeric     | NO       | 1                 |
| unit_price  | numeric     | NO       | 0                 |
| line_total  | numeric     | NO       | 0                 |
| sort_order  | integer     | NO       | 0                 |
| created_at  | timestamptz | NO       | now()             |

> Template line items each generated invoice is built from. Same shape as
> invoice_line_items / estimate_line_items so generation is a straight copy.
> FK: contract_id -> service_contracts.id (ON DELETE CASCADE),
> catalog_id -> service_catalog.id. RLS: org_isolation (ALL).

---

## contract_invoice_runs
| column              | type        | nullable | default           |
|---------------------|-------------|----------|-------------------|
| id                  | uuid        | NO       | gen_random_uuid() |
| org_id              | uuid        | NO       |                   |
| run_at              | timestamptz | NO       | now()             |
| as_of               | date        | NO       |                   |
| triggered_by        | uuid        | YES      |                   |
| contracts_processed | integer     | NO       | 0                 |
| invoices_created    | integer     | NO       | 0                 |
| error               | text        | YES      |                   |

> Audit log of contract-invoice generation runs — one row per generation attempt,
> because unattended (scheduled) billing needs a paper trail. triggered_by ->
> employees.id (NULL for a future scheduled/headless run). RLS: org_isolation (ALL).

---

## DB function: generate_contract_invoices(as_of date default current_date) -> integer

SECURITY DEFINER, search_path pinned to public. EXECUTE granted to `authenticated`
only — revoked from `anon` and PUBLIC. Returns the number of invoices created.

The MANUAL "generate now" path. For each active service_contract in the caller's
org whose start_date <= as_of, computes the current billing period (anchored to
start_date, stepped by frequency), skips ended contracts and periods inside a
pause window, and — if no invoice already exists for that (contract_id,
period_start) — inserts a draft invoice stamped with the contract + period and
copies the template line items into invoice_line_items. Writes one
contract_invoice_runs row per call. Idempotent: a re-run for the same period is a
no-op (existence check + the UNIQUE partial index).

Guards: caller must have an active app_users row (org resolved from it, never from
the client) and role admin or manager, else raises 'Not authorized.'

> NOT YET SCHEDULED. Per plan decision O-3 the automatic pg_cron / Edge Function
> schedule is enabled by the owner ONLY after this manual path is proven against
> real contracts. Until then, generation happens only when an admin triggers it.
> A scheduled/headless variant would run without auth.uid() and must be a separate
> function EXECUTEd by the cron role, not this one.

---

## payments
| column      | type        | nullable | default           |
|-------------|-------------|----------|-------------------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |                   |
| invoice_id  | uuid        | NO       |                   |
| amount      | numeric     | NO       |                   |
| method      | text        | NO       |                   |
| reference   | text        | YES      |                   |
| paid_at     | timestamptz | NO       | now()             |
| recorded_by | uuid        | YES      |                   |
| notes       | text        | YES      |                   |
| created_at  | timestamptz | NO       | now()             |

> Manual payment recording (migration revenue_phase3_payments_and_job_link,
> 2026-07-24, decision D-A). NO payment processor and NO card data — `method` is a
> label only: CHECK ('cash','check','card','ach','other'). A separate table rather
> than columns on invoices so an invoice can carry PARTIAL and MULTIPLE payments;
> invoice paid-state is derived from SUM(amount) vs invoices.total.
> FKs: invoice_id -> invoices.id (ON DELETE CASCADE), recorded_by -> employees.id.
> RLS: org_isolation (ALL), matching the parent invoices table. Indexes on
> org_id and invoice_id.
> Do NOT store PAN / card numbers / processor tokens here.

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

> RLS: `org_isolation` (ALL) only — scopes every row to the caller's org via
> app_users. This is the sole policy on the table.
>
> The former `public_token_read` policy (FOR SELECT USING (true)) was DROPPED
> 2026-07-23 (migration drop_clients_public_token_read_policy). Because RLS
> policies are OR'd, `USING (true)` fully negated org_isolation and made every
> clients row — name, email, phone, address, notes — readable by any holder of
> the anon key across every org. The table had 0 rows, so nothing was exposed.
> Its only consumer, ClientPortalPage.tsx, was unrouted dead code and was
> deleted in the same change.
>
> client_token is retained on the table for a future public portal. If that is
> built, it MUST read through a SECURITY DEFINER RPC that takes the token and
> returns a single row — never a blanket read policy. RLS has no clean way to
> compare against a caller-supplied value.

---

## service_catalog
| column             | type        | nullable | default           |
|--------------------|-------------|----------|-------------------|
| id                 | uuid        | NO       | gen_random_uuid() |
| org_id             | uuid        | NO       |                   |
| name               | text        | NO       |                   |
| description        | text        | YES      |                   |
| default_unit_price | numeric     | NO       | 0                 |
| active             | boolean     | NO       | true              |
| created_at         | timestamptz | NO       | now()             |

> Reusable priced items that estimate/invoice line items draw from (decision O-1).
> Minimal shape — no categories, units, or tax classes in v1.
> RLS: org_isolation (ALL).

---

## estimates
| column               | type        | nullable | default           |
|----------------------|-------------|----------|-------------------|
| id                   | uuid        | NO       | gen_random_uuid() |
| org_id               | uuid        | NO       |                   |
| client_id            | uuid        | NO       |                   |
| property_id          | uuid        | YES      |                   |
| estimate_number      | integer     | NO       | nextval(seq)      |
| status               | text        | NO       | 'draft'           |
| subtotal             | numeric     | NO       | 0                 |
| tax_rate             | numeric     | NO       | 0                 |
| total                | numeric     | NO       | 0                 |
| notes                | text        | YES      |                   |
| valid_until          | date        | YES      |                   |
| converted_invoice_id | uuid        | YES      |                   |
| created_at           | timestamptz | NO       | now()             |
| sent_at              | timestamptz | YES      |                   |
| accepted_at          | timestamptz | YES      |                   |
| share_token          | uuid        | NO       | gen_random_uuid() |
| accepted_by_name     | text        | YES      |                   |

> status CHECK: ('draft','sent','accepted','declined','expired')
> estimate_number: global serial, UNIQUE (matches invoices/work_orders precedent).
> converted_invoice_id: set when the estimate is accepted and becomes an invoice.
> Non-null = already converted; the conversion function refuses to convert twice.
> FKs: client_id -> clients.id (required), property_id -> properties.id (optional).
> share_token (Phase D-2): unguessable UNIQUE token for the public hosted view.
> Read ONLY through get_shared_estimate(token); never expose the table to anon.
> accepted_by_name: who accepted via the public link (set by accept_shared_estimate).
> RLS: org_isolation (ALL). No public/anon policy — the RPCs are the public path.

---

## estimate_line_items
| column      | type        | nullable | default           |
|-------------|-------------|----------|-------------------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |                   |
| estimate_id | uuid        | NO       |                   |
| catalog_id  | uuid        | YES      |                   |
| description | text        | NO       |                   |
| quantity    | numeric     | NO       | 1                 |
| unit_price  | numeric     | NO       | 0                 |
| line_total  | numeric     | NO       | 0                 |
| sort_order  | integer     | NO       | 0                 |
| created_at  | timestamptz | NO       | now()             |

> FK: estimate_id -> estimates.id (ON DELETE CASCADE), catalog_id -> service_catalog.id.
> org_id is carried here so org_isolation needs no join (same denormalization
> rationale as project_timeline_events.property_id).
> line_total is app-computed (quantity * unit_price), not generated.
> RLS: org_isolation (ALL).

---

## invoice_line_items
| column      | type        | nullable | default           |
|-------------|-------------|----------|-------------------|
| id          | uuid        | NO       | gen_random_uuid() |
| org_id      | uuid        | NO       |                   |
| invoice_id  | uuid        | NO       |                   |
| catalog_id  | uuid        | YES      |                   |
| description | text        | NO       |                   |
| quantity    | numeric     | NO       | 1                 |
| unit_price  | numeric     | NO       | 0                 |
| line_total  | numeric     | NO       | 0                 |
| sort_order  | integer     | NO       | 0                 |
| created_at  | timestamptz | NO       | now()             |

> FK: invoice_id -> invoices.id (ON DELETE CASCADE), catalog_id -> service_catalog.id.
> Replaces the dropped invoices.line_items jsonb column. Same shape as
> estimate_line_items so conversion is a straight copy.
> RLS: org_isolation (ALL).

---

## DB function: convert_estimate_to_invoice(target_estimate_id uuid) -> uuid

SECURITY DEFINER, search_path pinned to public. EXECUTE granted to `authenticated`
only — explicitly revoked from `anon` and PUBLIC.

Performs the whole estimate -> invoice conversion in ONE transaction: inserts the
invoice from the estimate header, copies every estimate_line_items row into
invoice_line_items preserving sort order, then marks the estimate accepted and
stamps converted_invoice_id. Returns the new invoice id.

WHY IT EXISTS: PostgREST has no client-side multi-statement transaction, so doing
this from the browser could strand a half-built invoice if the sequence failed
partway (plan risk R-1). Call it from the app via `.rpc('convert_estimate_to_invoice',
{ target_estimate_id })` — never reimplement the steps client-side.

Guards, all raising an exception: caller must have an active app_users row
(org resolved from it, never trusted from the client), caller role must be admin or
manager, the estimate must belong to the caller's org, must not already be converted
(converted_invoice_id IS NULL), and must not be declined/expired. The estimate row is
locked FOR UPDATE during conversion.

---

## Known DB-wide issue: auth_rls_initplan (81 findings, NOT yet addressed)

The Supabase performance advisor flags 81 policies across the schema — including
every `org_isolation` policy and the pre-existing `app_users`, `clients` and
`invoices` policies — for re-evaluating `auth.uid()` per row instead of once per
query. The recommended fix is wrapping the call as `(select auth.uid())`.

This is a performance-at-scale issue, **not** a security hole: the policies are
correct, just not optimally planned. It was deliberately NOT fixed on the Phase 2
tables alone, because those policies intentionally copy the existing live
precedent — fixing only the new four would leave the schema inconsistent while
solving very little (all revenue tables are currently empty).

If addressed, do it as one deliberate DB-wide pass over every policy, not
piecemeal. Same applies to the `multiple_permissive_policies` (225) and
`unused_index` (48, expected while tables are empty) findings.

---

## DB functions: hosted sharing (Phase D-2, 2026-07-27)

The public customer-facing pages read/act ONLY through these token-keyed
SECURITY DEFINER functions — there is deliberately NO anon read policy on
estimates/invoices (the cc3fd91 lesson). EXECUTE granted to `anon` (the
unauthenticated web role) AND `authenticated`; revoked from PUBLIC. search_path
pinned. Each is keyed by an unguessable share_token; a non-matching token returns
NULL / raises, and there is no enumeration (122-bit uuid).

- **get_shared_estimate(p_token uuid) -> jsonb** — returns one estimate's public
  fields (business name, number, dates, totals, notes, client name, line items,
  and whether it converted + the resulting invoice's token) or NULL. STABLE.
- **get_shared_invoice(p_token uuid) -> jsonb** — one invoice's public fields
  including amount_paid (SUM of payments). No online-pay data — payments are
  manual (Phase A). STABLE.
- **accept_shared_estimate(p_token uuid, p_signer text default null) -> jsonb** —
  a customer accepts from the public link: converts the estimate to an invoice in
  one transaction (same shape as convert_estimate_to_invoice but token-gated, not
  auth-gated), records accepted_by_name, returns the new invoice's share_token.
  Idempotent: a second accept returns {already_accepted, invoice_token} without
  re-converting. Refuses declined/expired.

Validated as the anon role (rolled back): valid token returns data, bad token
returns NULL, a DIRECT select on estimates as anon returns 0 rows (RLS blocks it,
so the RPC is the only path), accept converts + returns the invoice token, a
second accept is idempotent.

The app calls these via the ANON supabase client from the public /view routes
(no auth). Internal pages only surface the share link.

---

## signatures
| column         | type        | nullable | default           |
|----------------|-------------|----------|-------------------|
| id             | uuid        | NO       | gen_random_uuid() |
| org_id         | uuid        | NO       |                   |
| property_id    | uuid        | NO       |                   |
| assignment_id  | uuid        | NO       |                   |
| signer_name    | text        | NO       |                   |
| signature_data | text        | NO       |                   |
| signed_at      | timestamptz | NO       | now()             |
| captured_by    | uuid        | YES      |                   |
| created_at     | timestamptz | NO       | now()             |

> On-site customer sign-off (Phase C-2, migration phase_c_signatures 2026-07-26),
> attached to an ASSIGNMENT — the unit of scheduled crew work — as proof of
> completion / billable evidence. FKs: assignment_id -> assignments.id CASCADE,
> property_id -> properties.id, captured_by -> employees.id.
> signature_data holds the signature image as a base64 data URL (a signature PNG
> is a few KB) — kept in-row rather than a second storage bucket. Could move to
> storage later if volume warrants.
>
> RLS: SELECT can_read_property(property_id); INSERT can_read_property AND an
> active app_users row in the org (crews capture in the field, same reach as field
> photos); DELETE can_manage_property (manager-only, to remove a mistaken
> capture). There is deliberately **NO UPDATE policy** — signatures are immutable
> evidence; an UPDATE matches zero rows (validated).

---

## Table count: 53
## Last synced from: Supabase project fjqeekwisnbpxgebrnpl
Phase C migrations applied 2026-07-25/26:
- phase_c_field_photo_capture — project_photos.timeline_event_id nullable; INSERT relaxed to any active member who can_read_property; storage INSERT org-scoped, DELETE manager-or-owner
- phase_c_signatures — new signatures table (immutable, attaches to an assignment)
Revenue chain migrations applied 2026-07-23:
- revenue_phase1_invoice_client_link — invoices.client_id + invoice_number, dropped invoices.line_items
- revenue_phase2_estimates_line_items_catalog — new service_catalog, estimates, estimate_line_items, invoice_line_items
- revenue_phase2_convert_estimate_to_invoice_fn — the transactional conversion function above
- revenue_phase2_add_missing_fk_indexes — covering indexes for estimate_line_items.catalog_id, invoice_line_items.catalog_id, estimates.converted_invoice_id (advisor: unindexed_foreign_keys)
Earlier: enable_postgis, properties_boundary_geojson, properties_boundary_generated, properties_calculated_acreage, projects_and_timeline_tables, drop_clients_public_token_read_policy, drop_legacy_department_and_group_options, pin_search_path_on_property_helpers
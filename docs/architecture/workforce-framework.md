# Workforce Framework Architecture

## Purpose
Ground Crew HQ now treats Settings as the operational source-of-truth for workforce structure and propagates that structure into execution pages.

## Source-of-Truth Hierarchy
1. Supabase tables (`departments`, `employee_groups`, `workforce_roles`, `worker_types`, `employment_statuses`, `job_descriptions`, `wage_categories`, `overtime_rules`, `language_options`, `shift_templates`, `work_locations`)
2. Workforce framework service layer: [workforce-framework.ts](/C:/Users/basil/OneDrive/Documents/New%20project/src/lib/workforce-framework.ts)
3. Page consumers (Settings, Employees, Scheduler/Workboard extensions)

## Framework Propagation
- Settings writes scoped records by `org_id`.
- Employees consumes framework options from the shared service layer.
- Role, department, group, worker type, language, location, and shift template selectors now resolve from the same normalized option source.
- Cache invalidation is centralized through `useInvalidateWorkforceFramework`.

## Role Semantics
Two separate role concepts are enforced:

1. Workforce Role (job title)
- Source: `workforce_roles`
- Used by: Employees, Scheduler, Workboard, Reports
- Examples: Field Manager, Equipment Operator, Irrigation Tech

2. Access Role (permission scope)
- Source: portal access controls (`app_users.role`)
- Used by: permissions/visibility/admin actions
- Examples: Platform Admin, Supervisor, Standard User, Read Only

Platform-level access roles are not treated as workforce job titles unless explicitly created inside `workforce_roles`.

## Operational Intelligence Structure
Groundwork logic lives in [operational-intelligence.ts](/C:/Users/basil/OneDrive/Documents/New%20project/src/lib/operational-intelligence.ts):
- workforce readiness scoring
- schedule coverage scoring
- labor allocation summary
- property staffing summary
- weather operational flags

This layer is deterministic and non-generative. It prepares structured signals for future recommendations.

## React Query Architecture
Shared query keys and fetch paths are centralized in `workforce-framework.ts`:
- single normalized fetch entrypoint (`useWorkforceFramework`)
- active/inactive filtering helpers
- name/id mapping utilities
- grouped refetch/invalidation

## Org-Scoped Behavior
- All framework reads are scoped by `org_id`.
- All framework writes in Settings preserve `org_id`.
- Consumers default to safe empty states when a framework table has no rows.

## Current Coverage
- Settings (Program Setup Hub): framework reads/writes through centralized layer
- Employees: framework-backed dropdowns and save payload mappings

## Next Expansion Targets
- Scheduler: consume shift templates + workforce roles directly from framework layer
- Workboard: consume groups/roles/work locations from framework layer only
- Reports: consume workforce dimensions from framework layer for filtering consistency

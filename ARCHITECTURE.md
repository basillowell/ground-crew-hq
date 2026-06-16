# Ground Crew HQ - Application Architecture
**Last updated:** June 16, 2026
**Version:** v2.5.32.2
**Purpose:** Authoritative reference for frontend layers, route inventory, data store, database schema domains, and structural notes.

---

## Stack Overview

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Drag-drop | @dnd-kit/core + @dnd-kit/sortable |
| Charts | Recharts |
| State | Zustand (`useAppStore`) |
| Backend | Supabase (PostgreSQL + RLS + Realtime) |
| Hosting | Vercel edge deployment |
| Auth | Supabase Auth (localStorage session persistence) |
| Weather | NWS (api.weather.gov) - US only, free, commercially legal |

---

## Frontend Layer

### Routing
- React Router v6.
- All page routes are lazy-loaded from `src/App.tsx`.
- Protected app routes are wrapped by `ProtectedRoute`.
- `ProtectedRoute` must use `useRef(hasEverAuthed)` so tab switches and background refetches do not flash the loading state after the first authenticated render.
- Landing page (`/`) is always public.

### Page Inventory
Verified against `src/App.tsx` on June 16, 2026.

| Route | Page | Auth | Lazy? |
|---|---|---|---|
| `/` | LaunchPortalPage | Public | Yes |
| `/pricing` | PricingPage | Public | Yes |
| `/auth/reset` | ResetPasswordPage | Public | Yes |
| `/portal/:clientToken` | ClientPortalPage | Public | Yes |
| `/app` | Redirects to `/app/dashboard` | Protected | N/A |
| `/app/dashboard` | CommandCenterOperationalPage | Protected | Yes |
| `/app/dispatch` | DispatchBoardPage | Protected | Yes |
| `/app/workboard` | WorkboardShell + WorkboardContent | Protected | Yes |
| `/app/scheduler` | SchedulerPage | Protected | Yes |
| `/app/field` | MobileFieldWorkspacePage | Protected | Yes |
| `/app/employees` | EmployeesPage | Protected | Yes |
| `/app/equipment` | EquipmentPage | Protected | Yes |
| `/app/invoicing` | InvoicingPage | Protected | Yes |
| `/app/reports` | ReportsPage | Protected | Yes |
| `/app/job-costing` | JobCostingPage | Protected | Yes |
| `/app/weather` | WeatherPage | Protected | Yes |
| `/app/applications` | ApplicationsPage | Protected | Yes |
| `/app/breakroom` | BreakroomPage (Realtime) | Protected | Yes |
| `/app/messaging` | MessagingPage | Protected | Yes |
| `/app/tasks` | TasksCatalogPage | Protected | Yes |
| `/app/safety` | SafetyPage | Protected | Yes |
| `/app/settings` | SettingsPage | Protected | Yes |
| `*` | NotFound | Public fallback | Yes |

### Navigation Architecture
Three-tier sidebar (supervisor/admin):
- Tier 1 - Primary Operations: Command Center, Dispatch, Workflow
- Tier 2 - Management: Team, Equipment, Invoicing, Reports, Job Costing
- Tier 3 - Settings/Compliance (footer): Chemical Logs, Safety, Settings, Help

Mobile bottom nav (employee role only - 5 tabs):
- Today, My Jobs, Clock In/Out, Messages, Profile
- Clock tab accent color `#a3e635` when clocked in

### Design Token System
Defined in `tailwind.config.ts`.

| Token | Purpose |
|---|---|
| `surface.*` | Base, card, elevated, border, and hover surfaces |
| `brand.*` | Primary lime brand actions and accents |
| `text.*` | Primary, secondary, muted, and inverse text |
| `status.*` | Active, pending, warning, complete, and hold states |

---

## Zustand Global Store (`useAppStore`)

**Location:** `src/store/appStore.ts`

**Pattern:** Reference data is fetched once on auth and shared across app pages.

### State Shape
```typescript
interface AppStore {
  employees: Employee[]
  properties: Property[]
  departments: Department[]
  org: Organization | null
  programSettings: ProgramSettings | null
  isHydrated: boolean
  hydrate: (orgId: string) => Promise<void>
  reset: () => void
}
```

### Hydration Flow
```text
auth/token
  -> app_users resolves org_id
  -> hydrate(orgId) with parallel reference-data queries
  -> isHydrated = true
  -> ProtectedRoute renders page
  -> pages read shared reference data from the store
```

### Rule
Page-level fetches for reference-data-dependent views usually wait for `isHydrated`:
```typescript
const { isHydrated } = useAppStore()
useEffect(() => {
  if (!isHydrated) return
  // fetch page-level data
}, [isHydrated, ...deps])
```

Exception: `useTasks()` must use `orgId` directly and must not be gated by `isOrgReady`; tasks are org-wide and load by organization.

---

## Database Layer

**Supabase project:** `fjqeekwisnbpxgebrnpl`
**RLS:** Enabled on all production tables
**Schema doc:** `docs/dev/live-db-state.md` is authoritative for column names

### Query Rules
- All queries must include `.eq('org_id', orgId)` on tables with `org_id`.
- Confirm DB-bound strings against `docs/dev/live-db-state.md` before writing a query.
- Do not rename tables or columns in app code.
- Codex never creates executable SQL or migrations.
- If a schema or policy change is required, stop and report `DB_CHANGE_REQUIRED`.

### Domain Map

#### Identity
| Table | Purpose |
|---|---|
| `app_users` | Auth bridge linking Supabase auth to org |
| `organizations` | Org record, plan, subscription status |
| `program_settings` | Branding, module, and weather defaults |

#### Workforce
| Table | Purpose |
|---|---|
| `employees` | Core crew roster |
| `departments` | Org department structure |
| `workforce_roles` | Role definitions |
| `worker_types` | Employment type categories |
| `employee_groups` | Crew groupings |
| `clock_events` | GPS clock in/out/break events |
| `employment_statuses` | Status definitions |
| `job_descriptions` | Role descriptions |
| `wage_categories` | Pay rate categories |
| `overtime_rules` | OT policy rules |

#### Operations
| Table | Purpose |
|---|---|
| `assignments` | Core job assignments linking employees, tasks, properties, and dates |
| `schedule_entries` | Shift schedule records |
| `tasks` | Org-wide reusable task library; `tasks.property_id` is nullable and must not be used to filter `useTasks()` |
| `task_requests` | Ad-hoc job requests |
| `recurring_task_rules` | Recurring job automation |
| `work_orders` | Equipment work orders |
| `notes` | Property/operational notes |
| `sops` | Standard operating procedures |
| `sop_checklist_items` | SOP checklist steps |
| `sop_completions` | SOP completion records |

#### Equipment
| Table | Purpose |
|---|---|
| `equipment_units` | Individual equipment records |
| `equipment_types` | Equipment categories |

#### Compliance
| Table | Purpose |
|---|---|
| `chemical_application_logs` | EPA-ready spray records; `id` is text |
| `chemical_products` | Product library; `id` is text |
| `chemical_application_tank_mix_items` | Tank mix line items with camelCase DB columns |
| `chemical_settings` | Org chemical compliance settings |
| `beta_feedback` | In-app feedback submissions |

#### Finance
| Table | Purpose |
|---|---|
| `invoices` | Invoice records |
| `clients` | Client records with public portal token |

#### Comms
| Table | Purpose |
|---|---|
| `messages` | Team messaging with Realtime publication |

#### Weather
| Table | Purpose |
|---|---|
| `weather_locations` | NWS location configs; `id` is text |
| `weather_daily_logs` | Daily weather records |
| `weather_display_prefs` | Per-user widget preferences |
| `weather_stations` | Station records with camelCase DB columns |
| `manual_rainfall_entries` | Manual rainfall overrides |

#### Config
| Table | Purpose |
|---|---|
| `properties` | Estate properties, also stored in `useAppStore` |
| `scheduler_settings` | Per-property scheduling config |
| `schedule_week_templates` | Saved week templates |
| `shift_templates` | Reusable shift definitions |
| `work_locations` | Named work locations |
| `application_areas` | Chemical application zones with camelCase DB column |

#### Lookup Tables
`department_options`, `group_options`, `property_class_options`

---

## Special Schema Notes

| Table | Issue | Action |
|---|---|---|
| `chemical_application_logs` | `id` is `text`, not `uuid` | Do not use `gen_random_uuid()` |
| `chemical_products` | `id` is `text`, not `uuid` | Do not use `gen_random_uuid()` |
| `weather_locations` | `id` is `text`, not `uuid` | Cast generated UUIDs to text only in approved SQL handled outside Codex |
| `chemical_application_tank_mix_items` | camelCase columns: `applicationLogId`, `productId`, `rateApplied`, `rateUnit`, `totalQuantityUsed`, `mixOrder` | Always double-quote in raw SQL |
| `weather_stations` | camelCase columns: `locationId`, `stationCode`, `isPrimary`, `providerType`, `timeZone` | Always double-quote in raw SQL |
| `application_areas` | camelCase column: `weatherLocationId` | Always double-quote in raw SQL |

---

## Known Stability Patterns
- ProtectedRoute uses `useRef(hasEverAuthed)` to prevent tab-switch loading flash.
- Auth visibility handlers must not call `supabase.auth.getSession()`; avoid auth lock contention on `visibilitychange`.
- `useTasks()` is org-scoped only and ignores property selection.
- Property inserts must have a submitting/loading guard to prevent duplicate rows.
- Properties lists must show all properties with no cap; target clients may have 50+ properties, especially HOA networks.

---

## Coding Rules
- Rule 9: Build gate is `npm run build`, not `tsc --noEmit` alone.
- Rule 10: All DB column names come from `docs/dev/live-db-state.md`, never memory.
- Rule 11: After any rename, grep for the old name and confirm zero remaining references.
- Rule 12: One concern per Codex pass.
- Rule 13: Every property insert needs duplicate-submit protection.
- All page-level data sections need loading, error/retry, and content states.
- No hardcoded hex values in JSX; use token classes.
- No new npm packages without checking existing dependencies first.

---

## Subscription Tier Map

| Tier | Price | Crew Limit | Key Features |
|---|---|---|---|
| Starter | $29/mo | <=10 | Scheduling, job tracking, field view, team messaging |
| Pro | $79/mo | <=30 | GPS clock in/out, recurring jobs, invoicing, job costing, client portal |
| Enterprise | $149+/mo | Custom | Route optimization, advanced BI, multi-location, API access |

Feature tier tags in code:
```typescript
// TIER: starter - always available
// TIER: pro - requires active subscription
// TIER: enterprise - custom contract only
```

---

## Infrastructure Identifiers

| Resource | Value |
|---|---|
| Repo | `github.com/basillowell/ground-crew-hq` |
| Local path | `C:\Projects\ground-crew-hq` |
| Production URL | `ground-crew-hq.vercel.app` |
| Supabase project | `fjqeekwisnbpxgebrnpl` |

---

*ARCHITECTURE.md is maintained alongside `CODERULES.md` and `docs/dev/live-db-state.md`. Update it after route, store, or structural changes.*

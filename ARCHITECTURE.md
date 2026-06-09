# Ground Crew HQ — Application Architecture
**Last updated:** June 9, 2026  
**Version:** v2.5.32.2  
**Purpose:** Authoritative reference for the full application architecture — frontend layers, data store, database schema domains, and structural notes.

---

## Stack Overview

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Drag-drop | @dnd-kit/core + @dnd-kit/sortable |
| Charts | Recharts |
| State | Zustand (useAppStore) |
| Backend | Supabase (PostgreSQL + RLS + Realtime) |
| Hosting | Vercel edge deployment |
| Auth | Supabase Auth (localStorage session persistence) |
| Weather | NWS (api.weather.gov) — US only, free, commercially legal |

---

## Frontend Layer

### Routing
- React Router v6
- All page routes are **lazy-loaded** — 48 JS chunks confirmed in production
- ProtectedRoute guard checks `isHydrated` before rendering any app page
- Landing page (`/`) is always visible — authenticated users see "Go to App →" CTA

### Page Inventory
| Route | Page | Lazy? |
|---|---|---|
| `/app/` | CommandCenterOperationalPage | ✓ |
| `/app/dispatch` | DispatchBoardPage | ✓ |
| `/app/scheduler` | SchedulerPage | ✓ |
| `/app/workboard` | WorkboardShell + WorkboardContent | ✓ |
| `/app/team` | EmployeesPage | ✓ |
| `/app/equipment` | EquipmentPage | ✓ |
| `/app/invoicing` | InvoicingPage | ✓ |
| `/app/reports` | ReportsPage | ✓ |
| `/app/job-costing` | JobCostingPage | ✓ |
| `/app/weather` | WeatherPage | ✓ |
| `/app/chemicals` | ChemicalsPage | ✓ |
| `/app/safety` | SafetyPage | ✓ |
| `/app/breakroom` | BreakroomPage (Realtime) | ✓ |
| `/app/field` | MobileFieldWorkspacePage | ✓ |
| `/app/settings` | SettingsPage | ✓ |
| `/app/applications` | ApplicationsPage | ✓ |
| `/portal/:clientToken` | ClientPortalPage (public) | ✓ |

### Navigation Architecture
Three-tier sidebar (supervisor/admin):
- **Tier 1 — Primary Operations:** Command Center, Dispatch, Workflow
- **Tier 2 — Management:** Team, Equipment, Invoicing, Reports, Job Costing
- **Tier 3 — Settings/Compliance (footer):** Chemical Logs, Safety, Settings, Help

Mobile bottom nav (employee role only — 5 tabs):
- Today · My Jobs · Clock In/Out · Messages · Profile
- Clock tab accent color `#a3e635` when clocked in

### Design Token System (tailwind.config.ts)
```
surface.base     #0a0f0c    — near-black base
surface.card     #141f18    — card backgrounds
surface.elevated #1c2d22    — modals, dropdowns
surface.border   #263d2d    — borders
surface.hover    #1f3027    — hover states

brand.DEFAULT    #84cc16    — lime-500 (primary)
brand.bright     #a3e635    — hero CTAs only
brand.dim        #4d7c0f    — secondary actions
brand.ghost      #1a2e10    — badge backgrounds

text.primary     #f0f4f0    — warm near-white
text.secondary   #8fa98f    — muted mid-grey-green
text.muted       #556b55    — placeholders
text.inverse     #0a0f0c    — text on lime

status.active    #22c55e    — in progress
status.pending   #f59e0b    — waiting/unassigned
status.warning   #ef4444    — overdue/alert
status.complete  #3b82f6    — completed
status.hold      #6b7280    — paused
```

---

## Zustand Global Store (useAppStore)

**Location:** `src/store/appStore.ts`  
**Pattern:** Fetched once on auth, shared across all pages, zero re-fetches per navigation.

### State Shape
```typescript
interface AppStore {
  employees: Employee[]        // 31 columns — from employees table
  properties: Property[]       // 14 columns — from properties table
  departments: Department[]    // 5 columns
  org: Organization | null     // id, name, plan, subscription_status
  programSettings: ProgramSettings | null  // 17 columns
  isHydrated: boolean
  hydrate: (orgId: string) => Promise<void>
  reset: () => void
}
```

### Hydration Flow
```
auth/token (6ms TTFB)
  → app_users (resolves org_id)
  → hydrate(orgId) — Promise.all of 5 parallel queries
  → isHydrated = true
  → ProtectedRoute renders page
  → pages read from store — zero Supabase calls for reference data
```

### Rule
All page-level `useEffect` fetches must include:
```typescript
const { isHydrated } = useAppStore()
useEffect(() => {
  if (!isHydrated) return
  // fetch page-level data
}, [isHydrated, ...deps])
```

---

## Database Layer

**Supabase project:** `fjqeekwisnbpxgebrnpl`  
**Total tables:** 47  
**RLS:** Enabled on all tables  
**Query rule:** All queries must include `.eq('org_id', 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807')`  
**Schema doc:** `docs/dev/live-db-state.md` — authoritative, updated with every migration

### Domain Map

#### Identity
| Table | Cols | Purpose |
|---|---|---|
| `app_users` | 7 | Auth bridge — links Supabase auth to org |
| `organizations` | 7 | Org record, plan, subscription status |
| `program_settings` | 17 | Branding, colors, weather defaults |

#### Workforce
| Table | Cols | Purpose |
|---|---|---|
| `employees` | 31 | Core crew roster |
| `departments` | 5 | Org department structure |
| `workforce_roles` | 6 | Role definitions |
| `worker_types` | 5 | Employment type categories |
| `employee_groups` | 5 | Crew groupings |
| `clock_events` | 8 | GPS clock in/out/break — event_type: 'clock_in'\|'clock_out'\|'break' |
| `employment_statuses` | 5 | Status definitions |
| `job_descriptions` | 6 | Role descriptions |
| `wage_categories` | 6 | Pay rate categories |
| `overtime_rules` | 6 | OT policy rules |

#### Operations
| Table | Cols | Purpose |
|---|---|---|
| `assignments` | 19 | Core job assignments — links employees, tasks, properties, dates |
| `schedule_entries` | 10 | Shift schedule records |
| `tasks` | 12 | Task library (reusable job types) |
| `task_requests` | 10 | Ad-hoc job requests |
| `recurring_task_rules` | 8 | Recurring job automation — days_of_week[], active |
| `work_orders` | 11 | Equipment work orders |
| `notes` | 9 | Property/operational notes |
| `sops` | 13 | Standard operating procedures |
| `sop_checklist_items` | 7 | SOP checklist steps |
| `sop_completions` | 8 | SOP completion records |

#### Equipment
| Table | Cols | Purpose |
|---|---|---|
| `equipment_units` | 13 | Individual equipment records |
| `equipment_types` | 8 | Equipment categories |

#### Compliance
| Table | Cols | Purpose |
|---|---|---|
| `chemical_application_logs` | 29 | EPA-ready spray records — ⚠️ id is text not uuid |
| `chemical_products` | 13 | Product library — ⚠️ id is text not uuid |
| `chemical_application_tank_mix_items` | 8 | Tank mix line items — ⚠️ camelCase columns |
| `chemical_settings` | 10 | Org chemical compliance settings |
| `beta_feedback` | 8 | In-app feedback submissions |

#### Finance (added June 9, 2026)
| Table | Cols | Purpose |
|---|---|---|
| `invoices` | 13 | Invoice records — status: draft\|sent\|paid\|void |
| `clients` | 10 | Client records with public portal token |

#### Comms (added June 9, 2026)
| Table | Cols | Purpose |
|---|---|---|
| `messages` | 6 | Team messaging — Realtime enabled via supabase_realtime publication |

#### Weather
| Table | Cols | Purpose |
|---|---|---|
| `weather_locations` | 12 | NWS location configs — ⚠️ id is text not uuid |
| `weather_daily_logs` | 14 | Daily weather records |
| `weather_display_prefs` | 7 | Per-user widget preferences |
| `weather_stations` | 11 | Station records — ⚠️ camelCase columns |
| `manual_rainfall_entries` | 6 | Manual rainfall overrides |

#### Config
| Table | Cols | Purpose |
|---|---|---|
| `properties` | 14 | Estate properties (also in store) |
| `scheduler_settings` | 16 | Per-property scheduling config |
| `schedule_week_templates` | 5 | Saved week templates |
| `shift_templates` | 9 | Reusable shift definitions |
| `work_locations` | 5 | Named work locations |
| `application_areas` | 5 | Chemical application zones — ⚠️ camelCase columns |

#### Lookup Tables
`department_options` · `group_options` · `property_class_options`

---

## ⚠️ Special Schema Notes

| Table | Issue | Action |
|---|---|---|
| `chemical_application_logs` | `id` is `text`, not `uuid` | Do not use `gen_random_uuid()` |
| `chemical_products` | `id` is `text`, not `uuid` | Do not use `gen_random_uuid()` |
| `weather_locations` | `id` is `text`, not `uuid` | Cast: `gen_random_uuid()::text` |
| `chemical_application_tank_mix_items` | camelCase columns: `applicationLogId`, `productId`, `rateApplied`, `rateUnit`, `totalQuantityUsed`, `mixOrder` | Always double-quote in raw SQL |
| `weather_stations` | camelCase columns: `locationId`, `stationCode`, `isPrimary`, `providerType`, `timeZone` | Always double-quote in raw SQL |
| `application_areas` | camelCase column: `weatherLocationId` | Always double-quote in raw SQL |

---

## Performance Baseline (as of June 9, 2026)

| Metric | Value | Target |
|---|---|---|
| LCP (cold load) | 645–824ms | <400ms |
| TTFB | 6ms | ✓ healthy |
| Supabase calls/session | 88–91 | <35 |
| Store leaks | 11 | 0 |
| Post-nav long tasks >50ms | 3–5 | 0 |
| JS chunks | 48 | ✓ healthy |
| Failed requests | 5 | 0 |

### Remaining Performance Work
1. Complete store Prompt 3 — eliminate 11 remaining reference table leaks
2. React.lazy() — CommandCenter + Scheduler + WorkboardShell still eager at startup
3. Equipment page CLS 0.24 — add min-height to async data containers
4. Disable Google Docs Offline Chrome extension before recording traces

---

## Coding Rules (enforced via CODERULES.md)

- **Rule 9:** Build gate is `npm run build` — not `tsc --noEmit` alone
- **Rule 10:** All column names from `docs/dev/live-db-state.md` — never from memory
- **Rule 11:** grep before editing any file, verify after rename
- **Rule 12:** One concern per Codex pass
- **Claude writes all migrations. Codex never touches the database.**
- All queries must include `.eq('org_id', orgId)`
- All page `useEffect` fetches must include `isHydrated` guard
- No hardcoded hex values in JSX — always use token classes
- No new npm packages without checking existing deps first

---

## Subscription Tier Map

| Tier | Price | Crew Limit | Key Features |
|---|---|---|---|
| Starter | $29/mo | ≤10 | Scheduling, job tracking, field view, team messaging |
| Pro | $79/mo | ≤30 | + GPS clock in/out, recurring jobs, invoicing, job costing, client portal |
| Enterprise | $149+/mo | Custom | + Route optimization, advanced BI, multi-location, API access |

Feature tier tags in code:
```typescript
// TIER: starter — always available
// TIER: pro — requires active subscription
// TIER: enterprise — custom contract only
```

---

## Infrastructure Identifiers

| Resource | Value |
|---|---|
| Repo | `github.com/basillowell/ground-crew-hq` |
| Local path | `C:\Projects\ground-crew-hq` |
| Production URL | `ground-crew-hq.vercel.app` |
| Vercel project | `prj_Y3NgqXZ0IgFj1JN9ViZWgitMRMNK` |
| Vercel team | `team_A9f00zq9pBiz6dFy1qn8hTW8` |
| Supabase project | `fjqeekwisnbpxgebrnpl` |
| Supabase org | `bb13da4a-d2de-4fc9-ad5a-bfd266e08807` |
| Default property | `b50b42cd-903e-4280-9373-1d9cae97b2b3` |

---

*ARCHITECTURE.md — maintained alongside CODEX6.9.26.md and live-db-state.md. Update after any significant structural change.*

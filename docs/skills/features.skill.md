# Features Skill - Ground Crew HQ

## Production Pages (App.tsx routes)
| Route | File | Purpose |
|---|---|---|
| /app/dashboard | CommandCenterOperationalPage | Daily ops summary, crew, quick actions |
| /app/dispatch | DispatchBoardPage | Real-time crew dispatch board |
| /app/workboard | WorkboardShell + WorkboardContent | Task dispatch, assignments, Gantt |
| /app/scheduler | SchedulerPage | Weekly shift planning by employee |
| /app/field | MobileFieldWorkspacePage | Crew clock in/out, tasks, offline |
| /app/employees | EmployeesPage | Crew roster, profiles, departments |
| /app/equipment | EquipmentPage | Fleet registry, work orders |
| /app/invoicing | InvoicingPage | Invoicing and billing |
| /app/reports | ReportsPage | Labor metrics, scheduled vs actual |
| /app/job-costing | JobCostingPage | Job cost tracking |
| /app/weather | WeatherPage | Live weather, stations, rainfall |
| /app/applications | ApplicationsPage | Chemical logs, tank mix, compliance |
| /app/breakroom | BreakroomPage | TV display board for crew areas |
| /app/messaging | MessagingPage | Internal messaging |
| /app/tasks | TasksCatalogPage | Org-wide task catalog and categories |
| /app/safety | SafetyPage | Incident logging, hazard reports |
| /app/settings | SettingsPage | Brand, modules, billing, users |

## Public Routes (no auth required)
| Route | File | Purpose |
|---|---|---|
| / | LaunchPortalPage | Landing page + auth dialog |
| /pricing | PricingPage | Subscription pricing |
| /auth/reset | ResetPasswordPage | Password reset |
| /portal/:clientToken | ClientPortalPage | Public client portal |
| * | NotFound | Fallback route |

## App Shell
- `AppLayout.tsx` wraps all `/app/*` routes.
- `AppSidebarRefined.tsx` handles navigation and branding from `useProgramSettings()`.
- `WorkflowTopBar.tsx` handles property switcher, date, notifications, and user display.
- `ProtectedRoute` must use `useRef(hasEverAuthed)` to prevent tab-switch loading flash.

## Core Data Flow
Program Setup -> Employees + Properties + Tasks + Shift Templates
-> Scheduler (shifts) -> Workboard (assignments) -> Field (clock events)
-> Reports (scheduled vs assigned vs actual hours)

## Key Business Rules
- Every data write is scoped by `org_id`; `property_id` is required only where the DB column is NOT NULL.
- `tasks.property_id` is nullable; tasks are org-wide and not tied to a property.
- `useTasks()` must use `orgId` directly, must never filter by `property_id`, and must not be gated behind `isOrgReady`.
- Property inserts must use a submitting/loading guard to prevent duplicate rows from double-clicks.
- Properties list must show ALL properties with no cap. Target clients may have 50+ properties (HOA networks).
- Admins and managers can write to all tables in their org.
- Field crew (employee role) can only read their own data.
- Property switcher in the top bar scopes property-specific page queries.
- Today's date is the default for all operational pages.

## What Each Page Owns
- Dashboard: reads schedule_entries + assignments + equipment_units (today).
- Workboard: reads + writes assignments; reads schedule_entries + tasks + employees.
- Scheduler: reads + writes schedule_entries; reads employees.
- Field: reads assignments + schedule_entries; writes clock_events.
- Reports: reads schedule_entries + assignments + clock_events + employees.
- Tasks: reads + writes org-wide tasks and categories.

## Known Working Patterns
- dataStore is DEAD; never import from `@/lib/dataStore`.
- All data comes from `supabase-queries.ts` hooks.
- Auth comes from `useAuth()`; never read auth from localStorage directly.
- Never call `supabase.auth.getSession()` inside `visibilitychange` handlers.
- Pending clock events use localStorage key `gcrew-pending-clocks`.

## Self-Service Onboarding Flow
New clients complete setup through the app without developer help:
1. Register - org created automatically in organizations table.
2. Dashboard shows onboarding checklist.
3. Weather setup via `/app/weather` onboarding flow.
4. Employees added via `/app/employees`.
5. Equipment added via `/app/equipment`.
6. Tasks added via `/app/tasks` or Settings task catalog surfaces.
7. Shifts scheduled via `/app/scheduler`.
8. Assignments built via `/app/workboard`.

## Weather Self-Service Pattern
`weather_locations` and `weather_stations` are always created
by the user through the weather onboarding flow.
Never hardcode lat/lng or insert weather rows in migrations.
The geocoding flow uses:
`https://geocoding-api.open-meteo.com/v1/search`

## Feature Flag Pattern
Enabled modules are stored in `program_settings.enabledModules[]`.
Check before rendering any module nav item:
```typescript
const isEnabled = programSetting?.enabledModules?.includes('weather')
```

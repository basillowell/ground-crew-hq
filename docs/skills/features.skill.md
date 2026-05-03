# Features Skill — Ground Crew HQ

## 14 Production Pages
| Route | File | Purpose |
|---|---|---|
| /app/dashboard | CommandCenterOperationalPage | Daily ops summary, crew, quick actions |
| /app/workboard | WorkboardPage | Task dispatch, assignments, Gantt |
| /app/scheduler | SchedulerPage | Weekly shift planning by employee |
| /app/field | MobileFieldWorkspacePage | Crew clock in/out, tasks, offline |
| /app/employees | EmployeesPage | Crew roster, profiles, departments |
| /app/equipment | EquipmentPage | Fleet registry, work orders |
| /app/reports | ReportsPage | Labor metrics, scheduled vs actual |
| /app/safety | SafetyPage | Incident logging, hazard reports |
| /app/weather | WeatherPage | Live weather, stations, rainfall |
| /app/applications | ApplicationsPage | Chemical logs, tank mix, compliance |
| /app/breakroom | BreakroomPage | TV display board for crew areas |
| /app/messaging | MessagingPage | Internal messaging |
| /app/tasks | TasksCatalogPage | Task library management |
| /app/settings | ProgramSetupHubPage | Brand, modules, billing, users |

## App Shell
- AppLayout.tsx — wraps all /app/* routes, loads Supabase data for shell
- AppSidebarRefined.tsx — navigation, branding from useProgramSettings()
- WorkflowTopBar.tsx — property switcher, date, notifications, user display

## Core Data Flow
Program Setup → Employees + Properties + Tasks + Shift Templates
→ Scheduler (shifts) → Workboard (assignments) → Field (clock events)
→ Reports (scheduled vs assigned vs actual hours)

## Key Business Rules
- Every data write scoped by org_id AND property_id
- Admins and managers can write to all tables in their org
- Field crew (employee role) can only read their own data
- Property switcher in top bar scopes all page queries
- Today's date is the default for all operational pages

## What Each Page Owns
- Dashboard: reads schedule_entries + assignments + equipment_units (today)
- Workboard: reads + writes assignments, reads schedule_entries + tasks + employees
- Scheduler: reads + writes schedule_entries, reads employees
- Field: reads assignments + schedule_entries, writes clock_events
- Reports: reads all four: schedule_entries + assignments + clock_events + employees

## Known Working Patterns
- dataStore is DEAD — never import from @/lib/dataStore
- All data from supabase-queries.ts hooks
- Auth from useAuth() — never from localStorage directly
- Pending clock events: localStorage key 'gcrew-pending-clocks'

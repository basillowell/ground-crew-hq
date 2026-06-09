# CODEX 6.9.26 — Ground Crew HQ: Full Rebuild Intelligence Brief
**Date:** June 9, 2026  
**Revised by:** Claude (schema audit pass)  
**Purpose:** Authoritative coding prompt document for Claude/Codex — color system, navigation, feature parity, and subscription value pivots. Every section contains actionable code-level directives.

> ⚠️ **SCHEMA NOTE:** All table and column names in this document have been verified against `docs/dev/live-db-state.md` and the live Supabase DB. Several table names in the original draft (`jobs`, `time_entries`, `clients`, `job_materials`, `messages`, `activity_log`, `recurring_job_templates`) **do not exist**. Corrected references are marked with `→ CORRECTED`.

---

## 1. SITUATION ASSESSMENT

### What's Working
- Supabase auth + RLS architecture is sound — do not touch
- `AppLayout.tsx` sidebar/topbar shell is structurally correct
- Role-based access (admin/manager/employee) is properly scaffolded
- `useAppStore` hydration pattern (`isHydrated` guard) is stabilized and tested
- 48 JS chunks with lazy loading confirmed working across all page routes
- Performance: 645ms cold LCP, 91 Supabase calls per session (target: <35)

### What's Broken or Underserving the Product
- **Color system** feels murky — current greens read as default, not intentional
- **Navigation** lacks hierarchy — all items feel equally weighted
- **Value proposition** anchored to weather API which (a) cannot legally drive subscription billing and (b) is free on every phone
- **No sticky revenue features** — nothing creates switching cost or daily habit loops
- **Mobile field view** is underbuilt — field workers are daily active users, not admins
- **Input text visibility** — recently fixed (e2c4430) but symptom of fragile CSS token system

### Competitor Benchmarks (June 2026)
| App | Pricing | Killer Feature | UX Rating |
|---|---|---|---|
| Jobber | $79–$189/mo | Recurring jobs, routing, client hub | 4.6/5 |
| Housecall Pro | $59–$299/mo | Drag-drop dispatch board, autopay | 4.5/5 |
| ServiceTitan | Custom | Advanced reporting, BI dashboard | 4.1/5 |
| LMN by Granum | Per-crew | Estimating + job costing | 4.3/5 |

**Target positioning:** Between Jobber and Housecall Pro — simpler than ServiceTitan, more operations-native than generic tools.

---

## 2. VALUE PROPOSITION PIVOT (CRITICAL)

### Drop "Weather-Aware" as the Hero Claim
Weather data is free on every phone. Cannot bill for it. Hero claim must shift to:

> **"The operations brain for your grounds crew — scheduling, dispatch, job tracking, and payroll in one place."**

### Replace Weather With Subscription-Justifying Features

| Feature | Why Customers Pay | Maps To Existing Schema |
|---|---|---|
| GPS-verified clock in/out | Eliminates buddy-punching | `clock_events` table EXISTS ✓ |
| Drag-drop dispatch board | Daily habit loop for supervisors | `assignments` + `schedule_entries` ✓ |
| Recurring job automation | Lawn care is recurring by nature | `recurring_task_rules` table EXISTS ✓ |
| Automated invoicing | #1 cited essential feature (72%) | Needs new `invoices` table |
| Job costing dashboard | Tells owner if a job is profitable | `assignments.actual_hours` + `employees.hourly_rate` ✓ |
| Team messaging | Replaces text threads | Needs `messages` table (TODO exists) |
| Client-facing portal | Customers see arrival windows | Needs new `clients` table |
| Route optimization | Direct dollar value — fuel savings | `properties.latitude/longitude` ✓ |

### What to Do With Weather Data
Keep NWS integration as a **passive scheduling assist** — surface frost/rain alerts as a yellow warning badge on the dispatch board, not a hero feature. It adds value without being the value.

---

## 3. COLOR SYSTEM — FULL REPLACEMENT

### Problem With Current Palette
Current `#0f1a14` base and `#a3e635` lime accent read as "Bootstrap dark theme with a green swap." Electric lime is too saturated — creates eye strain, no visual rest points. Muted text at `#94a3b8` is too cool (blue-grey) for a green-brand product.

### New Design Token System

```typescript
// tailwind.config.ts — replace existing color extensions
// IMPORTANT: grep for all existing color token usages before replacing
// Run: grep -r 'surface-\|brand\.\|text-text-\|status-' src/ to audit impact
colors: {
  surface: {
    base:     '#0a0f0c',   // near-black, slight green warmth
    card:     '#141f18',   // card background
    elevated: '#1c2d22',   // modals, dropdowns, elevated panels
    border:   '#263d2d',   // subtle borders
    hover:    '#1f3027',   // hover states on clickable rows
  },
  brand: {
    DEFAULT:  '#84cc16',   // lime-500 — toned down from a3e635
    bright:   '#a3e635',   // hero CTAs only
    dim:      '#4d7c0f',   // lime-700 — secondary actions
    ghost:    '#1a2e10',   // lime tint bg for badges/chips
  },
  text: {
    primary:  '#f0f4f0',   // warm near-white
    secondary:'#8fa98f',   // warm mid-grey-green
    muted:    '#556b55',   // placeholder, disabled
    inverse:  '#0a0f0c',   // text on lime backgrounds
  },
  status: {
    active:   '#22c55e',   // job in progress
    pending:  '#f59e0b',   // waiting/unassigned
    warning:  '#ef4444',   // overdue, weather alert
    complete: '#3b82f6',   // completed jobs
    hold:     '#6b7280',   // paused / on hold
  },
}
```

### Typography Scale

```css
/* src/index.css — add to @layer utilities */
.heading-xl  { @apply text-3xl font-bold tracking-tight text-text-primary; }
.heading-lg  { @apply text-xl font-semibold tracking-tight text-text-primary; }
.heading-md  { @apply text-base font-semibold text-text-primary; }
.body-base   { @apply text-sm font-normal text-text-secondary; }
.body-muted  { @apply text-xs font-normal text-text-muted; }
.label-field { @apply text-xs font-medium uppercase tracking-widest text-text-muted; }
```

### Glass Effect — Modals Only

```css
.glass-modal {
  background: rgba(20, 31, 24, 0.85);
  backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid rgba(132, 204, 22, 0.12);
}
```

---

## 4. NAVIGATION REDESIGN

### Problem Statement
Flat visual hierarchy — all nav items look equally important. Field employee and supervisor views share too much chrome. Mobile nav is secondary.

### New Sidebar Architecture (AppLayout.tsx / AppSidebarRefined.tsx)

```
TIER 1 — PRIMARY OPERATIONS
  ▸ Command Center         [LayoutDashboard]
  ▸ Scheduler              [CalendarDays]       ← exists, rename label to "Dispatch"
  ▸ Workflow               [ClipboardList]      ← exists

TIER 2 — MANAGEMENT
  ▸ Team                   [UsersRound]         ← exists (EmployeesPage)
  ▸ Equipment              [Wrench]             ← exists
  ▸ Invoicing              [Receipt]            ← NEW (P1 feature)
  ▸ Reports                [BarChart3]          ← exists

TIER 3 — SETTINGS/COMPLIANCE (footer-pinned)
  ▸ Chemical Logs          [Shield]             ← exists
  ▸ Safety                 [ShieldAlert]        ← exists
  ▸ Settings               [Settings2]          ← exists
  ▸ Help                   [HelpCircle]
```

### Mobile Bottom Nav (Employee Role Only)

```tsx
// 5-tab sticky bottom bar for employees on mobile
// Replaces full sidebar when: role === 'employee' && isMobile
const employeeTabs = [
  { label: 'Today',    icon: Home,         href: '/app/field' },
  { label: 'My Jobs',  icon: ClipboardList, href: '/app/scheduler' },
  { label: 'Clock',    icon: Clock,        href: '/app/field?tab=clock' },
  { label: 'Messages', icon: MessageSquare, href: '/app/breakroom' },
  { label: 'Profile',  icon: User,         href: '/app/settings?tab=profile' },
]
// Clock tab icon: brand.bright (#a3e635) when clocked_in === true
// Check clock status from clock_events table — most recent event_type
// Valid event_type values: 'clock_in' | 'clock_out' | 'break'
```

### Nav Item Component

```tsx
function NavItem({ icon: Icon, label, href, badge }: NavItemProps) {
  const isActive = usePathname().startsWith(href)
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
        isActive
          ? 'bg-surface-hover text-brand font-medium border-l-2 border-brand'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
      {badge && (
        <span className="ml-auto text-xs bg-status-pending text-white rounded-full px-1.5 py-0.5">
          {badge}
        </span>
      )}
    </Link>
  )
}
```

---

## 5. FEATURE BUILD PRIORITY

### Schema Reality Check Before Building
The following tables referenced in features **DO NOT EXIST** yet and need migrations before Codex writes queries:

| Feature | Missing Table | Columns Needed |
|---|---|---|
| Invoicing | `invoices` | id, org_id, property_id, employee_id, status, total, created_at |
| Job costing | Uses existing tables | `assignments.actual_hours` + `employees.hourly_rate` ✓ |
| Client portal | `clients` | id, org_id, name, email, phone, client_token |
| Messaging | `messages` | id, org_id, channel_id, sender_id, body, created_at |
| Dispatch board | Uses existing tables | `assignments` + `tasks` + `employees` + `properties` ✓ |
| GPS clock in/out | `clock_events` EXISTS ✓ | event_type: 'clock_in'|'clock_out'|'break', employee_id, property_id |
| Recurring jobs | `recurring_task_rules` EXISTS ✓ | task_id, employee_id, days_of_week[], active |

**Rule: Claude creates all migrations. Codex never touches the database.**

---

### P0 — Build Now (30 days)

#### 5.1 Dispatch Board (Drag-Drop)
**Prompt for Codex:**
```
Build DispatchBoardPage.tsx using @dnd-kit/core and @dnd-kit/sortable.
Weekly grid: columns = Mon–Sun, rows = crew members from useAppStore().employees.
Job cards from assignments table (join tasks for name, properties for location).
Draggable between cells — update assignments.date and assignments.employee_id on drop.
Job card shows: task name (from tasks.name), property short_name, status chip, estimated_hours.
Use surface.card as card bg, brand.DEFAULT as drop target highlight.
All queries: .eq('org_id', orgId) — org-scoped.
Column names from live-db-state.md only — never from memory.
```

#### 5.2 GPS Clock In/Out Enhancement
**Prompt for Codex:**
```
Enhance MobileFieldWorkspacePage.tsx ClockInCard component.
On clock-in click: call navigator.geolocation.getCurrentPosition(), 
insert to clock_events table:
  { employee_id, property_id, event_type: 'clock_in', 
    location_lat, location_lng }
Note: timestamp column has DB default now() — do not pass it.
On clock-out: insert { event_type: 'clock_out', location_lat, location_lng }.
Show elapsed time counter using useEffect interval when clocked in.
Check clock status: query clock_events for most recent event_type by employee_id.
RLS: employee writes only their own rows.
Column names from live-db-state.md — clock_events has: 
  id, employee_id, property_id, event_type, timestamp, location_lat, location_lng, org_id
```

#### 5.3 Recurring Task Automation UI
**Prompt for Codex:**
```
Add RecurringTasksSection.tsx to SettingsPage under a "Recurring Tasks" tab.
Read from recurring_task_rules table:
  id, org_id, property_id, task_id, employee_id, days_of_week (text[]), active, created_at
Join tasks table for task name, employees for employee name, properties for property name.
UI: list of active rules with toggle (active), edit, delete.
Create form: select task (from useAppStore tasks if available, else fetch tasks table),
  select employee, select property, select days_of_week (checkboxes Mon–Sun), active toggle.
All queries org-scoped. Column names from live-db-state.md only.
```

---

### P1 — Build for Retention (60 days)

#### 5.4 Job Costing Dashboard
**Prompt for Codex:**
```
Build JobCostingPage.tsx under Reports section.
For each completed assignment (assignments.status = 'completed'):
  revenue = estimated_hours × (tasks.estimated_hours as proxy until rate field exists)
  labor_cost = actual_hours × employees.hourly_rate (nullable — handle null)
  gross_margin = (revenue - labor_cost) / revenue
Display as sortable table: property, task, employee, est hours, actual hours, margin %.
Color-code margin: green >40%, yellow 20–40%, red <20%.
Summary row: avg margin, highest/lowest margin task category.
recharts BarChart for monthly actual_hours trend — already in stack.
All queries org-scoped. Use live-db-state.md for column names.
```

#### 5.5 Invoicing (Requires Migration First)
> ⚠️ Claude must create the `invoices` migration before Codex builds this UI.
> Migration needed: `invoices` (id uuid, org_id uuid, property_id uuid, status text default 'draft', line_items jsonb, subtotal numeric, tax_rate numeric, total numeric, created_at timestamptz, sent_at timestamptz, paid_at timestamptz)

**Prompt for Codex (run AFTER migration):**
```
Build InvoicingPage.tsx with three tabs: Draft, Sent, Paid.
Read from invoices table (migration required — confirm table exists first via grep of live-db-state.md).
Each invoice row: property name (from useAppStore properties), status chip, total, created_at.
"Send Invoice" button: update status to 'sent', set sent_at = now().
"Mark Paid" button: update status to 'paid', set paid_at = now().
Summary banner: total outstanding (status='sent'), collected this month (status='paid'), overdue count.
All queries org-scoped.
```

---

### P2 — Differentiators (90 days)

#### 5.6 Route Optimization
**Prompt for Codex:**
```
Add "Optimize Route" button to DispatchBoardPage per crew per day.
Sort crew's assignments for that day using nearest-neighbor greedy algorithm.
Start from first property's lat/lng (properties.latitude, properties.longitude from useAppStore).
Calculate straight-line distance × 1.4 drive-time conversion.
Reorder assignments in-place (update assignments.order_index).
Show numbered stop list with estimated drive time between stops.
No external API — pure geometry only.
```

#### 5.7 In-App Messaging
> ⚠️ Requires `messages` table migration. TODO already exists in codebase.
> Migration needed: `messages` (id uuid, org_id uuid, channel text, sender_id uuid, body text, created_at timestamptz default now())

**Prompt for Codex (run AFTER migration):**
```
Rebuild BreakroomPage.tsx as a channel-based messaging page.
Channels: one per property (from useAppStore properties), one company-wide.
Messages from messages table, subscribe via Supabase Realtime postgres_changes.
Each message: sender initials avatar, sender name from useAppStore employees, timestamp, body.
Composer at bottom, send on Enter or button click.
Unread count: messages created_at > user's last_seen_at (store in localStorage for now).
All queries org-scoped.
```

---

## 6. COMPONENT DESIGN STANDARDS

### Card

```tsx
<div className="bg-surface-card border border-surface-border rounded-xl p-4">
  <div className="flex items-center justify-between mb-3">
    <h3 className="heading-md">{title}</h3>
    <span className="body-muted">{subtitle}</span>
  </div>
  {children}
</div>
```

### Status Badge

```tsx
const statusStyles = {
  active:   'bg-status-active/10 text-status-active border-status-active/20',
  pending:  'bg-status-pending/10 text-status-pending border-status-pending/20',
  complete: 'bg-status-complete/10 text-status-complete border-status-complete/20',
  hold:     'bg-status-hold/10 text-status-hold border-status-hold/20',
  warning:  'bg-status-warning/10 text-status-warning border-status-warning/20',
}
function StatusBadge({ status }: { status: keyof typeof statusStyles }) {
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', statusStyles[status])}>
      {status}
    </span>
  )
}
```

### Empty State

```tsx
function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-text-muted" />
      </div>
      <p className="heading-md mb-1">{title}</p>
      <p className="body-base mb-4 max-w-xs">{description}</p>
      {action}
    </div>
  )
}
```

### Data Table

```tsx
<div className="rounded-xl border border-surface-border overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-surface-elevated border-b border-surface-border">
      <tr><th className="label-field px-4 py-3 text-left">{column}</th></tr>
    </thead>
    <tbody className="divide-y divide-surface-border">
      <tr className="hover:bg-surface-hover transition-colors cursor-pointer">
        <td className="px-4 py-3 text-text-primary">{value}</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 7. MOBILE-FIRST DIRECTIVES

Every page must pass before considered done:

1. **375px minimum** — nothing overflows or truncates illegibly
2. **Touch targets** — all interactive elements: `min-h-[44px] min-w-[44px]`
3. **Bottom sheet on mobile** — `<Dialog>` with `bottom-0 inset-x-0 rounded-t-2xl` on small screens
4. **Sticky bottom CTAs** — `fixed bottom-6 left-4 right-4 sm:static`
5. **No horizontal scroll** — no fixed-width containers without `overflow-x-auto`

---

## 8. COMMAND CENTER REDESIGN

**Prompt for Codex:**
```
Redesign CommandCenterOperationalPage.tsx.

KPI row (4 cards):
  - Today's Assignments: COUNT assignments WHERE date = today AND org_id = orgId
  - Crew On-Clock: COUNT clock_events WHERE event_type = 'clock_in' AND no
    subsequent 'clock_out' today (subquery or client-side filter)
  - Open Task Requests: COUNT task_requests WHERE status = 'pending' AND org_id = orgId
  - Active Work Orders: COUNT work_orders WHERE status = 'open' AND org_id = orgId

Two-column layout (desktop), single column (mobile):
  Left: Today's assignments — list from assignments table joined to tasks + employees + properties
        Show: employee name, task name, property short_name, status chip, shift_start time
  Right: Recent activity — last 10 rows from task_requests (created_at desc) +
         last 10 clock_events (timestamp desc), merged and sorted by timestamp

Bottom: recharts BarChart — assignments grouped by tasks.category for current week

Weather: single amber banner at very top ONLY when NWS returns alert for default weather location.
         Remove weather from any hero/card position.

All data from useAppStore where available (employees, properties).
Page-level fetches for: assignments, task_requests, work_orders, clock_events.
All queries org-scoped. Column names from live-db-state.md only.
```

---

## 9. WHAT TO STOP BUILDING

| Stop | Why |
|---|---|
| Weather as hero feature | Cannot monetize, free on every phone |
| Pastel/tinted card backgrounds | Reads unpolished |
| Full-width glassmorphism on data tables | Hurts readability |
| Sidebar items with no state differentiation | All feel equally unimportant |
| Generic placeholder dashboards | Every page: real data or clear empty state |

---

## 10. SUBSCRIPTION TIER FRAMEWORK

Tag all features in code — gate is easy to add later:

```typescript
// TIER: starter — always available
// TIER: pro — requires active subscription
// TIER: enterprise — custom contract only
```

**Tier map:**
- **Starter ($29/mo):** Scheduling, basic job tracking, team messaging, field view
- **Pro ($79/mo):** GPS clock in/out, recurring jobs, invoicing, job costing, client portal
- **Enterprise ($149+/mo):** Route optimization, advanced BI, multi-location, API access

---

## 11. IMMEDIATE CODING TASKS — ORDERED BY IMPACT

| # | Task | File | Schema Ready? |
|---|---|---|---|
| 1 | New color token system | `tailwind.config.ts` | ✓ |
| 2 | Sidebar three-tier hierarchy | `AppLayout.tsx` | ✓ |
| 3 | Command Center redesign | `CommandCenterOperationalPage.tsx` | ✓ |
| 4 | Dispatch board | `DispatchBoardPage.tsx` (new) | ✓ uses assignments |
| 5 | GPS clock in/out enhancement | `MobileFieldWorkspacePage.tsx` | ✓ uses clock_events |
| 6 | Recurring tasks UI | `RecurringTasksSection.tsx` (new) | ✓ uses recurring_task_rules |
| 7 | Job costing dashboard | `JobCostingPage.tsx` (new) | ✓ uses assignments + employees |
| 8 | Invoicing | `InvoicingPage.tsx` (new) | ❌ needs invoices migration |
| 9 | Messaging rebuild | `BreakroomPage.tsx` | ❌ needs messages migration |
| 10 | Client portal | `/portal/[clientToken]` (new) | ❌ needs clients migration |

**Tasks 1–7 can start immediately. Tasks 8–10 require Claude to write migrations first.**

---

## 12. ANTI-PATTERNS TO ENFORCE

- No `filter: invert()` anywhere
- No `animation` on text content (causes CLS — confirmed in Equipment page trace)
- No `@apply` chains longer than 6 classes — extract to component
- No hardcoded hex values in JSX — always use token classes
- No `useEffect` without `isHydrated` guard (enforced in commit 52a44d9)
- No direct Supabase calls in render — always in effect/query hook
- No new npm packages without checking if Tailwind + existing deps cover it
- No table or column names from memory — always from `docs/dev/live-db-state.md` (Rule 10)
- No DB changes by Codex — Claude writes all migrations

---

## 13. SCHEMA CORRECTIONS FROM ORIGINAL DRAFT

| Original Reference | Correction | Status |
|---|---|---|
| `jobs` table | Does not exist. Use `assignments` + `tasks` | No migration needed |
| `time_entries` table | Does not exist. Use `clock_events` | No migration needed |
| `clients` table | Does not exist | Migration needed (P1) |
| `job_materials` table | Does not exist | Migration needed if feature built |
| `messages` table | Does not exist | Migration needed (TODO in codebase) |
| `activity_log` table | Does not exist | Derive from clock_events + task_requests |
| `recurring_job_templates` | Does not exist. Use `recurring_task_rules` | No migration needed |
| `crew_members.hourly_rate` | Use `employees.hourly_rate` | ✓ column exists |
| `clients.clientToken` | Does not exist | Migration needed |
| `clock_in` / `clock_out` event_type values | Correct values: `'clock_in'` / `'clock_out'` / `'break'` | Fixed in DB (commit e0fe9fa) |

---

*CODEX 6.9.26 — Claude-audited revision. Use as authoritative brief for all coding sessions. Supersedes the original Claude Code draft.*

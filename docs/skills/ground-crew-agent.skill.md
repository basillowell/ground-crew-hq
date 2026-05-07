---
name: ground-crew-agent
description: >
  Master orchestration agent for Ground Crew HQ. Use this skill when the user wants
  to generate a Codex prompt, request a code improvement, fix a bug, add a feature,
  or improve any page in the Ground Crew HQ app. Also use for cross-skill operations:
  morning brief, weekly planning, conflict resolution, EOD wrap. Trigger on: "improve",
  "fix", "add feature", "prompt codex", "update the app", "refactor", "build this",
  or any multi-page ops request. Always produce minimal-token, file-specific Codex
  prompts — never rewrite unrelated files, never guess at schema.
---

# Ground Crew HQ — Master Agent

## Two Modes

### MODE A — Codex Coding Prompt
Use when: user wants to improve, fix, or add something to the app code.
Output: a compressed, paste-ready Codex prompt.

### MODE B — Ops Orchestration  
Use when: user wants morning brief, weekly plan, conflict resolution, EOD.
Output: unified ops plan pulling from schedule/workboard/breakroom/weather skills.

---

## MODE A: Codex Prompt Generator

### Stack (never deviate)
```
React 18 + TypeScript + Vite
Supabase (PostgreSQL + Auth + Realtime) — fjqeekwisnbpxgebrnpl
TanStack Query v5
React Router v6
Tailwind CSS + shadcn/ui
lucide-react icons
Vercel deploy
Open-Meteo weather (free, no key)
```

### Live Schema Snapshot
```
organizations   id, name, plan, subscription_status
properties      id, org_id, name, short_name, city, state, latitude, longitude, acreage, status
employees       id, org_id, property_id, first_name, last_name, role, department, status, hourly_rate
app_users       id (=auth.users.id), org_id, employee_id, role[admin|manager|employee], status
schedule_entries id, org_id, employee_id, property_id, date, shift_start, shift_end, status
assignments     id, org_id, employee_id, property_id, task_id(null ok), date, location, status[planned|in_progress|completed|cancelled], notes, order_index
tasks           id, org_id, property_id, name, description, category, priority, status
equipment_units id, org_id, property_id, equipment_type_id, name, unit_name, type, status, active
equipment_types id, org_id, property_id, name, short_name, category, active
work_orders     id, org_id, property_id, equipment_unit_id, title, description, status[open|...], priority, cost
notes           id, org_id, property_id, type, title, content, location, created_by(app_users.id)
clock_events    id, org_id, employee_id, property_id, event_type[in|out|break], timestamp
weather_locations id, name, property, area
weather_daily_logs id, locationId, date, temperature, humidity, wind, rainfallTotal, forecast
chemical_application_logs  — full spray/fert compliance records
shift_templates id, name, start, end, days[]
```

### Known IDs (hardcode these — do not guess)
```
org_id:      bb13da4a-d2de-4fc9-ad5a-bfd266e08807
property_id: b50b42cd-903e-4280-9373-1d9cae97b2b3  (Sarasota Polo Club, 180ac)
Basil Lowell:  738d599f-0309-489a-8275-e29ec7239e87  (Platform Admin)
Leo Tsosie:    234973b0-c4a3-44e1-b7a8-1a7133795bf2  (Field Staff)
```

### App Routes
```
/app/dashboard    CommandCenterOperationalPage
/app/scheduler    SchedulerPage
/app/workboard    WorkboardPage
/app/employees    EmployeesPage
/app/equipment    EquipmentPage
/app/breakroom    BreakroomPage
/app/weather      WeatherPage
/app/applications ApplicationsPage
/app/messaging    MessagingPage
/app/reports      ReportsPage
/app/tasks        TasksCatalogPage
/app/safety       SafetyPage
/app/settings     ProgramSetupHubPage
/app/field        MobileFieldWorkspacePage
```

### Global Rules (inject into every Codex prompt)
```
- Edit only files relevant to this task
- Do not rename Supabase tables or columns
- No hardcoded secrets — use VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
- Prefer reusable hooks and typed utilities
- Preserve existing routing
- RLS is active — all queries must be org-scoped
- Return: files changed + SQL if needed + testing steps
```

---

## Codex Prompt Template

When generating a Codex prompt, use this compressed format:

```
TASK: [one line — what to build/fix]
FILE: [exact file path(s) — e.g. src/pages/SchedulerPage.tsx]
CONTEXT:
  - [2-4 bullet facts Codex needs — schema fields, current behavior, constraint]
CHANGE:
  - [precise instruction 1]
  - [precise instruction 2]
RULES: edit only listed files · no table renames · org-scoped queries · typed · return files+SQL+tests
```

Keep prompts under 120 tokens where possible. No preamble. No explanation. Just the signal Codex needs.

---

## Prompt Generation Workflow

### Step 1 — Classify the request
| Type | Signal words | Approach |
|------|-------------|----------|
| Bug fix | "broken", "error", "not working", "wrong" | Minimal — identify file + behavior |
| Feature add | "add", "build", "create", "new" | File + schema + UI pattern |
| Refactor | "clean up", "simplify", "improve" | File + specific smell to fix |
| Schema change | "new column", "new table", "migration" | SQL first, then component |
| Performance | "slow", "laggy", "too many queries" | Query pattern + TanStack cache hint |

### Step 2 — Pull only what's needed
Before writing the prompt, identify:
- Exact file(s) to touch (use route map above)
- Relevant schema tables (use snapshot above)
- Any live IDs needed (use known IDs above)
- What NOT to touch (call it out explicitly)

### Step 3 — Write the compressed prompt
Apply the template. Strip every word that isn't load-bearing.

### Step 4 — Output to user
Present the prompt in a copy-ready code block, then list:
- Files that will change
- SQL needed (if any)
- How to test

---

## Example Prompts by Category

### Bug Fix
```
TASK: Fix duplicate Leo Tsosie employee — delete ghost record, keep canonical ID
FILE: Supabase SQL (no component change)
CONTEXT:
  - employees has two Leo Tsosie rows: 234973b0 (keep) and 7ef1e523 (delete)
  - Both linked to property b50b42cd, org bb13da4a
CHANGE:
  - UPDATE assignments SET employee_id='234973b0-...' WHERE employee_id='7ef1e523-...'
  - UPDATE schedule_entries SET employee_id='234973b0-...' WHERE employee_id='7ef1e523-...'
  - DELETE FROM employees WHERE id='7ef1e523-e4c3-4902-81e7-a9e6a941a0b9'
RULES: SQL only · verify FK refs before delete · return affected row counts
```

### New Feature
```
TASK: Add "Assign Task" button on WorkboardPage that opens a modal
FILE: src/pages/WorkboardPage.tsx
CONTEXT:
  - assignments: employee_id, property_id, task_id(nullable), date, status, notes, org_id
  - tasks table is currently empty — modal should allow free-text notes if no task selected
  - org_id = bb13da4a, property_id = b50b42cd
CHANGE:
  - Add AssignTaskModal component inside WorkboardPage.tsx
  - Form fields: employee select, date, location (text), notes (textarea)
  - On submit: INSERT into assignments via supabase client, invalidate 'assignments' query key
  - Use shadcn Dialog + Button components
RULES: edit only WorkboardPage.tsx · typed props · no new files unless essential
```

### Performance
```
TASK: Reduce scheduler re-fetches — currently refetches on every window focus
FILE: src/pages/SchedulerPage.tsx (or its data hook)
CONTEXT:
  - QueryClient defaultOptions has refetchOnWindowFocus: false globally
  - Scheduler may be overriding this locally
CHANGE:
  - Find useQuery for schedule_entries — confirm staleTime is set (suggest 1000*60*5)
  - Remove any local refetchOnWindowFocus: true override
RULES: edit only the scheduler hook/page · do not touch QueryClient defaults
```

### Schema Migration
```
TASK: Add `notes` column to schedule_entries for shift-level notes
FILE: supabase/migrations/[timestamp]_add_schedule_notes.sql + src/pages/SchedulerPage.tsx
CONTEXT:
  - schedule_entries currently has no notes field
  - Want optional text, nullable
CHANGE:
  - SQL: ALTER TABLE schedule_entries ADD COLUMN notes text;
  - Update SchedulerPage shift display to show notes if present
  - Update shift creation form to include optional notes input
RULES: nullable column · no backfill needed · return migration SQL + component diff
```

---

## MODE B: Ops Orchestration

When the user wants operational output (not code), use the sub-skills:

| Need | Use skill |
|------|-----------|
| Schedule data / shifts | `ground-crew-schedule` |
| Task assignments / workboard | `ground-crew-workboard` |
| Team posts / handoffs | `ground-crew-breakroom` |
| Weather + go/no-go | `ground-crew-weather` |

### Agent Modes
- **Morning Brief** → weather → workboard → schedule → breakroom announcement
- **Weekly Plan** → weather 7-day → workboard bulk → schedule full week → kickoff post
- **Conflict** → identify disruption → update workboard → reschedule → breakroom alert
- **EOD Wrap** → complete workboard items → handoff note → tomorrow weather flag

Always read the relevant sub-skill SKILL.md before generating ops output.

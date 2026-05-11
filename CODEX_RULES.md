# Ground Crew HQ — Codex Operating Rules

> Read this file at the start of every session before writing any code.
> These rules exist to prevent schema drift, deployment floods, and auth loops.

---

## The Golden Rule

**Codex owns the frontend. Supabase is managed externally.**

Claude (the supervisor) applies all schema changes directly to the live database.
Codex writes TypeScript, React components, hooks, and pages — never SQL migrations
for structural changes.

---

## Rule 1 — No SQL migrations for schema changes

NEVER create migration files that:
- Create or drop tables
- Add, rename, or drop columns
- Add or modify foreign keys
- Create or modify RLS policies
- Create or modify database functions
- Insert seed data with hardcoded UUIDs

WHY: Schema changes applied via migration files do not automatically run against
the live Supabase database. This creates drift between GitHub and production,
breaking the app in ways that are hard to trace.

INSTEAD: When a schema change is needed, add a comment in the code:
```
// SCHEMA NEEDED: add column X to table Y — request from Claude session
```
Then flag it in your response so the supervisor (Claude) can apply it directly.

---

## Rule 2 — Never hardcode UUIDs

NEVER hardcode org IDs, user IDs, property IDs, or any UUID in:
- Migration files
- Seed files
- Component code
- Hook defaults

ALWAYS read these from auth context:
```typescript
const { orgId, user } = useAuth()
```

The one exception: the supervisor may provide a UUID explicitly for a targeted
fix — use it only in that specific context, never as a permanent default.

---

## Rule 3 — One branch, always main

NEVER create new branches. All work goes directly to `main`.

WHY: Every branch Codex pushes triggers a new Vercel preview deployment.
With multiple branches active, Vercel spawns dozens of deployments and it
becomes impossible to know which URL is production.

If git refuses a direct push to main, use:
```
git push origin HEAD:main --force-with-lease
```

---

## Rule 4 — Auth context is the only source of org_id

NEVER query Supabase without scoping to org:
```typescript
// WRONG
const { data } = await supabase.from('employees').select('*')

// RIGHT
const { orgId } = useAuth()
const { data } = await supabase.from('employees').select('*').eq('org_id', orgId)
```

NEVER use JWT custom claims for org_id. The correct pattern is:
```typescript
// RLS policies use this function (already in DB):
// SELECT org_id FROM app_users WHERE id = auth.uid()
```

NEVER call set_claim(), refreshSessionWithRetry(), or any JWT manipulation.
Auth is: signIn → session → query app_users → done.

---

## Rule 5 — Supabase joins require foreign keys

NEVER use PostgREST nested select syntax unless the FK exists:
```typescript
// Only works if weather_stations.locationId FK → weather_locations.id exists
const { data } = await supabase
  .from('weather_locations')
  .select('*, weather_stations(*)')  // ← requires FK in DB
```

If a join fails with "could not find relationship in schema cache":
- Do NOT use the nested select
- Use two separate queries and join in TypeScript instead:
```typescript
const { data: locations } = await supabase.from('weather_locations').select('*').eq('org_id', orgId)
const { data: stations } = await supabase.from('weather_stations').select('*')
const joined = locations?.map(loc => ({
  ...loc,
  stations: stations?.filter(s => s.locationId === loc.id)
}))
```

---

## Rule 6 — Never block the UI on failed queries

ALWAYS separate loading states:
```typescript
const [isAuthReady, setIsAuthReady] = useState(false)   // from AuthContext
const [isDataLoading, setIsDataLoading] = useState(true) // local to page

// Pattern:
if (!isAuthReady) return <PageSkeleton />
if (isDataLoading) return <ContentSkeleton />
if (error) return <ErrorState onRetry={refetch} />
return <PageContent />
```

NEVER let a failed data fetch re-trigger auth validation.
NEVER show an infinite spinner — always show a Retry button after 10s.

---

## Rule 7 — Build must pass before commit

ALWAYS run `npm run build` before committing.
NEVER commit if the build has errors.
If build fails due to TypeScript errors: fix them, do not use `// @ts-ignore`.

---

## Rule 8 — Commit naming convention

```
feat: short description (ver2.X.Y)     ← new feature
fix: short description (ver2.X.Y)      ← bug fix
chore: short description (ver2.X.Y)    ← cleanup, refactor, deps
```

Bump the patch version (Y) for each commit to main.
Never use vague messages like "update" or "fix bug".

---

## Current DB State (updated by supervisor)

**Project:** fjqeekwisnbpxgebrnpl.supabase.co
**Org ID:** read from auth context — never hardcode
**Production URL:** ground-crew-hq.vercel.app
**Branch:** main

### Tables (37 total — all have RLS enabled)
app_users, application_areas, assignments, chemical_application_logs,
chemical_application_tank_mix_items, chemical_products, clock_events,
department_options, departments, employee_groups, employees,
employment_statuses, equipment_types, equipment_units, group_options,
job_descriptions, manual_rainfall_entries, notes, organizations,
overtime_rules, program_settings, properties, property_class_options,
schedule_entries, scheduler_settings, shift_templates, task_requests,
tasks, wage_categories, weather_daily_logs, weather_display_prefs,
weather_locations, weather_stations, work_locations, work_orders,
worker_types, workforce_roles

### Key relationships
- app_users.org_id → organizations.id
- weather_stations.locationId → weather_locations.id (FK added)
- weather_locations.org_id → organizations.id
- employees linked via app_users.employee_id

### RLS pattern (use this everywhere)
```sql
-- SELECT
USING (org_id = (SELECT org_id FROM app_users WHERE id = auth.uid())
  OR auth.role() = 'service_role')

-- For app_users table specifically (no org_id self-reference):
USING (auth.uid() = id OR auth.role() = 'service_role')
```

### Helper functions (already in DB — do not redefine)
- `current_org_id()` → reads app_users by auth.uid()
- `current_user_role()` → reads app_users by auth.uid()
- `current_employee_id()` → reads app_users by auth.uid()
- `auth_app_user_id()` → reads app_users by auth.uid()

---

## How to use this file

**At the start of every Codex session, paste:**
```
Read CODEX_RULES.md before writing any code. Follow all rules exactly.
Schema changes are managed externally — flag them in comments, never in migrations.
```

**When starting a task, paste:**
```
Read CODEX_RULES.md. Task: [your task here]
```

That's it. Codex will read the file from the repo and apply the rules to everything it writes.

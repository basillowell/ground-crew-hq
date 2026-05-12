[# Ground Crew HQ — Codex Operating Rules
# Version: 2.5 · Last updated: May 2026
# Maintained by: Claude (supervisor) + Basil Lowell (product owner)
#
# These rules exist to prevent the four failure modes we've hit:
#   1. Schema drift (DB and GitHub out of sync)
#   2. Deployment floods (every branch triggers Vercel)
#   3. Auth loops (stale sessions, race conditions)
#   4. JSX corruption (incremental patches on broken files)
#
# AGENTS.md is a developer reference — keep it in the repo.
# These rules govern what Codex builds, not what Claude supervises.

---

## The Core Split

**Claude (supervisor):** Handles all schema, RLS, migrations, DB seeds,
foreign keys, and index changes — directly via Supabase MCP. Never Codex.

**Codex:** Writes TypeScript, React components, hooks, pages, and styles.
Never touches the database directly.

**Basil (product owner):** Tells Claude what to build. Claude checks the DB,
fixes anything structural, then writes the Codex prompt with confirmed context.
Codex gets a prompt with the right schema state already confirmed — no investigation needed.

---

## Rule 1 — No SQL migrations for structural changes

NEVER create migration files that:
- Create, rename, or drop tables or columns
- Add or modify foreign keys or indexes
- Create or modify RLS policies or functions
- Insert seed data with hardcoded UUIDs

INSTEAD: If a schema change is needed, add an inline comment:
```tsx
// SCHEMA NEEDED: add column X to table Y — flag for Claude session
```
Flag it in your response. Claude applies it directly to Supabase.

EXCEPTION: Documentation-only migration files (comments, version notes)
for tracking purposes are fine. Never executable structural SQL from Codex.

---

## Rule 2 — Never hardcode UUIDs or environment values

NEVER hardcode in any file:
- Org IDs, user IDs, property IDs, location IDs, station IDs
- Supabase project URLs or anon keys
- Environment-specific values of any kind

ALWAYS read from context:
```typescript
const { orgId, user, userRole } = useAuth()
```

---

## Rule 3 — One branch only: main

NEVER create new branches. All work goes to `main` directly.

WHY: Every branch triggers a new Vercel preview deployment.
Multiple active branches = dozens of dead deployments.

If git refuses a direct push:
```bash
git push origin HEAD:main --force-with-lease
```

Production URL: **ground-crew-hq.vercel.app**
Supabase project: **fjqeekwisnbpxgebrnpl.supabase.co**

---

## Rule 4 — Auth context is read-only: do not modify

The auth pattern is implemented and working. Do not touch it.

**Current working pattern:**
```typescript
// On mount: getSession() → 200ms delay → loadAppUser() with 3 retries
// onAuthStateChange: SIGNED_IN → loadAppUser(), SIGNED_OUT → clear state
// Safety timeout: 12s → force isReady=true
// Context exports: { user, orgId, userRole, isReady }
// isReadyRef tracks isReady in timeout closures
```

**Never:**
- Call `set_claim()` or any JWT manipulation
- Call `refreshSessionWithRetry()` or custom retry wrappers
- Read `org_id` from JWT — always read from `app_users` table
- Modify AuthContext.tsx without explicit Claude instruction

If auth appears broken: flag it for Claude. Every Codex auth fix
in this project has introduced a new loading loop.

---

## Rule 5 — Supabase queries: two calls, never nested select

PostgREST nested selects require a foreign key in the DB.
When in doubt, use two queries and join in TypeScript.

```typescript
// WRONG — crashes without FK:
const { data } = await supabase
  .from('weather_locations')
  .select('*, weather_stations(*)')

// RIGHT — always safe:
const { data: locations } = await supabase
  .from('weather_locations')
  .select('*')
  .eq('org_id', orgId)

const { data: stations } = await supabase
  .from('weather_stations')
  .select('*')

const joined = locations?.map(loc => ({
  ...loc,
  stations: stations?.filter(s => s.locationId === loc.id) ?? []
}))
```

**All queries must be org-scoped:**
```typescript
.eq('org_id', orgId)           // tables with org_id column
.in('locationId', locationIds) // tables linked via location
```

---

## Rule 6 — Loading states: never blank, never infinite

```typescript
if (!isReady) return <PageSkeleton />
if (isDataLoading) return <ContentSkeleton />
if (error) return <ErrorState onRetry={refetch} message={error} />
return <PageContent data={data} />
```

- Data fetch timeout: **8 seconds** → show error + Retry button
- Auth timeout: **12 seconds** → force isReady, show "Clear session" option
- Retry button must actually re-trigger the fetch (use useCallback)
- Never show a dead end with no escape

---

## Rule 7 — Corrupted files: full rewrite, never patch

If a file has JSX parsing errors, encoding issues, or mismatched tags:
**Delete the entire file content. Rewrite from scratch.**

Never apply str_replace to a broken file. Corruption compounds.

Signs a file needs rewrite (not a patch):
- Build fails with "Unexpected token" in that file
- str_replace cannot find its target string
- Multiple consecutive patch attempts fail on same file
- File has been edited 10+ times across sessions (check git log)

Current known corrupted file: `ProgramSetupHubPage.tsx` — always rewrite.

---

## Rule 8 — UI language: product only, zero developer terms

| Never render... | Render instead... |
|---|---|
| "Agent Skills" | "Operations Assistant — Coming soon" |
| "Codex", "Claude", "AI prompt" | (remove entirely) |
| "Set weather_default_latitude" | "Configure weather for your property" |
| "Configure employees table" | "Set up your crew" |
| "RLS", "migration", "schema" | (never in UI) |
| "skill", "SKILL", "prompt helper" | (never in UI) |

AGENTS.md lives in the repo as a developer reference.
Never import or render its content in the app UI.

---

## Rule 9 — Build must pass before every commit

```bash
npm run build  # 0 errors required
```

- Fix all TypeScript errors — no `// @ts-ignore`
- Missing component → create a simple placeholder, not an error
- Never commit a broken build

---

## Rule 10 — Commit format

```
feat: description (ver2.X.Y)      ← new feature
fix: description (ver2.X.Y)       ← bug fix
refactor: description (ver2.X.Y)  ← rewrite/cleanup
chore: description (ver2.X.Y)     ← config, docs, deps
```

Bump patch (Y) per commit. Check package.json for current version.

---

## Live DB State
*Maintained by Claude — confirmed May 12, 2026*

**Project:** fjqeekwisnbpxgebrnpl.supabase.co
**Org:** Ground Crew HQ · Plan: starter
**Active property:** Sarasota Polo Club (b50b42cd-903e-4280-9373-1d9cae97b2b3)

### Auth & RLS
```typescript
// app_users policy: auth.uid() = id OR auth.role() = 'service_role'
// All 37 tables have RLS enabled — no exceptions
```

### Helper functions (SECURITY DEFINER — never redefine from Codex)
```sql
current_org_id()      → SELECT org_id FROM app_users WHERE id = auth.uid()
current_user_role()   → SELECT role FROM app_users WHERE id = auth.uid()
current_employee_id() → SELECT employee_id FROM app_users WHERE id = auth.uid()
auth_app_user_id()    → SELECT id FROM app_users WHERE id = auth.uid()
```

### All 37 tables (all RLS on)
```
app_users · application_areas · assignments
chemical_application_logs · chemical_application_tank_mix_items
chemical_products · clock_events · department_options · departments
employee_groups · employees · employment_statuses
equipment_types · equipment_units · group_options · job_descriptions
manual_rainfall_entries · notes · organizations · overtime_rules
program_settings · properties · property_class_options
schedule_entries · scheduler_settings · shift_templates
task_requests · tasks · wage_categories
weather_daily_logs · weather_display_prefs · weather_locations
weather_stations · work_locations · work_orders
worker_types · workforce_roles
```

### Key foreign keys (confirmed in DB)
```
weather_stations.locationId → weather_locations.id ✓
weather_locations.org_id    → organizations.id ✓
scheduler_settings.property_id → properties.id ✓
app_users.employee_id → employees.id ✓
```

### Scheduler settings (id: 48336e91)
```
operational_day_start: 05:00    operational_day_end: 18:00
default_shift_start: 05:00      default_shift_end: 13:30
operational_days: mon/tue/wed/thu/fri/sat
min_shift_hours: 4   max_shift_hours: 10   overtime_threshold: 40h
property_id: b50b42cd (Sarasota Polo Club)
```

### Weather
```
Location:  Sarasota Polo Club · id: 8c4f9cf0 · lat: 27.3364 · lng: -82.5307
Station:   Sarasota Polo Club Station · id: 7b98c31e · provider: Open-Meteo
Display:   7 panels enabled in weather_display_prefs
Daily logs: 11 rows, 7 in 2026 · YTD rainfall: 3.69 in
```

### Standard RLS policy pattern
```sql
-- Tables with org_id:
USING (org_id = (SELECT org_id FROM app_users WHERE id = auth.uid())
  OR auth.role() = 'service_role')

-- app_users (no self-reference):
USING (auth.uid() = id OR auth.role() = 'service_role')

-- weather_daily_logs (linked via locationId):
USING (
  "locationId" IN (
    SELECT id FROM weather_locations
    WHERE org_id = (SELECT org_id FROM app_users WHERE id = auth.uid())
  ) OR auth.role() = 'service_role'
)
```

---

## How to invoke these rules

### Every Codex session — paste this first:
```
Read CODEX_RULES.md before writing any code.
No migrations. No new branches. Main only.
Task: [your task]
```

### Corrupted file rewrite:
```
Read CODEX_RULES.md — Rule 7 applies to [filename].
Full rewrite required. Delete all existing content. Rewrite from scratch.
[new spec here]
```

### Auth issue:
Do not send to Codex. Send screenshot + console error to Claude.

### DB/RLS issue:
Do not send to Codex. Claude fixes directly in Supabase — usually 10 seconds.

### New feature:
Tell Claude what you want. Claude checks DB, fixes schema if needed,
then writes the Codex prompt with confirmed context already embedded.]

# Full Cycle Audit Report (ver2.5.14.146–164)
Date: 2026-05-17
Scope: Steps 1–8 requested (audit only; no feature changes)

## Summary
- PASS: 4
- WARN: 6
- FAIL: 8

---

## STEP 1 — Git log verification (146 through 164)
Command run: `git log --oneline | head -100`

### Version coverage
- Present: `146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 164`
- Missing: `163`

### FAIL
- Missing commit: `ver2.5.14.163`
  - Fix: add/land the missing `163` commit (or document intentional skip).

---

## STEP 2 — Build verification
Command run: `npm run build`

### Result
- FAIL

### Build error
- `src/App.tsx` imports lazy route `./pages/WeatherPage`, but file is not resolvable.
  - Error: `Could not resolve "./pages/WeatherPage" from "src/App.tsx"`
  - Runtime impact: app build is blocked.

### FAIL
- `src/App.tsx:30` — unresolved lazy import `./pages/WeatherPage`
  - Fix: restore `src/pages/WeatherPage.tsx` or update route import to existing page file.

---

## STEP 3 — Import health check
Signals used:
- Build output (module resolution)
- Lint output (`npm run lint`)
- import scans in `src/App.tsx` and weather-related components

### a) Imports/modules that do not exist
- FAIL: `src/App.tsx:30` → `lazy(() => import("./pages/WeatherPage"))` cannot resolve.

### b) Circular imports (A→B→A)
- No direct circular pair found in weather component set by text scan.
- WARN: full graph-based cycle detection tool was not run; no proven cycle reported from current scans.

### c) Variables used but never declared
- No explicit undeclared-variable compile error surfaced before build stopped at unresolved module.
- WARN: this check is partially blocked by the missing `WeatherPage` module.

### d) Unused imports (non-critical)
- Lint run shows many warnings/errors but not primarily unused-import failures.
- WARN: non-critical hygiene items exist (hooks dependency warnings, refresh warnings).

---

## STEP 4 — Supabase query column audit vs `docs/dev/live-db-state.md`
Pattern scan found multiple table/column mismatches against the documented schema.

### FAIL (schema mismatches)
- `src/pages/WorkboardPage.tsx:639` — `weather_locations.property_id` filter usage
  - In schema: `weather_locations.property` (text), **not** `property_id`.
  - Fix: query/filter using `property`.

- `src/pages/WorkboardPage.tsx:2444`
- `src/pages/WorkboardPage.tsx:3922`
  - Uses `request.notes` for `task_requests`.
  - In schema: `task_requests.description`, **not** `notes`.
  - Fix: read/write `description`.

- `src/lib/supabase-queries.ts:894` — `weather_locations` select includes `weather_stations(*)`
  - `weather_stations` is not documented in `live-db-state.md`.
  - Fix: either document `weather_stations` in schema doc or remove dependency from this query.

### WARN (table references not documented in live-db-state)
These tables are referenced in code but absent from current schema doc:
- `program_settings`
- `weather_stations`
- `employee_groups`
- `role_options`
- `language_options`
- `worker_types`
- `application_areas`
- `chemical_application_logs`
- `chemical_application_tank_mix_items`
- `work_orders`
- `work_locations`

If these are valid tables, `live-db-state.md` is stale/incomplete.

---

## STEP 5 — Route integrity (`src/App.tsx`)
Checked each route’s lazy import path and page presence signal via build.

### FAIL
- Route `/app/weather` broken due unresolved page import.
  - `src/App.tsx:30` lazy import missing target file.

### PASS
- Remaining top-level lazy imports in `App.tsx` are syntactically valid and did not raise resolution errors before weather import failure.

---

## STEP 6 — RLS-sensitive operations (`insert/update/delete/upsert`)
Scan run across `src/pages`.

### FAIL (missing org-scope guard on writes)
- `src/pages/WorkboardPage.tsx:2788`
  - `supabase.from('assignments').delete().eq('id', assignmentId)` missing `.eq('org_id', orgId)`.
  - Fix: add org scope guard to mutation filter.

- `src/pages/WorkboardPage.tsx:2825`
  - `task_requests` status update by `id` only; missing org scope.
  - Fix: add `.eq('org_id', orgId)`.

- `src/pages/SettingsPage.tsx:2653`
  - `shift_templates` delete by `id` only; missing org scope.
  - Fix: add `.eq('org_id', orgId)`.

### WARN (write handling consistency)
- Some writes have robust `error` + `toast` handling, but consistency is uneven across pages.
- Lint/build blocker prevented full end-to-end validation of every write path.

---

## STEP 7 — Stale state / orgId guards

### PASS
- Many `useQuery` calls are guarded with `enabled: Boolean(orgId)` or equivalent patterns in pages and shared query hooks.

### WARN (guard exceptions)
- `src/lib/supabase-queries.ts:1340` — `enabled: Boolean(startDate && endDate)` (no orgId in guard).
- `src/lib/supabase-queries.ts:1449` — `enabled: Boolean(date)` (no orgId in guard).
- `src/lib/supabase-queries.ts:1458` — `enabled: Boolean(startDate && endDate)` (no orgId in guard).

These may be intentional for globally scoped queries, but they violate the strict org-first guard pattern requested.

---

## STEP 8 — Final classification

## Critical FAIL items (runtime/build blockers)
1. `src/App.tsx:30` — unresolved `./pages/WeatherPage` lazy import (build fails).
2. Missing version commit `ver2.5.14.163`.
3. `src/pages/WorkboardPage.tsx:639` — `weather_locations.property_id` (schema mismatch).
4. `src/pages/WorkboardPage.tsx:2444` — `task_requests.notes` usage (schema mismatch; should be `description`).
5. `src/pages/WorkboardPage.tsx:3922` — `task_requests.notes` usage (schema mismatch; should be `description`).
6. `src/lib/supabase-queries.ts:894` — dependency on undocumented `weather_stations(*)` relation.
7. `src/pages/WorkboardPage.tsx:2788` — assignment delete mutation missing org scope filter.
8. `src/pages/SettingsPage.tsx:2653` — shift_templates delete mutation missing org scope filter.

## Non-critical WARN highlights
- Lint reports 74 warnings and 52 errors (many are code-quality/hook-rule issues rather than immediate runtime crashes).
- Schema documentation appears incomplete for several referenced tables.
- Some shared queries do not include orgId in `enabled` guards.

---

## Commands executed
- `git log --oneline | head -100`
- `npm run build`
- `npm run lint`
- route/import/query pattern scans via ripgrep


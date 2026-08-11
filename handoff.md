# Ground Crew HQ — Session Handoff

_Last updated: 2026-07-30 · current version: **v7.19.11** (source of truth: `package.json` → `__APP_VERSION__`, shown in the app footer)_

This is a handoff for a Claude/Codex reviewer picking up the project. Read `CLAUDE.md` and the memory index (`~/.claude/projects/C--Projects-ground-crew-hq/memory/MEMORY.md`) alongside this.

## Project
- **App:** SaaS for lawn/grounds crew management. Prod: https://ground-crew-hq.vercel.app
- **Stack:** Next.js 16 (App Router) + React 18 + TypeScript + Tailwind + Supabase + Vercel. NOT Vite (migrated off).
- **Code layout:** `app/` = thin Next shell (routes/layout); real app lives in `src/` (pages, components, lib). Only `app/globals.css` is loaded; `src/index.css` is dead.
- **Supabase project:** `fjqeekwisnbpxgebrnpl` · **Vercel project:** `prj_Y3NgqXZ0IgFj1JN9ViZWgitMRMNK` (team `team_A9f00zq9pBiz6dFy1qn8hTW8`).

## How work ships here
- **Type-check gate (important):** the root `tsconfig.json` has `"files": []`, so plain `tsc` and `next build`'s TS pass are hollow. The real gate is **`npm run typecheck`** (`tsconfig.typecheck.json`), and the **build script runs `next build && npm run typecheck`** — a type regression fails the Vercel deploy. Always keep `npm run typecheck` at 0.
- **Deploy:** push to `main` → Vercel auto-deploys prod. Bump the patch version on user-facing ships (footer is the deploy truth-check). Verify the deployment reaches `READY` on the pushed SHA.
- **DB changes:** snake_case columns; RLS on all tables; never modify `AuthContext.tsx` or route guards. Supabase MCP `apply_migration` for DDL.
- **Workflow preference (do this):** delegate substantial coding to **Codex** (`codex:rescue` skill / `codex:codex-rescue` agent) with tight self-contained briefs; keep the Claude session **lean** (ideation + Codex-driving + terse review). Still run the build/type gate and flag real bugs — briefly. User is token-conscious.

## Shipped this session (all live on prod)
- **v7.19.7** OKLCH theme engine migration + per-page property selection.
- **v7.19.8** Type-safety cleanup: 224 → 0 `tsc` errors + the honest type-check gate above (fixed 3 real runtime bugs).
- **PostGIS relocation** (DB): moved PostGIS + `spatial_ref_sys` `public` → `extensions`, clearing a CRITICAL Supabase finding. Acreage columns recreated extensions-qualified. Verified. Runbook: `docs/dev/postgis-relocation-runbook.md` (DONE).
- **Security Advisor** driven to an accepted floor: 0 CRITICAL/ERROR, 19 residual WARNs (by-design SECDEF funcs + Pro-gated leaked-password). Disabled unused `pg_graphql` (dashboard) to clear ~128 GraphQL warnings. Details: memory `project_supabase_advisor_baseline.md`.
- **v7.19.9** Per-project **area zones** on the properties map (draw/edit/clear a polygon per project; `projects.area_geojson`).
- **v7.19.10** Project **progress photos** — a "Progress photos" strip uploads directly to a project (null `timeline_event_id`); RLS verified to allow it.
- **v7.19.11** Properties **workspace Phase 1** (see below).

## Properties tab — Phase 1 (v7.19.11, just shipped)
Addressed user feedback that the tab was cramped/clumsy and the map "wandered."
- **Hard-mount fix** (`src/components/map/FitBounds.tsx`): the map used to re-fit on every React-Query refetch (new `properties` array each time). Now it fits once per selected-property change via a stable signature. No more wandering.
- **Spacious workspace** (`src/pages/PropertiesMapPage.tsx`, `PropertyDetailPanel.tsx`): removed the cramped `xl:pr-[38rem]` fixed side-panel overlay. When a property is selected: a compact **anchored map header** (~380px) on top, full-width inline detail + Gantt below.
- **Calendar Gantt** (`src/components/map/ProjectGantt.tsx`, new): per project, a planned bar (`start_date → target_end_date`) with **progress-submission markers** along it (label / date / submitter). Freeform model — the project **timeline events** ARE the "stage-completion / progress submissions."

### Phase 2 — deferred / open decisions (agreed direction, not yet built)
- **"Work submissions"** were defined by the user as freeform stage-completion progress entries = the existing timeline events. **Kept freeform for now.** A structured "defined stages" model (named phases per project, checked off) was deferred.
- **Planned vs actual dates:** projects only have planned dates (`start_date`/`target_end_date`). No `actual_start`/`actual_end` columns; actuals are currently just the submission markers. Adding real actual-date fields is deferred.
- Crew **dispatch/assignments are NOT linked to projects** (no `project_id` on assignments) — if the user ever wants real crew-work rollups per project (vs progress submissions), that needs a schema link.

## Key files (Properties tab)
- `src/pages/PropertiesMapPage.tsx` — orchestrator (property/project selection, 3 mutually-exclusive map edit modes: boundary / pin / area).
- `src/components/map/PropertyMap.tsx` — Leaflet map (boundary polygons, project pins, area polygons, Geoman editing).
- `src/components/map/PropertyDetailPanel.tsx` — inline project detail (timeline events, progress photos, area/pin controls).
- `src/components/map/ProjectGantt.tsx` — the new calendar Gantt.
- `src/lib/supabase-queries.ts` — data layer (projects, timeline events, photos, areas; the type gate lives against this).

## Task Work Order Funnel (design 2026-08-10; **P0 schema SHIPPED to DB 2026-08-11**)
A **client-originated to-do** that a supervisor vets and hands to an employee to complete.
Flow: **client → supervisor (review/accept) → employee (assigned via assignment) → completed.**
This is a **task** work order (service/property work), NOT equipment maintenance.

**Grounding / gotchas (IMPORTANT — corrected after schema inspection):**
- The existing **`work_orders` table is EQUIPMENT MAINTENANCE**, not generic tasks. Its full schema
  (hidden by the app's `RevenueWorkOrder` type) includes `equipment_unit_id`, `category` (default
  `'preventative'`), `interval_hours/days`, `due_at_hours/date`, `planned_status`. **Do NOT extend it**
  for the task funnel — that would re-conflate the concepts. `useRevenueWorkOrders` only surfaces a
  subset of it for job-costing rollups.
- The mock `src/components/equipment/WorkOrderKanban.tsx` is the same equipment concept, mock-only.
- Decision: the task funnel gets its **own `task_work_orders` table**. **Assign model = Plan B**:
  assigning creates an `assignments` row linked via the new `assignments.task_work_order_id` — so it
  rides the existing workboard + job-costing rollups. (`assignments` already carries `work_order_id`,
  `task_id`, `equipment_unit_id`; we added `task_work_order_id`.)
- `clients` already has a `client_token` column → a foundation for P4 client-facing links exists.

**Phases:**
- **P0 — Schema. ✅ DONE (migration `task_work_order_funnel_p0`, applied to prod 2026-08-11).**
  New table `public.task_work_orders`: `id, org_id, property_id (FK properties), client_id (FK clients),
  title, description, priority (default 'medium'), source (default 'internal'), funnel_stage
  (default 'new'), submitted_by, reviewed_by, accepted_at, rejected_reason, due_date, created_at,
  completed_at`. RLS **mirrors `work_orders`**: `select` = `org_id = current_org_id()`; `manage` (ALL)
  = org + `current_user_role() in ('admin','manager')`. Added `assignments.task_work_order_id`
  (uuid FK → task_work_orders, on delete set null). Security advisor: no new findings.
  `funnel_stage` is deliberately separate from any operational `status`. Stages:
  `new → in_review → accepted | rejected → assigned → completed`.
- **P1 — Data layer.** Types + queries/mutations in `src/lib/supabase-queries.ts`: create,
  review (accept/reject + reason), assign (creates an assignment with `task_work_order_id` + employee + date),
  advance/complete, list-by-`funnel_stage`. Generate TS types after.
- **P2 — Supervisor funnel UI.** A Work Orders inbox (lanes New → In Review → Accepted → Assigned →
  Completed; reject with reason). Use `Badge` status variants (active/pending/warning/complete/hold — Move 7).
- **P3 — Employee side.** Assignments carrying a `task_work_order_id` surface in the field/task view; employee marks complete.
- **P4 (later) — real client intake.** True client submission portal (leverage `clients.client_token`).
  v1 = supervisor enters client-originated WOs (`source='client'`, `client_id`). Defer the portal.

**Follow-up:** Command Center "Open Work Orders" tile (Move 4) currently counts the equipment
`work_orders` table. Once the funnel is live, decide whether that tile should count `task_work_orders`
instead (or both). Logged in POLISH-CLEANUP.md.

## Backlog — deferred features
- **Payroll / Timesheet Review (bi-weekly pay-period approval).** Need: one screen to review, PER EMPLOYEE across a pay period, their tasks (assignments + hours), breaks (clock_events), and total logged time, so a supervisor can verify/correct and APPROVE before running payroll. Building blocks already exist: `assignments.approved_by`/`approved_at` (row-level approval audit), the day-level `OpenTaskDayReviewPanel`, and `clock_events` (clock in/out + breaks). Gap: review today is per-DAY, not aggregated per pay-period. Likely home: extend `ReportsPage` or a new `/app/payroll` (or timesheet) view. Shelved 2026-08-11 to finish the work-order funnel first.

## Immediate next steps (suggested)
1. Eyeball the live Properties workspace (v7.19.11) — layout, the Gantt, no regressions.
2. Decide Phase 2 scope: structured stages? real actual-date fields? crew-work-per-project link?
3. Anything else the user raises — brief it to Codex, keep Claude lean.

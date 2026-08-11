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

## Task Work Order Funnel — plan (agreed direction 2026-08-10, not yet built)
A **client-originated to-do** that a supervisor vets and hands to an employee to complete.
Flow: **client → supervisor (review/accept) → employee (assigned task) → completed.**
This is a **task** work order (service/property work), NOT equipment maintenance.

**Grounding / gotchas:**
- Build on the **real `work_orders` table** (`useRevenueWorkOrders`, `fetchRevenueWorkOrders`,
  cols today: `id, org_id, property_id, title, status, priority, cost, created_at, completed_at, wo_number`).
- Do NOT extend `src/components/equipment/WorkOrderKanban.tsx` — that is **mock-only**
  (seeds from `seedWorkOrders`, `useState`, no persistence) and is equipment-oriented. Separate concept.
- Command Center's current "openWorkOrders" = `notes.filter(type==='alert')` — unrelated; being replaced (Move 4 tile).

**Phases:**
- **P0 — Schema.** Extend `work_orders` (snake_case, RLS mirroring existing policies): add
  `description`, `client_id` (FK clients, null), `source` ('client'|'internal', default 'internal'),
  `assignee_id` (FK employees, null), `reviewed_by` (null), `accepted_at` (null), `rejected_reason` (null),
  `due_date` (null). Define/confirm `status` enum: `new → in_review → accepted | rejected → assigned → in_progress → completed`.
- **P1 — Data layer.** Mutations: create, review (accept/reject + reason), assign (employee + due_date), advance status; list-by-status query.
- **P2 — Supervisor funnel UI.** A Work Orders inbox (lanes New → In Review → Accepted/Assigned → In Progress → Completed), accept/reject/assign actions. Reuse `StatusChip` + status tokens.
- **P3 — Employee side.** Assigned WOs surface in field/task view; employee marks complete.
- **P4 (later) — real client intake.** True client submission needs client auth/portal (does not exist today).
  v1 = supervisor enters client-originated WOs (`source='client'`, `client_id`). Defer the portal.

**Open integration choice (decide before P1):** on assign, does the WO stay **self-contained**
(`assignee_id` + `due_date` on the row, surfaced via a new employee query — simplest, recommended v1),
or does it **spawn a `tasks`/`assignments` row** so it rides the existing workboard/scheduler? Recommend self-contained for v1, link to assignments later.

## Immediate next steps (suggested)
1. Eyeball the live Properties workspace (v7.19.11) — layout, the Gantt, no regressions.
2. Decide Phase 2 scope: structured stages? real actual-date fields? crew-work-per-project link?
3. Anything else the user raises — brief it to Codex, keep Claude lean.

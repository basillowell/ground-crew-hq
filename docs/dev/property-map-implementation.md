# Property Map — Implementation Plan

> Status: **PLAN / AWAITING REVIEW** — nothing implemented, no migrations applied.
> Author: Claude Code · Date: 2026-07-23
> Scope: visual Properties page with an interactive map, freeform polygon boundary
> per property, multiple projects per property each with its own timeline.
>
> Out of scope this pass (deliberate): Google Drive invoice linking (needs its own
> OAuth/verification design) and the property-appraiser / taxable-assets export view.

---

## 0. Open decisions (resolve before Phase 1 starts)

**D1 — Boundary storage shape.** Hybrid `jsonb` + generated geometry (recommended)
vs. pure `geometry(Polygon,4326)` + RPC layer. See §1. This determines the entire
client data layer, so it blocks everything else.

**D2 — Package approval.** `@geoman-io/leaflet-geoman-free` (dependency) and
`@types/leaflet` (devDependency). CLAUDE.md forbids installing packages without
asking. See Phase 2.

**D3 — Tile provider.** Stadia Maps (recommended) vs MapTiler. See Phase 4.
Needed before Phase 1 renders anything, but trivially swappable.

---

## 1. The defining architectural constraint

**PostgREST cannot read or write a raw `geometry(Polygon,4326)` column in a usable
form from the browser client.** The standard table endpoint returns geometry as WKB
hex, and there is no clean way to insert/update a polygon from `supabase-js` without
an RPC or an explicit cast. Native PostGIS geometry is still the right call for
indexing and `ST_Area`, but it collides with **Rule 5 (two queries, never nested
select)** and this app's established "plain PostgREST from the browser client"
pattern.

### Recommended: hybrid column

| Column | Role |
|---|---|
| `boundary_geojson jsonb NULL` | The **read/write surface** the client touches via normal PostgREST (`.select`, `.update`). The draw tool serializes Geoman's GeoJSON geometry straight into it. |
| `boundary geometry(Polygon,4326)` — DB-generated from `boundary_geojson` | DB-maintained, GIST-indexed, **never touched by the client**. Exists for spatial indexing and area math. |
| `calculated_acreage numeric` — DB-generated, area of `boundary_geojson` cast to geography, converted to acres | Auto cross-check against the existing manual `acreage` field. |

Why this shape: the browser client stays on plain PostgREST (no RPC layer, Rule 5
satisfied, matches every other query in `src/lib/supabase-queries.ts`), while the
database still gets indexable geometry and automatic acreage.

**Risk:** the PostGIS expressions may not qualify as `IMMUTABLE`, which a generated
column requires. If the migration rejects them, the fallback is a `BEFORE
INSERT/UPDATE` trigger computing the same two values. Both are database objects and
are **Basil's to apply, not the agent's** (Rule 1).

### Alternative: pure geometry + RPC

If D1 resolves toward the originally-specified `geometry(Polygon,4326)` only, the
plan still holds, but Phase 0 must additionally define two `SECURITY DEFINER`
functions — one returning boundaries as GeoJSON, one accepting a GeoJSON polygon for
a given property — and the client reads/writes move from `.select`/`.update` to
`.rpc()`. Deltas are noted inline in Phases 1–2.

---

## 2. Hard constraints this plan is built around

| Constraint | Source | Consequence |
|---|---|---|
| Agents never write SQL / migrations / RLS | Rule 1, Hard Boundary | Phase 0 is a `DB_CHANGE_REQUIRED` **spec**. Agent work begins only after columns exist and `live-db-state.md` is regenerated. |
| Never install npm packages without asking | CLAUDE.md | Geoman + leaflet types need explicit approval (D2). |
| Two queries, never nested select | Rule 5 | `projects`→`properties` and `project_timeline_events`→`projects` are stitched in TypeScript, never PostgREST embeds. |
| No sentinel values into uuid columns | Rule 14 | `currentPropertyId` defaults to the string `'all'`; must be branched on and converted before reaching any uuid column. |
| Bounded timeout on every Supabase queryFn | Rule 22 | Every new hook wraps the call in `Promise.race` against a 10–15s timeout. |
| Never blank, never infinite | Rule 6 | Every data section: skeleton → error + working Retry → content. Skeletons gate on genuine first-load only, never on background `isFetching`. |
| Column names come from `live-db-state.md` | Rule 10 | No query may reference the new columns until the doc is regenerated post-migration. |
| Admin/manager RLS scopes to org | Rule 17 | New policies gate on org membership + the existing property helpers — never the admin's own `employee.property_id`. |
| Product UI never renders DB/agent vocabulary | Rule 8 | User-facing copy says "boundary", "acreage", "projects". Never "RLS", "PostGIS", "migration". |
| SSR-guard all browser APIs | CLAUDE.md (Vite→Next lessons) | Leaflet is client-only. Lazy `useState` initializers still run during server render. |
| Build before commit | Rule 9 | `npm run build` must pass — `tsc --noEmit` is not sufficient. |
| One concern per pass | Rule 12 | Each phase below is a separate session/commit. |

---

## 3. Phase 0 — Schema (`DB_CHANGE_REQUIRED`, Basil applies)

Per Rule 1 this is a **specification, not executable SQL**. Basil authors and applies
the migration; the agent's job ends at this spec.

```
DB_CHANGE_REQUIRED: Property Map feature — PostGIS boundaries + projects + timeline

(1) EXTENSION
    Enable the PostGIS extension (Supabase-native).

(2) TABLE properties — ADD COLUMNS
    boundary_geojson    jsonb    nullable, no default
        Client-writable GeoJSON Polygon geometry object. NULL = boundary not
        drawn yet (expected for every existing row).
    boundary            geometry(Polygon,4326)  nullable, DB-generated
        Derived from boundary_geojson. Never written by application code.
    calculated_acreage  numeric  nullable, DB-generated
        Area of boundary_geojson cast to geography, converted to acres
        (divide square metres by 4046.8564224). Cross-check only — does NOT
        replace or overwrite the existing manual `acreage` column.
    If the generated-column expressions are rejected as non-IMMUTABLE, implement
    boundary + calculated_acreage via a BEFORE INSERT/UPDATE trigger instead.

    INDEX: GIST index on boundary.

    NOTE: no new colour column. Polygon fill/stroke reuses the existing
    properties.color field, which already drives per-property tinting elsewhere.

    RLS: unchanged. properties already uses org_id membership for INSERT and
    can_manage_property(id) for SELECT/UPDATE/DELETE. Adding columns does not
    require new policies — confirm the existing UPDATE policy permits writing
    boundary_geojson.

(3) NEW TABLE projects
    id              uuid         NOT NULL  default gen_random_uuid()  (PK)
    org_id          uuid         NOT NULL
    property_id     uuid         NOT NULL  (FK -> properties.id)
    name            text         NOT NULL
    status          text         NOT NULL  default 'active'
    description     text         nullable
    start_date      date         nullable
    target_end_date date         nullable
    color           text         nullable   (optional per-project tint)
    created_at      timestamptz  NOT NULL  default now()

    property_id is NOT NULL: a project always belongs to exactly one property.
    This is a required parent FK, NOT a hierarchical drill-down scope column —
    Rule 18's nullable-scope guidance does not apply here.

(4) NEW TABLE project_timeline_events
    id           uuid         NOT NULL  default gen_random_uuid()  (PK)
    org_id       uuid         NOT NULL
    project_id   uuid         NOT NULL  (FK -> projects.id)
    property_id  uuid         NOT NULL  (denormalised for RLS gating)
    event_type   text         NOT NULL
    title        text         NOT NULL
    body         text         nullable
    event_date   date         NOT NULL
    created_by   uuid         nullable
    created_at   timestamptz  NOT NULL  default now()

(5) RLS on both new tables — mirror the existing properties/notes precedent
    INSERT:          org_id membership check + role in (admin, manager)
    SELECT:          gate through can_read_property(property_id)
    UPDATE/DELETE:   gate through can_manage_property(property_id)

    Rule 17: the org/role check must test org_id membership only — never the
    acting admin's own employee.property_id.
    Confirm can_read_property / can_manage_property are SECURITY DEFINER
    (they are, per the notes and equipment_units precedent) so the policies do
    not trigger per-row recursive subqueries.

(6) INDEXES on both new tables
    org_id and property_id (both are referenced by the RLS policies —
    unindexed RLS-referenced columns are the single biggest RLS performance
    problem per current Supabase guidance). Plus project_id on
    project_timeline_events.

WHY: the Properties map page needs (a) an indexable polygon boundary per property
with server-computed acreage as a cross-check against the manual acreage field,
and (b) multiple projects per property, each with its own timeline of events.
No such columns or tables exist today.
```

**After apply:** regenerate `docs/dev/live-db-state.md` from `information_schema`.
No agent may write a query touching these columns until that doc lists them
(Rule 10).

---

## 4. Phase 1 — Map shell (read-only)

Goal: a map centred/fit to the org's properties, wired to the shared
`currentPropertyId` singleton. No drawing yet. Independently shippable.

| File | Action |
|---|---|
| `src/pages/PropertiesMapPage.tsx` | **New.** `'use client'`. Page shell: reuse the existing `src/components/shared/PropertySelector.tsx` (it already drives the singleton), skeleton / error + Retry per Rule 6, and the dynamically-imported map. |
| `src/components/map/PropertyMap.tsx` | **New.** The `<MapContainer>` itself. Imported **only** via `next/dynamic` with `ssr: false` — never statically. Renders `<TileLayer>` plus one `<Polygon>` per property that has a boundary, filled with that property's `color`. |
| `src/components/map/FitBounds.tsx` | **New.** Child of `MapContainer` using `useMap()` + `map.fitBounds()`. Compute bounds from the GeoJSON coordinate arrays, **not** from layer refs — `getBounds()` only returns a usable result after a layer has mounted on the map. |
| `src/lib/supabase-queries.ts` | **Edit.** Add `usePropertyBoundaries(orgId)`. Mirror the existing `useProperties` shape: `.eq('org_id', orgId)`, `Promise.race` 10–15s timeout (Rule 22), retry tuned per failure kind (transient gets 1–2 retries; RLS denial gets none). |
| Router + sidebar nav | **Edit** wherever other pages register. Role-gate to admin/manager (Supervisor view). No new route guards (CLAUDE.md). |
| `app/globals.css` | **Edit** — the only loaded stylesheet. Leaflet's CSS goes here. Do **not** touch `src/index.css` (dead Vite-era leftover). |

### Selection wiring — single source of truth

Clicking a polygon calls `setCurrentPropertyId(property.id)` from `useOrgProfile()`;
the dropdown already does the same. Both drive the identical `useSyncExternalStore`
snapshot in `src/hooks/useOrgProfile.ts`. **No local selection state** — that is the
whole point, so the map plugs into existing app behaviour (Workboard, Equipment,
etc.) rather than creating a second source of truth.

When `currentPropertyId === 'all'`, fit to all polygons; otherwise fit to and
emphasise the selected one. **Rule 14:** `'all'` must never reach a uuid column —
branch on it explicitly before any `.eq('id', …)` or insert payload.

### SSR notes

react-leaflet touches `window` at module load. Marking the component `'use client'`
is **not sufficient** — the `MapContainer` subtree must sit behind
`dynamic(..., { ssr: false })`. Per this repo's own migration lessons, lazy
`useState` initializers still execute during server render, so keep every Leaflet
reference inside effects or dynamically-imported children.

Leaflet's default marker icon paths break under bundlers. Prefer GeoJSON/polygon
rendering over default markers; if markers are needed later, apply the standard
icon-path fix.

---

## 5. Phase 2 — Boundary drawing tool

**Blocked on D2 (package approval).**

- `@geoman-io/leaflet-geoman-free` — the actively maintained drawing/editing plugin.
  Leaflet.draw is unmaintained since 2018 and must not be used.
- `@types/leaflet` (dev) — not currently installed.
- **`react-leaflet-geoman-v2` is probably unnecessary.** Geoman's own Next.js guide
  wires the plugin via `createControlComponent` from `@react-leaflet/core`, which is
  already a transitive dependency of react-leaflet 4.2.1. A ~30-line local control
  component avoids a third-party wrapper whose react-leaflet-v4 compatibility is an
  additional version-matching risk. **Recommendation: skip the wrapper package.**

| File | Action |
|---|---|
| `src/components/map/GeomanControl.tsx` | **New.** `createControlComponent` wrapping `map.pm.addControls()` — polygon draw / edit / drag / remove. On `pm:create`, `pm:update`, `pm:remove`, serialize `layer.toGeoJSON().geometry` and hand it upward. |
| `src/components/map/PropertyMap.tsx` | **Edit.** Mount `GeomanControl` only in an explicit "edit boundary" mode, gated to admin/manager. |
| `src/lib/supabase-queries.ts` | **Edit.** `useSavePropertyBoundary` mutation → `.update({ boundary_geojson }).eq('id', propertyId).eq('org_id', orgId)`. *(Pure-geometry alternative: this becomes `.rpc(...)`.)* Invalidate the boundaries query on success so the DB-computed `calculated_acreage` refetches. |
| `src/pages/PropertiesMapPage.tsx` | **Edit.** Display `calculated_acreage` beside the manual `acreage` as a cross-check, e.g. "drawn 4.2 ac / on file 4.0 ac". Never auto-overwrite the manual value. |

Saving a boundary is an update, not an insert, so Rule 13 (duplicate-submit
protection on property inserts) does not strictly apply — but the save action should
still disable while in flight to prevent racing writes.

---

## 6. Phase 3 — Projects + timeline CRUD

| File | Action |
|---|---|
| `src/components/map/PropertyDetailPanel.tsx` | **New.** Slide-over panel for the selected property: its projects list and each project's timeline. |
| `src/components/map/ProjectFormDialog.tsx` | **New.** Create/edit a project. Duplicate-submit protection on save (Rule 13 pattern). `property_id` from `currentPropertyId` — guard `'all'` per Rule 14. `org_id` from `useOrgProfile()`, never hardcoded (Rule 2). Reset all state via a single `handleClose()`. |
| `src/components/map/TimelineEventForm.tsx` | **New.** Add timeline events to a project. |
| `src/lib/supabase-queries.ts` | **Edit.** `useProjects(propertyId, orgId)`, `useTimelineEvents(projectId, orgId)`, plus create/update mutations. **Rule 5:** fetch related rows separately and stitch in TypeScript — no PostgREST embeds. All queries `.eq('org_id', orgId)` with a bounded timeout. |

---

## 7. Phase 4 — Tile provider

Raw `tile.openstreetmap.org` is **not licensed for commercial SaaS** — its policy
explicitly prohibits revenue-generating use without written permission. A licensed
commercial provider is required.

- Add a provider API key as an env var in Vercel — **not** committed to the repo.
- **Recommendation: Stadia Maps.** Pricing compares favourably to MapTiler, and
  their **domain-based authentication** is the cleaner fit for a client-rendered
  app: the key never ships in the JS bundle, auth is scoped to the production
  domain, and localhost works keyless during development. MapTiler is a fine
  fallback and publishes an equivalent Next.js + Leaflet guide.
- `TileLayer` needs both `url` and the provider's required `attribution`.
- Confirm the commercial tier (~$25/mo) is active before production launch.

---

## 8. Risks, ranked

1. **Geometry read/write vs Rule 5 / plain PostgREST** — the defining risk (§1).
   Resolved by the hybrid shape; blocks everything until D1 is decided.
2. **Generated-column immutability** — `ST_Area(...::geography)` may not qualify as
   `IMMUTABLE`. Trigger fallback is specified. Database-side, so it cannot be worked
   around in application code.
3. **`react-leaflet-geoman-v2` compatibility** — avoided entirely by writing a local
   `GeomanControl` on `@react-leaflet/core`, which is already present.
4. **SSR `window` access at import time** — requires `dynamic({ ssr: false })`, not
   merely `'use client'`.
5. **`currentPropertyId === 'all'` sentinel** (Rule 14) — every project/timeline
   insert and every boundary update must guard it before touching a uuid column.
6. **Leaflet CSS and marker assets under Next** — CSS must load through
   `app/globals.css`; default marker icon paths break under bundlers.
7. **RLS assumptions** — the spec states the NULL/role semantics explicitly rather
   than assuming the existing property helpers "just work" for new tables (Rule 18's
   underlying lesson, even though `property_id` is NOT NULL here).
8. **Rule 8 vocabulary leak** — keep PostGIS/RLS/migration language out of every
   user-facing string.

---

## 9. Sequencing

```
Phase 0  Basil applies schema
   ↓     regenerate docs/dev/live-db-state.md   (gate: Rule 10)
Phase 1  Map shell, read-only  — provable in browser preview
Phase 4  Tile provider          — small, unblocks Phase 1 visuals
Phase 2  Boundary drawing       — gated on D2 package approval
Phase 3  Projects + timeline CRUD
```

Each phase is one feature area (Rule 12), independently buildable, and must pass
`npm run build` before commit (Rule 9). Commit and push in the same session once
build and verification pass (Rule 20).

---

## 10. Reference reading

- [Geoman + Next.js getting started](https://geoman.io/blog/using-geoman-with-next)
- [React Leaflet on Next.js App Router](https://xxlsteve.net/blog/react-leaflet-on-next-15/)
- [Making react-leaflet work with Next.js](https://placekit.io/blog/articles/making-react-leaflet-work-with-nextjs-493i)
- [React Leaflet — view bounds example](https://react-leaflet.js.org/docs/example-view-bounds/)
- [High-performance Leaflet map visualisations in React](https://andrejgajdos.com/leaflet-developer-guide-to-high-performance-map-visualizations-in-react/)
- [Supabase — RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase RLS production patterns](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Stadia Maps — React Leaflet quickstart](https://docs.stadiamaps.com/tutorials/getting-started-with-react-leaflet/) ·
  [authentication](https://docs.stadiamaps.com/authentication/) ·
  [pricing](https://stadiamaps.com/pricing/)
- [MapTiler — Leaflet with Next.js](https://docs.maptiler.com/leaflet/examples/nextjs/)

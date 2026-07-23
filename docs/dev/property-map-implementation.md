# Property Map — As-Built Record

> Status: **SHIPPED**. All four phases are live on `main`.
> Last updated: 2026-07-23
>
> Shipped in: `6cdcff1` (map shell) · `e4099d2` (boundary editing) · `a36227c`
> (projects + timeline panel) · `e8fb76b` (schema sync) · `2ea6dbf` + `7b2e92f`
> (post-ship icon-shadowing fix)
>
> **Schema authority is `docs/dev/live-db-state.md`, not this file** (Rule 10).
> The schema notes below are context for *why* the shape is what it is; always
> confirm column names against live-db-state before writing a query.
>
> Still deferred, not built: Google Drive invoice linking (needs its own
> OAuth/verification design) and the property-appraiser / taxable-assets export.

---

## 1. Decisions — all resolved

### D1. Boundary storage → **hybrid jsonb + generated geometry** ✅

The concern that drove this: PostgREST cannot read or write a raw
`geometry(Polygon,4326)` column in a usable form from the browser client. It
returns geometry as WKB hex, and there is no clean way to write a polygon from
`supabase-js` without an RPC — which would have collided with **Rule 5** and with
the app's established "plain PostgREST from the browser" pattern.

Shipped shape on `properties`:

| Column | Type | Role |
|---|---|---|
| `boundary_geojson` | `jsonb` nullable | **The only column application code touches.** Read and written via ordinary PostgREST. NULL = boundary not drawn yet. |
| `boundary` | `geometry(Polygon,4326)` nullable | `GENERATED ALWAYS ... STORED` from `boundary_geojson` via `ST_GeomFromGeoJSON`. DB-maintained, read-only to the client. GIST index `properties_boundary_gist_idx`. |
| `calculated_acreage` | `numeric` nullable | `GENERATED ALWAYS ... STORED` via `ST_Area`, in acres. A **cross-check** against the manual `acreage` field — it never overwrites it. |

**The flagged immutability risk did not materialize.** The plan warned that
`ST_GeomFromGeoJSON` / `ST_Area(...::geography)` might not qualify as `IMMUTABLE`
inside a `GENERATED` column, with a trigger as fallback. The generated columns were
accepted as-is; no trigger was needed.

Client surface, as built: `src/lib/supabase-queries.ts:1354` writes
`.update({ boundary_geojson: ... })` — plain PostgREST, no RPC layer anywhere.
Reads select `boundary_geojson, calculated_acreage` (`:1284`).

**Never write to `boundary` or `calculated_acreage` from application code.** They are
generated; writes will be rejected.

### D2. Drawing plugin → **Geoman, no React wrapper** ✅

Installed: `@geoman-io/leaflet-geoman-free ^2.20.0`, `@types/leaflet ^1.9.21`.

`react-leaflet-geoman-v2` was **deliberately not used**. The control is a local
component (`src/components/map/GeomanControl.tsx`) built on `createControlComponent`
from `@react-leaflet/core`, which is already a transitive dependency of react-leaflet
4.2.1. This avoided taking on a third-party wrapper whose react-leaflet v4
compatibility would have been an extra version-matching risk.

Leaflet.draw was correctly ruled out — unmaintained since 2018.

### D3. Tile provider → **USGS The National Map imagery** ✅ (neither option planned)

The plan recommended Stadia Maps with MapTiler as fallback. **Neither was used.**

Shipped: `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}`,
attribution `USGS The National Map`, `maxZoom={19}` (`PropertyMap.tsx:21-22, 84-88`).

This is a better fit than what was planned, for reasons the plan missed:

- **Public domain.** US federal government imagery — no commercial licensing problem,
  which was the entire reason `tile.openstreetmap.org` was ruled out.
- **No API key, no env var, no monthly cost.** Sidesteps the key-exposure question
  that made Stadia's domain-auth attractive in the first place.
- **Aerial imagery, not a street basemap.** For tracing a lawn/grounds boundary you
  need to see the actual turf, tree lines, and cart paths. A street map would have
  been close to useless for the core task.

**Tradeoff to remember: US coverage only.** If the product ever serves properties
outside the US, this provider stops working and D3 reopens — Stadia/MapTiler remain
the fallback analysis. Also worth knowing there is no contractual uptime guarantee on
a free government service.

---

## 2. As-built structure

### Schema (see `live-db-state.md` for authoritative columns)

- `properties` — gained `boundary_geojson`, `boundary`, `calculated_acreage`.
  Existing `color` is reused for polygon tint; no new colour column was added.
- `projects` — `property_id` is `NOT NULL` (a project always belongs to exactly one
  property; this is a required parent FK, *not* a hierarchical scope column, so
  Rule 18's nullable-scope guidance does not apply).
- `project_timeline_events` — carries `property_id` denormalised alongside
  `project_id`, so RLS can gate without joining through `projects` on every row check.

**Shipped RLS is stricter than specified.** The plan called for INSERT = org
membership + admin/manager role. What shipped additionally requires
`can_manage_property(property_id)` on INSERT for both new tables. That is the better
policy — it prevents a manager in the right org from inserting against a property
they cannot manage. SELECT gates on `can_read_property(property_id)`;
UPDATE/DELETE on `can_manage_property(property_id)`.

### Files

| Path | Role |
|---|---|
| `src/pages/PropertiesMapPage.tsx` | Page shell, edit-mode toggle, save flow, acreage cross-check display |
| `src/components/map/PropertyMap.tsx` | `MapContainer`, `TileLayer`, per-property `Polygon`. Loaded **only** via `dynamic(..., { ssr: false })` |
| `src/components/map/FitBounds.tsx` | `useMap()` + `fitBounds`, computed from GeoJSON coordinate arrays |
| `src/components/map/GeomanControl.tsx` | Draw/edit control via `createControlComponent` |
| `src/components/map/PropertyDetailPanel.tsx` | Selected property: projects + timeline |
| `src/components/map/ProjectFormDialog.tsx` | Project create/edit |
| `src/components/map/TimelineEventForm.tsx` | Timeline event entry |
| `src/lib/supabase-queries.ts` | `usePropertyBoundaries`, `useProjects`, `useTimelineEvents`, save mutations |

### Selection model

Polygon click and the property dropdown both call `setCurrentPropertyId` from
`useOrgProfile()` — the same `useSyncExternalStore` singleton used by Workboard,
Equipment, and the rest of the app. There is deliberately **no local selection
state**, so the map participates in existing app behaviour instead of creating a
second source of truth.

`currentPropertyId` defaults to the string `'all'`. **Rule 14: never let it reach a
uuid column** — branch on it explicitly before any insert payload or `.eq('id', …)`.

---

## 3. What actually bit us

Recorded because it cost real debugging time and the first diagnosis was wrong.

**The lucide-react icon shadowing bug** (fixed in `2ea6dbf`, `7b2e92f`). Adding the
Properties nav entry in `6cdcff1` introduced `import { Map } from 'lucide-react'` into
`AppLayout.tsx`. That binding **shadowed the global `Map` constructor for the entire
module**, so the unrelated notification-dedup `new Map(...)` at `AppLayout.tsx:308`
began constructing a React icon component — crashing every `/app` page with
`v.Map is not a constructor`.

The initial diagnosis blamed Turbopack chunk scope-hoisting colliding with Leaflet's
`.Map` export. That was wrong, and the wrong fix (`globalThis.Map`) would have masked
the shadow rather than removing it. What disproved it:

- The chunk containing the broken call carried **no Leaflet code at all** (Leaflet was
  isolated in 1 of 62 chunks).
- **32 bare `new Map()` sites** exist across the codebase; only this one broke —
  because only this module bound a `Map` identifier.
- Tracing the minified `v = e.i(73526)` showed an ordinary module import, not a
  hoisted namespace.

Fix was to alias the icon (`Map as MapIcon`) in all four files importing it bare,
removing the shadow instead of dodging it. `Menu` and `History` were aliased too.

**The rule for next time:** lucide-react exports many icons named after JS/DOM globals
— `Map`, `Set`, `Image`, `Text`, `Link`, `Menu`, `Command`, `History`, `Layers`. If an
`X is not a constructor` error appears, **check the file's import list first**. It is
far more often icon shadowing than a bundler bug. A repo sweep against a globals list
currently reports zero shadows; re-run it after adding icons.

### Risks that did not materialize

- Generated-column immutability (D1) — accepted as written, no trigger needed.
- `react-leaflet-geoman-v2` compatibility — avoided entirely by not using it.
- Leaflet marker-asset breakage under Next — sidestepped; rendering is polygon-only,
  no default markers.

### Risks that held and still apply

- **SSR:** react-leaflet touches `window` at module load. `dynamic({ ssr: false })` is
  required; `'use client'` alone is not sufficient.
- **Rule 5:** projects/properties and timeline/projects are stitched in TypeScript,
  never via PostgREST embeds.
- **Rule 8:** no PostGIS/RLS/migration vocabulary in user-facing copy.

---

## 4. Reference reading

- [Geoman + Next.js](https://geoman.io/blog/using-geoman-with-next)
- [React Leaflet on Next.js App Router](https://xxlsteve.net/blog/react-leaflet-on-next-15/)
- [React Leaflet — view bounds](https://react-leaflet.js.org/docs/example-view-bounds/)
- [Supabase — RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [USGS The National Map services](https://basemap.nationalmap.gov/arcgis/rest/services)
- Fallback commercial providers if coverage ever needs to leave the US:
  [Stadia Maps](https://docs.stadiamaps.com/tutorials/getting-started-with-react-leaflet/) ·
  [MapTiler](https://docs.maptiler.com/leaflet/examples/nextjs/)

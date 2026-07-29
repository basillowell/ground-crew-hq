# PostGIS Relocation Runbook — move PostGIS out of `public`

> Status: **READY TO EXECUTE** (not yet started as of 2026-07-28, HEAD `0165d29`).
> Purpose: resolve the CRITICAL `rls_disabled_in_public` finding on
> `public.spatial_ref_sys` by moving PostGIS to the `extensions` schema, so the
> table is no longer exposed via PostgREST. Keeps PostGIS and the acreage
> measuring tool intact.

---

## Why (verified facts, don't re-litigate)

- `spatial_ref_sys` is owned by **`supabase_admin`**. The `postgres` role (both the
  MCP connection and the dashboard SQL editor) is **not** the owner and **not** a
  superuser.
- Therefore, **every SQL remediation fails**: `ALTER TABLE ... ENABLE RLS` errors
  `42501: must be owner`; `REVOKE ... FROM anon, authenticated` returns "success"
  but is a **silent no-op** (you can't revoke a grant made by `supabase_admin`).
  Both were confirmed, including via Supabase's own dashboard AI (which falsely
  reported success — re-check proved anon still had full CRUD).
- The finding fires because the table is in the **`public`** schema (PostgREST-
  exposed). Move PostGIS to `extensions` (NOT PostgREST-exposed) → finding gone.
- **Customer data was never at risk** — every business table has RLS; only this
  PostGIS reference table is affected. This is integrity hygiene, not a breach.

## Key simplification

The acreage columns compute **directly from the jsonb** — they do NOT depend on
the geometry columns:
```
calculated_acreage = st_area(st_geomfromgeojson(boundary_geojson::text)::geography)/4046.8564224
```
And the app reads **only** `boundary_geojson`/`*_geojson` (jsonb) and
`calculated_acreage`/`calculated_area_acres`. It never reads the `boundary` /
`location` / `area` geometry columns or the GIST indexes. **So we drop all 5
generated columns + 3 indexes, but only recreate the 2 acreage columns.** The
geometry columns and GIST indexes are unused — don't bother recreating them
(recreate later only if server-side spatial queries are ever added).

**Zero data loss:** the drawn shapes live in `boundary_geojson` / `location_geojson`
/ `area_geojson` (jsonb), which are NEVER touched by any step below.

---

## Step 1 — Claude (SQL via MCP): drop the PostGIS-dependent columns + indexes

```sql
DROP INDEX IF EXISTS public.properties_boundary_gist_idx;
DROP INDEX IF EXISTS public.projects_location_gist_idx;
DROP INDEX IF EXISTS public.projects_area_gist_idx;

ALTER TABLE public.properties
  DROP COLUMN IF EXISTS boundary,
  DROP COLUMN IF EXISTS calculated_acreage;

ALTER TABLE public.projects
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS area,
  DROP COLUMN IF EXISTS calculated_area_acres;
```
After this, nothing in the DB depends on PostGIS, so the extension can be moved.
The map still renders (it reads `boundary_geojson`); only the "drawn X ac" number
is blank until Step 3.

## Step 2 — OWNER (Supabase dashboard, NOT the SQL editor): move PostGIS

The dashboard Extensions UI runs with platform privilege the SQL editor lacks.

1. Dashboard → **Database → Extensions** → search **postgis**.
2. **Disable** PostGIS. (It should succeed now that Step 1 removed all dependents.
   If it complains about dependents, something else references PostGIS — stop and
   re-scan before continuing.)
3. **Enable** PostGIS again, and when prompted for the schema, choose
   **`extensions`** (the schema already exists).

**Caveat / fallback:** if the UI does NOT let you choose the schema (re-installs
into `public` by default), the relocation can't succeed this way — re-enable in
`public`, then run Step 3 with the UNQUALIFIED expressions (the originals below),
which puts you back exactly where you started with zero data loss. Then fall back
to the Supabase support ticket route.

## Step 3 — Claude (SQL via MCP): recreate the 2 acreage columns, schema-qualified

Use this when PostGIS is in **`extensions`**:
```sql
ALTER TABLE public.properties
  ADD COLUMN calculated_acreage numeric GENERATED ALWAYS AS (
    CASE WHEN boundary_geojson IS NOT NULL
      THEN extensions.st_area((extensions.st_geomfromgeojson(boundary_geojson::text))::extensions.geography) / 4046.8564224::double precision
      ELSE NULL::double precision
    END
  ) STORED;

ALTER TABLE public.projects
  ADD COLUMN calculated_area_acres numeric GENERATED ALWAYS AS (
    CASE WHEN area_geojson IS NOT NULL
      THEN extensions.st_area((extensions.st_geomfromgeojson(area_geojson::text))::extensions.geography) / 4046.8564224::double precision
      ELSE NULL::double precision
    END
  ) STORED;
```

**Original (UNQUALIFIED) expressions** — only for the fallback where PostGIS ended
up back in `public`:
```sql
-- properties.calculated_acreage
CASE WHEN boundary_geojson IS NOT NULL
  THEN st_area((st_geomfromgeojson(boundary_geojson::text))::geography) / 4046.8564224::double precision
  ELSE NULL::double precision END
-- projects.calculated_area_acres  (same, with area_geojson)
```

## Step 4 — Verify

```sql
-- 1. Finding resolved: spatial_ref_sys no longer in the public schema
select count(*) as should_be_zero
from pg_tables where schemaname='public' and tablename='spatial_ref_sys';

-- 2. Acreage recomputes correctly for existing drawn boundaries
select name, round(calculated_acreage::numeric,2) as drawn_ac, acreage as on_file
from properties where boundary_geojson is not null order by name;
```
Then re-run the Security Advisor — the `rls_disabled_in_public` CRITICAL should be
gone. Also confirm saving a boundary in the app still populates the acreage
(that exercises `extensions.st_area` under the authenticated role).

## Live-db-state sync

After success, update `docs/dev/live-db-state.md`: PostGIS now in `extensions`;
`boundary`/`location`/`area` geometry columns and GIST indexes removed;
`calculated_acreage`/`calculated_area_acres` retained (recomputed via
`extensions.*`). Note that server-side spatial queries would require recreating a
geometry column + GIST index, qualified to `extensions`.

## Rollback / safety

Every step is recoverable because the jsonb source columns are never touched. If
anything goes wrong, the boundaries are intact in `*_geojson`; recreate the
acreage columns (qualified or not, per where PostGIS ended up). Worst case is a
temporarily-blank "drawn acreage" display — never data loss.

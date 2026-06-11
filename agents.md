# Ground Crew HQ - Agent Instructions

## Stack
- React + Vite + TypeScript
- Supabase/Postgres backend
- Vercel deployment
- Tailwind/shadcn UI
- lucide-react icons

## Global Rules
- Keep changes small and file-specific.
- Do not rewrite unrelated pages.
- Do not rename existing Supabase tables or columns unless explicitly requested.
- Never hardcode secrets, org IDs, or UUIDs.
- Use VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for Supabase.
- Prefer reusable hooks, components, and typed utilities.
- Preserve existing routing unless the task specifically asks for routing changes.
- Return exact files changed, SQL required, and testing steps.
- Read CODERULES.md before writing any code in a new session.
- Read docs/dev/live-db-state.md before writing any DB query (Rule 10).

## Required Reading Before Any Session
1. CODERULES.md — 12 non-negotiable rules (build gate, auth freeze, SQL boundary, etc.)
2. ARCHITECTURE.md — full route inventory, DB domain map, store shape
3. docs/dev/live-db-state.md — authoritative column names for every table

## Product Direction
Ground Crew HQ is a workforce operations platform for grounds/facilities crews:
- employee management
- scheduler
- daily workboard
- task management (org-wide task library)
- equipment management
- weather (NWS — US only)
- reports (labor metrics)
- safety (incident logging)
- messaging (internal team)
- chemical applications (EPA-ready spray logs)
- job costing
- invoicing
- client portal
- program setup / settings

## Before Auth Changes
Always inspect:
- src/lib/supabase.ts
- src/contexts/AuthContext.tsx
- src/pages/LaunchPortalPage.tsx

AuthContext.tsx is FROZEN — never modify it (CODERULES Rule 4).

## Before Weather Changes
Always inspect:
- src/pages/WeatherPage.tsx
- any weather hooks or weather utilities
- Supabase weather/location tables if present

## Before Any DB Query
Read docs/dev/live-db-state.md to confirm column names.
Never guess column names — stale strings compile but fail at runtime (400 from Supabase).

## Design Reference
For visual polish, layout consistency, branding, page hierarchy, and UI behavior, read:
- docs/design.md

Use docs/design.md only when the task involves UI, layout, branding, page redesign, or visual polish.

## Expected Output From Codex
Every response should include:
1. Summary of fix
2. Files changed
3. SQL needed, if any
4. Testing steps

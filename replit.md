# Ground Crew HQ

A workforce coordination platform for outdoor crews, properties, and daily field operations. Built for supervisors, admins, and field teams to manage schedules, tasks, weather, equipment, and communication across multiple properties.

## Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui (Radix UI)
- **Routing**: React Router v6
- **Data fetching**: TanStack React Query (with localStorage persistence)
- **Auth & Database**: Supabase (auth, RLS, realtime subscriptions)
- **Maps**: Leaflet / React Leaflet
- **Charts**: Recharts
- **PWA**: vite-plugin-pwa

## Environment Variables (Secrets)

| Secret | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public API key |

## Development

```bash
npm run dev   # Start dev server on port 5000
npm run build # Production build into dist/
```

## Architecture

- Pure frontend SPA — all data comes from Supabase via the JS client
- Supabase handles authentication (email/password), row-level security, and realtime push updates
- The `supabase/migrations/` folder contains the full DB schema (organizations, properties, employees, schedules, assignments, tasks, equipment, notes, clock_events, program_settings)
- Supabase Edge Function at `supabase/functions/send-sms/` handles Twilio SMS delivery (runs in Supabase infra)
- `src/lib/supabase-queries.ts` — all React Query hooks wrapping Supabase queries
- `src/contexts/AuthContext.tsx` — auth state, profile loading, role/org resolution
- `src/lib/supabase.ts` — Supabase client initialization (reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)

## Key Pages

| Route | Page |
|---|---|
| `/` | Login / Launch Portal |
| `/app/dashboard` | Command Center |
| `/app/workboard` | Daily Workboard |
| `/app/employees` | Employee Management |
| `/app/scheduler` | Shift Scheduler |
| `/app/equipment` | Equipment Tracker |
| `/app/tasks` | Task Catalog |
| `/app/weather` | Weather & ET Logs |
| `/app/reports` | Reports |
| `/app/messaging` | Internal Messaging |
| `/app/field` | Mobile Field Workspace |
| `/app/settings` | Program Setup Hub |

## Replit Migration Notes

- Migrated from Lovable — `lovable-tagger` removed from devDependencies
- Vite dev server configured for port 5000 with `allowedHosts: true` for Replit proxy compatibility
- Supabase credentials stored as Replit Secrets (not hardcoded)
- Deployment: static site build (`npm run build` → `dist/`)

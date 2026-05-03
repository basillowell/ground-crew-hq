# Ground Crew HQ

Workforce operations platform for golf course, resort, and
grounds maintenance teams.

## What It Does
- Daily operations dashboard with crew and weather snapshot
- Workforce scheduling (weekly shift planning)
- Workboard (task dispatch and assignment)
- Mobile field workspace (clock in/out, offline resilient)
- Employee and equipment management
- Weather (self-service setup, live Open-Meteo, 7-day forecast)
- Chemical application logging and compliance
- Labor reports (scheduled vs assigned vs actual hours)
- Multi-property support with org-level isolation

## Tech Stack
- React 18 + TypeScript + Vite
- Supabase (PostgreSQL + Auth + Realtime)
- TanStack Query v5
- React Router v6
- Tailwind CSS + shadcn/ui
- Vercel (auto-deploy on push to main)
- Open-Meteo (free weather API, no key required)

## Live Infrastructure
- App: https://ground-crew-hq.vercel.app
- Supabase: https://fjqeekwisnbpxgebrnpl.supabase.co
- GitHub: https://github.com/basillowell/ground-crew-hq

## Local Development
npm install
cp .env.example .env.local
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev

## Database
Migrations: supabase/migrations/ (run in order)
Seeds (dev only): supabase/seeds/

## Testing
npm run test          # Playwright headless
npm run test:headed   # Playwright with browser
npm run test:mobile   # iPhone 14 viewport

## New Client Onboarding
Every client self-onboards through the app:
1. Admin logs in → sees getting started checklist
2. Sets weather location in Weather page
3. Adds employees, equipment, tasks
4. Schedules shifts, builds workboard
No developer setup required per client.

## Agent Skills
docs/skills/supabase.skill.md  — database patterns
docs/skills/components.skill.md — component patterns
docs/skills/features.skill.md  — page map and business rules

## Version
v2.4.1 — Full Supabase migration, multi-tenant RLS,
         self-service weather onboarding, offline field page

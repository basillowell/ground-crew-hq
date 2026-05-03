# Ground Crew HQ

Ground Crew HQ is a workforce operations platform for grounds, turf, and facilities teams. It centralizes scheduling, daily task execution, weather intelligence, equipment tracking, messaging, and operations reporting across one or multiple properties.

## Core Features

- Workboard for daily dispatch, assignments, and execution flow
- Scheduler for shift planning and crew coverage
- Weather operations hub with station/location-aware context
- Applications tracking for chemical/agronomy workflows
- Employee and role management
- Multi-property operational support
- Equipment fleet and maintenance visibility
- Messaging and operational notifications

## Tech Stack

- React 18 + TypeScript + Vite
- Supabase (Auth + Postgres + Realtime)
- TanStack Query
- Tailwind CSS + shadcn/ui
- Vercel (deployment)

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

3. Start development server:

```bash
npm run dev
```

4. Build production bundle:

```bash
npm run build
```

## Testing

- Unit/integration tests:

```bash
npm run test
```

- Playwright E2E tests (if configured in your environment):

```bash
npx playwright test
```

## Deployment

### Vercel

- Connect the GitHub repository in Vercel
- Configure required environment variables from Supabase
- Push to `main` to trigger production deployment

### Supabase

- Keep schema migrations under `supabase/migrations`
- Apply migrations before promoting environment changes
- Validate RLS policies for all production data paths

## Target Users

- Grounds crews
- Turf managers
- Facilities and operations managers
- Multi-site/property supervisors

## Live Infrastructure

- Frontend: Vercel (auto-deploys on push to main)
- Backend: Supabase (PostgreSQL + Auth + Realtime)
- Weather: Open-Meteo API (free, no key required)
- Supabase Project: fjqeekwisnbpxgebrnpl.supabase.co

## Database Setup

Run migrations in order from `supabase/migrations/`:
1. `001_initial_schema.sql`
2. `002_multi_tenant.sql`
3. `004_fix_recursive_rls.sql`

After migrations, seed starter tasks:
Run `supabase/seeds/001_starter_tasks.sql`

## First Org Setup

Every new client org needs:
1. A row in organizations table
2. A Supabase auth user
3. A row in app_users linked to auth user
4. A row in employees linked to app_users
5. At least one row in properties with latitude and longitude

## Current Version

v2.4.1 - Full Supabase migration complete  
All 14 pages on real Supabase data  
Multi-tenant org isolation via RLS  
Offline clock event queue on field page

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

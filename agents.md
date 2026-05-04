> Skills: docs/skills/supabase.skill.md,
> docs/skills/components.skill.md, docs/skills/features.skill.md

# Ground Crew HQ — Agent Instructions

## Who I Am
I am not a traditional programmer. I understand systems,
infrastructure, and operations management deeply.
I have a background in Basic and Visual C++.
Explain modern patterns simply, relating to systems thinking.
I build ahead of my capability and learn by doing.

## Project Identity
Ground Crew HQ is a workforce operations platform for golf course,
resort, and grounds maintenance teams. It is a real SaaS product
with paying clients — not a demo or prototype.
Every feature must serve a real field operations need.

## Tech Stack
- React 18 + TypeScript + Vite
- shadcn/ui + Tailwind CSS — do NOT introduce other UI libraries
- Supabase (auth, database, realtime, edge functions)
- TanStack Query v5 for all data fetching
- React Router v6 for routing
- Vercel for deployment (auto-deploys on push to main)

## Code Rules
- Make surgical changes only — never rewrite entire files
- Preserve existing architecture and patterns
- Use existing hooks from supabase-queries.ts before creating new ones
- Use useAuth() for currentUser, currentPropertyId, orgId
- Never hardcode UUIDs or credentials in application code
- All new components use Tailwind + shadcn only

## Data Rules — CRITICAL
- ALL data persists via Supabase — no localStorage as primary store
- Every INSERT and UPDATE must include org_id: currentUser?.orgId
- Every INSERT and UPDATE must include property_id: currentPropertyId
  where that column exists on the table
- Never change Supabase schema without providing a migration SQL file
  in supabase/migrations/
- After every mutation: queryClient.invalidateQueries({ queryKey: ['table'] })
- RLS policies required on every table — admin/manager bypass pattern:
  current_user_role() IN ('admin', 'manager')

## Deployment
- Production URL: ground-crew-hq.vercel.app
- Preview deployments are protected by Vercel SSO — use production URL for testing
- Deploy via: vercel --prod (or push to main branch)

## Multi-Tenant Rules
- This app serves multiple client organizations
- Each org is isolated by org_id — never query without org scope
- Never expose one org's data to another

## File Structure Rules
- Pages: src/pages/ — one file per module, no duplicates
- Components: src/components/ — shared UI only
- Data hooks: src/lib/supabase-queries.ts — single source of truth
- Auth: src/contexts/AuthContext.tsx — never bypass
- Migrations: supabase/migrations/ — numbered sequentially
- Seeds: supabase/seeds/ — starter data only

## Known Working Patterns — Use These
- Data fetch: useQuery hook from supabase-queries.ts
- Auth state: useAuth() → currentUser, currentPropertyId, orgId
- After save: queryClient.invalidateQueries({ queryKey: ['table-name'] })
- Offline events: localStorage key 'gcrew-pending-clocks' with retry on online
- Branding: applyBranding() in AppLayout reads from useProgramSettings()
- RLS bypass for admin: current_user_role() IN ('admin', 'manager')

## Skills Reference
Before making any change, read the relevant skill file:
- Database changes → read docs/skills/supabase.skill.md
- Component changes → read docs/skills/components.skill.md  
- Page or feature changes → read docs/skills/features.skill.md

Skills contain the exact patterns, table names, hook names,
and conventions used in this codebase. Using them prevents
drift, duplication, and broken patterns.

## Git Rules
- Commit messages: feat:, fix:, refactor:, chore:, docs:
- Never commit broken code — npm run build must pass
- Keep changes small and testable — one feature per commit
- Never push directly to main without build passing

## Testing Rules
- Every critical flow needs a Playwright test
- Critical flows: auth, workboard task assign, scheduler shift save,
  field clock in/out, equipment add unit, weather location save
- Run tests: npx playwright test
- Never ship a change that breaks an existing test

## Mobile-First Rules
- Field page (/app/field) is used on phones — minimum 44px touch targets
- Offline resilience required on all field interactions
- Test on mobile viewport before shipping field page changes

## The Prime Rule
This is a REAL product with REAL clients.
All features must be functional, connected, and production-safe.
Demo behavior, mock data, and localStorage-as-database are not acceptable.

## Current App State (as of v2.4.1)
- All 14 pages fully migrated to Supabase — dataStore is DEAD
- Multi-tenant isolation active via org_id RLS on all tables
- AppLayout shell reads from Supabase via useAuth + query hooks
- Weather page has self-service onboarding flow
- Field page has offline clock event queue
- Settings page has sidebar nav with 8 sections
- Dashboard has getting started checklist for new orgs
- Playwright test suite in e2e/ covers 6 critical flows

## What Is NOT Yet Built
- Stripe billing integration (stub UI exists in settings)
- SMS notifications via Twilio
- Calendar .ics export from scheduler
- Push notifications
- Equipment QR code scanning
These are Phase 2 features — do not build unless explicitly asked.

## Commit Message Format
feat: add weather 7-day forecast
fix: correct RLS policy on schedule_entries
refactor: migrate AppLayout to Supabase hooks
chore: remove orphan page files
docs: update skills with loading state patterns
test: add scheduler Playwright spec

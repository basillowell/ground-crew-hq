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
- Never hardcode secrets.
- Use VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for Supabase.
- Prefer reusable hooks, components, and typed utilities.
- Preserve existing routing unless the task specifically asks for routing changes.
- Return exact files changed, SQL required, and testing steps.

## Product Direction
Ground Crew HQ is a workforce operations platform for grounds/facilities crews:
- employee management
- scheduler
- daily workboard
- task management
- equipment management
- weather
- reports
- safety
- messaging
- program setup

## Before Auth Changes
Always inspect:
- src/lib/supabase.ts
- src/contexts/AuthContext.tsx
- src/pages/LaunchPortalPage.tsx

## Before Weather Changes
Always inspect:
- src/pages/WeatherPage.tsx
- any weather hooks or weather utilities
- Supabase weather/location tables if present

## Expected Output From Codex
Every response should include:
1. Summary of fix
2. Files changed
3. SQL needed, if any
4. Testing steps

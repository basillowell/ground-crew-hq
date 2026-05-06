# Auth Skill - Ground Crew HQ

## Purpose
Authentication must allow a Supabase Auth user to log in and reach the app dashboard only when the required app profile records exist.

## Required Files To Inspect
- src/lib/supabase.ts
- src/contexts/AuthContext.tsx
- src/pages/LaunchPortalPage.tsx
- src/App.tsx

## Supabase Requirements
Login depends on:
1. Supabase Auth user
2. app_users row
3. employees row
4. organizations row

The app_users.id should match the Supabase auth.users.id unless the app uses a different explicit auth_user_id column.

## Required Behavior
- Do not redirect to /app/dashboard until AuthContext profile hydration completes.
- Prevent redirect loops between "/" and "/app/dashboard".
- Show clear user-facing errors for:
  - missing Supabase environment variables
  - invalid credentials
  - missing app_users profile
  - missing employee record
  - missing organization record
  - inactive user
  - inactive subscription, if enforced
- Use development-only console logs for auth debugging.
- Never expose secrets in logs.

## Required Vercel Env Vars
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

## SQL Seed Pattern
When asked to seed an admin user, provide SQL that creates:
- organization
- employee
- app_users row linked to the Supabase auth user

## Do Not
- Do not disable authentication permanently.
- Do not bypass Supabase security.
- Do not hardcode one user into frontend code.
- Do not remove ProtectedRoute unless replacing it with a safer version.

## Expected Result
A valid Supabase email/password user with matching app_users, employees, and organizations records can log in and reach /app/dashboard.

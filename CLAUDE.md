# App version: v7.19.4 (source of truth: package.json → \_\_APP\_VERSION\_\_)

# Ground Crew HQ — Claude Code Instructions

## Project Identity

* SaaS app for lawn/grounds crew management
* Production: ground-crew-hq.vercel.app
* Stack: Next.js 16 (App Router) + React 18 + TypeScript + Tailwind CSS + Supabase + Vercel
* NOT Vite — migrated off it. `npm run build` is `next build`; there is no vite.config/index.html/src/main.tsx
* Repo: C:\\Projects\\ground-crew-hq

## Supabase

* Project ID: fjqeekwisnbpxgebrnpl
* Never modify AuthContext.tsx
* Never touch existing route guards or ProtectedRoute logic
* New DB columns must be snake\_case (CODERULES.md)
* RLS policies exist on all tables — don't bypass them

## Design System (2026 Overhaul)

* Dark-first. Base: #0f1a14. Card: #1a2d1f. Elevated: #243828
* Primary accent: #a3e635 (electric lime)
* Text: #f8fafc primary, #94a3b8 muted, #64748b placeholder
* Tailwind only — no new CSS frameworks or component libraries
* Glassmorphism on modals and cards only — never on dense data tables
* Mobile-first at 375px breakpoint

## Roles

* admin / manager → Supervisor view
* employee → Field Crew view
* Role badge always visible in sidebar footer and topbar

## Architecture

* `app/` is a thin Next.js App Router shell (routes, layout, providers); the real application code lives in `src/` (pages, components, lib) and is live
* Stylesheet: `app/globals.css` is the ONLY one loaded, via `app/layout.tsx`. `src/index.css` is a dead Vite-era leftover imported by nothing — edit globals.css
* Auth lives in LaunchPortalPage.tsx as a dialog (not separate pages)
* Reset password is a standalone page: /auth/reset → ResetPasswordPage.tsx
* AppLayout.tsx handles sidebar, topbar, mobile nav
* Supervisor dashboard: CommandCenterOperationalPage.tsx
* Employee field view: find via grep

## Workflow Rules

* Grep before editing any file
* Read the file before editing it
* Confirm with user after each file
* Run npm run build before every commit (tsc --noEmit alone is not sufficient — see CODERULES.md Rule 9)
* Never install new npm packages without asking first
* Commit message format: feat/fix/chore: short description

## Vercel

* Project ID: prj\_Y3NgqXZ0IgFj1JN9ViZWgitMRMNK
* Auto-deploys on push to main
* Check deployment logs if styles don't appear in production

## What NOT to do

* No kinetic/animated typography (CLS killer)
* No WebGL or Three.js in UI components
* No filter:invert() for dark mode
* No pastel gradients
* No new route guards without discussion
* Never empty the trash or permanently delete files


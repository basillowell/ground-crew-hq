# Ground Crew HQ — Claude Session Handoff
# Paste this at the start of every new Claude conversation.
# Keep this file updated after each session.
# Last updated: May 13, 2026

---

## Project Identity
- App: Ground Crew HQ (turf/golf operations platform)
- Owner: Basil Lowell (basillowell@yahoo.com) — Admin
- Repo: https://github.com/basillowell/ground-crew-hq (public)
- Production URL: https://ground-crew-hq.vercel.app
- Vercel project: prj_Y3NgqXZ0IgFj1JN9ViZWgitMRMNK (team: team_A9f00zq9pBiz6dFy1qn8hTW8)
- Supabase project: fjqeekwisnbpxgebrnpl
- Stack: React + TypeScript + Vite + Supabase + Vercel
- Branch: main only — never create new branches

---

## How This Works
- Claude = supervisor. Fixes DB, RLS, schema, seeds directly via Supabase MCP.
- Codex = builder. Writes React/TypeScript only. Never touches DB.
- Basil = product owner. Describes what to build. Claude checks DB first, then writes Codex prompt.
- Rules files in repo: CODEX_RULES.md (root) + docs/dev/live-db-state.md

---

## Current Version
ver2.5.40 (in progress as of last session)

## Recent Commits (last session)
- ver2.5.38: CODEX_RULES.md v3.0 + live-db-state.md split ✅
- ver2.5.37: Labor summary report + actual hours tracking ✅
- ver2.5.36: Task library in Settings ✅
- ver2.5.35: Workflow labor board — daily task view ✅
- ver2.5.34: Scheduler week view — shift times, day summary, copy week ✅
- ver2.5.33: schedulerDefaults variable name crash fix ✅
- ver2.5.32: Stale state — settings refresh, modal freeze, template picker ✅
- ver2.5.31: shift_templates query fix + Add Shift wired to scheduler defaults ✅
- ver2.5.30: Scheduler tab — operational day + shift templates ✅
- ver2.5.29: Settings page rewrite — clean shell (corrupted files deleted) ✅

---

## Current App State (what works)

### ✅ Working
- Auth: login/logout, session management, org context
- Dashboard: loads, readiness cards, weather widget
- Scheduler: week grid, shift times in cells, day summary row, weekly totals, Add Shift modal with template picker, Copy Week button
- Settings → Scheduler tab: Operational Day card (saves 07:30–16:00), Shift Templates (4 templates)
- Settings → Tasks tab: Task library (12 tasks seeded)
- Weather: live Open-Meteo feed, hourly CSS chart (12/24/48h), 10-day forecast list, Rainfall Tracker with YTD data
- Workflow/Workboard: Labor board structure, scheduled crew section, Assign Task modal

### ⚠️ Known Issues (pending Codex ver2.5.40)
1. Tasks page crashes on load — broken lazy-loaded chunk (TasksCatalogPage)
   Fix: Rule 7 rewrite of TasksCatalogPage.tsx
2. Assign Task modal shows "No tasks" — needs to query tasks table
   Fix: fetch taskLibrary at WorkflowPage level, pass to modal
3. Scheduler Add Shift modal defaults to 05:00 instead of 07:30
   Fix: change useState fallback from '05:00' to '07:30'

### 🔧 DB Fixes Applied Directly (no code change needed)
- shift_templates.id: gen_random_uuid()::text default added
- 12 standard tasks seeded (Mow Greens, Roll Greens, Mow Fairways, etc.)
- app_users RLS: auth.uid() = id (simplest possible, no subquery)
- weather_stations FK → weather_locations added
- Supabase Site URL set to https://ground-crew-hq.vercel.app
- weather_display_prefs duplicate row removed

---

## DB Quick Reference

### Key IDs (never hardcode — use useAuth())
- Org: bb13da4a-d2de-4fc9-ad5a-bfd266e08807 (Ground Crew HQ)
- Property: b50b42cd-903e-4280-9373-1d9cae97b2b3 (Sarasota Polo Club)
- Weather location: 8c4f9cf0-1bcb-4801-bb75-e8233a154c35
- Scheduler settings: 48336e91-8890-4596-aba2-cc19a9c855be
- Auth user: 9078c42b-e938-4994-a88f-f77df3de2ead

### Critical schema gotchas
- shift_templates: cols are "start" and "end" (NOT start_time/end_time), NO created_at
- tasks.priority: integer (1=high, 2=medium, 3=low) NOT text
- weather_locations.id: text type (not uuid)
- weather_daily_logs: currentConditions and forecast are nullable
- All 37 tables have RLS enabled

### Scheduler settings current values
- operational_day_start: 07:30, operational_day_end: 16:00
- default_shift_start: 05:00, default_shift_end: 13:30
- operational_days: [mon,tue,wed,thu,fri,sat]

---

## Queued Prompts (send to Codex in order)

### NEXT: ver2.5.40 (send now)
Fix Tasks page crash + Workflow task assignment + Scheduler defaults
[Prompt written in last session — see conversation or ask Claude to regenerate]

### AFTER: ver2.5.41 — Workflow improvements
- Assign task saves to assignments table correctly
- Task rows show status toggle (planned → in_progress → done)
- Actual hours input per task
- Day summary footer with totals

### AFTER: ver2.5.42 — Settings remaining tabs
- Workspace tab: reads/saves org name + program_settings
- Workforce tab: renders 6 workforce roles
- Weather tab: shows active location + panel toggles
- Access tab: email/role display + sign out

### AFTER: ver2.5.43 — Reports page
- Labor Summary: scheduled hours vs task hours per employee
- Date range picker with presets
- Export CSV

---

## How to Start a New Claude Session

1. Paste this entire file at the start of the conversation
2. Say what you want to build or what's broken
3. Claude will check DB state, fix anything structural directly,
   then write a clean Codex prompt
4. Send prompt to Codex, wait for build confirmation
5. Screenshot result and send back to Claude

## How to Update This File
After each session, update:
- Current version number
- Recent commits list (add new, keep last 10)
- Working / Known Issues sections
- Queued prompts (remove completed, add new)
- Any new DB fixes applied

Keep this file in: docs/dev/SESSION_HANDOFF.md in the repo
AND locally so you can paste it fresh each time.

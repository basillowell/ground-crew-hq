# CrewHQ AI Agent Rules

## Project Context
This is a workforce operations platform for grounds, turf, and facility management teams.

Core modules:
- Workboard (tasks + execution)
- Scheduler (timeline + crew assignments)
- Weather (live + station-based decision making)
- Applications (chemical + agronomy tracking)
- Employees (crew management)
- Properties (multi-location support)
- Equipment (asset tracking)

## Tech Stack
- React + TypeScript + Vite
- Supabase (Postgres backend)
- Vercel deployment
- Tailwind + shadcn/ui

## Rules for AI Agents

### Code Rules
- DO NOT rewrite entire files unless explicitly told
- Make **surgical changes only**
- Preserve existing architecture
- Use existing patterns before creating new ones

### Data Rules
- ALL data must persist via Supabase
- NO mock data in production code
- Do not change schema without providing SQL migration

### UI Rules
- Use existing Tailwind + shadcn styles
- Do not introduce new UI libraries
- Keep UI consistent across modules

### Behavior Rules
- Explain changes simply (user is not a traditional developer)
- Prefer stability over cleverness
- Fix root causes, not symptoms

### Git Rules
- Use clear commit messages:
  - feat:
  - fix:
  - refactor:
- Do not commit broken code
- Keep changes small and testable

### Critical Rule
This is a REAL product - not a demo.
All features must be functional, connected, and production-safe.

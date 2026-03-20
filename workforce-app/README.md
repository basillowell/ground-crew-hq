# WorkForce OS

Full-stack **Workforce & Operations Management Platform** — Next.js 14, PostgreSQL, Tailwind CSS.

## Features

| Module | What it does |
|---|---|
| **Scheduler** | Week grid · add/edit shifts · day-off toggle · copy previous week |
| **Workboard** | Daily task allocation · visual hours bar · equipment assignment |
| **Employees** | CRUD · hourly rates · groups · active/inactive filter |
| **Equipment** | Unit tracking · status filter chips · visual status selector |
| **Reports** | Dollars & hours · task totals · quick date ranges · % cost bars |
| **Settings** | Manage employee groups · task categories · tasks |

## Stack

```
Next.js 14 (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Zustand · date-fns
```

## Quick Start

### 1. Install
```bash
git clone <repo> && cd workforce-app
npm install
```

### 2. Database

Create a free database at [Neon](https://neon.tech) or [Supabase](https://supabase.com), then run the schema:
```bash
# Paste lib/schema.sql into the SQL editor and run it
```

### 3. Environment
```bash
cp .env.example .env.local
# Edit .env.local — add your DATABASE_URL
```

### 4. Run
```bash
npm run dev
# → http://localhost:3000
```

## Deploy to Vercel

```bash
# Push to GitHub
git init && git add . && git commit -m "Initial commit"
git remote add origin <github-url> && git push -u origin main
```

In Vercel dashboard:
1. Import GitHub repo
2. Add env vars: `DATABASE_URL`, `NEXTAUTH_SECRET`
3. Deploy ✅

## Project Layout

```
app/
  api/                  # All API routes
    employees/          # GET, POST, PATCH :id, DELETE :id
    groups/             # GET, POST
    shifts/             # GET, POST, PATCH :id
    task-assignments/   # GET, POST, PATCH :id, DELETE :id
    tasks/              # GET, POST
    task-groups/        # GET, POST
    equipment/          # GET
    equipment-units/    # POST, PATCH :id
    equipment-types/    # GET
    reports/
      dollars-hours/    # GET ?start=&end=
      task-totals/      # GET ?start=&end=
  employees/page.tsx
  scheduler/page.tsx
  workboard/page.tsx
  equipment/page.tsx
  reports/page.tsx
  settings/page.tsx
components/
  Sidebar.tsx
  Modal.tsx
  TaskAssignmentRow.tsx
lib/
  db.ts         # Connection pool + query helper + transaction util
  api.ts        # Shared error helpers (badRequest, notFound, unprocessable)
  types.ts      # All TypeScript interfaces
  utils.ts      # Date / format / calculation helpers
  store.ts      # Zustand global state
  schema.sql    # Full DB schema with indexes + seed data
```

## Business Logic

- **Time validation** — task hours shown vs shift duration with visual bar
- **Equipment availability** — only `ready` units assignable
- **No double-booking** — same unit blocked across shifts on same date
- **Cost calculation** — `duration × hourly_rate` per employee
- **Day-off exclusion** — day-off shifts excluded from cost reports

## Customization

All reference data is managed in **Settings**:
- Employee groups
- Task categories  
- Tasks (with category assignment)

Equipment types can be added directly via the `equipment_types` table or by extending the Settings page.

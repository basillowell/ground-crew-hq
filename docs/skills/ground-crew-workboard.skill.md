---
name: ground-crew-workboard
description: >
  Generate, populate, and manage the Workboard page (/app/workboard) in Ground Crew HQ.
  Use this skill whenever the user wants to create work orders, dispatch tasks, manage job
  status, assign crew to tasks, track equipment needed, set priorities, or update the
  workboard in Ground Crew HQ. Trigger on: "add a job", "update the workboard", "what's
  pending", "mark as done", "assign crew to", "move to in progress", "create a work order",
  "dispatch a task", "what equipment do we need", "prioritize jobs", or any task/job
  management request in the app context. Always use this skill for workboard operations
  rather than answering generically.
---

# Ground Crew Workboard Skill

## Live Database Reference
**Project ID:** `fjqeekwisnbpxgebrnpl`
**Org ID:** `bb13da4a-d2de-4fc9-ad5a-bfd266e08807`

### Known Employees
| Name | ID |
|------|----|
| Basil Lowell | `738d599f-0309-489a-8275-e29ec7239e87` |
| Leo Tsosie | `234973b0-c4a3-44e1-b7a8-1a7133795bf2` |

### Known Properties
| Name | ID |
|------|----|
| Sarasota Polo Club | `b50b42cd-903e-4280-9373-1d9cae97b2b3` |

### Task Catalog
The `tasks` table is currently **empty** — no tasks seeded yet. When the user asks to
assign a task, either:
1. Create the task first, then assign it, OR
2. Create an assignment with `task_id = NULL` and put the task description in `notes`

## Real Schemas

### `assignments` table
```sql
id           uuid DEFAULT gen_random_uuid() PRIMARY KEY
employee_id  uuid NOT NULL REFERENCES employees(id)
property_id  uuid NOT NULL REFERENCES properties(id)
task_id      uuid REFERENCES tasks(id)   -- nullable, tasks catalog empty for now
org_id       uuid REFERENCES organizations(id)
date         date NOT NULL
location     text                         -- area/zone on property
status       text DEFAULT 'planned'       -- 'planned' | 'in_progress' | 'completed' | 'cancelled'
notes        text                         -- use for task description if no task_id
order_index  integer                      -- display order on workboard
created_at   timestamptz DEFAULT now()
```

### `tasks` table (catalog — currently empty)
```sql
id           uuid DEFAULT gen_random_uuid() PRIMARY KEY
property_id  uuid NOT NULL REFERENCES properties(id)
org_id       uuid REFERENCES organizations(id)
name         text NOT NULL
description  text
category     text DEFAULT 'General'
priority     integer DEFAULT 1
status       text DEFAULT 'active'
created_at   timestamptz DEFAULT now()
```

## Workflow

### Step 1 — Understand the Request
Gather:
- What task/job needs to be done (description)
- Which employee(s)
- Date
- Location on property (e.g. "North fields", "Polo field 3", "Maintenance barn")
- Priority / notes

### Step 2 — Check Existing Assignments
```sql
SELECT a.date, a.status, a.notes, a.location,
       e.first_name || ' ' || e.last_name as employee
FROM assignments a
JOIN employees e ON a.employee_id = e.id
WHERE a.org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'
  AND a.date >= CURRENT_DATE
ORDER BY a.date, a.order_index;
```

### Step 3 — Create Task (if needed) then Assignment

**Option A — Quick assignment (no task catalog entry):**
```sql
INSERT INTO assignments (employee_id, property_id, org_id, date, status, notes, location, order_index)
VALUES (
  '234973b0-c4a3-44e1-b7a8-1a7133795bf2',
  'b50b42cd-903e-4280-9373-1d9cae97b2b3',
  'bb13da4a-d2de-4fc9-ad5a-bfd266e08807',
  '2026-05-12',
  'planned',
  'Mow north polo fields — cut height 3.5 inches',
  'North Polo Fields',
  1
);
```

**Option B — With task catalog entry first:**
```sql
-- Step 1: create task
INSERT INTO tasks (property_id, org_id, name, description, category, priority)
VALUES (
  'b50b42cd-903e-4280-9373-1d9cae97b2b3',
  'bb13da4a-d2de-4fc9-ad5a-bfd266e08807',
  'Mow Polo Fields',
  'Mow all active polo fields to playing height',
  'Mowing',
  1
) RETURNING id;

-- Step 2: assign with task_id
INSERT INTO assignments (employee_id, property_id, task_id, org_id, date, status, notes, order_index)
VALUES (
  '234973b0-c4a3-44e1-b7a8-1a7133795bf2',
  'b50b42cd-903e-4280-9373-1d9cae97b2b3',
  '[returned_task_id]',
  'bb13da4a-d2de-4fc9-ad5a-bfd266e08807',
  '2026-05-12',
  'planned',
  NULL,
  1
);
```

### Step 4 — Status Updates
```sql
-- Mark in progress
UPDATE assignments SET status = 'in_progress'
WHERE id = '[assignment_id]' AND org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807';

-- Mark completed
UPDATE assignments SET status = 'completed'
WHERE id = '[assignment_id]' AND org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807';
```

### Step 5 — Output Summary
After every write operation, show a confirmation:
```
✅ Workboard updated — Sarasota Polo Club
| Date       | Employee   | Task                          | Location         | Status  |
|------------|------------|-------------------------------|------------------|---------|
| 2026-05-12 | Leo Tsosie | Mow north polo fields         | North Polo Fields| planned |
```

### Step 6 — Offer Next Steps
- Add more assignments for the week
- Build out the tasks catalog for reusable tasks
- Mark items complete as work finishes
- Hand off to Ground Crew Agent for full operational view

## Common Task Categories for 180-Acre Polo Club
- **Mowing** — polo fields (playing height ~2.5–3.5"), rough areas, surrounds
- **Field Prep** — divot repair, line marking, goal post setup
- **Irrigation** — check heads, run zones, repair leaks
- **Fertilizing / Spraying** — turf programs, pest/weed control
- **Equipment Maintenance** — mowers, aerators, utility vehicles
- **Cleanup** — debris, storm response, event prep/teardown
- **Aeration / Overseeding** — seasonal programs

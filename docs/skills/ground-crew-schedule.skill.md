---
name: ground-crew-schedule
description: >
  Generate, populate, and manage the Scheduler page (/app/scheduler) in Ground Crew HQ.
  Use this skill whenever the user wants to build a crew schedule, assign shifts, plan a
  work week, add jobs to specific dates and times, assign crew members to properties, or
  generate any scheduling data for the Ground Crew HQ app. Trigger on phrases like "build
  the schedule", "schedule the crew", "who's working", "add a shift", "plan this week",
  "assign [crew member] to [job]", or any mention of scheduling within Ground Crew HQ.
  Always use this skill — even for partial schedule edits — rather than answering inline.
---

# Ground Crew Scheduler Skill

## Live Database Reference
**Project ID:** `fjqeekwisnbpxgebrnpl`
**Org ID:** `bb13da4a-d2de-4fc9-ad5a-bfd266e08807`

### Known Employees
| Name | ID | Role | Department |
|------|----|------|------------|
| Basil Lowell | `738d599f-0309-489a-8275-e29ec7239e87` | Platform Admin | Maintenance |
| Leo Tsosie | `234973b0-c4a3-44e1-b7a8-1a7133795bf2` | Field Staff | Field Staff |

> Note: Leo Tsosie has a duplicate entry (`7ef1e523-e4c3-4902-81e7-a9e6a941a0b9`). Use `234973b0` as the canonical ID.

### Known Properties
| Name | ID | Acreage |
|------|----|---------|
| Sarasota Polo Club | `b50b42cd-903e-4280-9373-1d9cae97b2b3` | 180 acres |

### Existing Shift Pattern
Current shifts run **05:00–13:30** at Sarasota Polo Club. Early morning start is intentional — 180-acre polo property, work before heat peaks.

## Real Schema — `schedule_entries`
```sql
id           uuid DEFAULT gen_random_uuid() PRIMARY KEY
employee_id  uuid NOT NULL REFERENCES employees(id)
property_id  uuid NOT NULL REFERENCES properties(id)
org_id       uuid REFERENCES organizations(id)
date         date NOT NULL
shift_start  time NOT NULL
shift_end    time NOT NULL
status       text DEFAULT 'scheduled'   -- 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
created_at   timestamptz DEFAULT now()
```

## Workflow

### Step 1 — Understand the Request
For scheduling requests, gather:
- Date(s) or date range
- Which employee(s) (Basil and/or Leo, or both)
- Shift times (default: 05:00–13:30 to match existing pattern)
- Any notes or special instructions

If anything is ambiguous, ask **one question at a time**.

### Step 2 — Check What's Already Scheduled
Before inserting, always query first to avoid duplicates:
```sql
SELECT se.date, se.shift_start, se.shift_end, se.status,
       e.first_name, e.last_name
FROM schedule_entries se
JOIN employees e ON se.employee_id = e.id
WHERE se.org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'
  AND se.date BETWEEN '[start]' AND '[end]'
ORDER BY se.date, se.shift_start;
```

### Step 3 — Generate and Insert
Build the INSERT using real UUIDs:
```sql
INSERT INTO schedule_entries (employee_id, property_id, org_id, date, shift_start, shift_end, status)
VALUES
  ('738d599f-0309-489a-8275-e29ec7239e87', 'b50b42cd-903e-4280-9373-1d9cae97b2b3', 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807', '2026-05-12', '05:00', '13:30', 'scheduled'),
  ('234973b0-c4a3-44e1-b7a8-1a7133795bf2', 'b50b42cd-903e-4280-9373-1d9cae97b2b3', 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807', '2026-05-12', '05:00', '13:30', 'scheduled');
```

### Step 4 — Confirm and Summarize
After inserting, show the user a clean summary table:
```
| Date       | Employee     | Property            | Shift           | Status    |
|------------|--------------|---------------------|-----------------|-----------|
| 2026-05-12 | Basil Lowell | Sarasota Polo Club  | 05:00 – 13:30   | scheduled |
| 2026-05-12 | Leo Tsosie   | Sarasota Polo Club  | 05:00 – 13:30   | scheduled |
```

### Step 5 — Offer Next Steps
- Add more dates or a full week
- Change shift times
- Push to Workboard as task assignments
- Hand off to Ground Crew Agent for full-week plan

## Useful Queries

**View this week's schedule:**
```sql
SELECT se.date, e.first_name || ' ' || e.last_name as employee,
       p.name as property, se.shift_start, se.shift_end, se.status
FROM schedule_entries se
JOIN employees e ON se.employee_id = e.id
JOIN properties p ON se.property_id = p.id
WHERE se.org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'
  AND se.date >= CURRENT_DATE
ORDER BY se.date, se.shift_start;
```

**Delete a specific shift:**
```sql
UPDATE schedule_entries SET status = 'cancelled'
WHERE id = '[entry_id]' AND org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807';
```

## Defaults for Sarasota Polo Club
- Start: 05:00 (early morning — 180 acres, beat the Florida heat)
- End: 13:30 (8.5 hr shift)
- Both Basil and Leo typically scheduled together
- Property: always Sarasota Polo Club (`b50b42cd`)

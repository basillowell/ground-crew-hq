# Scheduler Skill - Ground Crew HQ

## Purpose
The Scheduler is a weekly workforce grid used to plan employee shifts.

## Required Files To Inspect
- src/pages/SchedulerPage.tsx
- scheduler components
- schedule hooks
- Supabase schedule tables
- src/contexts/AuthContext.tsx

## Core Model
Rows = employees
Columns = days of week
Cells = shift or day off

## Required Features
- Weekly view with Sunday-Saturday columns
- Add/edit shift
- Day off toggle
- Copy previous day/week, if available
- Employee search/filter
- Weekly summary per employee
- Daily summary totals
- Prevent broken/invalid time ranges
- Persist changes to Supabase

## Shift Data
Each shift should support:
- employee_id
- date
- start_time
- end_time
- is_day_off
- notes
- department/property if the app supports it

## Validation
- end_time must be after start_time
- day off should clear or ignore start/end time
- inactive employees should not be scheduled by default
- preserve existing schedule entries when editing unrelated cells

## UI Requirements
- Grid should be readable and responsive
- Green/normal style for working shift
- Yellow/orange style for day off
- Clear loading and empty states

## Do Not
- Do not rebuild the entire app.
- Do not change auth logic.
- Do not rename schedule tables without SQL migration.

## Expected Result
A supervisor can plan a week of shifts, save them, and see total hours by employee/day.

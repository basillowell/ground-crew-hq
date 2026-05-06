# Reports Skill - Ground Crew HQ

## Purpose
Reports convert scheduling, task, employee, and equipment data into operational and financial insights.

## Required Files To Inspect
- src/pages/ReportsPage.tsx
- report components
- Supabase report queries
- task assignments
- employees
- schedule entries/shifts

## Core Reports
1. Dollars and Hours
2. Task Totals by Date and Group
3. Employee Hours
4. Equipment Usage
5. Daily/Weekly Labor Summary

## Dollars and Hours Logic
cost = task duration * employee hourly_rate

If overtime is implemented, separate:
- regular hours
- overtime hours
- regular cost
- overtime cost

## Task Totals Logic
Group by:
- date
- task group
- task
- employee, optionally

## Required Filters
- date range
- employee
- task group
- property
- department
- equipment, if available

## Required Exports
Where practical:
- CSV export
- print-friendly view
- PDF later, optional

## UI Requirements
- Date range selector
- Run button
- Do not auto-run expensive reports on every keystroke
- Show generated timestamp
- Show empty/loading/error states

## Do Not
- Do not fake report totals.
- Do not calculate money without employee hourly_rate.
- Do not mutate operational data from reports.

## Expected Result
Supervisor can run reports showing labor hours, task totals, and costs from real saved data.

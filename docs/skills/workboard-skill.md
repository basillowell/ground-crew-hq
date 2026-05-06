# Workboard Skill - Ground Crew HQ

## Purpose
The Workboard is the daily execution board where supervisors assign tasks to employees for a selected date.

## Required Files To Inspect
- src/pages/WorkboardPage.tsx
- task assignment components
- employee/task hooks
- Supabase assignment/task tables
- scheduler data model

## Core Model
Date -> employee shifts -> task assignments

## Required Features
- Select date
- Show employees scheduled for that date
- Expand/collapse employee rows
- Assign multiple tasks per employee
- Set duration per task
- Assign equipment unit when needed
- Show shift total hours
- Show assigned task total hours
- Warn when assigned hours do not match shift hours
- Save task assignments to Supabase

## Task Assignment Fields
- employee_id
- task_id
- date or shift_id
- duration
- equipment_unit_id
- status
- notes
- order_index / position

## Validation
- task duration must be positive
- task total should not exceed shift hours without warning
- equipment must be ready before assignment, if equipment is selected
- avoid duplicate booking the same equipment at the same time if time windows exist

## UI Requirements
- Similar to taskTracker labor board:
  - employee rows
  - task rows inside employee
  - duration column
  - equipment column
  - status column
- Clear empty state when no employees are scheduled
- Quick Click button may later copy previous day/task template

## Do Not
- Do not convert this into a generic Kanban board.
- Do not remove scheduler connection.
- Do not overwrite equipment status logic.

## Expected Result
Supervisor can open a daily workboard, assign tasks to scheduled employees, and track labor hours.

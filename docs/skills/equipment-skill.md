# Equipment Skill - Ground Crew HQ

## Purpose
Equipment Management tracks equipment types, individual units, statuses, work orders, and task availability.

## Required Files To Inspect
- src/pages/EquipmentPage.tsx
- equipment components
- equipment hooks
- Supabase equipment/work order tables

## Core Model
Equipment Type -> Equipment Units -> Work Orders

## Equipment Type Fields
- id
- name
- short_name
- category
- active

## Equipment Unit Fields
- id
- equipment_type_id
- unit_name
- status
- notes
- active

## Status Values
Use:
- ready
- issue
- maintenance
- disabled

## Required Features
- Add/edit equipment type
- Add/edit unit
- Show status badges
- Show total units by type
- Show count of ready/issue/maintenance/disabled
- Show unit details
- Create/view work orders
- Prevent disabled equipment from being assigned to workboard tasks

## UI Requirements
- Split layout:
  - left: equipment types
  - right: selected equipment units/details
- Status colors:
  - ready = green
  - issue = yellow/orange
  - maintenance = gray/blue
  - disabled = red
- Clear empty and loading states

## Do Not
- Do not delete historical work orders when disabling equipment.
- Do not hard-delete units unless explicitly requested.
- Do not break Workboard equipment assignment.

## Expected Result
Equipment can be tracked by type/unit and used as an operational constraint in task assignments.

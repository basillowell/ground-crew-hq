# Claude Handoff 519.1

## Context
This handoff starts from Claude prompt: **"Continue the ver2.5.14.191 diagnostic."**

## Progress Since ver2.5.14.191

### Completed and pushed to `main`
- `b901514` — **diag: ver2.5.14.191 — minimal workboard to isolate crash source**
  - Established minimal Workboard diagnostic path.
- `0a19dab` + `5346a64` — **fix: ver2.5.14.190 shell split**
  - Moved to Workboard shell/content split and removed legacy page.
- `6634b80` — **fix: ver2.5.14.192 — reorder derived workboard state to prevent TDZ crash**
  - Moved `dayAssignments` above hook/effect usage to address TDZ/minification ordering risk.
- `243b3c8` — **fix: add missing dropdown menu imports in workboard content**
  - Fixed runtime `DropdownMenu is not defined`.
- `9c584dc` — **fix: scheduler guarded query loading stabilization**
  - Added query `enabled` guards in Scheduler week queries and loading/error gating stabilization.

### Build status during this run
- Multiple `npm run build` runs completed successfully after each targeted fix.

## Current branch / remote state
- `main` is aligned with `origin/main` at commit `9c584dc`.
- No unpushed commits at this moment.

## Local uncommitted work currently present
These edits exist locally and are **not committed/pushed yet**:
- `src/pages/WorkboardContent.tsx`
  - Weather logs query change to schema-safe filtering (location-based).
  - Assignment payload cleanup (`equipment_id` removed, `equipment_unit_id` retained).
- `src/lib/supabase-queries.ts`
  - Weather daily logs range query switched from `location_id` fallback behavior to primary `locationId` usage.
- `src/pages/SettingsPage.tsx`
  - Access tab crash fix for missing invite modal state (`showInviteModal`, `inviteEmail`, `inviteRole`).

## Why this matters
- The committed history contains the Workboard diagnostic and stabilization path.
- There are **additional local fixes** for known runtime/query issues that still need decision:
  - either commit/push together,
  - or split into prompt-specific commits (recommended if strict prompt traceability is needed).

## Recommended next step for Claude
1. Review `git diff` on the three modified files.
2. Decide commit strategy:
   - **Option A:** one stabilization batch commit for local pending fixes.
   - **Option B:** split by task domain:
     - Workboard schema-safe query/payload fix
     - Settings invite-modal crash fix
3. Run `npm run build`.
4. Push to `main`.


# Polish Gameplan — Cleanup Punch-List

Running list of deferred / follow-up items surfaced while executing the 8-move
polish gameplan (see the shared gameplan artifact). These are **not** blockers —
they're things to batch-address in a dedicated cleanup pass.

_Started: 2026-08-10 · last swept: 2026-08-11 (Sweep A)_

## Open

- [ ] **Two live `EmptyState` components with divergent APIs (consolidate, don't delete).**
  `src/components/EmptyState.tsx` (props `icon, title, description, actionLabel, onAction`) is imported
  by ~10 files via `@/components/EmptyState`. `src/components/shared/EmptyState.tsx` (props
  `icon, title, description, action`) is used via the `@/components/shared` barrel (NotesPanel).
  Both are in active use — NOT dead code. Plan (Sweep B): keep the widely-used `@/components/EmptyState`,
  migrate the one `shared` consumer (NotesPanel) + the barrel export, then delete `shared/EmptyState.tsx`.

- [ ] **Onboarding is unmounted — re-wire `OnboardingWizardV2`** (feature, deferred).
  V1 deleted in Move 5. `OnboardingWizardV2.tsx` is still referenced nowhere — nothing renders onboarding
  for new users. Needs a product decision on WHERE it mounts (new-org / first-login flow), so it's feature
  work, not mechanical cleanup. Deferred out of the cleanup pass 2026-08-11.

- [ ] **`status.*` token naming is semantically off** (documented; rename intentionally SKIPPED).
  `status.warning` = red, `status.pending` = amber. Documented in CLAUDE.md (Move 8). Decided 2026-08-11
  NOT to rename — it's documented, and renaming touches tailwind.config + every `bg-status-*` consumer for
  marginal gain. Left as-is on purpose.

## Resolved

- [x] **Command Center "Open Work Orders" tile now counts task work orders** (#7).
  Was counting the equipment `work_orders` table; now uses `useTaskWorkOrders(orgId)` and counts
  funnel_stage not in (completed, rejected). Commit `6c3b4cf`, 2026-08-11.

- [x] **Property-badge text contrast is now luminance-aware** (#1).
  Added `src/lib/colorContrast.ts` `getContrastText(hex)` (WCAG relative luminance) and applied it to
  property-color-backed initials in Command Center + Settings. Commit `40be763`, 2026-08-11.

- [x] **Renamed misleading `openWorkOrders` → `openAlerts`** in Command Center propertyStats (#3).
  Commit `40be763`, 2026-08-11.

- [x] **Tokenized residual raw-palette indicators** (#6).
  Offline banner / pending-sync / notification indicators moved off raw yellow/red/amber to theme-aware
  `status.*`. Commit `40be763`, 2026-08-11.

- [x] **Removed dead status CSS vars + fixed a broken class** (#8).
  Removed unused `--status-safe/danger/info/muted` from globals.css; fixed `DayCloseOut.tsx` which used
  non-existent `status-danger` classes (rendered no color) → `status-warning`. Commit `40be763`, 2026-08-11.

- [x] **`assignTaskWorkOrder` atomicity + double-assign guard (funnel P1).**
  Replaced the two-write helper with an atomic `SECURITY INVOKER` RPC `assign_task_work_order` (migration
  `assign_task_work_order_rpc`): inserts the assignment and sets `funnel_stage='assigned'` in one
  transaction; raises unless the WO is in the caller's org, has a property, and is in stage `accepted`.
  Commit `0ae8a69`, 2026-08-11.

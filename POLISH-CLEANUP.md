# Polish Gameplan — Cleanup Punch-List

Running list of deferred / follow-up items surfaced while executing the 8-move
polish gameplan (see the shared gameplan artifact). These are **not** blockers —
they're things to batch-address in a dedicated cleanup pass.

_Started: 2026-08-10 · last swept: 2026-08-11 (Sweep A) · Sweep B queued 2026-08-15_

## Sweep B — DONE (Codex, commit `553d527`, 2026-08-15 · Claude-audited)
<!-- prompt archived at docs/codex-prompts/codex_polish_sweep_b.md -->


One concern: residual raw-palette colors → design tokens (Rule 23). Executed by
Codex from `codex_polish_sweep_b.md`; diff audited against the rules by Claude —
6 files, color-preserving token mapping, `dark:` variants dropped, exclusions
(print/export stylesheets, recharts data hex, QR `bg-white`, `ui/*`,
`property.color`) untouched, verify grep down to the QR exception, clean build.

- [x] `ErrorRetry.tsx` — shared error card `bg-red-50 text-red-700` → `status.warning` tokens.
- [x] `SchedulerPage.tsx` — hour-threshold indicators → `status.active` / `status.pending`. Codex also (in-scope) converted the `STATUS_STYLES` shift-status map and department-color helper — object-literal `className` strings my grep missed — from `emerald/amber/blue/red/slate` to `status.active/pending/complete/warning/hold`, hues preserved. Also finished a pre-existing gap: `sick` had a token badge but a raw `red-400` cell border.
- [x] `ResetPasswordPage.tsx` — both error boxes `red-500/red-400` → `status.warning` tokens.
- [x] `ChemicalSettings.tsx` — "Saved" label `text-emerald-600` → `text-status-active`.
- [x] `FeedbackWidget.tsx` — filled-star `text-amber-500` → `text-status-pending`.
- [x] `ApplicationsPage.tsx` — dashed caution note `amber-300/50/800` → `status.pending` tokens.

## Open

- [ ] **Onboarding is unmounted — re-wire `OnboardingWizardV2`** (feature, deferred).
  V1 deleted in Move 5. `OnboardingWizardV2.tsx` is still referenced nowhere — nothing renders onboarding
  for new users. Needs a product decision on WHERE it mounts (new-org / first-login flow), so it's feature
  work, not mechanical cleanup. Deferred out of the cleanup pass 2026-08-11.

- [ ] **`status.*` token naming is semantically off** (documented; rename intentionally SKIPPED).
  `status.warning` = red, `status.pending` = amber. Documented in CLAUDE.md (Move 8). Decided 2026-08-11
  NOT to rename — it's documented, and renaming touches tailwind.config + every `bg-status-*` consumer for
  marginal gain. Left as-is on purpose.

## Resolved

- [x] **Consolidated the two `EmptyState` components** (#5).
  Kept `@/components/EmptyState` (10 consumers); deleted `src/components/shared/EmptyState.tsx` + its
  barrel export. NotesPanel's import of the shared one was dead (never rendered) so no migration needed.
  Commit `3eddba0`, 2026-08-11.

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

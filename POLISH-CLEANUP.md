# Polish Gameplan — Cleanup Punch-List

Running list of deferred / follow-up items surfaced while executing the 8-move
polish gameplan (see the shared gameplan artifact). These are **not** blockers —
they're things to batch-address in a dedicated cleanup pass.

_Started: 2026-08-10_

## Open

- [ ] **Property-badge text contrast is not luminance-aware.**
  `src/pages/CommandCenterOperationalPage.tsx` (property cards + list rows) now
  renders initials with `text-text-inverse` on an arbitrary `property.color`
  background. `text-inverse` is near-black in dark mode / near-white in light mode,
  so a property whose org color is dark (navy/forest/maroon) gets unreadable dark
  initials in dark mode (and pale colors break the other way in light mode). The
  old `text-white` was a safer static choice on saturated fills.
  **Fix:** add a shared `getContrastText(hex)` helper (relative-luminance → black/white)
  and use it wherever a property/org color backs text. Audit other property-badge
  render sites for the same pattern (workboard, properties map, employees).
  _Surfaced in: Move 2 (commit cab4265)._

- [ ] **`status.*` token naming is semantically off** (documented in Move 8; optional rename still open).
  `status.warning` maps to red (hue ~25) while `status.pending` is amber (hue ~70),
  and separate `--warning` (amber) / `--destructive` (red) tokens also exist.
  ✅ Mapping is now documented in CLAUDE.md (Move 8, commit 05403e6), so it's no longer a silent trap.
  Remaining (optional): actually rename the tokens for semantic clarity — a code change touching
  tailwind.config.ts + all `bg-status-*` consumers. Low priority now that it's documented.

- [ ] **Misleading field name in Command Center `propertyStats`.**
  `propertyStats.openWorkOrders` is actually `notes.filter(type==='alert').length` and feeds the
  "Issues / open alerts" tile — but it now sits beside a real "Open Work Orders" tile
  (`useRevenueWorkOrders`). Rename the field to `openAlerts` to stop it lying about its content.
  `src/pages/CommandCenterOperationalPage.tsx`. _Surfaced in: Move 4 (commit 0ce7dfe)._

- [ ] **Two live `EmptyState` components with divergent APIs (consolidate, don't delete).**
  `src/components/EmptyState.tsx` (props `icon, title, description, actionLabel, onAction`) is imported
  by ~10 files via `@/components/EmptyState`. `src/components/shared/EmptyState.tsx` (props
  `icon, title, description, action`) is used via the `@/components/shared` barrel (NotesPanel).
  Both are in active use — NOT dead code. Consolidate to one component + one prop shape and migrate
  the ~10 call sites, then delete the loser. Real refactor; do it deliberately, not as a "safe delete."
  _Reclassified out of Move 5 after grep, 2026-08-10._

- [ ] **Onboarding is unmounted — re-wire `OnboardingWizardV2`.**
  Decision (2026-08-10): keep V2, delete V1. V1 (`OnboardingWizard.tsx`) is being removed in Move 5.
  But `OnboardingWizardV2.tsx` is still referenced nowhere — nothing renders onboarding for new
  users. Remaining work: re-mount V2 in the new-org/new-user flow (or confirm it's intentionally
  deferred). _Surfaced in: Move 5 grep, 2026-08-10._

- [ ] **Residual raw-palette indicators (non-pills) violate Rule 23.**
  A few raw Tailwind colors remain on small indicators the Move 7 sweep correctly skipped:
  AppLayout's offline banner (`border-yellow-200 bg-yellow-50 text-yellow-900`), the mobile
  pending-sync banner/dot, and the notification severity dot. Tokenize these to `status.*`
  (warning/pending) when convenient. Low priority — edge indicators, not core UI.
  _Surfaced in: Move 7b, 2026-08-10._

- [ ] **Command Center "Open Work Orders" tile counts the wrong table (revisit after funnel P2).**
  The Move 4 tile uses `useRevenueWorkOrders` → the **equipment** `work_orders` table. Once the task
  work-order funnel (`task_work_orders`) is live, decide whether that tile should count task WOs
  instead, or show both equipment + task counts. _Surfaced in: funnel P0, 2026-08-11._

- [ ] **Audit for dead status CSS vars after the migration.**
  `app/globals.css` still defines `--status-safe / --status-danger / --status-info /
  --status-muted` from the older system; the canonical Tailwind set is now
  `active / pending / warning / complete / hold`. Confirm nothing consumes the old
  vars (note: `src/index.css` is already dead per CLAUDE.md) and remove the unused ones.

## Resolved

- [x] **`assignTaskWorkOrder` atomicity + double-assign guard (funnel P1).**
  Replaced the two-write helper with an atomic `SECURITY INVOKER` RPC
  `assign_task_work_order(p_work_order_id, p_employee_id, p_date)` (migration
  `assign_task_work_order_rpc`, 2026-08-11): inserts the assignment and sets
  `funnel_stage='assigned'` in one transaction, and raises unless the WO is in the
  caller's org, has a property, and is in stage `accepted` — so double-assign is
  impossible at the DB layer. `assignTaskWorkOrder` now calls it (commit `0ae8a69`).
  Resolved 2026-08-11.

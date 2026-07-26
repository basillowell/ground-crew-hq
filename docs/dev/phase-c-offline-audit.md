# Phase C — Offline Sync: Audit & Hardening Design

> Prepared: 2026-07-26 · HEAD `102b9c2` · For review before any code changes.
> This is the "design-first" deliverable for the offline piece of Phase C. It is
> an AUDIT of the mechanism that already exists, not a greenfield design.

---

## 0. Correction to the product audit

[product-audit.md](product-audit.md) and [roadmap-next-4-phases.md](roadmap-next-4-phases.md)
both state the app has **"no offline support."** That is **wrong**, and I'm
correcting it here. `MobileFieldWorkspacePage.tsx` contains a working offline
outbox: an offline banner, a `pendingSyncCount` indicator, a `field-sync-queue`,
`enqueueSyncAction`, and a `syncQueue()` drain on reconnect. The problem is not
that offline is missing — it's that the existing implementation has **payroll-
correctness bugs**. That is a more serious situation than "not built," because
buggy sync silently corrupts data, whereas missing sync merely fails loudly.

**Mitigating fact:** there are currently **no employee-role logins** in the org
(verified 2026-07-25). Field crews are the only ones who clock in offline, so
these bugs are **latent** today, not actively corrupting data. They must be fixed
**before** crew accounts start using offline mode.

---

## 1. What exists (as-built)

`MobileFieldWorkspacePage.tsx`:
- A queue in `localStorage` under key `field-sync-queue` (`loadSyncQueue` /
  `saveSyncQueue`, lines ~447-461).
- `enqueueSyncAction` pushes an item when the clock/assignment action happens
  while `!navigator.onLine`, or after an online insert errors.
- `syncQueue()` (lines ~469-509) drains on reconnect: for each item it either
  `.update()`s an assignment or `.insert()`s a clock_event, collecting failures
  into `remaining`, then `saveSyncQueue(remaining)` once at the end.
- Two queued types: `assignment_status` (an `.update`) and `clock_event` (an
  `.insert`).

The scaffolding is real and the UX (offline banner, "Synced N offline changes"
toast, pending count) is already wired through `AppLayout` → `WorkflowTopBar`.

---

## 2. Findings, ranked

### F-1 — Captured clock time is LOST; payroll records sync-time, not tap-time · CRITICAL

The clock handler captures a timestamp for the optimistic UI event
(`MobileFieldWorkspacePage.tsx:1125`, `new Date().toISOString()`), but the
**enqueued payload does not include it** (lines 1132-1139 and the type at
143-150 have `employee_id, property_id, org_id, event_type, location_lat,
location_lng` — no `timestamp`). When `syncQueue()` later runs
`clock_events.insert(payload)` (line 490), no timestamp is sent, so the DB
default `timestamp DEFAULT now()` fires.

**Consequence:** a crew clocks in at 7:00am in a dead zone, drives into signal at
10:00am — the clock-in is written as **10:00am**. Three hours vanish, silently,
in the employer's favor. This is the worst kind of bug: invisible, and it
corrupts the one thing the field app exists to protect.

**Fix:** capture `timestamp` (and a client `id`, see F-2) at tap time and put
them in the queued payload. `clock_events.timestamp` is an explicit column and
`clock_events.id` is a client-settable `uuid` — both already support this.

### F-2 — No idempotency; a lost ack or mid-drain kill DUPLICATES clock events · CRITICAL

The clock_event payload has no client-generated `id`, and `syncQueue()` does a
plain `.insert()` with no conflict handling. Two concrete failure paths:

1. The insert commits on the server, but the response is lost (flaky signal) or
   the app is backgrounded/killed before `saveSyncQueue(remaining)` runs. The
   item stays in the queue → next drain re-inserts → **duplicate clock event.**
2. `saveSyncQueue(remaining)` runs **once, after the whole loop**. If the app is
   killed mid-drain (routine on mobile), nothing is persisted, so **every** item
   — including ones already inserted to the DB — remains in `localStorage` and is
   re-inserted on the next drain.

**Consequence:** duplicate clock-ins/outs → payroll double-counts. No unique
constraint catches it because there's no client id to conflict on.

**Fix:** (a) generate `id = crypto.randomUUID()` at tap time, include it in the
payload; (b) sync with `.upsert(payload, { onConflict: 'id', ignoreDuplicates:
true })` so a replay is a no-op; (c) persist the queue **incrementally** — remove
each item as it succeeds, not once at the end — so a mid-drain kill can't replay
completed items.

### F-3 — Payroll data lives in localStorage · HIGH (Rule 15)

The outbox is `localStorage` (`field-sync-queue`). **CODERULES Rule 15** forbids
business data in localStorage. Beyond the rule, `localStorage` is synchronous,
~5 MB capped, and easily cleared — a poor home for pending payroll writes.

**Fix:** move the outbox to **IndexedDB** (async, durable, structured). This may
warrant the tiny `idb` wrapper (needs package approval) or a small raw-IndexedDB
helper (no dep). Recommend raw helper to avoid a new package.

### F-4 — assignment_status sync is blind last-write-wins · MEDIUM

`syncQueue()` does `.update(payload).eq('id', assignmentId)` with no check that
the server row hasn't changed since. If a manager reassigned or edited the task
while the crew was offline, the crew's stale update silently overwrites it.
Lower severity than the clock bugs, but a real conflict hole.

**Fix (later):** include the field the crew actually changed only, or a
`updated_at` guard / conflict surface. Acceptable to defer past the clock fixes.

---

## 3. Recommended phasing

**C-off-1 — the payroll correctness fix (urgent, small, targeted).** F-1 + F-2:
captured `timestamp` + client `id` in the clock payload, idempotent upsert-ignore
drain, incremental queue persistence. This is a focused change to the existing
handler and `syncQueue()`, not a rewrite. The idempotency (upsert on `id`,
ignore duplicates) is partially **validatable at the DB layer** the same rolled-
back way the revenue chain was — I can prove a double-insert of the same id
yields one row.

**C-off-2 — move the outbox to IndexedDB (F-3).** Robustness + Rule 15. Larger,
independent, and can follow C-off-1.

**C-off-3 — assignment conflict handling (F-4).** Defer.

## 4. The validation limit that stays true

I can prove the **idempotency and timestamp** fixes at the DB layer (rolled back).
What I **cannot** prove without a real device on a real network is the end-to-end
offline behavior: airplane-mode → clock in → reconnect → exactly one row with the
tap-time timestamp; double-tap offline → no duplicates; kill-mid-drain → no
replay. Those require a physical test. So C-off-1 should ship with a **device
test checklist** the owner runs before crews rely on offline mode:

1. Airplane mode → clock in → wait 2 min → reconnect. Expect: one clock_in, its
   `timestamp` ≈ the tap time (not the reconnect time).
2. Airplane mode → clock in → clock out → reconnect. Expect: exactly two events,
   correct order and times.
3. Airplane mode → clock in → force-quit the app → reopen → reconnect. Expect:
   one clock_in, no duplicate.
4. Reconnect with two queued items, kill the app mid-sync → reopen. Expect: no
   duplicated events.

## 5. Recommendation

F-1 and F-2 are payroll-corrupting and should be fixed **before** any crew logins
are created. They're small, targeted, and partly DB-validatable. Because you
asked to keep the offline work design-first, I've stopped at this audit rather
than rewriting the clock-sync path — that path is exactly what deserves your eyes
before I change it. Say go and I'll implement C-off-1 (with the rolled-back DB
validation of the idempotency), then hand you the device checklist for the part
only a phone can prove.

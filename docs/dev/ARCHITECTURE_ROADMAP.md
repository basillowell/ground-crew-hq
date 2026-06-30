# Ground Crew HQ — Supabase Resilience Roadmap

Created June 29, 2026, following a multi-session investigation into
app-wide stale-data failures traced to a Supabase auth-js internal
lock contention issue, compounded by missing query timeouts and an
overly aggressive blanket `retry: false` policy.

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Done

## Items

- [x] Add bounded timeout to EmployeesPage.tsx Availability query
- [x] Add bounded timeout to SchedulerPage.tsx weekScheduleQueries
- [x] Narrow loading-skeleton gate on SchedulerPage.tsx to genuine
      first-load only
- [x] Audit and fix the same unguarded-fetch pattern across other
      sidebar pages (Workboard, Dispatch, Command Center, Equipment,
      Invoicing, Chemical Logs, Safety)
- [x] Add visibilitychange listener invalidating all queries on tab
      focus (root-level, App.tsx)
- [x] Remove the temporary [DIAG-VIS] getSession() diagnostic from
      App.tsx now that it has served its purpose
- [x] Revisit `refetchOnWindowFocus: false` — consolidated to the
      native React Query mechanism, removed the custom
      visibilitychange listener
- [x] Replace blanket `retry: false` with a distinction between
      genuine application errors (no retry) and transient/timeout
      errors (1-2 retries with backoff) — removed from SchedulerPage.tsx
      and EmployeesPage.tsx, both now inherit the global retry: 3 with
      exponential backoff
- [x] Research whether the currently pinned @supabase/supabase-js
      version is behind on lock-contention-related fixes — RESOLVED:
      this is a confirmed, currently unresolved upstream bug
      (supabase/supabase#44642), not a version-lag issue. The exact
      pinned version, exact stack (React+Vite+Vercel), and exact
      error message match a known, open issue triggered by Chrome
      tab suspension. No clean SDK-level fix exists yet. Our bounded
      timeouts + query invalidation are the practical ceiling until
      upstream resolves it.
      A forced-page-reload-after-inactivity mitigation WAS implemented
      and tested in production. It was confirmed to make the problem
      worse, not better — reloading into the same corrupted client state
      caused an infinite reload loop. It was reverted (see commit history:
      implemented, then reverted same day). This ruled out "just reload"
      as a viable fix and pointed investigation toward the actual root
      cause below.
- [ ] PENDING USER VERIFICATION: re-test the original repro
      (background the tab for several minutes via switching to a
      different OS-level app) now that both the noOpLock fix
      (70a1bff) and the AbortController fix (823a5d0) are live.
      Specifically check pages/actions not yet validated against
      these two fixes: Settings, Equipment, Invoicing, Chemical
      Logs, and the Scheduler Add Shift save flow.

## Post-Roadmap Findings (June 29-30, 2026)

Two further root causes were found after the items above were
completed, because the original fixes were not sufficient on their
own:

**Finding 1 — Web Lock bypass.** A stored Supabase session value was
inspected directly and found structurally healthy (well-formed JWT,
valid expiry, valid refresh token) — ruling out corrupted session data
as the cause. This pointed to the lock-contention bug itself (not a
symptom of it) as the actual blocker: Supabase's auth client uses
navigator.locks to coordinate session refresh across tabs, and the
automatic refresh-on-page-load check was deadlocking on an orphaned
lock after extended tab backgrounding. Fixed by replacing the lock
coordination with a no-op function (`lock: noOpLock` in
src/lib/supabase.ts), bypassing navigator.locks entirely. This was an
explicitly authorized exception to CODERULES Rule 4/21, granted after
this documented investigation — see commit 70a1bff.

**Finding 2 — non-cancelling timeouts.** After Finding 1 shipped, a
stuck Add Shift save (a write, not a read) was observed hanging
indefinitely with zero timeout, and a timed-out Workboard read could
not be recovered even by clicking Retry. Root cause: every timeout
added earlier in this roadmap used `Promise.race(query, timeout)`,
which only stops Claude's/the app's own JavaScript from waiting — it
does NOT cancel the underlying network request. An abandoned request
stays open and occupies a browser connection slot indefinitely;
enough of these can queue out every subsequent request on the page,
including a manual Retry, explaining the retry-proof cascading
failures. Fixed by replacing every Promise.race timeout with a real
AbortController + Supabase's .abortSignal(), which genuinely cancels
the underlying request — across SchedulerPage.tsx, EmployeesPage.tsx,
EquipmentPage.tsx, InvoicingPage.tsx, ApplicationsPage.tsx, and
WorkboardContent.tsx (including its previously-unprotected Add Shift
save mutation). See commit 823a5d0.

## Notes
This file tracks architecture-level follow-up work distinct from
day-to-day feature/bug sessions. Update the status markers as each
item is actually completed and verified — do not mark an item [x]
without confirming the change is live in production.
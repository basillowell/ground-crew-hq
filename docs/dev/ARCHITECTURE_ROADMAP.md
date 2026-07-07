# Ground Crew HQ — Supabase Resilience Roadmap

Created June 29, 2026, following a multi-session investigation into
app-wide stale-data failures traced to a Supabase auth-js internal
lock contention issue, compounded by missing query timeouts and an
overly aggressive blanket `retry: false` policy. Updated June 30,
2026 after two further root causes were found and fixed (Web Lock
bypass, non-cancelling timeouts), and a third, intermittent
write-side race condition was identified and documented as ongoing
monitored risk rather than fully resolved.

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
- [x] User verification completed (June 30, 2026). Result: PARTIAL
      SUCCESS. Reads (Scheduler, Workflow, Team, and after a
      follow-up session, Settings/Dispatch) now reliably recover
      after extended tab backgrounding. Writes (specifically the
      Scheduler "Add Shift" save) are INTERMITTENTLY affected — see
      Finding 3 below. This is downgraded from "blocking" to
      "known, monitored, intermittent" rather than left unresolved
      and undocumented.
- [x] Extend AbortController coverage to SettingsPage.tsx (10
      previously-unprotected queries — the most exposed page in the
      app) and DispatchBoardPage.tsx (2 queries). Confirmed via
      direct file inspection that CommandCenterOperationalPage.tsx,
      SafetyPage.tsx, ReportsPage.tsx, and JobCostingPage.tsx make
      no direct Supabase calls and needed no changes.
- [ ] Sign-out button investigated — reported not reliably
      redirecting to the landing page after clicking. Root cause
      not yet confirmed; needs a dedicated follow-up session
      separate from this investigation.

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

**Finding 3 — intermittent write failures (unresolved, monitored).**
After Findings 1 and 2 shipped, the Scheduler "Add Shift" save was
observed hanging indefinitely after tab backgrounding, with the
[DIAG-SAVE] diagnostic confirming the handler reached
`supabase.from('schedule_entries').insert()` but the actual HTTP
request never appeared in a HAR capture — not pending, not failed,
genuinely never sent. On a SEPARATE reproduction attempt (same code,
same page, same backgrounding scenario), the identical save succeeded
cleanly in 155ms (confirmed via HAR: `POST .../schedule_entries ->
201`). Same code path, two different outcomes under the same
conditions — this is a genuine intermittent race condition, not a
deterministic bug, most likely tied to internal timing of Supabase's
background token-refresh cycle relative to the exact moment a write
is attempted.

This was NOT fixed today. A race condition that fails roughly some
fraction of attempts, deep inside a third-party auth library's
internals, requires many repeated, carefully-timed reproductions to
characterize before a real fix can be attempted responsibly — this is
explicitly flagged as future work, not silently left undocumented.

Mitigation already in place that reduces (but does not eliminate) user
impact: the AbortController fix from Finding 2 means a save that does
hang will at least time out after 15 seconds with a clear error
message and a re-enabled form, rather than freezing the UI forever
with no recovery path — the user can simply retry, and per this
session's observation, a retry is likely to succeed since the failure
appears to be timing-dependent rather than persistent.

Future investigation, if this becomes a frequent pain point: capture
multiple repeated HAR files across many Add Shift attempts immediately
after backgrounding, specifically noting elapsed time since the tab
became visible and elapsed time since the access token was last
refreshed, to look for a correlating pattern before attempting a fix.

## Notes
This file tracks architecture-level follow-up work distinct from
day-to-day feature/bug sessions. Update the status markers as each
item is actually completed and verified — do not mark an item [x]
without confirming the change is live in production.

## Next.js Migration Status (July 7, 2026)

### Completed
- [x] Sessions 1-8: Full Next.js App Router migration executed.
- [x] Vite removed, AuthContext removed, legacy browser-side session management removed.
- [x] `utils/supabase/browser.ts`, `server.ts`, and `middleware.ts` created.
- [x] All 17 app routes wired to existing page components.
- [x] `useUser.ts` and `useOrgProfile.ts` hooks replace AuthContext.
- [x] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` added to Vercel.
- [x] `getSession` fix for `useUser.ts` initial load race condition.
- [x] `authState` terminal-state guard in `LaunchPortalPage.tsx`.
- [x] Login handoff fix in `LaunchPortalPage.tsx`: replaced React Router `navigate('/app/scheduler', { replace: true })` with `window.location.href = '/app/scheduler'` so the post-login request goes through Next.js middleware and can establish the server-side Supabase session cookie. See commit `ef86e1d`.

### Final Blocking Issue Status
- [x] RESOLVED: the previously identified final blocker was the post-login client-side navigation path. HAR evidence showed login succeeded, profile calls returned 200, then the server app shell redirected because middleware saw no server-side cookie. The fix was the one-line full-page handoff in `src/pages/LaunchPortalPage.tsx`, now present as `window.location.href = '/app/scheduler';`.

### Architecture now in place
- Next.js middleware runs on every request.
- Server-side Supabase cookie management is handled via `@supabase/ssr`.
- Legacy browser-side AuthContext session ownership has been removed.
- Legacy Vite app entry/config files have been removed.
- The remaining auth flow uses the Next.js App Router shell plus Supabase SSR client utilities.


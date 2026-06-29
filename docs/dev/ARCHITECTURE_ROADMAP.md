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
      upstream resolves it. A more aggressive mitigation (forced
      page reload after N seconds of inactivity) was identified in
      the community thread but intentionally not implemented due to
      its UX tradeoff (loses unsaved in-progress state) — pending
      product decision.
- [ ] Once the above are resolved, re-test the original repro
      (background the tab for several minutes via switching to a
      different OS-level app, not just a browser tab) and confirm no
      page shows stale/stuck data afterward

## Notes
This file tracks architecture-level follow-up work distinct from
day-to-day feature/bug sessions. Update the status markers as each
item is actually completed and verified — do not mark an item [x]
without confirming the change is live in production.
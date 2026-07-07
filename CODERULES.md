# Ground Crew HQ — AI Code Rules
# Version: 4.0 · May 2026
# Applies to: Claude Code, Codex, any AI agent working in this repo
# Maintained by: Basil Lowell (product owner)

---

## Mission
Build a clean, stable product UI. Never touch infrastructure.
When in doubt about scope, stop and ask Basil before proceeding.

---

## Hard Boundary

AI agents ONLY change:
- React components, TypeScript, hooks, pages, styles

AI agents NEVER change:
- Supabase schema, tables, columns, indexes
- SQL migrations or seed files
- RLS policies or database functions
- AuthContext.tsx (auth architecture is frozen)
- Branch config or Vercel settings
- Any file in supabase/migrations/

If a schema or auth change is needed, STOP and report:
```
DB_CHANGE_REQUIRED: [exact table/column/policy needed and why]
```
Basil applies it (or delegates to Claude Code). Resume after confirmation.

---

## Non-Negotiable Rules

**Rule 1 — No SQL**
Never create executable SQL. Flag schema gaps with DB_CHANGE_REQUIRED.

**Rule 2 — No hardcoded IDs**
Never hardcode UUIDs, org IDs, user IDs, or env values anywhere.
Always read from: `const { orgId, user, userRole } = useAuth()`

**Rule 3 — Main branch only**
Never create new branches. All commits go to `main`.
Never force push without explicit approval from Basil in that session.

**Rule 4 — Auth is frozen**
Never modify AuthContext.tsx.
Never call set_claim(), refreshSessionWithRetry(), or JWT manipulation.
If auth appears broken: stop and report, do not attempt to fix.

**Rule 5 — Two queries, never nested select**
PostgREST nested selects require a DB foreign key.
Always use two separate queries and join in TypeScript.

**Rule 6 — Never blank, never infinite**
Every data section needs: skeleton → error+retry → content.
Fetch timeout: 8s → show error + Retry button.
Retry button must actually re-trigger the fetch (useCallback).

**Rule 7 — Corrupted file = full rewrite**
If a file has JSX errors or has been patched 10+ times:
Delete all content. Rewrite from scratch. Never patch a broken file.
Current known file: SettingsPage.tsx — always rewrite if broken.

**Rule 8 — Product UI only**
Never render: "Agent Skills", "Codex", "Claude", "prompt", "skill", "RLS", "migration"
Replace any agent/skill UI with: "Operations Assistant — Coming soon"

**Rule 9 — Build before commit (not just type check)**
`npm run build` must pass with 0 errors before every commit.
`npx tsc --noEmit` is NOT sufficient — Vite build and tsc are different gates.
Vercel runs the build, not the type check. A passing type check does not mean
the build passes. This distinction caused real deploy failures (ver2.5.29.3–29.5).
Fix all TypeScript errors. Never use `// @ts-ignore`.

**Rule 10 — Column names come from live-db-state.md, never from memory**
Before writing ANY query (.select, .eq, .insert, .update, .order, .filter,
payload keys), read `docs/dev/live-db-state.md` to confirm the column exists.
If the column isn't listed there, STOP — do not guess or invent it.
JS/TS variable and interface names may stay camelCase; only DB-bound strings
must match the schema exactly (all snake_case as of May 2026 migration).

**Rule 11 — Verify after any rename**
After renaming a column, file, function, or prop, grep the codebase for the OLD
name and confirm ZERO remaining references before finishing.
A passing build does NOT prove this — stale column strings compile fine and only
fail at runtime (400 errors from Supabase). The final step of any rename task is
a clean re-grep.

**Rule 12 — One concern per pass**
Each task changes one feature area. If a task spans multiple unrelated areas
(e.g. weather + chemical + auth), stop and ask to split it. Scope creep across
areas is the top cause of drift. Touching 1–3 related files is normal; touching
8+ files across unrelated features is a red flag — report it and wait.

---

**Rule 13 - Property inserts require duplicate-submit protection**
Every property insert must have a submitting/loading state that disables the
save action while the insert is in flight. This prevents duplicate property rows
from double-clicks, Enter-key repeats, or slow-network retries.

**Rule 14 - No sentinel values into UUID columns**
Any selector that can resolve to a placeholder like 'all' (meaning "no
specific item chosen") must be explicitly checked and converted to null,
or the action blocked with a toast, before it reaches any Supabase
insert/update payload. Never let a sentinel string land in a uuid column.

**Rule 15 - No business data in localStorage**
Any data used across more than one device, session, or user (categories,
SOPs, anything visible to a teammate) lives in Supabase, never
localStorage/sessionStorage - even as a "for now" shortcut.

**Rule 16 - Verification must include real command output**
A "done" report alone isn't sufficient. Every commit report must include
actual output: git log -1 --oneline, git status --short, and grep -n
counts for any removed/renamed symbols - not prose summary only.

**Rule 17 - Admin/manager RLS scopes to org, not personal property assignment**
Any RLS policy or helper function gating admin/manager access checks
org_id membership only - never the admin's own employee.property_id.
An admin manages their whole org, not just the one property their own
employee record happens to be pinned to.

**Rule 18 — Hierarchical scope columns must be nullable, not faked**
When building drill-down features (org → property → employee → task),
each narrower scope column is a nullable FK, never forced NOT NULL with
a fallback anchor. RLS must explicitly handle the NULL case at each
level — don't assume an existing property-scoped helper function
handles NULL correctly without checking.

**Rule 19 — Click targets scale to context, not uniformly**
Desktop-dense admin/settings surfaces may use compact controls. Primary
actionable buttons on touch-driven operational surfaces (Workboard,
Workflow, Dispatch) need a minimum ~36-40px hit area regardless of
visual size — achieved via padding/invisible hit-area expansion, not by
literally enlarging icons and changing visual density.

**Rule 20 — Commit and push are part of a successful session, not a separate step**
If npm run build passes and the prompt's VERIFY step confirms the
change matches what was described, commit AND push to origin/main in
the same session — do not stop and wait for a separate push
instruction. If the build fails, the verify step doesn't match, or
scope is unclear, STOP without committing or pushing and report exactly
what's blocking it with real command output.

**Rule 21 — Don't add new Supabase auth-session callers outside AuthContext**
Every getSession()/refreshSession() call competes for a single
browser-level lock that Supabase's own auto-refresh cycle also depends
on. A stuck/orphaned lock has been directly observed in production
("Lock ... was not released within 5000ms... Forcefully acquiring the
lock to recover") and can cascade into app-wide stale-data symptoms
across unrelated pages. Do not add new calls to these methods outside
what AuthContext.tsx already does internally — not even for
diagnostic or visibility-triggered code. React to real query failures
instead of proactively polling session state.

**Rule 22 — Every Supabase queryFn needs a bounded timeout**
A fetch with no timeout can hang indefinitely if a browser tab is
backgrounded mid-request and never properly resumes — confirmed root
cause of stale-data incidents on the Scheduler and Availability pages.
Every queryFn that calls Supabase directly must wrap the call in a
Promise.race against a 10-15 second timeout, matching the pattern
already established in EmployeesPage.tsx and SchedulerPage.tsx. This
applies to all new queries going forward, not just the ones already
fixed.

---

## Coding Rules

**Stale state:** Use `useCallback` for all fetch functions.
Use `key` prop on tab components to force clean remount on tab switch:
```tsx
{tab === 'Scheduler' && <SchedulerTab key="scheduler" orgId={orgId} />}
```

**Modal state:** Always reset all modal state on close via a single `handleClose()`.
Never just `setShowModal(false)` — always reset internal state too.

**Time values:** Supabase returns times as "HH:MM:SS" — always `.slice(0,5)` before display.

**Org scoping:** Every query must include `.eq('org_id', orgId)` on tables with org_id.

**camelCase tables note:** As of the May 2026 migration, ALL tables are
snake_case. There are no remaining camelCase columns. If you find a
camelCase column reference in the code, it is a bug — fix it to snake_case.

**Retry strategy:** `retry: false` is correct for genuine application
errors (RLS denial, validation failure) that won't resolve by
retrying. It is the wrong setting for transient/timeout-shaped
failures (a request that times out due to tab backgrounding) — those
should get 1-2 automatic retries with backoff before surfacing as an
error. Don't apply `retry: false` blanket-wide across every query;
distinguish by what kind of failure is actually expected.

**Loading/skeleton gates:** Gate loading skeletons on genuine
first-load only (`isLoading` with zero cached data) — never on every
background `isFetching`. A slow or temporarily stuck background
refetch must never wipe an already-successfully-rendered view; let the
last good render persist while a refetch is in flight.

---

## Lessons from the Vite → Next.js Migration Debugging Session (July 2026)

- SSR-guard browser APIs: any `window`, `document`, `localStorage`, or `sessionStorage` access must be inside a client-only guard (`typeof window !== 'undefined'`) or an effect/event handler. Lazy `useState` initializers still execute during server render in Next.
- Shared session/profile state belongs in Context, not per-component hooks. Auth/profile hydration must run once in a provider and be consumed via Context; do not let every component that calls a hook start its own `app_users`/profile fetch chain.
- Scope derived "attempted" flags to identity. State like `profileAttempted`, `profileError`, or "loaded once" must be tied to the user/org id it was computed for, so stale logged-out or previous-user state cannot become a terminal error for the next identity.
- After framework migrations, grep repo-wide for old framework dependencies and props: remove `react-router-dom`, `BrowserRouter`, `useNavigate`, `useLocation`, `Link to=`, Vite globals, and any framework-specific globals after migrating to Next.
- Test render-loop bugs against production before dev-mode debugging. Dev-mode React/Next behavior can add StrictMode noise and extra ref/effect churn; confirm whether a maximum-update-depth issue reproduces in a production build before chasing dev-only traces.
- Chrome's default HAR export can strip `Cookie` and `Authorization` headers. A HAR showing "no auth headers" is not proof headers were absent on the wire unless the export preserved sensitive headers.
- Confirm fixes are actually deployed before re-testing. Verify the deployed commit/build hash or app version before concluding a production test disproves a local or newly merged fix.
- Next.js can vendor its own internal React/React DOM under `next/dist/compiled/*`; `package.json`'s `react`/`react-dom` version is not the only React implementation involved in runtime stack traces.

---

## Start-of-Session Checklist

Before writing any code in a new session:
1. Read `CODERULES.md` (this file)
2. Read `docs/dev/live-db-state.md` if the task touches any DB query
3. Read the specific file(s) being changed before editing
4. Confirm the task is scoped to one feature area (Rule 12)

---

## Pre-Commit Checklist

Before every commit:
1. `npm run build` — must pass with 0 errors (not just `tsc --noEmit`)
2. If any rename occurred — re-grep for old name, confirm 0 hits (Rule 11)
3. If any DB column was used — confirm it exists in `docs/dev/live-db-state.md`

---

## Git & Deploy

- Production URL: **ground-crew-hq.vercel.app**
- Supabase project: **fjqeekwisnbpxgebrnpl.supabase.co**
- Branch: **main only**
- Commit format: `feat|fix|refactor|chore: description (ver2.X.Y)`
- Version source of truth: `package.json` version is injected by `next.config.ts` as `NEXT_PUBLIC_APP_VERSION`; `src/constants/version.ts` reads `process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown'` and exports `APP_VERSION` for UI consumers.

---

## When to Stop

Stop immediately and report if:
- A schema column or table is missing → DB_CHANGE_REQUIRED
- A query returns unexpected null from RLS → DB_CHANGE_REQUIRED
- AuthContext needs modification → stop, do not touch
- A file has JSX corruption → report before rewriting
- Build fails after 2 attempts → report the exact error
- A column name isn't in live-db-state.md → do not guess
- A task spans multiple unrelated feature areas → ask to split first

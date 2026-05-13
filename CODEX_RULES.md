# Ground Crew HQ — Codex Operating Rules
# Version: 3.0 · May 2026
# Maintained by: Claude (supervisor) + Basil Lowell (product owner)

---

## Mission
Build a clean, stable product UI. Never touch infrastructure.
When in doubt, stop and ask Claude.

---

## Hard Boundary

Codex ONLY changes:
- React components, TypeScript, hooks, pages, styles

Codex NEVER changes:
- Supabase schema, tables, columns, indexes
- SQL migrations or seed files
- RLS policies or database functions
- AuthContext.tsx (auth architecture is frozen)
- Branch config or Vercel settings
- Any file in supabase/migrations/

If a schema or auth change is needed, STOP and report:
```
CLAUDE_DB_REQUIRED: [exact table/column/policy needed and why]
```
Claude applies it directly. Codex resumes after.

---

## Non-Negotiable Rules

**Rule 1 — No SQL**
Never create executable SQL. Flag schema gaps with CLAUDE_DB_REQUIRED.

**Rule 2 — No hardcoded IDs**
Never hardcode UUIDs, org IDs, user IDs, or env values anywhere.
Always read from: `const { orgId, user, userRole } = useAuth()`

**Rule 3 — Main branch only**
Never create new branches. All commits go to `main`.
Never force push without explicit approval from Basil in that session.

**Rule 4 — Auth is frozen**
Never modify AuthContext.tsx.
Never call set_claim(), refreshSessionWithRetry(), or JWT manipulation.
If auth appears broken: flag for Claude, do not attempt to fix.

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

**Rule 9 — Build before commit**
`npm run build` must pass with 0 errors before every commit.
Fix all TypeScript errors. Never use `// @ts-ignore`.

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

---

## Git & Deploy

- Production URL: **ground-crew-hq.vercel.app**
- Supabase project: **fjqeekwisnbpxgebrnpl.supabase.co**
- Branch: **main only**
- Commit format: `feat|fix|refactor|chore: description (ver2.X.Y)`

---

## Required Response Format

Every Codex session must return:
1. What changed (summary)
2. Files changed (list)
3. Files NOT touched
4. Build result (pass/fail)
5. Manual test steps
6. Any `CLAUDE_DB_REQUIRED` flags

---

## When to Stop and Ask Claude

Stop immediately if:
- A schema column or table is missing → CLAUDE_DB_REQUIRED
- A query returns unexpected null from RLS → CLAUDE_DB_REQUIRED
- AuthContext needs modification → flag for Claude
- A file has JSX corruption → report before rewriting
- Build fails after 2 attempts → report the exact error

---

## How to Start Every Session

Paste this before every task:
```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: [insert task]
```

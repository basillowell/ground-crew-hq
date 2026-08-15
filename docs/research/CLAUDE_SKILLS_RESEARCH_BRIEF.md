# Claude Code Skills Research Brief
*June 2026 — Research only, no installs, no code changes*

---

## Ecosystem Overview

Claude Code skills are SKILL.md files placed in `.claude/skills/<name>/` (project scope) or `~/.claude/skills/<name>/` (global scope). They load as slash commands when Claude Code starts. The primary installer is the **vercel-labs/skills** CLI (23.6k ⭐), invoked as `npx skills`.

### Critical Install-Path Bug (Active as of June 2026)

When running `npx skills add <repo> -g -a claude-code`, the CLI writes to `~/.agents/skills/` instead of `~/.claude/skills/`. Claude Code only reads `~/.claude/skills/`, so the skill is silently invisible. Three open GitHub issues confirm this is unresolved (#744, #851, #1355 on vercel-labs/skills). **Workaround:** After installing, manually copy the skill folder: `cp -r ~/.agents/skills/<name> ~/.claude/skills/` — or add a `SessionStart` hook in `~/.claude/settings.json` that does the copy automatically.

---

## Comparison Table by Category

### 1. Debugging / "Why Won't This Build"

| Skill / Tool | Repo | Stars | Type | What It Does | Install | Requirements |
|---|---|---|---|---|---|---|
| `claude doctor` | Built-in Claude Code | — | Built-in command | Checks Node version, auth tokens, env vars, MCP servers in one pass; surfaces ~80% of misconfigurations | `/doctor` (built-in) | None |
| Project Env Setup | claudedirectory.org (no GitHub confirmed) | N/A | Single skill | Auto-detects stack from version files (.node-version etc.), verifies runtimes, starts Docker Compose, runs migrations, seeds data | Manual: copy to `.claude/skills/env-setup/SKILL.md` | None, but Node/Docker must be present |

**Assessment:** No well-adopted third-party skill exists for systematic build diagnosis beyond Claude Code's built-in `/doctor`. The env-setup skill from claudedirectory.org does environment verification but has no verified GitHub repo — adoption signal is unclear.

---

### 2. Verification / Live Testing

| Skill | Repo | Stars | Type | What It Does | Install | Requirements |
|---|---|---|---|---|---|---|
| playwright-skill | [lackeyjb/playwright-skill](https://github.com/lackeyjb/playwright-skill) | 2.8k ⭐ | Single skill | Claude autonomously writes and executes Playwright code on-the-fly — navigates pages, fills forms, captures screenshots, returns console output. Model-invoked when you ask Claude to "test" something. | `/plugin marketplace add lackeyjb/playwright-skill` | Node.js, Playwright, Chromium — run `npm run setup` after install |
| qa-skills | [neonwatty/qa-skills](https://github.com/neonwatty/qa-skills) | 16 ⭐ | Collection (14 skills + 6 agents) | Full QA pipeline: generates Playwright E2E tests from workflow docs, runs adversarial-breaker and security-auditor agents, mobile UX audit, performance profiling. | `claude plugin marketplace add neonwatty/qa-skills` | Playwright CLI global install: `npm install -g @playwright/cli@latest` |
| playwright-py-skill | [akaihola/playwright-py-skill](https://github.com/akaihola/playwright-py-skill) | ~200 ⭐ | Single skill | Python-flavored variant of the playwright-skill above | Via marketplace | Python + Playwright |

**Best for this workflow:** `lackeyjb/playwright-skill` — the most direct fix for "verify that Codex's reported change actually works without me manually testing it."

---

### 3. Code Review

| Skill / Tool | Repo | Stars | Type | What It Does | Install | Requirements |
|---|---|---|---|---|---|---|
| claude-code-security-review | [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review) | 5.4k ⭐, 561 forks, 250+ repos | GitHub Action (**not a Claude Code skill**) | Runs Claude on every PR diff and posts inline security findings: injection attacks, IDOR, hardcoded secrets, broken auth, XSS, RCE, CORS. Not vulnerable to DDoS/rate-limit false positives (intentionally filtered). | Add to `.github/workflows/security.yml` | `CLAUDE_API_KEY` in GitHub Secrets; requires `pull_request` trigger. ⚠️ Not hardened against prompt injection — only use on trusted contributor PRs |
| trailofbits/skills | [trailofbits/skills](https://github.com/trailofbits/skills) | 5.9k ⭐ | Collection (40+ skills) | Security-focused differential review (`git diff`-aware), detection of insecure defaults, hardcoded credentials, supply chain risk assessment, Semgrep rule generation. Backed by a reputable security firm (Trail of Bits). Smart-contract heavy but includes general code audit skills. | `/plugin marketplace add trailofbits/skills` | Some skills require Semgrep installed locally |
| sanyuan0704/sanyuan-skills | [sanyuan0704/sanyuan-skills](https://github.com/sanyuan0704/sanyuan-skills) | 3.6k ⭐ (via secondary source — not directly verified) | Collection | Senior-engineer-level code review: SOLID principles, security patterns, performance issues, error handling. | `npx skills add sanyuan0704/sanyuan-skills` | None |
| alirezarezvani/claude-skills | [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | 19.1k ⭐ (via secondary source — not directly verified) | Mega-collection (345+ skills) | Includes `pr-review-expert` (blast radius analysis + security scanning + coverage assessment). Also `incident-commander` for post-incident review. | `/plugin install pr-review-expert@claude-code-skills` | None |
| Built-in `/code-review` | Claude Code built-in | — | Built-in | Reviews current diff for correctness and simplification | `/code-review` (built-in) | None; `/code-review ultra` uses cloud multi-agent |

**Note:** The Claude Code `/code-review` skill is already installed and capable. The main gap it doesn't fill is **automated security scanning on every Codex PR** — that's where `anthropics/claude-code-security-review` (GitHub Action) is the strongest option despite not being a Claude Code skill.

---

### 4. Database / RLS-Specific

| Skill | Repo | Stars | Type | What It Does | Install | Requirements |
|---|---|---|---|---|---|---|
| supabase/agent-skills | [supabase/agent-skills](https://github.com/supabase/agent-skills) | Official Supabase repo | Collection | Teaches agents correct Supabase patterns. Covers: never use `user_metadata` for auth (use `app_metadata`); views bypass RLS without `security_invoker = true`; UPDATE requires SELECT policy; storage upsert needs INSERT+SELECT+UPDATE. Schema iteration via `execute_sql` then advisor review before formalizing migrations. | `npx skills add supabase/agent-skills` | Supabase CLI for local dev. ⚠️ Explicitly discourages connecting MCP to production DB |
| pg-aiguide | [timescale/pg-aiguide](https://github.com/timescale/pg-aiguide) | ~400 ⭐ | MCP server + plugin | PostgreSQL-specific knowledge: query planning, index guidance, TimescaleDB patterns | Via Claude Code MCP server setup | Requires pg-aiguide MCP server running |
| database-schema-designer | Part of alirezarezvani/claude-skills | — | Single skill | Schema design, migrations, seed data, and RLS policy generation | `/plugin install database-schema-designer@claude-code-skills` | None |

**Best for this workflow:** `supabase/agent-skills` — official, directly addresses the patterns Codex gets wrong (RLS bypasses, view security, migration order).

---

### 5. Git Workflow

| Skill | Repo | Stars | Type | What It Does | Install | Requirements |
|---|---|---|---|---|---|---|
| git-workflow-skill | [netresearch/git-workflow-skill](https://github.com/netresearch/git-workflow-skill) | 25 ⭐ | Single skill | Conventional Commits, branching strategy guidance (Git Flow/trunk-based), `/pr-finish` command that drives a PR to fully-green-and-merged state (preflight checks, CI fix loop, rebase). 30 releases — actively maintained. | `npx skills add https://github.com/netresearch/git-workflow-skill --skill git-workflow` | None |
| git-commit-writer | [agensi.io/skills/git-commit-writer](https://www.agensi.io/learn/best-git-automation-skills-claude-code) | "Most downloaded on Agensi" (no GitHub star count found) | Single skill | Reads staged diff, writes Conventional Commits message, suggests split when multiple logical changes staged | `unzip git-commit-writer.zip -d ~/.claude/skills/` | Downloaded from Agensi — no GitHub repo confirmed |
| pr-description-writer | agensi.io | No GitHub repo confirmed | Single skill | Reads branch diff, generates PR body: what changed, why, how, what to test | `unzip pr-description-writer.zip -d ~/.claude/skills/` | Downloaded from Agensi |
| changelog-generator | agensi.io | No GitHub repo confirmed | Single skill | Translates commits to user-facing release notes, groups by type, filters internal commits | `unzip pr-description-writer.zip -d ~/.claude/skills/` | Requires consistent conventional commits |

**Caution on Agensi skills:** No GitHub repos found for the three Agensi git skills — install is zip-based from a commercial platform. Treat as a paid marketplace, not an open-source skill.

---

### 6. Frontend / Design Consistency

| Skill | Repo | Stars | Type | What It Does | Install | Requirements |
|---|---|---|---|---|---|---|
| frontend-design (official) | anthropics/skills | 565k installs (install count, not GitHub stars) | Single skill | Bans generic fonts by name, forces deliberate aesthetic direction before coding. Official Anthropic. No taste/visual reference built in — guardrails only. | Via Claude Code official marketplace | None |
| taste-skill | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 43.5k ⭐ (via secondary source — suspiciously high, may be installs not stars) | Single skill | Three adjustable dials: design variance, motion intensity, visual density. Anti-slop defaults with broad coverage. No memory across screens. | `npx skills add Leonxlnx/taste-skill` | None |
| ui-ux-pro-max-skill | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 91.5k ⭐ (via secondary source — likely install count) | Single skill | 240+ design styles, 127 font pairings, searchable design database. Python vetting script required. Broad cross-platform coverage. | `npx skills add nextlevelbuilder/ui-ux-pro-max-skill` | Python for the vetting script |
| superdesign-skill | [superdesigndev/superdesign-skill](https://github.com/superdesigndev/superdesign-skill) | ~1.2k ⭐ | Single skill | AI design agent: explores multiple parallel UI variants on a canvas, outputs React + Tailwind. More generative than guardrails-focused. | `npx skills add superdesigndev/superdesign-skill` | None |
| web-design-guidelines | Vercel | 28k ⭐ (likely installs) | Single skill | Accessibility and UX audit rules — contrast, WCAG, spacing. Review-only, doesn't generate design. | Via Vercel marketplace | None |
| Claude-Code-Frontend-Design-Toolkit | [wilwaldon/Claude-Code-Frontend-Design-Toolkit](https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit) | 386 ⭐ | Curated list (not a skill) | Comprehensive reference of 70+ design skills, MCP servers, CLAUDE.md patterns for frontend. Not installable as one skill — use as a discovery resource. | N/A — browse manually | N/A |

**Note on star counts in this category:** The extremely high numbers (43.5k, 91.5k, 565k) appear to reflect install counts from marketplaces, not GitHub stars. Treat these as popularity signals, not GitHub verification. The `taste-skill` and `frontend-design` are genuinely widely used based on multiple independent references.

---

### 7. Environment / Setup Capture

| Skill | Repo | Stars | Type | What It Does | Install | Requirements |
|---|---|---|---|---|---|---|
| Project Env Setup | claudedirectory.org listing (no GitHub repo confirmed) | Unverified | Single skill | Auto-detects runtime from version files, runs setup commands, verifies environment. Records what works. | Manual copy to `.claude/skills/env-setup/SKILL.md` | None |
| env-secrets-manager | Part of alirezarezvani/claude-skills | — | Single skill | .env file management, leak detection, rotation workflows | `/plugin install env-secrets-manager@claude-code-skills` | None |
| skill-creator | Part of anthropics/skills (official) | Official | Single skill | Interviews you about a repeated workflow and scaffolds a SKILL.md for it — the right tool to *create* a setup-capture skill rather than install one | Via official marketplace | None |

**Assessment:** No well-adopted third-party skill exists specifically for recording a dev environment setup as a reusable recipe. The best approach is: run `/doctor` to capture the current state, then use `skill-creator` to scaffold a project-specific setup skill yourself from that output.

---

## Adoption Caveat

Several sites (scriptbyai.com, awesomeskill.ai, crossaitools.com, claudedirectory.org) aggregate Claude Code skills but are commercial directories, not GitHub stats. Star counts from these sources are unreliable — some appear to count cumulative installs across all platforms, not GitHub stars. The entries I verified directly via GitHub fetch are marked above with sourcing. When in doubt, check the GitHub repo directly before installing.

---

## Top 5 for This Workflow

Criteria: directly reduces the three stated friction points — (1) manual bug reproduction, (2) manual verification of Codex's reported changes, (3) recurring environment/build issues — on the React+Vite+TS+Tailwind+shadcn+Supabase+Vercel stack.

---

### #1 — `supabase/agent-skills` (Official)
**Why:** Codex's most common Supabase mistakes are RLS bypasses in views, wrong auth metadata field, and missing UPDATE→SELECT policy. This skill teaches exactly those patterns. Official, actively maintained, multiple independent confirmation.

**What it fixes:** The "Codex said it added RLS but the query still returns all rows" class of bug.

```bash
npx skills add supabase/agent-skills
```

---

### #2 — `lackeyjb/playwright-skill`
**Why:** 2.8k stars, widely referenced. Lets Claude write and execute Playwright automation on the spot — navigate the running app, fill a form, screenshot the result — so you don't have to manually test and report back "the modal didn't close."

**What it fixes:** The entire "manually reproduce and report" loop for UI bugs and Codex verification.

```bash
/plugin marketplace add lackeyjb/playwright-skill
# Then run: npm run setup  (installs Playwright + Chromium)
```

---

### #3 — `anthropics/claude-code-security-review` (GitHub Action)
**Why:** Highest adoption signal in the security review space (5.4k ⭐, 250+ repos, official Anthropic). Catches injection, IDOR, hardcoded secrets, broken auth, and XSS on every Codex PR before it merges — without requiring you to remember to run `/code-review`.

**What it fixes:** Security issues introduced silently by Codex that `/code-review` only catches if you remember to run it.

**Note:** This is a GitHub Action, not a Claude Code skill. It runs in CI, not in your terminal.

```yaml
# .github/workflows/security.yml
name: Security Review
permissions:
  pull-requests: write
  contents: read
on:
  pull_request:
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
          fetch-depth: 2
      - uses: anthropics/claude-code-security-review@main
        with:
          comment-pr: true
          claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
```

*Prerequisite: add `CLAUDE_API_KEY` to GitHub Secrets. Only enable on PRs from trusted contributors.*

---

### #4 — `trailofbits/skills`
**Why:** The only code review skill collection backed by a professional security firm (5.9k ⭐, directly verified). The "security-focused differential review" skill runs against `git diff` output and catches supply chain risk, insecure defaults, and hardcoded credentials — a complement to #3's GitHub Action for in-session review.

**What it fixes:** In-session "should I merge this Codex diff" security judgment without waiting for CI.

```bash
/plugin marketplace add trailofbits/skills
```

*Some skills require Semgrep installed locally for static analysis. Core review skill works without it.*

---

### #5 — `anthropics/frontend-design` (Official)
**Why:** 565k installs (official Anthropic, most-installed design skill). Prevents Codex from defaulting to Times New Roman + Bootstrap-flavored layouts by injecting a design direction constraint before any UI generation. The right starting point before layering in your own CLAUDE.md design system block.

**What it fixes:** Codex-generated UI that looks generically AI-generated instead of matching the project's dark-first Tailwind design system.

```bash
# In Claude Code:
/plugin marketplace add anthropics/skills
# Then enable: frontend-design
```

*For deeper consistency with the Ground Crew HQ design system specifically, pair this with a `## Design System` block in CLAUDE.md (already present) — the skill enforces general guardrails; CLAUDE.md enforces project-specific tokens.*

---

## What Doesn't Exist Yet (As of June 2026)

- **No verified skill for systematic build/env diagnosis** beyond Claude Code's built-in `/doctor`. The closest candidates (env-setup from claudedirectory.org) have no confirmed GitHub repo or real adoption signal.
- **No Vercel-specific deployment verification skill** with meaningful adoption.
- **No RLS-policy auditor** that reads existing Supabase tables and flags missing or incorrect policies — `supabase/agent-skills` teaches patterns going forward but doesn't audit what's already there.
- **No shadcn-specific consistency enforcer** for an existing design system (the closest is `ui-ux-pro-max` which is generative, not project-aware).

---

## Sources

- [Extend Claude with skills — Official Docs](https://code.claude.com/docs/en/skills)
- [vercel-labs/skills CLI](https://github.com/vercel-labs/skills)
- [lackeyjb/playwright-skill](https://github.com/lackeyjb/playwright-skill)
- [neonwatty/qa-skills](https://github.com/neonwatty/qa-skills)
- [trailofbits/skills](https://github.com/trailofbits/skills)
- [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review)
- [netresearch/git-workflow-skill](https://github.com/netresearch/git-workflow-skill)
- [wilwaldon/Claude-Code-Frontend-Design-Toolkit](https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit)
- [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)
- [Supabase Agent Skills Blog Post](https://supabase.com/blog/supabase-agent-skills)
- [Superdesign Best Claude Code Skills Roundup](https://superdesign.dev/blog/best-claude-code-skills)
- [ScriptByAI Claude Code Resource List](https://www.scriptbyai.com/claude-code-resource-list/)
- [Layer5 — npx skills install path bug](https://layer5.io/blog/engineering/claude-code-skills-not-found-after-npx-install/)
- [Claude Directory — env-setup skill](https://www.claudedirectory.org/skills/env-setup)
- [Agensi — Best Git Automation Skills](https://www.agensi.io/learn/best-git-automation-skills-claude-code)
- [Snyk — Top 8 Claude Skills for UI/UX](https://snyk.io/articles/top-claude-skills-ui-ux-engineers/)

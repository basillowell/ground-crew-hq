# Codex Session Prompt — Polish Sweep B: Raw-Palette → Design Tokens
# Ground Crew HQ — August 15, 2026
# Continues the 8-move polish gameplan. Punch-list: POLISH-CLEANUP.md (Sweep A closed 2026-08-11).

Before doing anything else, read these files in order:
1. https://raw.githubusercontent.com/basillowell/ground-crew-hq/main/CODERULES.md
2. https://raw.githubusercontent.com/basillowell/ground-crew-hq/main/CLAUDE.md
3. https://raw.githubusercontent.com/basillowell/ground-crew-hq/main/CODEX6.9.26.md
4. https://raw.githubusercontent.com/basillowell/ground-crew-hq/main/ARCHITECTURE.md

Confirm by stating: rule count, build gate rule, app version, table count.
Do not proceed until confirmed.

---

TASK: ONE concern only (Rule 12) — migrate the remaining `className`-based raw
Tailwind palette colors on live app UI to the approved design tokens
(`surface.*`, `brand.*`, `text.*`, `status.*`). This is the Rule 23 cleanup the
polish gameplan deferred. No layout changes, no logic changes, no new features.

Status token meanings (from CLAUDE.md — do not rename them, Sweep A decided this):
- `status.active`   = green   → positive / on-track / "saved"
- `status.pending`  = amber   → waiting / soft-warning / caution
- `status.warning`  = red     → error / danger / over-threshold
- `status.complete` = blue
- `status.hold`     = slate

The tokens are theme-aware (wired to CSS variables across dark/light). When you
replace a color that carried an explicit `dark:` variant, DROP the `dark:` half —
the token already resolves per theme. Do not add `dark:` variants to token classes.

Established opacity pattern already used in this repo (see the StatusBadge spec in
CODEX6.9.26.md §6): `bg-status-X/10 text-status-X border-status-X/20`.

---

## DO NOT TOUCH — these hex/palette hits are legitimate, not violations

Blindly replacing every hex or palette match will BREAK things. Leave all of these:

1. **Print / PDF export stylesheets** — inline `style={{...}}` hex and `<style>`
   CSS strings that render white-paper documents, NOT on-screen app UI:
   - `src/pages/ReportsPage.tsx` — the timesheet/export blocks (~lines 1100–1300+)
   - `src/pages/WorkboardContent.tsx` — the print `<style>` block (~lines 3879–3887)
   These are intentionally light (paper). Tokens do not apply. Leave as-is.
2. **Chart-segment data colors** — hex passed to recharts as data values
   (e.g. `src/pages/ReportsPage.tsx` ~lines 819–822). Leave as-is.
3. **QR code background** — `src/components/equipment/EquipmentQrCard.tsx:22`
   `bg-white` on the QR tile. White is functionally required for camera scan
   contrast — this is a functional exception like user-data colors. Leave as-is.
4. **User-data colors** — any `property.color` (or similar per-row color) applied
   as an inline `style`. Rule 23 explicitly allows these. Leave as-is.
5. **Anything under `src/components/ui/*`** (shadcn primitives). Out of scope for
   this sweep.

If you find a palette hit you're unsure about, STOP and report it rather than
guessing (Rule 12 / "When to Stop").

---

SECTION 1 — SHARED ERROR CARD (highest impact: renders app-wide)
FILE: src/components/ErrorRetry.tsx

ISSUE: The shared error component is styled light-mode (`bg-red-50 text-red-700`),
so it paints a pale box wherever an error surfaces in the dark-first app.

- Line 11: replace
    `className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"`
  with
    `className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-status-warning"`
- Do not change the markup, the icon, the copy, or the Retry button.
- npm run build — must pass before Section 2

---

SECTION 2 — SCHEDULER HOUR-THRESHOLD INDICATORS
FILE: src/pages/SchedulerPage.tsx

ISSUE: Weekly/daily hour totals use raw emerald/amber with `dark:` variants.

- Line ~1510: `weekHours >= 40 ? 'text-emerald-700 dark:text-emerald-300'`
    → `'text-status-active'` (drop both the light and `dark:` classes)
  Leave the `text-foreground` / `text-muted-foreground` branches untouched.
- Line ~1529: `day.totalHours >= 24 ? 'text-amber-700 dark:text-amber-300'`
    → `'text-status-pending'` (drop both)
  Leave the `text-foreground` branch untouched.
- grep to confirm these are the only two `-emerald-`/`-amber-` hits in this file
  before and after; if there are more, report them, don't silently expand scope.
- npm run build — must pass before Section 3

---

SECTION 3 — RESET PASSWORD ERROR BOXES
FILE: src/pages/ResetPasswordPage.tsx  (standalone page — NOT AuthContext, safe to edit)

ISSUE: Two identical error banners use raw `red-500`/`red-400`.

- Lines ~93 and ~141: replace
    `className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-400"`
  with
    `className="rounded-xl border border-status-warning/30 bg-status-warning/10 px-3 py-3 text-xs text-status-warning"`
- Both occurrences, identical replacement.
- Do NOT touch any auth/session logic on this page — colors only.
- npm run build — must pass before Section 4

---

SECTION 4 — SMALL SINGLE-LINE INDICATORS
FILES: src/pages/settings/ChemicalSettings.tsx,
       src/components/FeedbackWidget.tsx,
       src/pages/ApplicationsPage.tsx

- ChemicalSettings.tsx ~line 146: `"text-sm text-emerald-600"` (the "Saved" label)
    → `"text-sm text-status-active"`
- FeedbackWidget.tsx ~line 96: the filled-star color `'text-amber-500'`
    → `'text-status-pending'`  (leave the empty-star `'text-text-muted'` as-is)
- ApplicationsPage.tsx ~line 1857: the dashed caution note
    `"... border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"`
    → `"... border border-dashed border-status-pending/40 bg-status-pending/10 px-3 py-2 text-xs text-status-pending"`
  (keep every non-color class — `mt-1 rounded-md ... px-3 py-2 text-xs` — intact)
- npm run build — must pass before final verification

---

AFTER ALL SECTIONS — VERIFY (Rule 16: paste real command output)

1. Re-run the audit grep and confirm ONLY the documented exceptions remain:
     grep -rnE 'className=.*(text-white|bg-white\b|(text|bg|border)-(slate|gray|zinc|neutral|green|red|amber|yellow|blue|emerald|lime|orange|rose|indigo|sky)-[0-9])' src/pages src/components --include="*.tsx"
   Expected remaining hits: ONLY EquipmentQrCard.tsx:22 (`bg-white`, the QR
   exception). If anything else remains, it wasn't in this sweep's scope — report
   it, do not fix ad hoc.
2. npm run build — final clean build, 0 errors (Rule 9 — build, not just tsc).
3. Paste: `git status --short` and, after committing, `git log -1 --oneline`.
4. Commit + push in the SAME session (Rule 20):
     git add -A
     git commit -m "fix: migrate residual raw-palette colors to design tokens (polish Sweep B)"
     git push origin main

RULES: edit only the listed files · one concern (palette→tokens) only ·
       no layout/logic/feature changes · token families only, no raw palette,
       no hex · drop `dark:` variants when swapping to tokens · do NOT touch the
       DO-NOT-TOUCH list · column names irrelevant (no DB queries in this sweep) ·
       return summary + files changed + (no SQL) + testing steps.

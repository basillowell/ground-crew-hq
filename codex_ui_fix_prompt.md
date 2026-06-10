# Codex Session Prompt — UI Dark Theme Fix
# Ground Crew HQ — June 10, 2026

Before doing anything else, read these files in order:
1. https://raw.githubusercontent.com/basillowell/ground-crew-hq/main/CODERULES.md
2. https://raw.githubusercontent.com/basillowell/ground-crew-hq/main/CLAUDE.md
3. https://raw.githubusercontent.com/basillowell/ground-crew-hq/main/CODEX6.9.26.md
4. https://raw.githubusercontent.com/basillowell/ground-crew-hq/main/ARCHITECTURE.md

Confirm by stating: rule count, build gate rule, app version, table count.
Do not proceed until confirmed.

---

TASK: Fix dark theme consistency, modal contrast, dispatch board, text 
      readability, and landing page hero across the entire app.

Work through each section in order. npm run build must pass after every 
section before proceeding to the next.

---

SECTION 1 — ROOT FIX: SHADCN CSS VARIABLES TO DARK THEME
FILES: src/index.css

This is the root cause of all white modals, light dropdowns, and 
inconsistent surfaces. Fix the CSS variable layer first.

- grep for ':root' or '[data-theme]' or '.dark' in src/index.css to find
  where shadcn CSS variables are defined
- Update these CSS variables to match the dark token system:
    --background: 10 15 12;
    --foreground: 240 244 240;
    --card: 20 31 24;
    --card-foreground: 240 244 240;
    --popover: 28 45 34;
    --popover-foreground: 240 244 240;
    --primary: 132 204 22;
    --primary-foreground: 10 15 12;
    --secondary: 28 45 34;
    --secondary-foreground: 240 244 240;
    --muted: 28 45 34;
    --muted-foreground: 143 169 143;
    --accent: 31 48 39;
    --accent-foreground: 240 244 240;
    --border: 38 61 45;
    --input: 38 61 45;
    --ring: 132 204 22;
- Add to @layer base:
    [data-radix-select-content],
    [data-radix-popover-content],
    [data-radix-dropdown-menu-content],
    [data-radix-dialog-content] {
      @apply bg-surface-elevated border-surface-border text-text-primary;
    }
    [data-radix-select-item][data-highlighted],
    [data-radix-dropdown-menu-item][data-highlighted] {
      @apply bg-surface-hover text-text-primary;
    }
- npm run build — must pass before Section 2

---

SECTION 2 — FIX SCHEDULER EDIT SHIFT MODAL
FILE: src/pages/SchedulerPage.tsx
Also check: any separate ShiftEditDialog or ShiftModal component file

ISSUES: Modal renders white background, inputs invisible, date picker light

- grep for 'Edit Shift' or 'DialogContent' in SchedulerPage.tsx
- Find the Dialog component wrapping the shift edit form
- Add to DialogContent: className="bg-surface-elevated border-surface-border"
- All Label inside: text-text-secondary
- All Input/Select inside:
    bg-surface-base border-surface-border text-text-primary
    placeholder:text-text-muted focus:border-brand
- DialogTitle: text-text-primary
- Cancel button: variant="outline" with border-surface-border text-text-secondary
- Save button: bg-brand text-text-inverse hover:bg-brand/90
- Date picker Calendar component: bg-surface-elevated text-text-primary
- npm run build — must pass before Section 3

---

SECTION 3 — FIX DISPATCH BOARD EMPTY EMPLOYEE ROWS
FILE: src/pages/DispatchBoardPage.tsx

ISSUE: Grid renders header row but zero employee rows despite store having data

- grep for where employees are mapped to rows in the weekly grid
- Check: const employees = useAppStore(s => s.employees) — is this present?
- Check: is there a .filter() that excludes employees? Remove any status filter
- Check: is the row render inside an isHydrated conditional that never fires?
- Check: is sortedEmployees or activeEmployees empty due to wrong field name?
  employees table uses: id, first_name, last_name, status, role, org_id
  (column names from live-db-state.md — never from memory)
- FIX: render ALL employees from store as rows, no filtering
- If isHydrated is false → show skeleton rows, not empty grid
- If employees.length === 0 → show EmptyState component per CODEX6.9.26.md
  Section 6 pattern with message "No crew members found."
- npm run build — must pass before Section 4

---

SECTION 4 — TEXT CONTRAST AND READABILITY
SCOPE: all files in src/pages/ and src/components/

ISSUES:
- Dark green text on dark green background — unreadable
- Sidebar section labels barely visible
- Some nav items using wrong text tokens

- grep -r 'text-surface-\|text-brand-ghost\|text-\[#0\|text-\[#1' 
  src/pages/ src/components/ --include="*.tsx"
- Replace any text class using a surface or dark hex token:
    text-surface-* → text-text-muted (for secondary info)
    text-[#0...] or text-[#1...] → text-text-primary or text-text-secondary
- Sidebar section labels (PRIMARY OPERATIONS, MANAGEMENT, etc):
    @apply text-text-muted text-[10px] uppercase tracking-widest font-medium
- Sidebar nav active item: text-brand font-medium border-l-2 border-brand
- Sidebar nav inactive: text-text-secondary hover:text-text-primary
- Topbar text: all labels text-text-muted, values text-text-primary
- npm run build — must pass before Section 5

---

SECTION 5 — LANDING PAGE HERO GRADIENT REMOVAL
FILES: src/pages/LaunchPortalPage.tsx, src/index.css

ISSUE: Hero h1 still renders electric lime/green — gradient not fully removed

- grep for 'hero-enter' in src/index.css
- Find the @keyframes hero-enter definition
- Remove ANY color, background-image, -webkit-text-fill-color, 
  background-clip from inside the keyframe
- Keep ONLY opacity and transform properties in the animation
- In LaunchPortalPage.tsx grep for the h1 element
- Confirm className contains ONLY text-text-primary
- Remove: bg-clip-text, text-transparent, bg-gradient-to-*, from-*, to-*
  if ANY of these exist on the h1
- Hero h1 final state: large bold warm white text on dark background
  No lime. No gradient. No glow.
- npm run build — must pass before Section 6

---

SECTION 6 — SURFACE COLOR REFINEMENT
The dark green (#0f1a14 / surface.base) surfaces feel too saturated.
FILES: tailwind.config.ts

- Update surface tokens to slightly warmer, less saturated values:
    surface.base:     '#0c0f0d'   (near-black, minimal green)
    surface.card:     '#131a15'   (dark card, less green)
    surface.elevated: '#1a2520'   (modals/dropdowns)
    surface.border:   '#243029'   (borders)
    surface.hover:    '#1e2c24'   (hover states)
- These are subtle shifts — the app stays dark, just less swampy
- Do NOT change brand.*, text.*, or status.* tokens
- npm run build — must pass before final commit

---

TRACE FINDINGS (June 10, 2026 trace):
Performance context to be aware of while coding:
- Real LCP: ~438ms (2864717ms is Google Docs extension artifact — ignore)
- Supabase calls: 39 — best yet, approaching target
- Store leaks still present: 11 calls (employees 2x, properties 1x, 
  departments 2x, organizations 3x, program_settings 3x)
- schedule_entries: 16 calls — highest single table, check for redundant 
  fetches in SchedulerPage if time allows
- Only 1 failed request, 1 post-nav long task — architecture is clean

---

AFTER ALL SECTIONS:
- Run final verification:
    grep -r 'text-white\b\|text-slate-\|text-gray-\|bg-white\b\|bg-gray-\|
    bg-slate-\|border-white/\|text-lime-\|bg-lime-\|rgba(163,230' 
    src/pages/ src/components/ --include="*.tsx"
  Report any matches outside LaunchPortalPage.tsx decorative mockup dots
- Fix any remaining matches
- npm run build — final clean build, zero errors
- git add -A
- git commit -m "fix: dark theme consistency — shadcn vars, modals, dispatch rows, 
  text contrast, hero gradient, surface refinement"
- git push origin main

RULES: edit only listed files · no table renames · org-scoped queries · 
       typed · isHydrated guard on all page effects · 
       column names from live-db-state.md only · no hardcoded hex ·
       return files+SQL+tests

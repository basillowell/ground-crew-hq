# Ground Crew HQ — Sprint 34 Codex Prompts
## Full Visual & UX Overhaul: Market-Ready Design
## Based on /last30days market research — May 2026
## Current: ver2.5.14.172 | 172 production deployments

---

## MARKET RESEARCH CONTEXT (May 2026)

What's converting right now in SaaS:
- **Calm design** — neutral palettes, color ONLY for meaning, whitespace-heavy (Linear, Notion)
- **Story-driven hero** — show the product, not describe it (Datadog split-screen, Notion embedded demo)
- **Bento-grid layouts** — modular card units, not walls of text (every top SaaS in 2026)
- **Single CTA focus** — multiple CTAs reduce conversion by 266%
- **Trust signals above fold** — G2 badges, customer logos, "No credit card required"
- **Micro-animations** — subtle hover, scroll reveal, CTA pulse (not flashy, just smooth)
- **Headlines under 44 characters** — outcome-focused, not feature-focused
- **"No credit card required"** and **"Get started in 30 seconds"** = friction killers
- **Dark mode for data-heavy pages** — developer tools and weather apps use it
- **Progressive disclosure** — show essentials first, details on demand

What our competitors DON'T do:
- None show live weather radar on a scheduling platform
- None have spray window intelligence
- None offer weather-conflict detection on task dispatch
- None have bilingual (EN/ES) mobile crew apps

---

## SPRINT 34 — Full Visual & UX Overhaul (ver2.5.14.173 – 2.5.14.178)

---

### PROMPT: ver2.5.14.173 — Landing page: story-driven hero + embedded product demo

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.173 — Landing page: 2026 conversion-optimized redesign

The landing page must convert visitors into signups. Current design is
generic. Apply 2026 SaaS landing page best practices.

---

FIX 1 — Hero section: outcome-driven, under 44 characters

Replace current hero with:

  Headline: "Your Crew. Your Weather. One Platform."
  Subheadline: "The only operations tool built for grounds and turf teams
  with live weather intelligence, spray window alerts, and crew scheduling
  that actually works in the field."
  
  CTA button (primary, large, green): "Start Free — No Credit Card"
  CTA button (secondary, outline): "Watch Demo"
  
  Below CTA: "Join 50+ facilities already using Ground Crew HQ"
  Trust badges row: "Weather-Aware" | "Bilingual Crews" | "Mobile-First"

FIX 2 — Product screenshot/demo hero

RIGHT side of hero (split-screen layout, Datadog-style):
  Show a REAL screenshot of the app dashboard with:
  - Schedule grid visible
  - Weather card visible
  - Spray window timeline visible
  
  Use a browser mockup frame (rounded corners, fake address bar)
  to make it look like a live product.
  
  If a real screenshot isn't available, create a stylized version
  using divs that LOOK like the dashboard:
  - Green sidebar with nav items
  - Schedule grid with colored shift cells
  - Weather widget with temperature + radar thumbnail
  
  This shows the product before anyone signs up.

FIX 3 — Bento-grid feature section

Below hero, use a bento-grid layout (modular cards of varying sizes):

  LARGE CARD (spans 2 columns):
    "Weather Intelligence Built In"
    "Live radar, spray window alerts, and severe weather notifications.
    No other scheduling tool has this."
    Icon: radar/weather graphic

  MEDIUM CARD:
    "Schedule in Minutes"
    "Drag, drop, copy week. Templates that learn your patterns."
    
  MEDIUM CARD:
    "Mobile Crew App"
    "Field page works with gloves on. English + Spanish. Offline mode."

  SMALL CARD:
    "Task Dispatch"
    "Weather-conflict warnings before you send crew out."

  SMALL CARD:
    "Reports That Justify the Budget"
    "Labor costs, completion rates, equipment health — 
    the numbers your GM needs."

  SMALL CARD:
    "Equipment Tracking"
    "Service alerts before breakdowns happen."

Use Tailwind grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
Large card: lg:col-span-2
Cards: rounded-2xl border bg-card p-6, hover:shadow-md transition-shadow

FIX 4 — Social proof section

Below features:
  "Trusted by Grounds Teams Across the Country"
  
  Three testimonial cards (use placeholder quotes until real ones arrive):
    "This replaced our whiteboard in week one. The spray window
    feature alone saves us hours." — Superintendent, Private Club
    
    "My crew uses the mobile app every morning. 
    In English and Spanish." — Head Groundskeeper, Municipal Course
    
    "The weather alerts caught a storm we would have missed. 
    Saved $3,000 in chemical waste." — Asst. Superintendent, Resort

  Stats bar:
    "500+ tasks dispatched · 2,000+ hours tracked · 50+ facilities"

FIX 5 — CTA section before footer

  "Ready to run your crew smarter?"
  Large CTA: "Start Free — No Credit Card"
  Below: "14-day free trial. All features included."

FIX 6 — Footer

  Ground Crew HQ
  Links: Features | Pricing | Login | Contact
  "© 2026 Ground Crew HQ · Built for the people who keep courses perfect."

FIX 7 — Micro-animations

  - Hero text: fade in from bottom on load (opacity 0→1, translateY 20→0, 600ms)
  - Feature cards: scroll reveal (appear as user scrolls down)
  - CTA button: subtle pulse animation on idle (scale 1→1.02→1, 2s loop)
  - Testimonial cards: slight hover lift (translateY -2px)

---

Files touched:
- src/pages/LaunchPortalPage.tsx (full redesign)

Commit: feat: ver2.5.14.173 — landing page 2026 conversion-optimized redesign
```

---

### PROMPT: ver2.5.14.174 — App-wide calm design system: colors, spacing, typography

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.174 — App-wide design system: calm palette, consistent spacing

2026 trend: "feels like Linear" = calm, neutral palettes with strategic
color usage. Color highlights data and status, not decoration.

---

FIX 1 — Color system (update CSS variables in globals/index.css)

  Primary: keep emerald/green (#166534) — brand color, used sparingly
  
  Status colors (ONLY for meaning):
    --status-safe: #22c55e (green) — scheduled, done, clear weather
    --status-warning: #f59e0b (amber) — needs attention, moderate weather
    --status-danger: #ef4444 (red) — critical, severe weather, overdue
    --status-info: #3b82f6 (blue) — in progress, informational
    --status-muted: #94a3b8 (slate) — inactive, no data, disabled
  
  Surface colors:
    Card backgrounds: bg-card (white in light, slate-900 in dark)
    Page background: bg-background (slate-50 in light, slate-950 in dark)
    Borders: border-border (slate-200 in light, slate-800 in dark)
  
  RULE: No colored backgrounds on cards unless conveying status.
  Cards are white/neutral. Color appears only on:
    - Left borders (status indicator)
    - Badges (status pills)
    - Icons (status meaning)
    - Charts/graphs (data visualization)

FIX 2 — Typography scale

  Page titles: text-xl font-semibold tracking-tight
  Section headers: text-sm font-semibold uppercase tracking-wider text-muted-foreground
  Card titles: text-sm font-medium
  Body text: text-sm
  Helper text: text-xs text-muted-foreground
  Monospace data: font-mono text-sm (for times, numbers, IDs)
  
  Apply consistently across ALL pages.

FIX 3 — Spacing system

  Page padding: p-4 md:p-6
  Card padding: p-4
  Card gap: gap-4
  Section gap: space-y-6
  Inline element gap: gap-2
  
  RULE: All cards use rounded-xl (12px radius)
  RULE: All buttons use rounded-lg (8px radius)
  RULE: All badges use rounded-full

FIX 4 — Card design standard

  Every card in the app follows this pattern:
    <div className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/30">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Section Label
      </div>
      {/* Card content */}
    </div>

  Status-indicated cards add: border-l-4 border-l-{status color}
  
  No colored card backgrounds. No gradients on cards. Clean and calm.

FIX 5 — Apply to Dashboard

  The Dashboard (CommandCenterOperationalPage.tsx) is the most-visited page.
  Apply the new design system:
  - Morning briefing: clean white card, no colored background
  - Stat cards: white cards with colored LEFT border only (by status)
  - Charts: use status colors for data series
  - All section headers: uppercase tracking-wider text-muted-foreground

FIX 6 — Apply to Sidebar

  Sidebar should feel calm:
  - Active item: bg-primary/10 text-primary border-l-2 border-primary
  - Inactive items: text-muted-foreground hover:text-foreground hover:bg-muted/30
  - Section labels: text-[10px] uppercase tracking-widest text-muted-foreground
  - No bold colors on inactive items

---

Files touched:
- src/index.css or tailwind config (color variables)
- src/pages/CommandCenterOperationalPage.tsx
- src/components/AppLayout.tsx (sidebar)
- All card components referenced

Commit: feat: ver2.5.14.174 — calm design system with strategic color
```

---

### PROMPT: ver2.5.14.175 — Dashboard: bento-grid operations overview

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.175 — Dashboard: bento-grid layout with operations cards

Redesign the Dashboard from a vertical stack to a bento-grid layout.

---

LAYOUT (desktop):
  ┌──────────────────────┬──────────────┐
  │  Morning Briefing    │  Weather     │
  │  (large card)        │  (compact)   │
  ├───────┬───────┬──────┴──────────────┤
  │ Crew  │ Tasks │  Spray Window       │
  │ Count │ Count │  (timeline bar)     │
  ├───────┴───────┼─────────────────────┤
  │  Efficiency   │  Schedule Coverage  │
  │  Score        │  (mini chart)       │
  ├───────────────┼─────────────────────┤
  │  Equipment    │  Open Needs         │
  │  Health       │  Count + list       │
  ├───────────────┴─────────────────────┤
  │  Operations Scorecard (full width)  │
  └─────────────────────────────────────┘

Use Tailwind grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
Large cards: lg:col-span-2
Each card: rounded-xl border bg-card p-4

CARD DESIGNS:

  Morning Briefing (lg:col-span-2):
    "Good morning, Basil."
    Date + property name
    AI briefing text (or stats summary)
    Quick action buttons: "Open Workboard" | "Open Scheduler"

  Weather (1 col):
    Big temp number (color by range)
    Condition + wind + humidity in small badges
    Mini radar thumbnail (small iframe, 150px height) or weather icon
    "View Full Weather →" link

  Crew Count:
    Large number: "3"
    Label: "Crew Scheduled"
    Left border: green if > 0, red if 0
    
  Tasks Count:
    Large number: "8"
    Label: "Tasks Assigned"
    Completion: "5/8 done (63%)"
    Mini progress bar

  Spray Window (lg:col-span-2 or full width):
    Timeline bar (green/red segments)
    "Safe: 6 AM – 11 AM" summary
    Compact — single row, not a full card

  Efficiency Score:
    Large number: "78"
    Color by score range
    Trend arrow: ↑ or ↓ vs yesterday
    Label: "Operations Score"

  Equipment Health:
    "4/4 Ready" or "2 Overdue"
    Left border: green or red
    
  Open Needs:
    Count badge
    Latest 2 needs listed
    "View All →" link to Workboard

  Scorecard (full width):
    5 mini metric cards in a row
    Task completion, labor efficiency, coverage, equipment, utilization
    Each with sparkline

---

Files touched:
- src/pages/CommandCenterOperationalPage.tsx (bento-grid redesign)

Commit: feat: ver2.5.14.175 — dashboard bento-grid operations overview
```

---

### PROMPT: ver2.5.14.176 — Scheduler: clean grid with status colors

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.176 — Scheduler: visual polish with calm design system

---

Apply calm design system to the Scheduler page:

FIX 1 — Shift cells: status-colored left border only

  Scheduled: border-l-4 border-l-emerald-400, white background
  Day off: border-l-4 border-l-amber-400, white background
  Vacation: border-l-4 border-l-blue-400, white background
  Sick: border-l-4 border-l-red-400, white background

  NO colored backgrounds on cells. Just left border + white card.
  Text inside: time in font-mono, status badge in small pill.

FIX 2 — Empty cells: subtle dashed border

  Empty "+Add" cells: border-dashed border-slate-200
  On hover: border-primary/50 bg-primary/5
  Transition: transition-colors duration-150

FIX 3 — Day column headers

  Today's column: subtle bg-primary/5 highlight
  Day name: text-xs uppercase tracking-wider
  Day number: text-lg font-bold
  
FIX 4 — Summary footer

  Day totals row: bg-muted/20
  Weekly total: font-mono text-primary font-bold

FIX 5 — Add Shift modal: clean form

  Remove any visual clutter in the modal.
  Form fields: consistent h-10 inputs with text-sm
  Buttons: primary = rounded-lg bg-primary, outline = rounded-lg border

---

Files touched:
- src/pages/SchedulerPage.tsx

Commit: feat: ver2.5.14.176 — scheduler visual polish with calm design
```

---

### PROMPT: ver2.5.14.177 — Workboard: clean dispatch board with status lanes

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.177 — Workboard: calm design dispatch board

---

Apply calm design system to the Workboard:

FIX 1 — Employee lanes: clean card with status summary

  Each employee lane is a rounded-xl card:
    Header: name (font-medium), shift time (font-mono text-muted-foreground)
    Coverage badge: colored pill (green/yellow/red)
    Task count: "3 tasks" text-xs

FIX 2 — Task rows: left-border status

  Planned: border-l-4 border-l-slate-400
  In Progress: border-l-4 border-l-blue-400
  Done: border-l-4 border-l-emerald-400, text with line-through

  NO colored backgrounds. Just left border on white.

FIX 3 — Suggested tasks section: calm, dismissable

  Section header: uppercase tracking-wider text-muted-foreground
  Each suggestion: rounded-xl border border-l-4 p-3
    Opportunity: border-l-emerald-400
    Warning: border-l-amber-400
    Urgent: border-l-red-400

FIX 4 — Right rail: organized panels

  Each panel: rounded-xl border bg-card p-4
  Panel headers: text-xs uppercase tracking-wider text-muted-foreground
  Clean separation between Needs Queue, Crew Summary, Weather, Notes

FIX 5 — Header bar: declutter

  Remove visual noise. Keep:
    Board date picker, department filter, view toggle, Add Task button
  Move secondary actions (Quick Plan, Export, Send Schedule, Apply Template)
  into a "More ▾" dropdown to reduce header width.

---

Files touched:
- src/pages/WorkboardPage.tsx

Commit: feat: ver2.5.14.177 — workboard calm design dispatch board
```

---

### PROMPT: ver2.5.14.178 — Employees, Equipment, Reports, Safety: design consistency

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.178 — Apply calm design system to remaining pages

---

Apply the same design system from ver2.5.14.174 to ALL remaining pages:

EMPLOYEES PAGE:
  - Table: clean borders, no colored rows
  - Status badge: small pill (green=Active, red=Inactive)
  - Edit buttons: outline, small
  - Add Employee modal: consistent form styling
  - Availability calendar: status colors via cell background opacity

EQUIPMENT PAGE:
  - Equipment cards: rounded-xl, status left-border
  - Service status: green badge (OK) / amber (due soon) / red (overdue)
  - Add/Edit form: consistent with other modals

REPORTS PAGE:
  - Charts: use status color palette
  - Trend lines: clean, no excessive gridlines
  - Print view: clean typography, branded header
  - Tab styling: consistent with other pages

SAFETY PAGE:
  - Safety talk cards: rounded-xl, date + attendees compact
  - Log form: consistent modal styling

SETTINGS PAGE:
  - Tab navigation: clean underline active state
  - Form cards: rounded-xl border bg-card p-4
  - Section headers: uppercase tracking-wider text-muted-foreground
  - Setup checklist: green checkmarks, clean progress feel

GLOBAL:
  - All loading skeletons: animate-pulse bg-muted rounded-xl
  - All empty states: centered icon + text + action button
  - All error states: red border card with retry button
  - All toast messages: consistent styling

---

Files touched:
- src/pages/EmployeesPage.tsx
- src/pages/EquipmentPage.tsx
- src/pages/ReportsPage.tsx
- src/pages/SafetyPage.tsx
- src/pages/SettingsPage.tsx

Commit: feat: ver2.5.14.178 — calm design system applied to all remaining pages
```

---

## Summary

| Version | Focus | Impact |
|---------|-------|--------|
| 173 | Landing page — story hero, bento features, social proof, micro-animations | Conversion: visitors → signups |
| 174 | Design system — calm palette, strategic color, typography, spacing | Foundation for all visual consistency |
| 175 | Dashboard — bento-grid, operations cards, mini radar, scorecard | First-impression "this is premium" |
| 176 | Scheduler — clean grid, status left-borders, smooth interactions | Daily-use polish |
| 177 | Workboard — calm dispatch board, decluttered header, clean task rows | Operations efficiency feel |
| 178 | All other pages — employees, equipment, reports, safety, settings | Total app consistency |

After Sprint 34, every page in the app follows the same calm, premium
design system. The landing page converts. The dashboard impresses.
The daily-use pages feel professional and fast.

---

*Save to repo: docs/dev/ROADMAP_SPRINT_34.md*

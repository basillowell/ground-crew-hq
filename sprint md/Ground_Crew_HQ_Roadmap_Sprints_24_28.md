# Ground Crew HQ — Sprints 24–28 Codex Prompts
## AI-Assisted Ops, Offline Mode, PWA, Billing & Growth
## Current Production: ver2.5.14.118 | Remaining from S20-23: 111-117, 119-122

---

## Market Context (May 2026)

The FSM market is projected at $8B by 2028 (12.7% CAGR). Three trends dominate:

1. **AI scheduling is table stakes** — FieldCamp, ServiceTitan, and Jobber all ship
   AI dispatch that considers skills, location, weather, and job priority. Ground Crew HQ
   has weather-aware dispatch (unique at our price) but needs AI task suggestions.

2. **Offline-first mobile is non-negotiable** — 93% of service orgs use AI; the ones
   that win have offline mobile apps. Crews work in dead zones (course interiors,
   remote fields). Our Field page requires connectivity — that's a beta-blocker.

3. **"Doing more with less" is the 2026 theme** — Labor shortage means software must
   replace a full-time dispatcher. Auto-scheduling, auto-reporting, and self-service
   crew workflows are what buyers evaluate first.

**Our position:** We match $200-500/mo tools on features. We beat everyone on
weather intelligence. We're missing: AI task suggestions, offline mode, and
automated reporting. These 5 sprints close those gaps.

---

## IMPORTANT: Complete remaining S20-23 prompts first

You skipped from 110 to 118. Before starting Sprint 24, send these
from ROADMAP_SPRINTS_20_23.md in order:
  111, 112, 113, 114, 115, 116, 117, 119, 120, 121, 122

---

## SPRINT 24 — AI-Assisted Daily Operations (ver2.5.14.123 – 2.5.14.126)
**Goal:** The app thinks for you. Auto-suggest tasks, flag conflicts, predict issues.

---

### PROMPT: ver2.5.14.123 — Smart morning brief: AI-generated daily plan summary

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.123 — Dashboard: AI-generated daily plan summary using Anthropic API

---

Add a "Daily Brief" card to the Dashboard that uses Claude to generate
a natural-language morning briefing from today's operational data.

FIX 1 — Collect today's data

Gather into a single context object:
  - Crew count + names + shift times (from schedule_entries)
  - Task count + task names + coverage % (from assignments)
  - Weather: temp, wind, rain probability, conditions (from Open-Meteo)
  - Equipment alerts: overdue items (from equipment_units)
  - Open needs count (from task_requests)
  - Yesterday's completion rate (from assignments WHERE date = yesterday)

FIX 2 — Call Anthropic API

Use the Anthropic API endpoint (already available in artifacts):
  POST https://api.anthropic.com/v1/messages
  model: "claude-sonnet-4-20250514"
  max_tokens: 300

System prompt:
  "You are a golf course operations assistant. Generate a brief 3-4 sentence
  morning briefing for a superintendent. Be direct, actionable, and mention
  weather concerns, staffing gaps, or equipment issues. Use a professional
  but friendly tone. No bullet points — just a natural paragraph."

User message: JSON of the collected data above.

FIX 3 — Display the briefing

Show the AI-generated text in a card with:
  - "🤖 Morning Brief" header with a small "AI-generated" badge
  - The paragraph text
  - "Refresh" button to regenerate
  - Loading shimmer while generating
  - Fallback: if API fails, show the standard stats-only briefing

Cache the result in sessionStorage for the current day so it doesn't
re-generate on every page visit. Clear cache at midnight.

---

Files touched:
- src/pages/CommandCenterOperationalPage.tsx

Commit: feat: ver2.5.14.123 — AI-generated morning briefing on dashboard
```

---

### PROMPT: ver2.5.14.124 — Smart task suggestions based on weather + history

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.124 — Workboard: smart task suggestions panel

---

Add a "Suggested Tasks" collapsible section at the top of the Workboard,
above the crew cards.

LOGIC (all client-side, no AI API needed):

Rule 1 — Weather-based suggestions:
  If rain probability < 20% AND wind < 10: suggest "Good conditions for spraying"
  If rain in last 24h: suggest "Course may be wet — consider delaying mowing"
  If temp > 95: suggest "Schedule water breaks every 90 minutes"
  If wind > 15: suggest "Postpone spray applications"

Rule 2 — History-based suggestions:
  Fetch assignments from same day last week:
    SELECT title, count(*) FROM assignments
    WHERE org_id = orgId AND date = (today - 7)
    GROUP BY title ORDER BY count DESC LIMIT 5
  Show: "Last [Day], your team did: Mow Greens (3x), Roll Greens (2x)..."
  Button: "Apply Last Week's Plan" (triggers Quick Plan from ver2.5.14.100)

Rule 3 — Coverage gap detection:
  If any scheduled employee has 0 assignments: suggest "Nick Chavez has
  no tasks assigned — 8.5h of shift time unplanned"

Rule 4 — Equipment due:
  If equipment overdue > 0: suggest "Toro #T-001 is overdue for service
  by 42 days — consider scheduling maintenance today"

Display suggestions as dismissable cards with colored left border:
  Green = opportunity, Yellow = warning, Red = urgent

Dismiss stores in sessionStorage so they don't reappear same day.

---

Files touched:
- src/pages/WorkboardPage.tsx

Commit: feat: ver2.5.14.124 — smart task suggestions based on weather and history
```

---

### PROMPT: ver2.5.14.125 — Auto-complete daily report at end of day

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.125 — Auto-generated end-of-day operations report

---

Add an "End of Day Report" button on the Workboard header (visible after 2 PM).

On click, generate a summary of today's operations:

REPORT CONTENT (auto-populated from DB):

  GROUND CREW HQ — DAILY OPERATIONS REPORT
  [Property Name] — [Date]

  CREW SUMMARY:
  [X] crew members worked today
  [List: Name — Shift — Tasks completed — Actual hours]

  TASK COMPLETION:
  [X]/[Y] tasks completed ([Z]%)
  Scheduled hours: [sum estimated]
  Actual hours: [sum actual]
  Variance: [difference] (+/- X%)

  WEATHER CONDITIONS:
  High: [temp]°F | Wind: [max wind]mph | Rain: [total mm]

  EQUIPMENT NOTES:
  [List any equipment marked as in_use or overdue]

  OPEN ITEMS:
  [List any tasks still in 'planned' or 'in_progress' status]
  [List any open task_requests]

DISPLAY OPTIONS:
  - "Copy to Clipboard" — formatted text
  - "Email Report" — mailto: with pre-filled body
  - "WhatsApp" — wa.me link with condensed version
  - "Print" — browser print dialog

Store the report text in notes table with category = 'daily-report'
and date = today so it's archived and viewable later.

---

Files touched:
- src/pages/WorkboardPage.tsx

Commit: feat: ver2.5.14.125 — auto-generated end-of-day operations report
```

---

### PROMPT: ver2.5.14.126 — AI task description helper in Assign modal

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.126 — Assign Task modal: AI-generated task notes

---

In the Assign Task modal, add a small "✨ Generate notes" button
next to the Notes textarea.

On click:
  Call Anthropic API with:
    System: "Generate a brief 1-2 sentence task instruction for a
    grounds crew member. Be specific and practical."
    User: "Task: [task name], Category: [category], Location: [location],
    Weather: [current conditions], Estimated time: [hours]h"

  Response fills the Notes textarea.
  User can edit the generated text before dispatching.

Example output: "Mow greens on holes 1-9 at 3/16" height. Start on the
far end and work back toward the clubhouse. Wind is from the east at 8mph."

Show a small spinner while generating. If API fails, show nothing (fail silently).
The button is a convenience, not a requirement.

---

Files touched:
- src/pages/WorkboardPage.tsx

Commit: feat: ver2.5.14.126 — AI task notes generator in assign modal
```

---

## SPRINT 25 — Offline-First Field Page (ver2.5.14.127 – 2.5.14.129)
**Goal:** Crew members can use the Field page with zero connectivity.

---

### PROMPT: ver2.5.14.127 — Service Worker + offline cache for Field page

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.127 — PWA service worker + offline data cache for Field page

---

FIX 1 — Register a service worker

Create public/sw.js with a basic cache-first strategy:
  - Cache the app shell (HTML, CSS, JS bundles) on install
  - Serve cached assets when offline
  - Update cache in background when online

Register in src/main.tsx:
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }

FIX 2 — Cache today's field data on load

When the Field page loads online, store today's data in IndexedDB
(or localStorage if simpler):
  - Employee's schedule_entry for today
  - Employee's assignments for today
  - Employee's clock_events for today

Use a simple key structure:
  field-cache-{date} = JSON.stringify({ schedule, assignments, clockEvents })

FIX 3 — Offline fallback on Field page

When navigator.onLine === false OR fetch fails:
  - Load data from cache
  - Show a yellow banner: "You're offline — showing cached data"
  - Allow status toggles and clock events to queue locally
  - Store queued actions in localStorage: field-sync-queue

FIX 4 — Sync queue when back online

Add a listener for the 'online' event:
  window.addEventListener('online', syncQueue)

syncQueue reads field-sync-queue from localStorage and:
  - Processes each queued action (status update, clock event, actual hours)
  - On success: remove from queue
  - On failure: keep in queue, retry next online event
  - Show toast: "Synced X offline changes"

---

Files touched:
- public/sw.js (create)
- src/main.tsx (register service worker)
- src/pages/MobileFieldWorkspacePage.tsx (offline cache + sync)

Commit: feat: ver2.5.14.127 — PWA service worker and offline field page
```

---

### PROMPT: ver2.5.14.128 — PWA manifest + install prompt

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.128 — PWA manifest and install-to-home-screen prompt

---

FIX 1 — Web app manifest

Create public/manifest.json:
  {
    "name": "Ground Crew HQ",
    "short_name": "CrewHQ",
    "description": "Weather-aware crew scheduling and task management",
    "start_url": "/app/field",
    "display": "standalone",
    "background_color": "#1a1f2e",
    "theme_color": "#22c55e",
    "orientation": "portrait",
    "icons": [
      { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  }

Add to index.html <head>:
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#22c55e">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

For icons: create simple placeholder PNGs (green circle with "GC" text)
using an SVG-to-PNG approach, or use solid green squares as placeholders.

FIX 2 — Install prompt on Field page

On the Field page, listen for the beforeinstallprompt event:
  Store the event. Show a banner at the bottom of the Field page:
  "Install Ground Crew HQ for faster access"
  Button: "Install" → triggers the stored prompt
  "Dismiss" → hides for 7 days (store in localStorage)

FIX 3 — Standalone mode detection

If running as installed PWA (window.matchMedia('(display-mode: standalone)')):
  - Hide the browser address bar reminder
  - Show a full-bleed status bar at top with crew name + time

---

Files touched:
- public/manifest.json (create)
- index.html (manifest link + meta tags)
- src/pages/MobileFieldWorkspacePage.tsx (install prompt)

Commit: feat: ver2.5.14.128 — PWA manifest and install-to-home-screen
```

---

### PROMPT: ver2.5.14.129 — Offline indicator + sync status across app

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.129 — Global offline indicator + sync status

---

FIX 1 — Offline indicator in header

Add a small indicator to the app header that shows connection status:
  Online: hidden (or tiny green dot)
  Offline: yellow bar below header: "⚡ You're offline — changes will sync when connected"

Use navigator.onLine + 'online'/'offline' event listeners.

FIX 2 — Sync status badge

When items are queued for sync (from Field page offline actions):
  Show a badge on the notification bell: "2 pending syncs"
  When sync completes: flash green and clear

FIX 3 — Supabase query retry on reconnect

When the app goes from offline → online, automatically:
  void queryClient.invalidateQueries()
This refreshes all stale data after reconnection.

---

Files touched:
- src/components/AppLayout.tsx (offline indicator)
- src/pages/MobileFieldWorkspacePage.tsx (sync status)

Commit: feat: ver2.5.14.129 — offline indicator and sync status
```

---

## SPRINT 26 — Billing & Subscription (ver2.5.14.130 – 2.5.14.132)
**Goal:** Start charging money. Stripe integration for subscriptions.

---

### PROMPT: ver2.5.14.130 — Stripe checkout for Pro plan

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.130 — Stripe checkout integration for Pro plan subscription

CLAUDE_DB_REQUIRED:
  The organizations table already has stripe_customer_id,
  stripe_subscription_id, subscription_status columns.
  Verify these exist. If not, Claude will add them.

---

FIX 1 — Upgrade button in Settings → Access tab

Add an "Upgrade to Pro" card in Settings → Access tab:
  Current plan: Free (Beta)
  Pro plan: $49/month — Unlimited properties, employees, advanced reports
  Button: "Upgrade to Pro →"

On click: redirect to Stripe Checkout.
Use a Stripe Checkout URL (client-side redirect, no server needed):
  window.location.href = `https://checkout.stripe.com/pay/...`

For now, use a placeholder URL and show a toast:
  "Stripe integration coming soon. You're on the free beta plan."

The actual Stripe product/price IDs will be configured later.
The UI flow must be ready.

FIX 2 — Plan badge in header

Show the current plan as a small badge next to the user name in the header:
  "FREE" (gray badge) or "PRO" (green badge)

Read from organizations.subscription_status:
  'active' = PRO, anything else = FREE

FIX 3 — Feature gating placeholder

Create a utility: src/utils/planGating.ts

  export function isPro(subscriptionStatus: string | null): boolean {
    return subscriptionStatus === 'active';
  }

  export function requiresPro(feature: string): boolean {
    const proFeatures = ['csv-export', 'cost-reports', 'multi-property',
      'schedule-templates', 'whatsapp-share', 'ai-briefing'];
    return proFeatures.includes(feature);
  }

Do NOT gate any features yet — just have the utility ready.
All features remain accessible during beta.

---

Files touched:
- src/pages/SettingsPage.tsx
- src/components/AppLayout.tsx (plan badge)
- src/utils/planGating.ts (create)

Commit: feat: ver2.5.14.130 — stripe checkout UI and plan gating utility
```

---

### PROMPT: ver2.5.14.131 — Usage dashboard in Settings

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.131 — Settings: usage dashboard showing plan limits

---

Add a "Usage" card to Settings → Workspace tab:

Display current usage vs plan limits:
  Properties: 1 / 1 (Free) or 1 / Unlimited (Pro)
  Employees: 4 / 5 (Free) or 4 / Unlimited (Pro)
  Tasks: 12 / 20 (Free) or 12 / Unlimited (Pro)
  Schedule entries (this month): X / 100 (Free) or X / Unlimited (Pro)

Show usage bars (progress bars) for each metric.
Green if under 75%, yellow 75-90%, red 90%+.

When at limit: show "Upgrade to Pro for unlimited access" link.

Limits for Free plan:
  1 property, 5 employees, 20 tasks, 100 schedule entries/month

These are soft limits — don't block anything during beta.
Just show the usage so users understand the value of upgrading.

---

Files touched:
- src/pages/SettingsPage.tsx

Commit: feat: ver2.5.14.131 — usage dashboard with plan limits
```

---

### PROMPT: ver2.5.14.132 — Billing history + cancel subscription

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.132 — Settings: billing management placeholder

---

Add a "Billing" card to Settings → Access tab (below the Upgrade card):

If on Free plan:
  "You're on the free beta plan. No payment method required."

If on Pro plan (subscription_status = 'active'):
  Plan: Pro ($49/month)
  Status: Active
  Next billing date: [read from stripe or show placeholder]
  "Manage Billing" button → opens Stripe Customer Portal URL
    (placeholder URL for now: show toast "Coming soon")
  "Cancel Subscription" button → confirmation dialog →
    show toast "Contact support@groundcrewhq.com to cancel"
    (No actual Stripe cancel API call — manual for beta)

---

Files touched:
- src/pages/SettingsPage.tsx

Commit: feat: ver2.5.14.132 — billing management placeholder in settings
```

---

## SPRINT 27 — Analytics & Insights (ver2.5.14.133 – 2.5.14.135)
**Goal:** Data-driven decisions. Trend charts, efficiency metrics, comparative analysis.

---

### PROMPT: ver2.5.14.133 — Reports: weekly trend charts

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.133 — Reports: weekly trend charts for labor and completion

---

Add a "Trends" tab to the Reports page (alongside the existing labor table).

CHART 1 — Task completion rate over time (recharts LineChart)
  X: weeks (last 8 weeks)
  Y: completion percentage (tasks done / total tasks)
  Line color: green

CHART 2 — Labor hours trend (recharts AreaChart)
  X: weeks (last 8 weeks)
  Y: two areas — scheduled hours (blue) vs actual hours (green)
  Overlap shows efficiency

CHART 3 — Crew utilization (recharts BarChart)
  X: employee names
  Y: average hours per week (last 4 weeks)
  Color: bar height relative to shift hours scheduled

Data source: aggregate from assignments table, grouped by week.

---

Files touched:
- src/pages/ReportsPage.tsx

Commit: feat: ver2.5.14.133 — weekly trend charts on reports page
```

---

### PROMPT: ver2.5.14.134 — Dashboard: operational efficiency score

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.134 — Dashboard: operational efficiency score card

---

Add an "Efficiency Score" card to the Dashboard showing a single
number (0-100) that represents overall operational health.

SCORING FORMULA:
  Task completion rate (last 7 days): 0-30 points
    (tasks_done / total_tasks * 30)
  Schedule coverage (today): 0-25 points
    (assigned_hours / shift_hours * 25)
  Labor variance (last 7 days): 0-20 points
    (20 - abs(actual_hours - scheduled_hours) / scheduled_hours * 20)
  Equipment health: 0-15 points
    (15 if 0 overdue, 10 if 1-2, 5 if 3+, 0 if 5+)
  Open needs resolution: 0-10 points
    (10 if 0 open, 5 if 1-3, 0 if 4+)

Display as a large number with color:
  90-100: green "Excellent"
  70-89: blue "Good"
  50-69: yellow "Needs Attention"
  Below 50: red "Critical"

Show a small trend arrow: ↑ if higher than yesterday, ↓ if lower.

---

Files touched:
- src/pages/CommandCenterOperationalPage.tsx

Commit: feat: ver2.5.14.134 — operational efficiency score on dashboard
```

---

### PROMPT: ver2.5.14.135 — Reports: export branded PDF report

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.135 — Reports: comprehensive printable report with all sections

---

Combine the labor summary, cost breakdown, and trend charts into
a single printable report page.

"Generate Full Report" button on Reports page → opens a new tab with:

  HEADER:
    Ground Crew HQ logo placeholder
    [Org Name] — Operations Report
    [Date Range] · Prepared by [user name] · Generated [timestamp]

  SECTION 1: Executive Summary
    Total scheduled hours | Total actual hours | Variance
    Total labor cost | Tasks completed | Completion rate
    Efficiency score (from ver2.5.14.134)

  SECTION 2: Labor Summary Table (from existing report)

  SECTION 3: Cost by Task Category (from existing report)

  SECTION 4: Trend Charts (rendered as static images via recharts)

  SECTION 5: Equipment Status Summary

  FOOTER:
    "Generated by Ground Crew HQ · ground-crew-hq.vercel.app"
    "This report is confidential."

Auto-trigger window.print() on load.
Use @media print CSS for clean formatting.

---

Files touched:
- src/pages/ReportsPage.tsx (or create a separate PrintableReport component)

Commit: feat: ver2.5.14.135 — comprehensive printable operations report
```

---

## SPRINT 28 — Growth & Virality (ver2.5.14.136 – 2.5.14.138)
**Goal:** Make the product spread. Referrals, testimonials, social proof.

---

### PROMPT: ver2.5.14.136 — Invite team members from within the app

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.136 — Invite team members via email link

---

Add an "Invite Team" button in Settings → Access tab.

On click, show a modal:
  "Invite a team member"
  Email input
  Role dropdown: Manager | Field Staff
  Button: "Send Invite"

On submit: generate a mailto: link pre-filled with:
  Subject: "You've been invited to Ground Crew HQ"
  Body:
    "Hi,

    [User name] has invited you to join [Org name] on Ground Crew HQ,
    the operations platform for grounds and facilities teams.

    Sign up here: https://ground-crew-hq.vercel.app

    Your organization: [Org name]
    Your role: [selected role]

    — Ground Crew HQ"

  Open the user's email client.

NOTE: This is a manual invite flow (no magic links or auto-provisioning).
The invited person signs up normally, and the admin adds them via the
Employees page. Future versions can add Supabase auth invite links.

Show a toast after sending: "Invite email opened in your mail app."

---

Files touched:
- src/pages/SettingsPage.tsx

Commit: feat: ver2.5.14.136 — invite team members via email
```

---

### PROMPT: ver2.5.14.137 — Beta feedback widget

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.137 — Floating feedback button for beta testers

CLAUDE_DB_REQUIRED:
  Need a table: beta_feedback
  Columns: id uuid, org_id uuid, user_id uuid, page text,
  feedback_type text (bug/feature/general), message text,
  rating integer (1-5), created_at timestamptz
  (Claude will create before Codex runs)

---

Add a small floating "Feedback" button in the bottom-right corner
of every page (except the landing page and Field page).

On click, expand into a small form:
  Type: Bug Report | Feature Request | General Feedback (radio buttons)
  Message: textarea (required)
  Rating: 1-5 stars (optional)
  "Submit" button

On submit:
  INSERT into beta_feedback with org_id, user_id (auth.uid()),
  page (current route path), feedback_type, message, rating.
  Toast: "Thanks for your feedback!"
  Collapse the widget.

Style: small round button with a speech bubble icon.
Expanded form: 300px wide card that slides up from the button.

---

Files touched:
- src/components/FeedbackWidget.tsx (create)
- src/components/AppLayout.tsx (render FeedbackWidget)

Commit: feat: ver2.5.14.137 — floating beta feedback widget
```

---

### PROMPT: ver2.5.14.138 — Landing page: social proof + testimonial section

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.138 — Landing page: testimonial section + live stats

---

FIX 1 — Testimonial section (placeholder)

Add a "What Superintendents Say" section to the landing page:

Three testimonial cards (placeholder content — replace with real
quotes when beta feedback comes in):

  "[Placeholder] This replaced our whiteboard in week one."
  — Superintendent, Private Golf Club

  "[Placeholder] The spray window feature alone saves us hours."
  — Assistant Superintendent, Municipal Course

  "[Placeholder] My crew actually uses the mobile app."
  — Head Groundskeeper, Sports Complex

Each card: photo placeholder (initials circle), quote, role + facility type.

FIX 2 — Live stats counter

Add a small stats bar above the testimonials:
  "Trusted by X facilities · Y tasks dispatched · Z hours tracked"

For now, use placeholder numbers:
  "Trusted by 5 facilities · 500+ tasks dispatched · 2,000+ hours tracked"

Later these can be real aggregate queries from the DB.

---

Files touched:
- src/pages/LaunchPortalPage.tsx

Commit: feat: ver2.5.14.138 — landing page testimonials and live stats
```

---

## DB Changes Required

| Version | Change |
|---------|--------|
| 2.5.14.137 | Create `beta_feedback` table (id, org_id, user_id, page, feedback_type, message, rating, created_at) |

All other prompts use existing tables.

---

## Complete Prompt Library (all files)

| File | Sprints | Versions | Status |
|------|---------|----------|--------|
| ROADMAP_PROMPTS.md | S1-8 | 2.5.48–2.5.70 | ✅ Done |
| ROADMAP_SPRINTS_9_16.md | S9-16 | 2.5.71–2.5.94 | ✅ Done |
| ROADMAP_SPRINTS_17_19.md | S17-19 | 2.5.14.96–107 | ⏳ Skipped — send 96-107 |
| ROADMAP_SPRINTS_20_23.md | S20-23 | 2.5.14.110–122 | ⏳ 111-117, 119-122 remaining |
| ROADMAP_SPRINTS_24_28.md | S24-28 | 2.5.14.123–138 | 🆕 Ready to send after above |

---

*Save to repo: docs/dev/ROADMAP_SPRINTS_24_28.md*

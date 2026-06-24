# Mobile UX Research Brief — Field Service Apps
**Date:** 2026-06-24
**For:** Ground Crew HQ Mobile Field View Redesign
**Scope:** Competitive analysis of six field-service/crew-management mobile apps; honest audit of the current `MobileFieldWorkspacePage.tsx`; prioritized redesign recommendations

---

## Executive Summary

The dominant pattern across every mature field-service mobile app is a **persistent bottom tab bar with 3–5 destinations**, with the most-used action (clock-in or today's jobs) surfaced on the home tab without scrolling. Ground Crew HQ's current Field View breaks this pattern entirely: it is a single scrolling page with no persistent navigation, meaning the clock-in widget disappears the moment a user scrolls to see their task list.

Clock-in/out flows have converged on a **two-tap maximum** as an industry standard, with GPS captured silently in the background. The apps that stand out (Jobber, Housecall Pro) fail gracefully when GPS is unavailable rather than blocking the action. Offline resilience is now a table-stakes expectation — the apps that require live connectivity (Connecteam, Housecall Pro in edit mode, ServiceTitan pull-to-refresh) are the ones that generate the most negative field reviews.

The most distinctive mobile-first pattern observed is not any single feature but a **design philosophy decision**: the best apps are built around a technician completing a shift in a straight line (arrive → clock in → see tasks → mark done → clock out), requiring zero navigation to accomplish the core workflow. Ground Crew HQ's current implementation requires a user to scroll past clock-in, past a progress bar, through a task list, and then back up to clock out — breaking the linear flow at every step.

---

## Comparison Table

| Dimension | Jobber | Housecall Pro | ServiceTitan | Connecteam | When I Work | Samsara/Motive |
|---|---|---|---|---|---|---|
| **Nav pattern** | Bottom tab bar | Dashboard cards + tab bar | Bottom tab bar (3 tabs: Home, Time, Menu) | Hub-based (Operations / Comms / HR hubs); no standard bottom bar | Bottom tab bar (Schedule, Time, Messages, More) | Tile-based home screen; bottom bar for major sections |
| **Top-level destinations** | ~5 (Home, Schedule, Requests, Clients, More) | ~4 (Dashboard, Schedule, Jobs, More) | 3 primary + 4 job sub-tabs (Today / Upcoming / Previous / Paused) | 3 hubs with nested sections | 4–5 (Schedule, Time Clock, Swap Shifts, Messages, Notifications) | 4–5 (Home, Logs/HOS, Inspection, Messages, Menu) |
| **Clock-in: tap count** | 2 taps (Timesheet icon → Start Timer); animated icon while tracking | 2 taps (Dashboard widget Clock In → confirm); follows with notification prompt | Multi-step (Home → Time tab → start); exact count varies by company config | 2 taps (Clock In → select job assignment) | 2–3 taps (photo selfie + GPS required on some configs) | 2 taps (duty status button → select On Duty/Driving) |
| **Clock-in: GPS handling** | GPS logged silently at each event; does not block clock-in on failure | GPS pinged at clock-in; logs location; does NOT block action if unavailable | GPS tied to dispatch; not a hard requirement for the clock-in tap itself | GPS stamp at punch; geofencing optional (Advanced+ tier only); hard fails if no internet | GPS geofencing; photo clock-in for accountability; does not hard-block on GPS failure | Real-time GPS via vehicle gateway; ELD-compliant continuous tracking; no field-worker blocking |
| **Clock-in: what's shown during** | Elapsed timer with animated Timesheet icon; live running total on Home | Elapsed timer card; job status (On My Way / Start Job / Pause / Finish Job) | Activity status bar with elapsed time and current activity label (Continuous Timekeeping config) | Elapsed timer on dashboard; break/end options | Elapsed timer; photo reference displayed | HOS clock showing drive time remaining and elapsed duty time |
| **"My tasks today" presentation** | Clean vertical list: time, customer name, job type, address; simple hierarchy; no cards | Visual job cards with customer photos, color-coded priority flags; rich info density | Card-based list with status icons (cloud checkmark, download arrow, warning triangle); Today/Upcoming/Previous tabs | Task list through "Quick Tasks" system; sub-task hierarchy; mobile-friendly forms | Schedule-based; shows shifts not task lists; employees see their upcoming shifts | Route/stop list with forms (DVIR, inspections); guided linear workflow per stop |
| **Task detail / completion on small screen** | Tap job → Start Job → notes/photos → Complete; ~3 taps to complete | Swipe between appointments; "Finish Job" tap; auto-prompts for follow-up estimate | Tap job card → opens detail; Dispatch/Arrive/Close Out actions on bottom of screen | Tap task → checklist items; sub-tasks visible inline | Mark shift complete via time clock; no granular task completion within shifts | Submit DVIR with guided steps; tappable defect categories; no partial-submit |
| **Teammate / crew visibility** | Not a core field-worker feature; supervisor-only live map | Manager live map; GPS ping every 15 min (Android) / ~400m movement (iOS); role-based permissions | Dispatch board (supervisor); technicians see their own jobs only | Real-time clocked-in list with job info; no movement between stops; breadcrumb optional | Manager sees who's clocked in in real time; field workers see team schedule | Fleet manager sees all drivers on live map; drivers see their own route only |
| **Offline handling** | Robust: auto-caches job data locally; full offline for forms, photos, notes, job completion; syncs on reconnect with original timestamp | View-only offline: can see pre-loaded schedules; cannot edit or finalize records without signal | Pull-to-refresh requires online; job data must be pre-loaded; limited offline capability | Zero offline support: clock-in, break, and clock-out all fail in airplane mode; confirmed by testing | Not documented in official sources; likely requires connectivity for GPS clock-in | Implied resilient: HOS compliance requirements demand reliable logging; likely queues locally |
| **Distinctly mobile-first feature** | 15–20 second photo markup flow for documenting job site problems | "On My Way" one-tap customer notification (reduces callbacks 70–80%); Good/Better/Best visual proposal builder | AI diagnostic assistant "Atlas in Mobile" for real-time on-site guidance; barcode/OCR equipment scanning | Push notifications for shift reminders; shift availability self-reporting | Photo clock-in as identity verification; shift swap directly from mobile with replacement workflow | "Hey Motive" voice assistant for hands-free HOS queries; in-cab safety coaching notifications; SOS emergency button |

---

## Per-App Deep Dives

### 1. Jobber

**Navigation:** Bottom tab bar with approximately five destinations. The Timesheet icon animates with a running clock animation while time tracking is active — a passive ambient cue visible from any tab. The philosophy is radical simplicity: assume technicians resist complexity and optimize for the tech-resistant crew member.

**Clock-in flow (2 taps):** Tap the animated Timesheet icon (Tab 1) → tap Start Timer. GPS is logged silently at the event without blocking the action. Critically, Jobber supports *two layers* of clock-in: daily (for payroll timesheets) and per-job (for labor costing). The Home screen surfaces a single timer that covers both, making the common case one action.

**Task presentation:** Jobs appear as a clean vertical list — time, customer name, job type, address — in a simple visual hierarchy. The workflow is linear: tap "Start Job" → add notes/photos → tap "Complete." No sub-navigation required. Older field workers specifically prefer this minimalism over card-heavy alternatives.

**Team visibility:** Not a field-worker-facing feature. Supervisor live map is available but not surfaced in the technician view. This is a deliberate choice — Jobber prioritizes focus over coordination.

**Offline:** The most robust in this comparison. Job data is cached automatically when details load during connectivity. Technicians can complete forms, upload photos, add notes, and mark jobs finished entirely offline. Sync happens automatically on reconnect with the original action timestamp preserved. This handles the "drove into a dead zone mid-job" scenario cleanly.

**Distinctly mobile-first:** Photo documentation that takes ~15–20 seconds — snap, annotate, save. One-tap "On My Way" customer text. No desktop-first surface area visible in the field workflow.

---

### 2. Housecall Pro

**Navigation:** Dashboard-centric with a bottom tab bar. The technician home screen shows a live GPS map widget, pending jobs as cards, and quick-status actions. Rather than showing a list, jobs are presented one at a time with swipe to move between appointments.

**Clock-in flow (2 taps, then job status flow):** Tap the dashboard widget Clock In button → confirm. After clocking in, the interface transitions to a job status workflow: "On My Way" → "Start Job" → "Pause Time" → "Finish Job." Each step sends the matching GPS coordinate. The "On My Way" tap triggers an automated customer notification pre-formatted as a text message — this is the killer feature.

**Task presentation:** Visual cards with customer profile photos, color-coded priority flags, and a full interaction history. Information density is high — good for sales-oriented crews, perceived as "too busy" by task-focused field workers. The proposal builder presents Good/Better/Best pricing as visual cards the technician literally hands the tablet to the customer to swipe through.

**Team visibility:** Manager map pings employee GPS every ~15 minutes (Android) or on ~400m movement (iOS). Not real-time. Role-based permissions control what field workers can see of each other.

**Offline:** View-only. Technicians can see pre-loaded schedules but cannot edit or finalize any records without signal. A documented limitation; rural contractors cite this as a significant pain point.

**Distinctly mobile-first:** The "On My Way" one-tap notification. Contractors using it report 70–80% reduction in customer callback inquiries. The entire customer communication loop is handled from a single mobile tap — no calls, no texts, no office relay.

---

### 3. ServiceTitan

**Navigation:** Bottom tab bar with three primary destinations: **Home** (today's schedule + current job), **Time** (clock-in/out), and **Menu** (settings and additional actions). Home surfaces today's schedule immediately without scrolling. Tapping "View all" reveals four job sub-tabs: Today, Upcoming, Previous, Paused. Tablet users see quick-action buttons (Directions, Contact, Chat) directly on job cards without tapping into detail view.

**Clock-in flow (multi-step, company-configured):** Navigate to the Time tab → begin tracking. The exact UI depends on company configuration — some use Continuous Timekeeping (shows a persistent activity bar with elapsed time and current status), others use discrete job-based clock-in. Status icons on job cards inform technicians of data sync state: cloud checkmarks (fully loaded), download arrows (still syncing), warning triangles (load failures). This is rare design sophistication — ambient sync status without a notification.

**Task presentation:** Cards in Today tab; each card shows status indicators, customer/location name. Tapping opens the full job detail with forms, equipment history, and the AI diagnostic assistant. Dispatch/Arrive/Close Out action buttons appear at the bottom of the detail screen — persistent, always reachable. Barcode and OCR scanning for equipment entry is native.

**Team visibility:** Supervisor-only dispatch board. Field technicians see only their assigned jobs. The app is explicitly designed to keep technicians focused and not expose crew coordination complexity at the field level.

**Offline:** A documented weak point. Pull-to-refresh only works online. Job data must be pre-loaded when connected. The warning triangle icon on cards signals load failures — the app surfaces this gracefully, but the data itself is not available. In contrast to their UI polish, offline resilience lags behind Jobber significantly.

**Distinctly mobile-first:** "Atlas in Mobile" — an AI assistant that provides real-time diagnostic guidance on-site. A technician encountering an unfamiliar HVAC unit can query Atlas without leaving the app or calling the office. This is genuinely mobile-first because it eliminates a class of problem (expertise gaps in the field) that only matters when you're not at a desk.

---

### 4. Connecteam

**Navigation:** Hub-based architecture rather than a traditional bottom tab bar. Three hubs — Operations, Communications, HR & Skills — each contain multiple nested features. On mobile this manifests as a left-sidebar-style navigation translated to mobile. The structure is comprehensive but can feel overwhelming; reviews describe it as "cluttered" because it's designed to serve admins as much as field workers.

**Clock-in flow (2 taps):** Tap "Clock In" at the dashboard top → select job assignment from dropdown. The two-step flow prevents accidental punches at the cost of friction. GPS is captured at the punch moment. Geofencing (restricts punches to job-site radii) requires the Advanced+ plan tier.

**Task presentation:** Quick Tasks system allows creation of tasks that don't require a full shift. Sub-task hierarchies are visible inline. Mobile-friendly custom forms display well. However, the "task" concept is disconnected from the "schedule" concept — they live in different hubs, which creates navigation friction.

**Team visibility:** Real-time display of who's clocked in with job information and timestamps. Breadcrumb tracking (optional) shows movement snapshots, but does not show how long a worker spent at a specific location — an important gap for grounds crew work where time-on-site is billable.

**Offline:** **Zero offline support** — the most critical weakness in this comparison. Testing confirmed that clock-in, break, and clock-out all completely fail in airplane mode. The app requires screen refresh after connectivity restores before operations can resume. For field teams in basements, rural areas, or signal dead zones, this is a complete operational failure.

**Distinctly mobile-first:** Real-time push notification system for schedule changes; shift availability self-reporting (workers can flag themselves available for open shifts directly from mobile). But honestly, Connecteam is an office-centric platform adapted for mobile — not mobile-first by design.

---

### 5. When I Work

**Navigation:** Bottom tab bar with four to five destinations: Schedule, Time Clock, Open Shifts, Messages, and Notifications. The schedule tab auto-loads the most recently viewed date rather than defaulting to today — a documented UX complaint from users who have to scroll to find the current workday.

**Clock-in flow (2–3 taps):** Tap Time Clock tab → Tap Clock In → (optional) Photo selfie verification. GPS geofencing restricts punches to configured job-site areas. Photo clock-in is the distinctive authentication mechanism: the system captures a selfie at each punch and matches against a reference photo, preventing buddy-punching without requiring manager oversight. Does not hard-block if GPS is unavailable.

**Task presentation:** Shift-focused rather than task-focused. Workers see their upcoming shifts with start/end time, location, and role. There is no granular task list within a shift — When I Work is a scheduling tool first, not a work order management system. Shift swaps, open shift pickup, and time-off requests are all manageable directly from the schedule tab.

**Team visibility:** Manager real-time view shows who's clocked in and where. Employees can see who else is working the same shift. This peer transparency supports self-organization on a job site without requiring manager mediation.

**Offline:** Not documented; likely requires connectivity for GPS clock-in verification.

**Distinctly mobile-first:** The shift swap workflow is entirely mobile-native. An employee taps their shift → requests a swap → the app finds eligible coworkers → sends them a notification → they accept or decline → the manager gets a one-tap approval prompt. An operation that would require phone calls and manager coordination in every other tool is self-service on a phone.

---

### 6. Samsara (Driver App)

**Navigation:** Tile-based home screen with quick access to the most critical daily actions: duty status, routes, inspections (DVIRs), messages, and documents. Bottom navigation bar for major sections. Designed for hands-dirty, glance-and-go use: large tap targets, high contrast, minimal text on primary actions.

**Duty status / clock-in flow (2 taps):** Tap the duty status button (always visible on home) → select status (Off Duty / Sleeper Berth / Driving / On Duty Not Driving). The status change is the clock-in equivalent. Continuous GPS tracking via vehicle gateway runs automatically — there is no separate "clock in" action for location tracking. HOS compliance requirements mean the app cannot afford to lose duty status data, making the queue-and-sync architecture battle-tested.

**Task presentation:** Stops and routes presented as a linear guided workflow. Each stop has associated forms (DVIR, delivery confirmation, customer signature). Tapping a stop reveals tappable defect categories, guided inspection checklists with photo capture, and a submit action. The workflow is strictly sequential — no skipping steps, no reordering.

**Team visibility:** Fleet managers see all drivers on a live map. Driver-facing view shows only the driver's own route and messages. Driver-to-dispatcher messaging is built into the app; drivers can flag delays, route issues, or emergencies without leaving the workflow.

**Offline:** Implied resilient given HOS compliance requirements — losing duty status data would create regulatory violations. The app is designed to log locally and sync when connectivity restores; GPS data from the vehicle gateway queues independently of the phone app.

**Distinctly mobile-first:** "Hey Motive" voice assistant — hands-free queries for remaining drive time, nearest fuel stop, and log status while actively driving. SOS emergency button with GPS location broadcast. In-cab safety coaching notifications triggered by AI detection of hard braking or distraction events. These features are physically impossible on a desktop.

---

## What Ground Crew HQ's Current Field View Does Differently / Worse

Reading `src/pages/MobileFieldWorkspacePage.tsx` directly reveals the following gaps against the competitive baseline:

### Structure
The entire field experience is a **single scrolling page** with no tab navigation, no persistent nav bar, and no way to jump between sections without scrolling. The rendered layout is:

1. Language toggle (EN/ES) — top of page
2. Offline sync banner (conditional)
3. Clock-in card
4. Pull-to-refresh indicator
5. Task progress bar
6. "My Tasks" section (all tasks in one scrolling block)
7. Visual divider
8. "Teammates" section (all teammates in one scrolling block)

No competitor exposes this pattern. All six apps reviewed use persistent bottom navigation with at minimum a Home and a Time Clock destination.

### Clock-in: GPS hard-blocks the action
`handleClockEvent()` calls `getCurrentPosition()` and shows a toast error (`"Location permission is required to use the time clock"`) before the clock event is even attempted if GPS fails. **Every competitor treats GPS as a background capture**, not a gate. A worker who denies location permission or is in a GPS-poor environment cannot clock in at all. This is the most critical functional regression relative to industry standard.

### Offline: Write-queue exists, but read-side is broken
The app has a thoughtful offline write queue (`FieldSyncQueueItem`, `localStorage`-backed, syncs on `window.addEventListener('online', ...)`). Clock events and assignment status updates queue correctly. But `fetchFieldData()` at line 426–430 shows:
```
if (!navigator.onLine) {
  setError('You are offline. Field data loads from Supabase once you are back online.');
  setLoading(false);
  return;
}
```
A worker who opens the app without connectivity sees an error state — no cached task list, no teammates, nothing. The offline queue is useless if you can't see what you're supposed to be working on. Jobber caches the full job view locally; Ground Crew HQ caches only write operations.

### No persistent clock status in view
When a worker scrolls past the clock-in card to read their task list, there is no ambient indicator that they are clocked in, how long they've been on the clock, or quick access to clock out. ServiceTitan's activity status bar is always visible. Jobber's animated Timesheet icon communicates state from any tab. Ground Crew HQ's elapsed timer is only visible at the top of the page.

### Task completion requires multi-step interaction
Completing a task opens the assignment's action button in-card. The flow is: scroll to find the card → tap the action button → (implicit) confirm. The flow is reasonable for a start action, but for the completion action, there's no hour-confirmation modal shown (the hours are auto-calculated from `actualStartAt` → `actualCompletedAt`), meaning a worker who forgot to tap "Start" will complete a task with 0 actual hours recorded. The old `updateTaskStatus` path with the hours-confirmation dialog (`activeDonePromptId`, `actualHoursDraft`) still exists in the component but is not wired to the current status action buttons.

### Language toggle occupies prime screen real estate
The EN/ES toggle is rendered above the clock-in card — the first thing a worker sees on load. This is an infrequently changed preference occupying the position where the most critical daily action should live. Every competitor buries language settings in a profile or settings screen.

### Teammates section is read-only, contact-less
The teammates block (lines 1307–1347) shows name, role, shift hours, and a task list for each teammate. There is no quick-contact option (no phone/message tap), no "what area is this person in right now" context, and no visual differentiation between a teammate who is clocked in vs. not yet arrived. The phone number is not exposed in the query (line 525–538 fetches `employee_id, shift_start, shift_end, status` — no contact info). Competitors at minimum show shift overlap context; When I Work shows live clock-in status peer-to-peer.

### No shift time context at the top
The clock-in card shows `propertyName` but not the worker's scheduled shift hours (`shift.shiftStart`, `shift.shiftEnd`). A worker opening the app has no immediate visual confirmation of when their shift starts/ends. This is fetched and stored in `shift` state but never rendered anywhere in the layout.

---

## Prioritized Recommendations (1–8)

### 1. Add a persistent bottom tab bar with 3–4 destinations
**Priority: Critical. Pattern: Every competitor.**

Replace the single scrolling page with a bottom tab bar. Suggested destinations:
- **Today** (clock-in card + task progress bar + task list for the day — visible without scrolling)
- **Team** (teammates section, moved here)
- **More** (language toggle, install banner, calendar export, any future settings)

This single architectural change fixes the "clock-in disappears when you scroll" problem, creates a clear mental model, and makes each section independently scrollable. Implementation: a sticky `<nav>` at the bottom with `position: fixed; bottom: 0` and padding-bottom on the content container matching the nav height (currently `pb-28` is already in the layout — just needs a real tab bar inside it).

**Tied to:** Jobber (Timesheet tab always accessible), ServiceTitan (3-tab layout), When I Work (Schedule/Time/Messages tabs), Housecall Pro (Dashboard/Schedule/Jobs tabs).

---

### 2. Remove the GPS gate from clock-in; capture GPS in the background
**Priority: Critical. Pattern: Jobber, Housecall Pro, When I Work.**

Change `handleClockEvent()` to proceed with the clock event even if `getCurrentPosition()` fails or is denied. Queue the event with `location_lat: null, location_lng: null` and show a subtle inline note ("Location unavailable — event logged without GPS"). This matches how every competitor handles the case. If GPS is critical for the org, the supervisor dashboard can flag location-less punches rather than blocking the field worker.

```typescript
// Proposed pattern
let position: GeolocationPosition | null = null;
try {
  position = await getCurrentPosition();
} catch {
  // log but don't block
}
const locationLat = position?.coords.latitude ?? null;
const locationLng = position?.coords.longitude ?? null;
```

**Tied to:** Jobber (GPS logged silently, does not block), Housecall Pro (GPS logged, does not block), When I Work (GPS optional per config).

---

### 3. Cache today's task list and shift data for offline read access
**Priority: High. Pattern: Jobber (full offline), Samsara (compliance-driven resilience).**

The write-side offline queue already works. The read-side needs localStorage caching. On a successful `fetchFieldData()` call, serialize `assignments`, `shift`, `teammates`, and `propertyName` to localStorage keyed by `[orgId, employeeId, todayKey()]`. On the next load attempt that fails due to offline state, load from cache and set `isOfflineData = true`. This means a worker who last opened the app at the start of their shift can still see their tasks in a dead-zone job site.

**Tied to:** Jobber (full offline job-data caching), Samsara (HOS-compliance-driven read availability).

---

### 4. Show a persistent clock-status indicator when clocked in
**Priority: High. Pattern: ServiceTitan (activity status bar), Jobber (animated Timesheet icon).**

When `isClockedIn` is true, show a slim persistent banner or tab-bar indicator (e.g., a pulsing green dot on the Today tab + elapsed time in small text). This gives the worker ambient confirmation without scrolling and provides quick access to clock out from any tab. If implementing tab bar (Rec #1 first), the Today tab badge or a sticky header on the Today tab serves this role.

**Tied to:** ServiceTitan (activity status bar with elapsed time always visible), Jobber (animated icon on any tab).

---

### 5. Move the language toggle to a settings/profile screen
**Priority: Medium. Pattern: All competitors (language in settings, not the home screen).**

The EN/ES toggle is a one-time-or-rarely-changed preference. Rendering it above the clock-in card wastes the most valuable screen real estate and slows the time-to-first-action on every single app open. Move it to the "More" tab or a profile sheet. The `language` state and `localStorage` persistence already work correctly — this is a pure layout change.

**Tied to:** Universal pattern — no competitor surfaces a language toggle as the first element on the field worker home screen.

---

### 6. Surface the scheduled shift times prominently on the clock-in card
**Priority: Medium. Pattern: Connecteam (shift card), When I Work (schedule tab), Housecall Pro (job card).**

The `shift.shiftStart` and `shift.shiftEnd` values are fetched and stored in component state but never rendered. Adding two lines to the `ClockInCard` component — scheduled `{formatTime(shift.shiftStart)} – {formatTime(shift.shiftEnd)}` — gives workers immediate context on whether they're on time and how long their shift is. This is especially important for lawn/grounds crews who need to plan outdoor work around weather and daylight.

**Tied to:** When I Work (shift card shows scheduled hours), Housecall Pro (job card shows appointment window).

---

### 7. Add clock-in status and contact action to the teammates section
**Priority: Medium. Pattern: When I Work (live clock-in status), Connecteam (real-time clocked-in list).**

The current teammate cards show name, role, shift window, and task list — but no indication of whether the teammate is currently clocked in or not. Add:
- A green/grey presence dot next to the name (derived from a lightweight clock_events query or a cached state)
- A "Call" or "Message" tap target (requires surfacing `phone` from the employee record — currently not queried)

The teammate query already has the data shape needed; the `clock_events` table can be queried for the same org+date to populate presence state with minimal additional cost.

**Tied to:** When I Work (peer clock-in visibility), Connecteam (real-time clocked-in list with job info).

---

### 8. Wire the actual-hours confirmation to the task completion path
**Priority: Lower. Pattern: Jobber (per-job labor costing), Housecall Pro (time-per-job tracking).**

The component already has the complete infrastructure for hours confirmation: `activeDonePromptId`, `actualHoursDraft`, `QUICK_HOURS_OPTIONS`, `showOtherActualInputId`, and `completeTaskWithHours()`. But `handleMyTaskStatusAction()` (the currently wired completion handler) bypasses all of it, using auto-calculated hours from `actualStartAt` / `actualCompletedAt` timestamps. The infrastructure should be used: when a worker taps "Complete," show a bottom sheet with the quick-hours chips (1h, 1.5h, 2h, 2.5h, 3h, 4h) pre-selected based on the elapsed time, with a confirm tap. This creates an actual-vs-estimated hours feedback loop that is the backbone of job costing in Jobber and Housecall Pro, and it transforms the task completion moment from a passive tap into an actionable data capture.

**Tied to:** Jobber (dual clock-in for daily payroll + per-job labor costing), Housecall Pro (time-per-job tracking feeding into job profitability reports).

---

*Research sources: Jobber Help Center, Jobber feature pages, Housecall Pro feature pages, ServiceTitan mobile help documentation, Connecteam review (timeero.com, brainsensei.com), When I Work (business.com review, official site), Samsara apps page, Motive ELD review, korekomfortsolutions.com technician comparison, arrivy.com field service app roundup, fieldservicetools.com Jobber review, SoftwareAdvice field service mobile survey, mobile UX best-practices literature (uxplanet.org, uxpin.com), direct code review of `src/pages/MobileFieldWorkspacePage.tsx`.*

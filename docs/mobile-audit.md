# Ground Crew HQ — Mobile UX Audit
**Date:** June 2026  
**Viewport target:** iPhone 14 (390 × 844px, 460 PPI)  
**Audited by:** Claude Code static analysis + competitive research  
**Scope:** Navigation, touch targets, field page, all app pages, competitive benchmarks, prioritized fixes

---

## 1. NAVIGATION

### How crew members navigate on mobile

**Employee role (`currentRole === 'employee'`):**
- The left sidebar is `hidden md:flex` — completely invisible below the md breakpoint (768px). Employees never see it on mobile. ✓
- Navigation is handled entirely by a bottom tab bar rendered in `AppLayout.tsx` at `position: fixed; bottom: 0`.
- Five tabs: **Today** (`/app/field`), **My Jobs** (`/app/scheduler`), **Clock** (`/app/field?tab=clock`), **Messages** (`/app/breakroom`), **Profile** (`/app/settings?tab=Account`).
- Tab bar height: `h-16` (64px). Each button: `min-h-11` (44px). Five columns of 78px each. ✓
- Active indicator: small brand-green pill at top of active tab icon. Clock icon turns `text-brand-bright` when employee is clocked in. ✓
- Safe-area inset: `paddingBottom: env(safe-area-inset-bottom)` applied — iPhone notch-safe. ✓
- Main content has `pb-20` to avoid content being obscured by the bottom bar. ✓

**Supervisor/Admin role:**
- Left sidebar (`w-60` = 240px) slides in from a hamburger button in the topbar.
- On mobile, it occupies 240px of 390px viewport (62% of screen width) — usable but cramped.
- Backdrop close button present (`bg-black/40` overlay click). ✓
- No bottom nav for supervisors — they must use the sliding sidebar.
- `NavItem` buttons use `py-2.5` ≈ 40px height ⚠️ (4px below the 44px guideline).

### Sidebar on 390px

| Role | Sidebar behavior | Verdict |
|---|---|---|
| Employee | Hidden — bottom nav only | ✓ Correct |
| Supervisor | 240px slide-in, covers 62% of screen | Acceptable |
| Admin | Same as Supervisor | Acceptable |

The sidebar nav links (`py-2.5 text-sm`) render at approximately **40px** height — technically below Apple's 44pt guideline but close enough to pass in practice.

---

## 2. TOUCH TARGETS

### MobileFieldWorkspacePage — Interactive Elements Audit

| Element | Class / Height | Status |
|---|---|---|
| Clock In button (active layout) | `min-h-11 w-full py-3` ≈ 44–52px | ✓ |
| Break button | `min-h-11` = 44px | ✓ |
| Clock Out button | `min-h-11` = 44px | ✓ |
| Task row (My Tasks) | `min-h-[48px]` container | ✓ |
| **Start / Complete button** | `px-3 py-1` ≈ **28–32px** | ⚠️ TOO SMALL |
| **Done (disabled) button** | `px-3 py-1` ≈ **28–32px** | ⚠️ TOO SMALL |
| Bottom nav tabs | `min-h-11` = 44px, 78px wide | ✓ |
| Pull-to-refresh zone | Touch gesture, no button | ✓ |

**Flagged: Start/Complete task action buttons**  
The action button on each task row uses `px-3 py-1` which renders at approximately 28–32px tall. On gloved hands or moving vehicles (crew members often tap from a truck), this will cause missed taps. The button is also positioned at the far right of a row where multiple elements are crowded: title, location badge, hours, status badge, action button — **5 elements in a 390px wide row**. Available tap width per element is ~70px but heights remain the issue.

**Spacing concern:** Within the task row (`min-h-[48px]`), the Start/Complete button, status badge (`text-[10px]`), and hours label (`text-xs`) are inline. Visual spacing is adequate (~4–8px gaps via `gap-2`) but the actual tappable region of the action button is below 44px tall.

### Dead Code Discovery — Critical Finding

**Line 1354 in MobileFieldWorkspacePage.tsx:**
```typescript
return displayOnlyLayout;  // ← this is the actual rendered output

return (   // ← UNREACHABLE — never renders
  <div className="mx-auto w-full max-w-[520px] ...">
```

The full-featured old layout (lines 1356–1700+) is **dead code** and never renders. This old layout included:
- Offline banner (`isOfflineData` flag shown to user)
- EN/ES language switcher visible in header
- Task progress bar (% done visualization)
- Full task cards with actual-hours input
- Add to Calendar button (h-12 = 48px)
- Welcome banner for new users

**None of these features are active.** Only the simplified `displayOnlyLayout` renders. This means the EN/ES language toggle, offline data badge, and task progress visualization are completely invisible to users, even though the logic is wired and working.

---

## 3. FIELD PAGE SPECIFICALLY (`/app/field`)

### What a crew member sees on first load (active layout)

1. **ClockInCard** — first visible element, above the fold on iPhone 14. Contains:
   - "Time Clock" label + property name + clock icon
   - Full-width **Clock In** button (lime green, `min-h-11`) — one tap ✓
2. Pull-to-refresh trigger (drag down)
3. **My Tasks** card — visible after scrolling ~250px
   - Skeleton loaders while data fetches ✓
   - Each task row: title, location badge, hours, status badge, Start/Complete button
4. Separator line
5. **Teammates** card — further below the fold

### Can they clock in with one tap?
**Yes** — the Clock In button is full-width, above the fold, and requires a single tap. GPS is requested automatically. Offline queue works if no connection. ✓

### Can they see their first task without scrolling?
**Borderline.** On iPhone 14 (844px height):
- ClockInCard: ~160px
- "My Tasks" header: ~32px
- First task row: 48px
- **First task is visible at ~240px from top** — yes, one task shows without scrolling ✓
- But if the employee has 3+ tasks, the second and third require scrolling.

### Is the offline queue visible when pending syncs exist?
**No — not in the active layout.**  
`isOfflineData` state is set correctly, but the visual indicator (yellow offline banner) only exists in the **dead code** old layout. The active `displayOnlyLayout` has **no persistent offline queue indicator**. The only feedback is a `toast.success('Synced N offline changes')` when reconnected, which disappears. A crew member cannot tell how many actions are pending.

The AppLayout does show: `⚡ You're offline — changes will sync when connected` banner, but only for supervisors/admin who see the full layout. The field page uses its own container.

---

## 4. OTHER PAGES ON MOBILE (390px)

### Pages that are completely unusable on mobile

| Page | Issue | Severity |
|---|---|---|
| **WorkboardContent** (`/app/workboard`) | 259KB component. Gantt timeline (`GanttTimeline`), multi-column crew rows, drag-and-drop. Requires minimum ~900px to be functional. Heavy horizontal scroll. | 🔴 Broken |
| **ReportsPage** (`/app/reports`) | Recharts bar charts, data tables, date range pickers. Minimum usable width ~600px. | 🔴 Broken |
| **ApplicationsPage** (`/app/applications`) | Multi-tab chemical log interface, tank mix tables, complex forms. | 🔴 Broken |
| **SchedulerPage** (`/app/scheduler`) | Weekly grid layout with employee rows × day columns. Requires ~700px minimum. | 🔴 Broken |
| **DispatchBoardPage** (`/app/dispatch`) | Real-time crew tracking, map-adjacent data tables. | 🔴 Broken |

### Pages that work acceptably on mobile

| Page | Notes |
|---|---|
| **MobileFieldWorkspacePage** (`/app/field`) | Purpose-built for mobile. Max-width 520px. ✓ |
| **LaunchPortalPage** (`/`) | Single-column landing + auth dialog. ✓ |
| **BreakroomPage** (`/app/breakroom`) | Message/TV board style, relatively simple layout. Acceptable. |
| **MessagingPage** (`/app/messaging`) | Message list → detail pattern. Works at 390px. ✓ |
| **SafetyPage** (`/app/safety`) | Form-based incident logging. Usable. ✓ |
| **SettingsPage** (`/app/settings`) | Tab-based, single-column. Works. Minor horizontal overflow on some tables. |
| **WeatherPage** (`/app/weather`) | Cards and charts. Charts may overflow but content is readable. Acceptable. |
| **PricingPage** (`/pricing`) | Marketing page, responsive. ✓ |
| **ClientPortalPage** (`/portal/:clientToken`) | Public-facing, should be responsive. ✓ |

### Pages with confirmed horizontal scroll

- `WorkboardContent.tsx` — Gantt bar, crew column headers overflow at any width under 900px
- `SchedulerPage` — 7-column weekly grid will overflow at 390px
- `ReportsPage` — bar charts clip or require horizontal scroll
- `ApplicationsPage` — spray log tables with 10+ columns

The main content wrapper uses `overflow-x-hidden` (`AppLayout.tsx: overflow-x-hidden`) which **hides** overflow rather than scrolling it — some content may be silently cut off rather than scrollable.

---

## 5. COMPETITIVE COMPARISON

### Deputy
- **Bottom navigation** in the native mobile app: Home, Schedule, Time, Shifts, More.
- GPS-verified clock in: crew taps once, location is captured.
- Manager can view a map of where crew clocked in/out.
- **Offline capability** limited compared to Homebase.
- Strong at compliance (predictive scheduling laws, break tracking).
- Native iOS/Android app — not PWA.

### Homebase
- Mobile apps with **offline clock-in support** (newer versions).
- Geofencing for clock-in verification reduces off-site punches.
- Limitation: location captured only at punch-in, not throughout shift.
- No "where is the crew now" visibility during shift.
- Works best for **fixed-location businesses** (restaurant, retail).
- Simple clock-in interface — large prominent button above fold.
- Mobile app rated highly for ease of use by hourly workers.

### When I Work
- Designed to separate scheduling from time tracking.
- Mobile app does **not support offline** clock-in.
- Geofencing available but requires connectivity.
- Strongest for scheduling UX; weaker for field/job-site use cases.
- Popular with restaurant and retail — less suited to roaming crews.

### Minimum viable mobile experience for field crew

Based on competitive analysis and field worker research, the **non-negotiables** are:

1. **Clock in from the parking lot** — no connectivity required, queues locally
2. **See today's tasks in <3 seconds** — no navigating, no login friction
3. **Mark a task done with one tap** — no multi-step form
4. **App works when WiFi is spotty** — golf courses, nurseries, remote sites
5. **Works in Spanish** — ~40% of grounds crew workforce is Spanish-speaking
6. **No training required** — if a superintendent has to teach it, they won't use it

### What would make a superintendent say "my crew can actually use this"

- Clock in from their truck before walking to the first hole ✓ (already works)
- Clock tab in bottom nav glows green when someone is clocked in ✓ (already exists)
- Task cards with big "Done" buttons — not small inline text buttons ⚠️
- Offline badge showing "3 pending" so crew knows their taps registered ⚠️
- Language toggle visible without hunting through a dead-code layout ⚠️
- PWA install prompt with context ("Add to home screen for faster access") ✓ (implemented)
- Superintendent can see from their phone who is clocked in right now — this is the Workboard but it's broken on mobile 🔴

---

## 6. RECOMMENDED FIXES — PRIORITY ORDER

### P0 — Fix immediately (correctness)

**Fix 1: Resurrect offline queue badge**  
- **File:** `src/pages/MobileFieldWorkspacePage.tsx`  
- **Change:** In `displayOnlyLayout`, add a small banner when `loadSyncQueue().length > 0`. Show: `"N action(s) pending sync"` in a yellow badge above the task list.
- **Why:** Crew members don't know if their clock-in or task completion was saved. This is a data integrity perception issue.
- **Effort:** 1–2 hours

**Fix 2: Increase Start/Complete button touch target**  
- **File:** `src/pages/MobileFieldWorkspacePage.tsx` (lines ~1288–1300)  
- **Change:** Replace `px-3 py-1` on the Start/Complete button with `px-3 py-2 min-h-[44px]`. Or move the action button below the task title row on its own line.
- **Why:** 28px target on a gloved or moving hand = missed taps. WCAG 2.1 AAA and Apple HIG both require 44px minimum.
- **Effort:** 30 minutes

**Fix 3: Restore language toggle (EN/ES)**  
- **File:** `src/pages/MobileFieldWorkspacePage.tsx`  
- **Change:** The language toggle exists in dead code. Add it to `displayOnlyLayout` — a small `EN | ES` toggle in the top-right of the Clock In card or as a floating button.
- **Why:** Spanish-speaking crew members can't access it at all in the active layout.
- **Effort:** 1 hour

### P1 — High impact (user experience)

**Fix 4: Add task progress summary to active layout**  
- **File:** `src/pages/MobileFieldWorkspacePage.tsx`  
- **Change:** Add the `doneCount / assignments.length` progress indicator (already computed) to `displayOnlyLayout` above the task list. A simple `"3/6 tasks complete"` line with a brand-green progress bar is sufficient.
- **Why:** Crew members want to know how far through the day they are without counting.
- **Effort:** 1 hour

**Fix 5: Make Workboard usable on mobile for supervisors**  
- **File:** `src/pages/WorkboardContent.tsx`  
- **Change:** Detect `window.innerWidth < 640` and render a simplified "Mobile Workboard" view: a vertical list of crew members with their assigned tasks for the day. No Gantt, no drag-drop. Read-only is fine.
- **Why:** Superintendents check the board from their phones throughout the day. Currently broken.
- **Effort:** 4–8 hours

**Fix 6: Add offline data banner to active layout**  
- **File:** `src/pages/MobileFieldWorkspacePage.tsx`  
- **Change:** Inside `displayOnlyLayout`, add the `isOfflineData` check (already in state) and render the yellow "Showing cached data" banner. Copy from dead code at line 1386–1390.
- **Why:** Dead simple — it already exists, just copy it into the active layout.
- **Effort:** 15 minutes

### P2 — Meaningful improvements

**Fix 7: Raise sidebar NavItem touch targets**  
- **File:** `src/components/AppSidebarRefined.tsx`  
- **Change:** Increase `py-2.5` to `py-3` on `NavItem` buttons (line ~106, ~118, ~131). Takes nav items from ~40px to ~44px.
- **Effort:** 10 minutes

**Fix 8: Add "My Crew Today" mobile view for supervisors**  
- **File:** New component or `CommandCenterOperationalPage.tsx`  
- **Change:** A mobile-first card showing who is clocked in right now, visible at `/app/dashboard` on small screens.
- **Why:** Top superintendent request — "who is on site right now?"
- **Effort:** 3–4 hours

**Fix 9: Fix `overflow-x-hidden` clipping on table-heavy pages**  
- **File:** `src/components/AppLayout.tsx`  
- **Change:** On pages like Reports and Applications, allow horizontal scroll within the main content area instead of clipping. Use `overflow-x-auto` scoped to the table container rather than the full page wrapper.
- **Effort:** 1–2 hours

**Fix 10: Improve pull-to-refresh visual feedback**  
- **File:** `src/pages/MobileFieldWorkspacePage.tsx`  
- **Change:** Current pull indicator is a plain text div ("Pull to refresh"). Replace with a loading spinner + brief haptic feedback on threshold crossing (`navigator.vibrate(30)` where supported).
- **Effort:** 30 minutes

---

## Summary Table

| Priority | Fix | File | Effort |
|---|---|---|---|
| P0 | Offline queue badge | MobileFieldWorkspacePage.tsx | 1–2h |
| P0 | Start/Complete button 44px | MobileFieldWorkspacePage.tsx | 30m |
| P0 | Restore EN/ES language toggle | MobileFieldWorkspacePage.tsx | 1h |
| P1 | Task progress summary in active layout | MobileFieldWorkspacePage.tsx | 1h |
| P1 | Mobile workboard view for supervisors | WorkboardContent.tsx | 4–8h |
| P1 | Offline data banner in active layout | MobileFieldWorkspacePage.tsx | 15m |
| P2 | Sidebar nav item touch targets | AppSidebarRefined.tsx | 10m |
| P2 | Crew-on-site mobile card | CommandCenterOperationalPage.tsx | 3–4h |
| P2 | Fix overflow clipping on table pages | AppLayout.tsx | 1–2h |
| P2 | Pull-to-refresh haptic + spinner | MobileFieldWorkspacePage.tsx | 30m |

---

## Appendix: Dead Code Inventory

Lines 1356–1700+ in `MobileFieldWorkspacePage.tsx` constitute an unreachable second return statement containing the original full-featured layout. Features in dead code:
- Welcome banner (first-time user)
- Offline data warning badge
- Employee name / date / property header
- EN/ES language switcher
- Clock-in card (h-12 buttons — larger than active layout)
- Shift time display card
- Add to Calendar button
- Task progress bar
- Full task cards with category badges, actual hours input, quick-hours buttons
- Needs/request form trigger (submit task request to supervisor)

Recommendation: Either restore these features to the active layout or delete the dead code. Do not leave it — it creates false confidence that features exist when they don't.

---

*Sources used in competitive research:*
- [Deputy mobile app help documentation](https://help.deputy.com/hc/en-au/articles/4753103029263-Manager-guide-to-the-Deputy-mobile-app)
- [Homebase vs When I Work comparison (2026)](https://connecteam.com/homebase-vs-wheniwork/)
- [Homebase mobile time clock](https://www.joinhomebase.com/glossary/mobile-time-clock)
- [Touch target accessibility guidelines](https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/)
- [Tap targets and thumb zones](https://www.72technologies.com/blog/tap-targets-thumb-zones-mobile-ux)
- [Mobile UX Design 2026 guide](https://uxcam.com/blog/mobile-ux/)
- [Mobile navigation UX best practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/)

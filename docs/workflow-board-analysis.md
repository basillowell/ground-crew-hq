# Workflow / Dispatch Board — Analysis & Recommendation

**Date:** 2026-07-20
**Status:** Analysis and recommendation only. No code changes in this pass.
**Scope:** `src/pages/WorkboardContent.tsx` (6,404 lines) + `src/components/workboard/` (6 components).

---

## Two things to say up front

**1. The TaskTracker gap-analysis document does not exist.** I searched the working tree, every branch, and full git history (`--diff-filter=A`, `-S "TaskTracker"`). Nothing. The only reference anywhere in the project is one line in `docs/skills/workboard-skill.md`: *"Similar to taskTracker labor board: employee rows, task rows inside employee, duration column, equipment column, status column."* So there was no prior analysis to build on, and this document does not contain original TaskTracker research either — I have no access to the product. **Treat TaskTracker as an unanalyzed competitor.**

**2. Source quality is mediocre and you should weight it accordingly.** Searches for dispatch-board UX return vendor marketing pages and affiliate listicles, not genuine teardowns. One search explicitly returned *"a detailed UX teardown specifically analyzing Deputy's capacity bar UI components and visual density doesn't appear to be available."* I've cited what states a concrete mechanism and discarded the rest. Where a claim rests on a vendor describing its own product, I say so. This is weaker evidence than the color-scheme analysis, which rested on primary engineering write-ups.

**The code inventory below, by contrast, is first-hand and verified.** That asymmetry is worth keeping in mind: the strongest findings here come from reading your code, not from the research.

---

## 1. Current-state inventory (read from the actual code)

### What GCHQ already does — and does well

| Capability | Where | Notes |
|---|---|---|
| **Employee-grouped board** (default) | `EmployeeRow.tsx` (23KB) | Expand/collapse per crew member, tasks nested inside |
| **Task-grouped alternate view** | `TaskGroupedBoard.tsx` | Genuine second lens on the same data |
| **Drag-and-drop** | `WorkboardContent:4918`, `EmployeeRow:216-340` | Reorder employee lanes; drag tasks *between* employees; drop task onto a lane |
| **Time-based Gantt timeline** | `GanttTimeline.tsx` | Real 6am–6pm timeline, %-positioned blocks, category tones, drop-to-time |
| **Coverage % + thresholds** | `:2360`, `:2452` | `assignedMinutes / shiftMinutes`, configurable warning threshold |
| **Color-coded left-edge rail** | `:4823` | `border-l-2 border-l-green/amber/red` keyed to coverage |
| **Escalation system** | `:2425-2475`, `:3054` | Coverage gaps, equipment service-overdue, dismissible |
| **Bulk apply via templates** | `:2805`, `:6021-6125` | All-crew toggle *or* per-employee multi-select |
| **Quick Plan** (copy last week) | `:5385` | Suggestion list with per-item selection |
| **Notes, scoped** | `NotesPanel.tsx` | Daily / General / Geo / Alerts, scoped to property / employee / assignment |
| **Equipment favorites + recents** | `:2945` | "Recently used" chips |
| **Turf Management panel** | `TurfPanel.tsx` | Domain-specific, no competitor equivalent found |
| **Actual-hours capture** | `:665-671` | Per-assignment actual vs planned, inline timeline editing |
| **Publish / send schedule to crew** | `:5956` | End-of-day report, crew notification |
| **Separate mobile + desktop trees** | `:688-706` | `expandedMobileCrewIds` vs `expandedDesktopCrewId` |

**This is a genuinely mature board.** Several things the research holds up as best practice, GCHQ already has — the color-coded status rail, drag-drop reassignment, a real timeline view, dual grouping, templated bulk creation. **Do not rebuild these.**

### The one real functional hole

**Nothing in the board detects conflicts.** `grep` for `conflict|overlap|doubleBook|alreadyAssigned` across `WorkboardContent.tsx` and every workboard component returns **zero matches**.

Concretely, on equipment (`:888`):

```ts
.from('equipment_units')
  .eq('active', true)
  .eq('status', 'available')     // the unit's OWN status field
```

That filters on whether the unit is broken or retired. It does **not** check whether the unit is already assigned to another employee on the same date. **Two crew members can be assigned the same mower for the same shift, and the board will not say a word.**

This isn't a nice-to-have I'm inventing. `docs/skills/workboard-skill.md` lists under **Validation**: *"avoid duplicate booking the same equipment at the same time if time windows exist."* It's a documented requirement that was never implemented.

The same absence applies to labor: coverage is computed and surfaced **after** the fact in the escalation panel, never **at the moment** of assignment.

### Visual/theming debt

- **31 hardcoded Tailwind palette classes** across workboard files (`bg-emerald-100`, `text-amber-800`, `bg-red-100`…): 20 in `WorkboardContent.tsx`, 6 in `EmployeeRow.tsx`, 5 in `TaskBlock.tsx`.
- **`GanttTimeline.tsx` hardcodes light-mode hex pastels** — `#dcfce7`, `#dbeafe`, `#fef3c7`, `#78350f`.

These bypass the OKLCH token system entirely. They were written for a light UI and are now painted onto a dark, themeable app. **This is very likely why the Workflow page reads as inconsistent with the rest of the app** after the theming work — the coverage badge uses `bg-emerald-100 text-emerald-800` (a near-white chip with dark green text) sitting on a dark surface, and it won't change with the user's scheme.

---

## 2. Findings from comparable products

### Conflict prevention happens *at assignment time*, not after

The clearest and most consistent pattern.

- ServiceTitan: *"If you try to drag a Generator job to an Apprentice, the system warns you,"* and dispatchers *"are alerted if they try to book a job outside the tech's zone."* Skills-based scheduling *"automatically prevent[s] overbooking the wrong job types at the wrong times"* ([ServiceTitan dispatch](https://www.servicetitan.com/features/dispatch-software), [Daily Dispatch Board docs](https://help.servicetitan.com/docs/use-the-daily-dispatch-board)).
- Overrun is shown **visually and immediately**: *"if a job runs long, you can visually see the overlap with the next appointment and drag the next appointment to a different tech or slide it later."*

**GCHQ (a) functionality:** *lacks entirely.* The board computes coverage but never blocks or warns during assignment.
**GCHQ (b) visual:** N/A — nothing to present yet. **A visual conflict indicator is strictly blocked on building detection first.**

### Equipment double-booking is a named, solved problem elsewhere

Samsara shipped asset scheduling specifically because *"assets [were] being double booked,"* letting you *"manage all your jobs and asset assignment"* centrally ([Samsara asset scheduling](https://www.samsara.com/blog/easily-schedule-leased-assets-with-samsara)).

**GCHQ (a):** *lacks entirely* — filters on unit status only (`:888`).
**GCHQ (b):** the *equipment-overdue* warning is well presented; there is simply no availability state to present.

### Drag-and-drop reassignment is table stakes

ServiceTitan matches techs to jobs *"all with a simple drag-and-drop"*; Jobber offers *"a drag-and-drop calendar to assign, reschedule, and track jobs in real-time"* ([Jobber vs ServiceTitan](https://www.fieldpulse.com/resources/blog/jobber-vs-servicetitan)); Deputy has a *"drag-and-drop shift builder with customizable templates"* ([Deputy scheduling](https://www.deputy.com/features/scheduling-software)).

**GCHQ (a):** *already supported.* Lane reorder, task-to-employee, task-to-task, and drop-to-time on the Gantt.
**GCHQ (b):** *matches.* No work needed. ✅

### Timeline/Gantt is the standard for spotting overlap and gaps

*"Gantt Chart Displays… horizontal bars, excellent for identifying overlaps, coverage gaps, and visualizing the duration of shifts across a team."* Alternatives cited are matrix/grid and heat maps, with explicit warning about *"Information Density Balance… to prevent overwhelming users"* ([Shift Management UX](https://www.myshyft.com/blog/schedule-visualization-tools/)).

**GCHQ (a):** *already supported* — `GanttTimeline.tsx` is a real implementation.
**GCHQ (b):** *falls short* — it's hardcoded to light pastels, so on the dark theme it renders as bright washes that fight the surface palette.

### Templates for repeated schedules

Deputy: templates in the shift builder. ServiceTitan Dispatch Pro auto-assigns on skills/performance/proximity (a paid AI add-on — worth noting the baseline product does **not** do this).

**GCHQ (a):** *already supported and arguably ahead* — Quick Plan (copy last week) **plus** task templates with all-crew/multi-select targeting.
**GCHQ (b):** *matches.* ✅

---

## 3. Recommendations

### A. Functionality — ranked by effort-to-impact

**A1. Equipment double-booking prevention** ⭐ *do this first*
**Effort: low. Impact: high.** The query at `:888` already fetches equipment for the org and date context exists. Add a filter (or a warning badge) against units already assigned that day. This is a **documented requirement that was never built**, it's the single clearest gap versus comparable products, and unlike most items here it has a real-world cost: two crews sent for the same machine.
*Trade-off:* need to decide hard-block vs. warn-and-allow. Recommend **warn**, since a supervisor may legitimately share a unit across a split shift.

**A2. Warn at assignment time, not after**
**Effort: medium. Impact: high.** The coverage math already exists (`:2360`) — it just runs in the wrong place. Surface "this pushes Nick to 110% of shift" **in the assignment dialog**, not in a panel discovered later. This is the single most consistent pattern across all researched products.
*Trade-off:* touches the busiest dialog in the app; get the copy non-naggy or people will tune it out.

**A3. Multi-select bulk edit of *existing* assignments**
**Effort: medium. Impact: medium.** Templates bulk-**create** well, but there's no way to select three existing assignments and change status/time/property in one action — the same friction you just hit on the availability grid. The pattern (and now the precedent) already exists elsewhere in the app.

**A4. Skills/qualification matching**
**Effort: high. Impact: medium.** ServiceTitan's skills-based scheduling has no GCHQ equivalent, but it needs a data model (certifications per employee, requirements per task) that doesn't exist. **Genuinely large; don't start here.** Note ServiceTitan gates the auto-assign version behind a paid AI add-on.

### B. Visual / UX — ranked by effort-to-impact

**B1. Replace hardcoded palette colors with theme tokens** ⭐ *do this first*
**Effort: low. Impact: high.** 31 hardcoded Tailwind classes + `GanttTimeline`'s hex pastels. This is almost certainly why Workflow feels off next to the rest of the app now — a `bg-emerald-100` chip is a near-white block on your dark surface, and it ignores the user's scheme entirely. Bounded, mechanical, no logic risk.
*Independent* of every functional item. Do it regardless of what else you pick.

**B2. Coverage as a capacity bar, not a raw percentage**
**Effort: low-medium. Impact: medium.** You already have the color-coded left rail (✅ matching best practice) *and* the number. A short horizontal fill bar reads faster than "72%" — the research favors bar/heat-map density over numeric. Cheap because the math and thresholds already exist.
*Independent.*

**B3. Make the Gantt timeline a first-class view**
**Effort: medium. Impact: medium.** `GanttTimeline.tsx` is the exact artifact the research calls best-in-class for spotting overlaps and gaps — but it's hardcoded to light mode and (from the code) not a primary destination alongside Employee/Task grouping. Fixing B1 partly rescues it.
**Depends on B1** for the color work.

**B4. Visual conflict indicators on the board**
**Effort: medium. Impact: high — but blocked.** ServiceTitan's "see the overlap, drag to fix" is the payoff pattern. **This cannot be built before A1/A2**, because there is no conflict state to render. Listed here so it isn't mistaken for independent visual polish.
**Hard dependency: A1 and/or A2 must ship first.**

**B5. Density / progressive disclosure audit**
**Effort: medium. Impact: uncertain — needs your judgment.** ~60 `useState` hooks and many panels (Planning, Notes, SOP, Work Orders, Turf, Suggested Tasks) suggest a lot competing for attention. Several already collapse (`sopCollapsed`, `suggestedTasksCollapsed`, `workOrdersExpanded`), so the mechanism exists. **I can't tell from code alone whether the defaults are wrong** — that needs watching a supervisor use it.

---

## 4. Recommendation

**Do A1 and B1 first. They're both low-effort, they're independent of everything else, and they fix real defects rather than adding surface area.**

A1 closes a documented requirement with a genuine operational cost. B1 explains the visual inconsistency you've been reacting to and is mechanical enough to be near-riskless.

Then **A2**, which is the highest-value structural change — it moves information you already compute to the moment it changes a decision. Only after A1/A2 does B4 become buildable.

**The thing worth internalizing:** this board is not behind on features. It already has drag-drop, dual grouping, a real timeline, templates, escalations, and a status rail — several of which the research treats as differentiators. Its gaps are narrow and specific: **it doesn't know when something conflicts, and it's painted in colors that predate the theme system.** Those are much smaller problems than a 6,400-line file might suggest.

### Open questions

- **Should equipment conflicts block or warn?** Split shifts may make sharing legitimate.
- **Is the Gantt timeline actually used?** If supervisors live in the Employee view, B3 drops down the list.
- **Is TaskTracker parity still the goal?** `workboard-skill.md` frames the whole board as "similar to taskTracker," but nobody has analyzed it. If it matters, that's a real research task — I'd need access or screenshots.

---

## Sources

- [ServiceTitan — Dispatch software](https://www.servicetitan.com/features/dispatch-software) · [Use the Daily Dispatch Board](https://help.servicetitan.com/docs/use-the-daily-dispatch-board) — drag-drop, skills/zone warnings at assignment, visual overlap
- [Jobber vs. ServiceTitan (FieldPulse)](https://www.fieldpulse.com/resources/blog/jobber-vs-servicetitan) — drag-drop calendar, real-time reschedule
- [Deputy — Scheduling software](https://www.deputy.com/features/scheduling-software) — drag-drop shift builder, templates
- [Shift Management UX: Schedule Visualization (myshyft)](https://www.myshyft.com/blog/schedule-visualization-tools/) — Gantt vs matrix vs heat map, density balance
- [Samsara — Asset scheduling](https://www.samsara.com/blog/easily-schedule-leased-assets-with-samsara) — double-booking as the named problem
- `docs/skills/workboard-skill.md` — internal spec; source of the unimplemented equipment-conflict requirement

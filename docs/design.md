# Ground Crew HQ Design System

## 1) Product Identity
Ground Crew HQ is a premium workforce operations platform for grounds crews, facilities teams, turf managers, and field supervisors.

The experience should feel:
- Powerful
- Clean
- Fast
- Field-ready
- Premium
- Operational
- Trustworthy

First impression should feel like a command center, not a basic task app.

## 2) Visual Direction
- Modern operations command center
- Premium fleet/facility/turf management dashboard
- Clean enterprise SaaS
- Sports facility operations board

Avoid:
- Childish colors
- Cluttered layouts
- Generic template feel
- Fake data-heavy dashboards

## 3) Color System
Use the following design tokens:

```css
:root {
  --hq-green-900: #0B2F1F;
  --hq-green-800: #123D2A;
  --hq-green-700: #185A3A;
  --hq-green-600: #227A4D;
  --hq-green-500: #2FA866;
  --hq-green-100: #EAF6EF;
  --hq-ink: #111827;
  --hq-slate: #334155;
  --hq-muted: #64748B;
  --hq-border: #E2E8F0;
  --hq-bg: #F6F8F6;
  --hq-card: #FFFFFF;

  --status-ready: #16A34A;
  --status-warning: #F59E0B;
  --status-danger: #DC2626;
  --status-info: #2563EB;
  --status-paused: #94A3B8;
}
```

## 4) Typography
- Modern sans-serif: Inter / Geist / system sans
- Strong page titles
- Uppercase micro-labels
- Compact, readable table text

## 5) Layout System
- Dark left sidebar
- Bright main workspace
- Sticky top command bar
- Large rounded cards
- Optional right context panels

## 6) Page Standards

### Dashboard
- Lead with today’s operational summary
- Show quick actions and high-signal KPIs first
- Keep setup/onboarding states guided and concise

### Employees
- Prioritize add/edit workflow clarity
- Settings-driven dropdowns only
- Show status and role clearly in list and modal

### Scheduler
- Weekly grid readability first
- Distinct shift/day-off states
- Clear hour totals and save feedback

### Workboard
- Daily execution board first, not generic kanban
- Employee rows + assignment detail hierarchy
- Show warnings for over-assigned hours

### Equipment
- Left type navigation, right unit details
- Strong status visibility (ready/issue/maintenance/disabled)
- Work order actions obvious and compact

### Weather
- Live source transparency always visible
- Actionable weather signals over raw noise
- Setup flow must be fast for first-time admins

### Reports
- Filter -> run -> result flow
- Clear loading/error/empty states
- Export controls visible but not dominant

### Settings
- Clean admin control center structure
- Workforce structure is first-class and saveable
- Skills/docs helpers should support admins, not runtime AI

### Landing/Login
- Minimal, premium, trustworthy
- Fast auth feedback with explicit errors
- No demo clutter

## 7) Component Rules

### Buttons
- Primary for main action
- Secondary/outline for supporting actions
- Danger only for destructive actions

### Badges
- Use status colors consistently
- Keep text short and scannable

### Tables
- Dense but readable
- Sticky headers where useful
- Action column predictable and aligned

### Modals
- Single clear goal per modal
- Keep forms grouped and labeled
- Save/cancel always visible

### Empty States
- Explain what is missing
- Provide one obvious next step

### Loading States
- Use skeletons only where they improve perceived performance
- Avoid blank white screens

### Error States
- Human-readable message
- Include retry path
- Do not show scary errors for normal empty setup states

### Icons
- Use lucide-react only
- Keep icon sizing consistent
- Icons should reinforce actions, not decorate randomly

### Mobile/Field Use
- Minimum 44px touch targets
- High contrast for daylight readability
- Keep critical actions near thumb zones

## 8) Competitive Design Edge
Ground Crew HQ should visibly differentiate on:
- Crew scheduling
- Daily execution clarity
- Weather-aware operations
- Equipment readiness
- Reporting confidence
- Safety and communication workflows
- Settings-driven operational structure

## 9) Implementation Guidance
- Make small page-specific improvements.
- Do not redesign the whole app in one pass.
- Preserve working functionality.
- Use existing Tailwind/shadcn/lucide patterns.
- Always return exact files changed and testing steps in implementation tasks.

# Ground Crew HQ — Sprints 29–33 Codex Prompts
## Weather Nuclear Upgrade, Auth Fixes, Pricing, Onboarding & Advanced Ops
## Current: ver2.5.14.145 | 145 deployments, 100% prompt coverage

---

## SPRINT 29 — Weather Nuclear Upgrade (ver2.5.14.146 – 2.5.14.150)
**Goal:** Best weather experience in any operations tool at any price point.
**APIs used:** RainViewer (free radar tiles), NWS api.weather.gov (free alerts),
Blitzortung (free lightning), Open-Meteo (already integrated).

---

### PROMPT: ver2.5.14.146 — Live radar map with RainViewer

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.146 — Live weather radar map using RainViewer API + Leaflet

---

Add a full-width live radar map to the Weather page as the HERO section
(above the current conditions card).

FIX 1 — Install Leaflet

Run: npm install leaflet react-leaflet
Add types: npm install -D @types/leaflet

Import Leaflet CSS in the Weather page or globally:
  import 'leaflet/dist/leaflet.css';

FIX 2 — Radar map component

Create src/components/weather/RadarMap.tsx

Props: latitude (number), longitude (number), height (string, default '400px')

The component renders:
  <MapContainer center={[latitude, longitude]} zoom={8}
    style={{ height, width: '100%', borderRadius: '12px' }}
    zoomControl={true} scrollWheelZoom={true}>
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      attribution="&copy; CARTO"
    />
    <TileLayer
      url={radarTileUrl}
      opacity={0.6}
    />
    <Marker position={[latitude, longitude]}>
      <Popup>{propertyName}</Popup>
    </Marker>
  </MapContainer>

FIX 3 — Fetch RainViewer radar timestamps

On mount, fetch: https://api.rainviewer.com/public/weather-maps.json

Response contains radar.past[] array with timestamps.
Use the LATEST timestamp to build the tile URL:
  const latestPath = data.radar.past[data.radar.past.length - 1].path;
  const radarTileUrl = `https://tilecache.rainviewer.com${latestPath}/256/{z}/{x}/{y}/2/1_1.png`;

  Color scheme 2 = original, smooth = 1, snow = 1

FIX 4 — Radar animation (last 2 hours)

Add a Play/Pause button below the map. When playing:
  Cycle through all radar.past[] timestamps at 500ms intervals
  Update the TileLayer URL on each frame
  Show a timestamp label: "Radar: 1:30 PM" updating with each frame

Add a timeline scrubber bar showing all available timestamps.
User can drag to scrub through radar history manually.

FIX 5 — Integration into Weather page

Place the radar map as the FIRST section on the Weather page:
  - Full width, 400px height on desktop, 250px on mobile
  - Dark map theme (CARTO dark basemap)
  - Property marker at center
  - Below map: "Last updated: [timestamp] · Source: RainViewer"

Keep all existing weather sections (current conditions, hourly, 7-day, rainfall)
below the radar map.

---

Files touched:
- src/components/weather/RadarMap.tsx (create)
- src/pages/WeatherPage.tsx (add radar map hero)
- package.json (add leaflet, react-leaflet)

Commit: feat: ver2.5.14.146 — live weather radar map with RainViewer
```

---

### PROMPT: ver2.5.14.147 — NWS severe weather alerts

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.147 — NWS severe weather alerts panel + push notifications

---

FIX 1 — Fetch NWS alerts

On the Weather page, fetch active alerts from the NWS API:
  GET https://api.weather.gov/alerts/active?point={lat},{lng}

  Headers: { 'User-Agent': 'GroundCrewHQ (support@groundcrewhq.com)' }
  (NWS requires a User-Agent header)

Parse response.features[] array. Each feature has:
  properties.event — "Tornado Warning", "Severe Thunderstorm Watch", etc.
  properties.severity — "Extreme", "Severe", "Moderate", "Minor"
  properties.headline — short description
  properties.description — full text
  properties.onset — start time
  properties.expires — end time
  properties.instruction — safety instructions

FIX 2 — Alerts panel on Weather page

Add an "Active Alerts" section between the radar map and current conditions.

If alerts exist:
  Show each alert as a colored card:
    Extreme/Severe = red background, bold text
    Moderate = orange/amber background
    Minor = yellow background

  Each card shows:
    - Event name (e.g. "Severe Thunderstorm Warning")
    - Severity badge
    - Headline text
    - Time: "Until 4:30 PM"
    - Expandable: click to show full description + safety instructions

If no alerts:
  Show: "No active weather alerts for this location ✓" in green

FIX 3 — Push notifications for severe alerts

When alerts are fetched and contain Extreme or Severe severity:
  Use the existing sendNotification() utility from lib/notifications:
    sendNotification(
      `⚠️ ${alert.event}`,
      alert.headline,
      '/app/weather'
    );

  Only send notification ONCE per alert (track seen alert IDs in sessionStorage).

FIX 4 — Alert badge on Weather sidebar nav

If active severe alerts exist, show a red dot badge next to "Weather"
in the sidebar navigation (similar to the notification bell badge).

---

Files touched:
- src/pages/WeatherPage.tsx (alerts panel)
- src/components/AppLayout.tsx (sidebar weather alert badge)
- src/lib/nwsAlerts.ts (create — fetch + parse NWS API)

Commit: feat: ver2.5.14.147 — NWS severe weather alerts with push notifications
```

---

### PROMPT: ver2.5.14.148 — Lightning strike overlay

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.148 — Lightning strike display on radar map

---

Add lightning strike data to the radar map from ver2.5.14.146.

FIX 1 — Blitzortung lightning embed

The simplest reliable approach: embed Blitzortung as an iframe layer
OR use their WebSocket feed for real-time strikes.

OPTION A (simpler — iframe overlay):
  Add a toggle button on the radar map: "⚡ Lightning"
  When enabled, overlay an iframe from:
    https://map.blitzortung.org/index.php?interactive=0&NavigationControl=0&FullScreenControl=0&InfoControl=0&DetectorControl=0&HistoryControl=0&LinksControl=0&SoundControl=0&TimerControl=0&ColorScheme=1&ColorSchemeStroke=1&ColorSchemeBackground=2
  
  Position the iframe absolutely over the Leaflet map with pointer-events: none
  and opacity: 0.7 so both radar and lightning are visible together.
  
  Sync the iframe's map center to the Leaflet map center (this is hard with
  iframes — if not feasible, use Option B instead).

OPTION B (better — static lightning data):
  Fetch recent lightning data from Open-Meteo (if available) or use
  the NWS alert data to detect active thunderstorms.
  
  When a thunderstorm alert is active (weather code >= 95 from Open-Meteo):
    Show a lightning bolt icon on the radar map at the property location
    with a pulsing animation ring.
    Show text: "⚡ Active thunderstorm detected within forecast area"

  When no thunderstorm:
    Show: "No lightning activity detected"

Choose whichever option builds cleanly. Option B is more reliable.

FIX 2 — Lightning summary card

Below the radar map, add a small card:
  "⚡ Lightning Activity"
  If thunderstorm weather code active: "Active thunderstorm in area — seek shelter if lightning visible"
  If not: "No lightning detected near [property name]"

---

Files touched:
- src/components/weather/RadarMap.tsx (lightning toggle/overlay)
- src/pages/WeatherPage.tsx (lightning summary card)

Commit: feat: ver2.5.14.148 — lightning activity display on weather page
```

---

### PROMPT: ver2.5.14.149 — Storm track forecast animation

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.149 — Storm track forecast: animated precipitation timeline

---

FIX 1 — Precipitation forecast as animated radar simulation

RainViewer only has past 2 hours of radar. For FUTURE precipitation,
use Open-Meteo's hourly precipitation_probability and weathercode data
to create a visual "future radar" simulation.

Create src/components/weather/StormTrackTimeline.tsx

Fetch hourly data for next 12 hours from Open-Meteo (already available).
For each hour, calculate a "storm intensity" score:
  score = (precipitation_probability / 100) * (weathercode >= 61 ? 2 : 1)

Display as a horizontal timeline bar (6 hours wide, scrollable to 12):
  Each hour segment is colored by intensity:
    score 0-0.2 = green (clear)
    score 0.2-0.5 = yellow (chance of rain)
    score 0.5-0.8 = orange (likely rain)
    score 0.8+ = red (heavy rain/storms)

Add an animated "wave" that moves from left to right showing storm progression.

Current time marker: vertical line at current position.
Each segment shows: hour label, precipitation %, weather icon.

FIX 2 — "Storm arrives in X hours" indicator

If any upcoming hour has precipitation_probability > 60% AND weathercode >= 61:
  Calculate hours until that point.
  Show prominent banner: "🌧️ Rain expected in ~3 hours (4:00 PM)"
  
If weathercode >= 95 (thunderstorm):
  "⛈️ Thunderstorm expected in ~2 hours (3:00 PM) — review outdoor operations"

If no significant precipitation in next 12 hours:
  "✅ Clear conditions expected for the next 12 hours"

FIX 3 — Place on Weather page

Add StormTrackTimeline below the radar map and above current conditions.
Make it visually prominent — this is the "what's coming" section.

---

Files touched:
- src/components/weather/StormTrackTimeline.tsx (create)
- src/pages/WeatherPage.tsx (integrate timeline)

Commit: feat: ver2.5.14.149 — storm track forecast timeline with arrival estimates
```

---

### PROMPT: ver2.5.14.150 — Weather page visual overhaul: Storm Radar aesthetic

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.150 — Weather page visual overhaul: dark theme + layer toggles

---

Redesign the Weather page to feel like a premium weather app (Storm Radar aesthetic).

FIX 1 — Dark weather theme

The Weather page should use a dark background regardless of app theme:
  Background: bg-slate-900 text-white
  Cards: bg-slate-800/80 border-slate-700
  This gives the radar map and weather data a dramatic, professional look.

Apply ONLY to the Weather page content area — the sidebar stays in app theme.

FIX 2 — Layer toggle bar on radar map

Floating toggle bar at top-right of the radar map:
  Buttons: Radar | Lightning | Wind | Temp | Alerts
  
  Radar: toggles radar tile overlay (default ON)
  Lightning: toggles lightning indicator (from ver2.5.14.148)
  Wind: toggles wind speed labels on the map (from Open-Meteo data)
  Temp: toggles temperature labels on the map (from Open-Meteo data)
  Alerts: toggles NWS alert polygons on the map (if available)

Each button: small pill with icon, active state = green, inactive = muted.
Only Radar is on by default.

FIX 3 — Current conditions overlay on radar map

Instead of a separate current conditions card, overlay key stats
on top of the radar map in the bottom-left corner:

  Semi-transparent dark card (bg-black/60 backdrop-blur):
    92°F · Overcast · Wind 8 mph · 56% humidity
    "Feels like 95°F"

This gives a "heads-up display" feel like Storm Radar.

FIX 4 — Reorganize weather page sections

New layout order (top to bottom):
  1. RADAR MAP (hero, full-width, 400px, with layer toggles + conditions overlay)
  2. ACTIVE ALERTS (if any — red/amber cards)
  3. STORM TRACK TIMELINE (precipitation forecast animation)
  4. HOURLY FORECAST (existing 12h/24h/48h toggle)
  5. 7-DAY FORECAST (existing day cards)
  6. SPRAY WINDOW (mini version of dashboard spray window)
  7. RAINFALL TRACKER (existing)
  8. WIND & CONDITIONS SUMMARY (existing)

FIX 5 — Spray window on Weather page

Add a compact spray window section (same logic as dashboard):
  Safe spray conditions: wind < 10mph, rain < 20%, temp 45-95°F
  Green/red timeline bar for the next 12 hours.
  "Safe to spray: 6:00 AM – 11:00 AM" summary text.

This is operations-specific and no other weather app has it.

---

Files touched:
- src/pages/WeatherPage.tsx (full layout restructure + dark theme)
- src/components/weather/RadarMap.tsx (layer toggles + conditions overlay)

Commit: feat: ver2.5.14.150 — weather page visual overhaul with dark theme and layer toggles
```

---

## SPRINT 30 — Auth & Pricing Fixes (ver2.5.14.151 – 2.5.14.153)
**Goal:** Logout works. Pricing reflects real market positioning. Session management solid.

---

### PROMPT: ver2.5.14.151 — Fix logout + session management

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.151 — Fix logout functionality + clean session management

---

FIX 1 — Logout button must work everywhere

Find EVERY logout/sign-out button in the app:
  - Settings → Access tab "Sign Out" button
  - Header user menu (if exists)
  - Mobile sidebar (if exists)
  - Error recovery screen "Return to Login" button

Each must execute this EXACT sequence:
  async function handleSignOut() {
    try {
      // 1. Clear query cache
      queryClient.clear();
      // 2. Clear persisted cache
      window.localStorage.removeItem('ground-crew-query-cache');
      // 3. Clear all app-specific localStorage
      Object.keys(window.localStorage).forEach(key => {
        if (key.startsWith('ground-crew') || key.startsWith('workflow') || key.startsWith('field-cache')) {
          window.localStorage.removeItem(key);
        }
      });
      // 4. Sign out from Supabase
      await supabase.auth.signOut();
      // 5. Hard redirect to login (not navigate — full page reload)
      window.location.assign('/');
    } catch (err) {
      console.error('Sign out failed:', err);
      // Force redirect even if signOut fails
      window.location.assign('/');
    }
  }

The key insight: use window.location.assign('/') NOT navigate('/').
navigate() keeps the React state tree alive which causes stale auth.
window.location.assign() does a full page reload, clearing everything.

FIX 2 — Header logout icon

Add a small logout icon (arrow-right-from-bracket or log-out icon)
in the header next to the user name. On click: handleSignOut().

The current header shows "Basil Lowell ADMIN →" but the arrow
may not be wired to sign out. Verify and fix.

FIX 3 — "Clear Cache & Reload" in Settings → Access

The Access tab should have a "Clear App Cache" button that:
  queryClient.clear();
  window.localStorage.removeItem('ground-crew-query-cache');
  window.location.reload();

This is separate from logout — it just refreshes stale data.

---

Files touched:
- src/pages/SettingsPage.tsx (Access tab sign out + clear cache)
- src/components/AppLayout.tsx (header logout icon)
- src/App.tsx (error recovery "Return to Login" handler)

Commit: fix: ver2.5.14.151 — logout functionality + session cleanup
```

---

### PROMPT: ver2.5.14.152 — Pricing page overhaul with real tiers

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.152 — Pricing page overhaul with market-aligned tiers

---

Rewrite the pricing page (PricingPage.tsx) with updated tiers.

THREE TIERS:

STARTER — $100/month
  Subtitle: "For small crews getting started"
  - Up to 10 employees
  - 1 property
  - Crew scheduling + task dispatch
  - Weather dashboard + spray window alerts
  - Mobile crew access (Field page)
  - Basic labor reports
  CTA: "Start Free Beta" → navigates to signup/login

PROFESSIONAL — $175/month (or $150/month billed annually)
  Subtitle: "For growing operations"
  Badge: "MOST POPULAR"
  - Up to 30 employees
  - Unlimited properties
  - Everything in Starter, plus:
  - Schedule templates + copy week
  - Labor reports + CSV export + cost tracking
  - Equipment tracking + service alerts
  - Spray window + weather-conflict detection
  - WhatsApp + email schedule sharing
  - Priority support
  Toggle: Show monthly ($175) / annual ($150/mo, save $300/year) pricing
  CTA: "Start Free Trial" → navigates to signup/login

ENTERPRISE — Custom pricing
  Subtitle: "For large facilities and multi-site operations"
  - 30+ employees (per-user pricing)
  - Everything in Professional, plus:
  - Multi-facility management
  - Advanced budget & cost analytics
  - API access + custom integrations
  - Dedicated onboarding + account manager
  - Live radar + severe weather notifications
  - Custom reporting
  CTA: "Contact Sales" → mailto:sales@groundcrewhq.com

DESIGN:
  - Annual/Monthly toggle switch at the top
  - Professional tier highlighted (green border, "MOST POPULAR" badge)
  - Feature comparison table below cards (checkmarks per tier)
  - "All plans include a 14-day free trial. No credit card required."
  - "Questions? Email support@groundcrewhq.com"

FEATURE COMPARISON TABLE (below cards):
  | Feature | Starter | Pro | Enterprise |
  | Properties | 1 | Unlimited | Unlimited |
  | Employees | Up to 10 | Up to 30 | Unlimited |
  | Scheduling | ✓ | ✓ | ✓ |
  | Task dispatch | ✓ | ✓ | ✓ |
  | Weather dashboard | ✓ | ✓ | ✓ |
  | Mobile crew app | ✓ | ✓ | ✓ |
  | Schedule templates | — | ✓ | ✓ |
  | Copy week | — | ✓ | ✓ |
  | Labor reports | Basic | Advanced + CSV | Advanced + CSV |
  | Cost tracking | — | ✓ | ✓ |
  | Equipment tracking | — | ✓ | ✓ |
  | Spray window alerts | — | ✓ | ✓ |
  | Live radar | — | — | ✓ |
  | Severe weather alerts | — | — | ✓ |
  | WhatsApp sharing | — | ✓ | ✓ |
  | API access | — | — | ✓ |
  | Multi-facility | — | — | ✓ |
  | Support | Community | Priority | Dedicated |

---

Files touched:
- src/pages/PricingPage.tsx (full rewrite)

Commit: feat: ver2.5.14.152 — pricing page overhaul with market-aligned tiers
```

---

### PROMPT: ver2.5.14.153 — Landing page pricing section update + CTA alignment

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.153 — Landing page: update pricing section + align CTAs

---

FIX 1 — Update pricing section on landing page

The landing page (LaunchPortalPage.tsx) has a pricing section.
Update it to match the new tiers from ver2.5.14.152:

  Show a compact version of the three tiers:
    Starter: $100/mo · Up to 10 crew
    Professional: $175/mo · Up to 30 crew · MOST POPULAR
    Enterprise: Custom · 30+ crew

  "View full pricing" link → navigates to /pricing

FIX 2 — CTA button alignment

All CTA buttons across the landing page must use consistent styling:
  Primary CTA: "Start Free Beta" → green button, navigates to /
  Secondary CTA: "Try Demo" → outline button, logs in as demo user
  "View Pricing" → text link to /pricing

FIX 3 — Add "14-day free trial" banner

Below the hero section, add a thin banner:
  "🎉 Free during beta — all features included. No credit card required."
  Green background, white text, centered.

---

Files touched:
- src/pages/LaunchPortalPage.tsx

Commit: feat: ver2.5.14.153 — landing page pricing update and CTA alignment
```

---

## SPRINT 31 — Onboarding & First-Run Experience (ver2.5.14.154 – 2.5.14.156)
**Goal:** A new subscriber goes from signup to operational in under 5 minutes.

---

### PROMPT: ver2.5.14.154 — Guided onboarding: step-by-step setup wizard

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.154 — Enhanced onboarding wizard with progress tracking

---

The onboarding wizard (built in ver2.5.72) needs enhancement for beta.

FIX 1 — Progress bar across all steps

Show a progress indicator at the top of the wizard:
  Step 1 of 5: Property Setup ●○○○○
  Step 2 of 5: Weather Location ●●○○○
  Step 3 of 5: Add Your Crew ●●●○○
  Step 4 of 5: Task Library ●●●●○
  Step 5 of 5: First Schedule ●●●●●

Use a horizontal progress bar with filled/unfilled dots.

FIX 2 — Step 2: Weather location setup

After adding a property, prompt for weather location:
  "Set up weather for [Property Name]"
  Three options:
    - Enter zip code (auto-lookup lat/lng)
    - Use my location (GPS)
    - Enter coordinates manually

  On save: INSERT into weather_locations with property, org_id, is_active=true

  weather_locations columns: id text, name text, property text,
    area text, latitude numeric, longitude numeric, org_id uuid, is_active boolean

FIX 3 — Step 5: Create first schedule

After seeding tasks, show:
  "Create your first weekly schedule"
  Display a simplified week grid (Mon-Fri only)
  For each employee added in step 3:
    Default shift: 7:00 AM - 3:30 PM (or operational day from settings)
    Checkboxes per day to toggle on/off

  On "Create Schedule":
    INSERT schedule_entries for each checked day/employee combination.

FIX 4 — Completion celebration

After step 5:
  "🎉 You're all set!"
  "Your operation is configured and ready to go."
  Buttons: "Open Dashboard" | "Open Workboard"

  Mark onboarding complete (prevent showing again):
  Store in localStorage: 'ground-crew-onboarding-complete' = 'true'

---

Files touched:
- src/components/OnboardingWizard.tsx (enhance)
- src/pages/CommandCenterOperationalPage.tsx (trigger wizard)

Commit: feat: ver2.5.14.154 — enhanced onboarding wizard with weather + schedule steps
```

---

### PROMPT: ver2.5.14.155 — Contextual help tooltips throughout app

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.155 — Contextual help tooltips for first-time users

---

Add small "?" help icons next to key UI elements that show explanatory
tooltips on hover/click. Target users who are seeing the app for the
first time.

TOOLTIPS TO ADD:

Dashboard:
  Morning briefing card → "This summarizes your crew, tasks, weather, and alerts for today."
  Spray window → "Green = safe to spray. Red = wind or rain makes spraying risky."
  Efficiency score → "Based on task completion, coverage, labor variance, equipment health, and open needs."

Scheduler:
  Copy Week button → "Duplicates this week's shifts to next week."
  Save as Template → "Saves this week as a reusable schedule pattern."

Workboard:
  Coverage % badge → "Percentage of shift time covered by assigned tasks."
  Quick Plan → "Auto-suggests today's tasks based on what you did last week."
  Weather warnings on tasks → "Based on current wind, rain, and temperature vs your escalation thresholds."

Settings:
  Escalation config → "Set thresholds for weather and equipment alerts on the workboard."
  Setup checklist → "Complete these steps to fully configure your operation."

IMPLEMENTATION:
  Use the existing Tooltip component from @/components/ui/tooltip.
  Wrap each "?" icon:
    <Tooltip>
      <TooltipTrigger>
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>{help text}</TooltipContent>
    </Tooltip>

---

Files touched:
- src/pages/CommandCenterOperationalPage.tsx
- src/pages/SchedulerPage.tsx
- src/pages/WorkboardPage.tsx
- src/pages/SettingsPage.tsx

Commit: feat: ver2.5.14.155 — contextual help tooltips throughout app
```

---

### PROMPT: ver2.5.14.156 — Welcome email template + in-app welcome message

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.156 — In-app welcome message for new users

---

FIX 1 — Welcome banner for first-time login

When a user logs in and has never dismissed the welcome banner
(check localStorage: 'ground-crew-welcome-dismissed'):

Show a full-width banner at the top of the Dashboard:
  Background: gradient green
  Text: "Welcome to Ground Crew HQ, [first name]! 👋"
  Subtitle: "Let's get your operation set up. Start with the setup wizard
  or explore the dashboard."
  Buttons: "Start Setup" (→ onboarding wizard) | "Explore Dashboard" (dismiss)
  "×" close button (sets localStorage flag)

FIX 2 — First-visit page hints

On FIRST visit to each major page (track in localStorage per page):

  Scheduler first visit:
    "This is your weekly schedule. Click '+ Add Shift' to schedule your crew."
    Dismiss button. Show once.

  Workboard first visit:
    "This is your daily operations board. Assign tasks to scheduled crew
    and track progress in real-time."
    Dismiss button. Show once.

  Weather first visit:
    "Live weather data for your property. Set up your weather station in
    Settings → Weather if you haven't already."
    Dismiss button. Show once.

Each hint appears as a small banner at the top of the page content area.
Light blue background, dismiss "×" button. Never shows again after dismissed.

---

Files touched:
- src/pages/CommandCenterOperationalPage.tsx (welcome banner)
- src/pages/SchedulerPage.tsx (first-visit hint)
- src/pages/WorkboardPage.tsx (first-visit hint)
- src/pages/WeatherPage.tsx (first-visit hint)

Commit: feat: ver2.5.14.156 — welcome message and first-visit page hints
```

---

## SPRINT 32 — Advanced Operations (ver2.5.14.157 – 2.5.14.159)
**Goal:** Features that make superintendents say "finally, someone built this."

---

### PROMPT: ver2.5.14.157 — Recurring daily task auto-assignment

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.157 — Recurring daily tasks: auto-assign when schedule is created

CLAUDE_DB_REQUIRED:
  Need a table: recurring_task_rules
  Columns: id uuid, org_id uuid, property_id uuid, task_id uuid,
  employee_id uuid (nullable — null means all scheduled crew),
  days_of_week text[] (e.g. ['mon','tue','wed','thu','fri']),
  active boolean DEFAULT true, created_at timestamptz DEFAULT now()
  (Claude will create this before Codex runs)

---

FIX 1 — Settings → Tasks tab: recurring task toggle

Each task in the task library gets a "Recurring" toggle:
  When enabled, show:
    - Days of week checkboxes (Mon-Sun)
    - Assign to: "All scheduled crew" or specific employee dropdown
  
  On save: INSERT into recurring_task_rules

FIX 2 — Auto-apply recurring tasks on Workboard load

When the Workboard loads for a date that has:
  - Schedule entries (crew is scheduled)
  - No assignments yet (fresh day)

Check recurring_task_rules WHERE active = true AND days_of_week contains today's day.
For each matching rule:
  If employee_id is null: create assignment for every scheduled employee
  If employee_id is set: create assignment for that specific employee (if scheduled)

Show a toast: "Auto-assigned 5 recurring tasks to 3 crew members"

Only run once per day (track in sessionStorage: 'recurring-applied-{date}').

---

Files touched:
- src/pages/SettingsPage.tsx (recurring toggle on tasks tab)
- src/pages/WorkboardPage.tsx (auto-apply on load)

Commit: feat: ver2.5.14.157 — recurring daily task auto-assignment
```

---

### PROMPT: ver2.5.14.158 — Crew availability calendar

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.158 — Employees page: availability calendar view

---

Add an "Availability" tab or view toggle on the Employees page.

FIX 1 — Monthly availability grid

Display a calendar grid (current month) with one row per employee:
  X axis: days of the month (1-31)
  Y axis: employee names

Each cell is color-coded:
  Scheduled (has schedule_entry) = green
  Day off / vacation / sick = respective colors from scheduler
  No entry = gray/empty

Data: fetch schedule_entries for the entire month for all employees.

FIX 2 — Quick stats

Below the calendar:
  "This month: [employee name] — 18 days scheduled, 2 days off, 1 sick"
  For each employee, show a summary row.

FIX 3 — Click to schedule

Clicking an empty cell opens the Add Shift modal pre-filled with
that employee and date. Clicking a filled cell opens the edit modal.

---

Files touched:
- src/pages/EmployeesPage.tsx (add availability tab/view)

Commit: feat: ver2.5.14.158 — employee availability calendar view
```

---

### PROMPT: ver2.5.14.159 — Workboard: drag tasks between employees

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.159 — Workboard: drag and drop tasks between crew members

---

Currently tasks can be reordered within a single employee's list.
Enable dragging a task from one employee to another.

FIX 1 — Cross-employee task drag

When dragging a task card, allow dropping it on a different employee's
task area. On drop:
  UPDATE assignments SET employee_id = newEmployeeId WHERE id = assignmentId
  Update local state optimistically.
  Show toast: "Moved [task name] from [old employee] to [new employee]"

Visual feedback during drag:
  - Dragged card shows a semi-transparent ghost
  - Valid drop targets (other employee areas) highlight with a dashed border
  - Invalid targets (same employee) show no highlight

FIX 2 — Drop on empty employee card

If an employee has no tasks, their empty state area ("No tasks assigned")
should be a valid drop target. On drop, the task moves to that employee.

FIX 3 — Prevent invalid drops

Do not allow dropping a task on:
  - The same employee (that's reordering, handled separately)
  - An employee not scheduled for that date
  Show toast.warning if attempted: "Cannot assign to unscheduled crew"

---

Files touched:
- src/pages/WorkboardPage.tsx
- src/components/workboard/EmployeeRow.tsx (if drag handlers are there)

Commit: feat: ver2.5.14.159 — cross-employee task drag and drop on workboard
```

---

## SPRINT 33 — Analytics & Business Intelligence (ver2.5.14.160 – 2.5.14.162)
**Goal:** Data that justifies the subscription to the GM who signs the check.

---

### PROMPT: ver2.5.14.160 — Dashboard: operations scorecard with trends

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.160 — Dashboard: weekly operations scorecard

---

Add an "Operations Scorecard" card to the Dashboard below the morning briefing.

METRICS (calculated from last 7 days of data):

  Task Completion Rate: [X]% (tasks done / total tasks)
    Trend arrow: ↑ or ↓ vs previous 7 days
    Bar chart: 7 daily bars

  Labor Efficiency: [X]% (actual hours / scheduled hours * 100)
    Green if 90-110%, yellow if 80-90% or 110-120%, red otherwise
    Trend arrow vs previous week

  Average Coverage: [X]% (mean of daily crew coverage percentages)
    Trend vs previous week

  Equipment Uptime: [X]% (available units / total units * 100)

  Crew Utilization: [X]% (days with shifts / total possible days * 100)

Display as a 5-column grid of metric cards.
Each card: large number, label, trend arrow, mini sparkline (7 data points).

Use recharts for sparklines (tiny line charts, no axes, just the trend shape).

---

Files touched:
- src/pages/CommandCenterOperationalPage.tsx

Commit: feat: ver2.5.14.160 — dashboard operations scorecard with weekly trends
```

---

### PROMPT: ver2.5.14.161 — Reports: executive summary PDF

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.161 — Reports: one-page executive summary for GM

---

Add a "GM Summary" tab/button on the Reports page.

On click, generate a single-page executive summary:

  GROUND CREW HQ — EXECUTIVE SUMMARY
  [Property Name] · [Date Range]

  KEY METRICS:
    Total Labor Hours: X scheduled / Y actual
    Total Labor Cost: $X,XXX
    Task Completion Rate: X%
    Average Crew Coverage: X%
    Equipment Health: X% uptime

  TOP 5 TASKS BY HOURS:
    1. Mow Greens — 45h total
    2. Mow Fairways — 38h total
    ...

  WEATHER IMPACT:
    X days with spray restrictions
    X days with heat advisories
    Total rainfall: X.X inches

  RECOMMENDATIONS:
    (Static text suggestions based on metrics)
    - If completion < 80%: "Consider adjusting task estimates or adding crew"
    - If labor variance > 15%: "Review actual hours tracking for accuracy"
    - If equipment uptime < 90%: "Schedule preventive maintenance"

Format as printable HTML (same pattern as ver2.5.14.135).
Auto-trigger window.print() on open.

---

Files touched:
- src/pages/ReportsPage.tsx

Commit: feat: ver2.5.14.161 — executive summary report for GM
```

---

### PROMPT: ver2.5.14.162 — Reports: year-over-year comparison

```
Read CODEX_RULES.md and docs/dev/live-db-state.md before writing code.

Hard rules:
- No SQL, no schema changes, no RLS, no auth changes, no new branches
- No hardcoded UUIDs — read from useAuth()
- Product UI only — no Claude/Codex/skill wording
- If DB change needed: CLAUDE_DB_REQUIRED and stop
- npm run build 0 errors before commit

Task: ver2.5.14.162 — Reports: month-over-month comparison charts

---

Add a "Trends" tab on the Reports page (if not already present from ver2.5.14.133).

FIX 1 — Monthly comparison chart

Fetch assignments grouped by month for the last 6 months:
  SELECT date_trunc('month', date) as month,
         sum(estimated_hours), sum(actual_hours), count(*)
  (Emulate in TypeScript since we can't write SQL — group fetched data by month)

Display as a recharts grouped bar chart:
  X axis: months (Jan, Feb, Mar...)
  Bars: Scheduled hours (blue) vs Actual hours (green)
  Line overlay: Task completion rate (%)

FIX 2 — Cost trend line

If employees have hourly_rate set:
  Calculate monthly labor cost = sum(actual_hours * hourly_rate)
  Display as a line chart below the bar chart.
  Show total YTD cost in a summary badge.

FIX 3 — Export all trends

"Export Trends" button → download all monthly data as CSV.

---

Files touched:
- src/pages/ReportsPage.tsx

Commit: feat: ver2.5.14.162 — monthly comparison charts and cost trends
```

---

## DB Changes Required

| Version | Change |
|---------|--------|
| 2.5.14.157 | Create `recurring_task_rules` table |

All other prompts use existing tables.

---

## Summary: What These Sprints Achieve

| Sprint | Versions | Impact |
|--------|----------|--------|
| S29 | 146-150 | Weather page becomes best-in-class with live radar, alerts, lightning, storm tracking |
| S30 | 151-153 | Logout works, pricing reflects market reality, CTAs aligned |
| S31 | 154-156 | New users go from signup to operational in 5 minutes |
| S32 | 157-159 | Recurring tasks, availability calendar, cross-employee drag-and-drop |
| S33 | 160-162 | Executive reports that justify the subscription to the GM |

**After Sprint 33 (ver2.5.14.162):** You have 162 production deployments,
a weather page that rivals Storm Radar, pricing that undercuts the market,
onboarding that converts trial users, and reports that sell the product
to the person who writes the check.

---

*Save to repo: docs/dev/ROADMAP_SPRINTS_29_33.md*

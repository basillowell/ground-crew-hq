---
name: ground-crew-weather
description: >
  Fetch, interpret, and act on weather data for Ground Crew HQ operations (/app/weather).
  Use this skill whenever the user asks about weather conditions, wants to know if it's
  safe to spray or mow, needs to reschedule jobs due to weather, or asks "can we work
  tomorrow?". Trigger on: "what's the weather", "is it safe to spray", "rain in the
  forecast", "heat advisory", "wind speed for spraying", or any weather question in the
  context of crew operations. Always interpret weather for field decisions — don't just
  report conditions.
---

# Ground Crew Weather Skill

## Live Database Reference
**Project ID:** `fjqeekwisnbpxgebrnpl`
**Property:** Sarasota Polo Club — Sarasota, Florida
**Coordinates:** lat 27.336, lng -82.531 (Sarasota, FL)

## Real Schema
```sql
-- Where the app stores weather config
weather_locations   id, name, property, area
weather_stations    id, locationId, latitude, longitude, timeZone, isPrimary
weather_daily_logs  id, locationId, date, temperature, humidity, wind, rainfallTotal, forecast, source, notes
manual_rainfall_entries  id, locationId, date, rainfallAmount, enteredBy, notes
```

## Weather API — Open-Meteo (no key needed)
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=27.336
  &longitude=-82.531
  &current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code
  &temperature_unit=fahrenheit
  &wind_speed_unit=mph
  &precipitation_unit=inch
  &forecast_days=7
  &timezone=America/New_York
```

Use `web_fetch` with this URL to get live data.

## Operational Rules — Sarasota Polo Club (180 acres)

### 🌿 Mowing / Field Maintenance
- ✅ GO: wind < 20 mph, no rain, temp < 100°F
- ⚠️ CAUTION: wet turf (polo field damage risk), temp > 95°F
- 🚫 STOP: active rain, lightning, wind > 25 mph

### 💧 Chemical Application (spray/fert)
- ✅ GO: wind 2–10 mph, no rain 4+ hrs before AND 24 hrs after, temp 50–85°F
- ⚠️ CAUTION: wind 10–15 mph, temp > 85°F
- 🚫 STOP: rain within 4 hrs, wind > 15 mph, temp > 90°F or < 45°F
- Log to `chemical_application_logs` with weather snapshot at time of application

### 🐎 Polo Field Prep
- ✅ GO: firm ground, wind < 20 mph
- ⚠️ CAUTION: soft/wet ground (hoof damage, divot issues)
- 🚫 STOP: rain in last 24 hrs on active fields, lightning

### 🌡️ Florida Heat Protocol (activate ≥ 103°F heat index)
- Water break every 30 min
- Shade rest every 2 hrs
- No solo work outdoors
- Limit heavy exertion 11am–2pm
- Post safety note to Breakroom (`notes` table, type='safety')

## Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌤️ WEATHER BRIEF — Sarasota Polo Club
[DATE] | Sarasota, FL

NOW: [temp]°F | Humidity [x]% | Wind [x] mph [dir]
Heat Index: ~[x]°F

TODAY:
  Morning  (5–11am): [temp range] | Wind [x] mph | [conditions]
  Midday  (11am–2pm): [temp range] | Wind [x] mph | [conditions]
  Afternoon (2–6pm): [temp range] | Wind [x] mph | [conditions]

FIELD STATUS:
  ✅/⚠️/🚫 Mowing:   [go/caution/stop + reason]
  ✅/⚠️/🚫 Spraying: [go/caution/stop + reason]
  ✅/⚠️/🚫 Field Prep: [go/caution/stop + reason]
  🌡️ Heat Protocol: [Active / Not Required]

RECOMMENDATION:
[2–3 sentences: what to do, when, what to watch]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Log Weather to Database
After fetching, optionally log to `weather_daily_logs`:
```sql
INSERT INTO weather_daily_logs (id, locationId, date, temperature, humidity, wind, rainfallTotal, forecast, source)
VALUES (
  gen_random_uuid(),
  '[weather_location_id]',
  CURRENT_DATE,
  [temp_f],
  [humidity],
  [wind_mph],
  [rainfall_in],
  '[conditions_summary]',
  'open-meteo'
);
```

## Offer Next Steps
- Reschedule weather-blocked assignments (→ workboard skill)
- Post weather alert to Breakroom (→ breakroom skill)
- Pull 7-day forecast for weekly planning
- Hand off to Ground Crew Agent for full ops integration

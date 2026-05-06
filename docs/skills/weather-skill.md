# Weather Skill - Ground Crew HQ

## Purpose
The Weather page must provide accurate operational weather for grounds crews, based on the selected or default facility location.

## Default Facility Location
Sarasota Polo Club
8201 Polo Club Lane
Sarasota, FL 34240

Approximate coordinates:
Latitude: 27.316
Longitude: -82.402

## Required Files To Inspect
- src/pages/WeatherPage.tsx
- src/lib/weather.ts
- src/lib/weatherClient.ts
- src/lib/supabase.ts
- src/lib/supabase-queries.ts
- any weather-related components or hooks

## Weather Rules
- Do not display fake weather data as live weather.
- Do not show placeholder temperatures as real conditions.
- Always display:
  - location used
  - source/provider
  - last updated time
  - loading state
  - error state
- If user enters an address, geocode it before fetching weather.
- If no user location exists, use default Sarasota Polo Club location.
- Browser geolocation is optional, not required.
- Saved locations should persist in Supabase when possible.

## Operational Weather Data
Include where available:
- current temperature
- feels like
- humidity
- wind speed
- wind direction
- rain chance
- precipitation
- storm/lightning alert if available
- hourly forecast
- daily forecast
- field/turf risk notes

## UI Requirements
Allow toggle visibility for:
- current conditions
- hourly forecast
- daily forecast
- radar/map placeholder
- wind
- rain
- alerts
- turf risk notes

## Backend / API
Prefer a weather provider that supports:
- latitude/longitude lookup
- current weather
- hourly forecast
- daily forecast

If using a public API key, it must be stored in environment variables, not hardcoded.

Suggested env vars:
- VITE_WEATHER_API_KEY
- VITE_WEATHER_PROVIDER

## Do Not
- Do not rely on hardcoded random mock weather.
- Do not assume browser location is correct.
- Do not overwrite unrelated dashboard or task code.

## Expected Result
Weather page accurately shows Sarasota, FL weather by default and user-selected weather when saved.

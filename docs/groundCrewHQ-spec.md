# Ground Crew HQ Workforce App Spec

## Product Direction

Ground Crew HQ is a modern workforce operations app for course, property, and grounds teams. The platform should feel like an operational command center rather than a basic admin panel. The product must support daily crew scheduling, task assignment, weather awareness, chemical application logging, equipment coordination, and reports that connect those systems together.

The visual direction should remain aligned with the current modern prototype:

- clean, modern operations dashboard styling
- strong hierarchy and clear data density
- user-friendly workflows for admins, managers, and crew leaders
- reusable components and shared architecture wherever possible

## Core First-Class Modules

### Existing Core Modules

- Workboard
- Scheduler
- Employee Management
- Task Management
- Equipment Management
- Safety Management
- Reports
- Messaging
- Settings / Program Setup

### New First-Class Modules

- Weather
- Applications

These modules should be treated as top-level operational areas, not as secondary reports or embedded widgets.

## Weather Module Requirements

### Navigation

- Add a `Weather` tab to the main sidebar

### Functional Requirements

- Support multiple weather locations/stations by property and area
- Show current conditions and forecast
- Show rainfall totals
- Show temperature
- Show humidity
- Show wind
- Show ET
- Support both station-based weather data and manual daily rainfall entry
- Support marking one station as primary per location
- Allow manual override entries when station data is unavailable
- Provide weather history by date and location

### UI Requirements

- Show snapshot cards for each location
- Show primary station status clearly
- Show online/offline state for stations
- Provide history tables, cards, and charts
- Make manual rainfall and manual override entry easy from the module

## Applications Module Requirements

### Navigation

- Add an `Applications` tab to the main sidebar

### Functional Requirements

- Build a dedicated chemical application logging workflow, not just reporting
- Add forms and screens for:
  - application date
  - start time
  - end time
  - area or location treated
  - product
  - target pest
  - agronomic purpose
  - rate applied
  - rate unit
  - total quantity used
  - carrier volume
  - area treated
  - applicator
  - equipment used
  - weather conditions
  - notes
- Support tank mix entries with multiple products on a single application log
- Make application logs filterable by:
  - date
  - area
  - product
  - applicator
- Support exports and printable log layouts
- Automatically connect application logs into Reports

### UX Requirements

- Surface weather snapshots inside application entry screens
- Make application entry feel operational and fast, not like a generic form
- Support compliance-style review, print, and export workflows

## Reporting Requirements

Reports should analyze weather and application activity together, not as isolated modules.

### Required Combined Reporting Outcomes

- Analyze rainfall and chemical applications together
- Show application logs with linked weather context
- Support rainfall history views by location
- Support product usage summaries
- Support rainfall vs application timing analysis

## Data Model Additions

The product spec now includes these additional entities:

- `weather_locations`
- `weather_stations`
- `weather_daily_logs`
- `manual_rainfall_entries`
- `chemical_products`
- `application_areas`
- `chemical_application_logs`
- `chemical_application_tank_mix_items`

### Entity Intent

- `weather_locations`: logical weather zones by property or area
- `weather_stations`: station sources assigned to a weather location
- `weather_daily_logs`: normalized current/forecast/weather metric snapshots by date and location
- `manual_rainfall_entries`: manual rain capture when station totals are missing or need correction
- `chemical_products`: chemical product catalog for application workflows
- `application_areas`: valid treatment areas mapped to properties and weather locations
- `chemical_application_logs`: top-level application event records
- `chemical_application_tank_mix_items`: product-level tank mix rows attached to an application log

## Architecture Guidance

- Reuse existing component patterns and page architecture where possible
- Prefer shared cards, charts, form controls, and layout sections
- Keep module behavior consistent across sidebar navigation, filters, cards, and report interactions
- Build the experience so admins, companies, and clients can use the system as a branded operational workspace

## Current Prototype Implementation Notes

The current prototype may use mock data and local persistence for speed while workflows are being validated. The final architecture should preserve these module boundaries and data relationships when moved to a backend.

### Current Expectations

- Weather is a dedicated module with snapshots, history, station management visibility, and manual entry workflows
- Applications is a dedicated module with real entry, tank mix capture, filtering, export, and print support
- Reports combines weather and application datasets for operational analysis
- Sidebar navigation exposes both modules as first-class areas

# Production Route Audit — ver2.5.14.183

Date: 2026-05-19  
Scope: Audit only (no feature changes)

## Commands run

1. `npm run build`
2. `npm run preview -- --host 127.0.0.1 --port 4173`

## Build result

`npm run build`: ✅ **0 build errors**  
Note: Vite emitted a chunk-size warning for one bundle over 500KB (warning only, not a build error).

## Preview result

`npm run preview`: ❌ **Failed to start**

Error:

`Error: spawn EPERM` while loading `vite.config.ts` via esbuild during preview startup.

Because preview server failed to start, route-level navigation validation could not be executed in this environment.

## Route-by-route status (preview navigation)

- `/app/dashboard` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/workboard` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/scheduler` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/field` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/employees` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/equipment` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/weather` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/applications` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/breakroom` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/messaging` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/reports` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/safety` — ❌ Could not test (preview server failed to start: `spawn EPERM`)
- `/app/settings` — ❌ Could not test (preview server failed to start: `spawn EPERM`)


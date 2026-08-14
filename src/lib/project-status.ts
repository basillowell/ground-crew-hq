// Shared mapping from a project's status string to the design-system status
// token, so the map zones, pins, and the legend always agree on color.
// Status tokens are theme-aware oklch triplets in globals.css:
//   --status-active (green) · --status-pending (amber) · --status-hold (slate)
//   --status-complete (blue) · --status-warning (red)

export type ProjectStatusKey = 'active' | 'pending' | 'hold' | 'complete' | 'warning';

// Project.status values authored in ProjectFormDialog are:
// active · planned · paused · completed. The extra cases keep older/derived
// strings (e.g. timeline "delay") mapping to a sensible color.
export function normalizeProjectStatus(status: string | null | undefined): ProjectStatusKey {
  const normalized = (status ?? '').toLowerCase();
  if (normalized === 'completed' || normalized === 'complete') return 'complete';
  if (normalized === 'delay' || normalized === 'delayed') return 'warning';
  if (normalized === 'paused' || normalized === 'on_hold' || normalized === 'hold') return 'hold';
  if (normalized === 'planned') return 'pending';
  return 'active';
}

// A Leaflet-ready color string (Leaflet paths accept CSS color functions).
export function projectStatusColor(status: string | null | undefined): string {
  return `oklch(var(--status-${normalizeProjectStatus(status)}))`;
}

export function statusKeyColor(key: ProjectStatusKey): string {
  return `oklch(var(--status-${key}))`;
}

// Legend rows, in the order they appear to a supervisor scanning the board.
export const PROJECT_STATUS_LEGEND: { key: ProjectStatusKey; label: string }[] = [
  { key: 'active', label: 'In progress' },
  { key: 'pending', label: 'Planned' },
  { key: 'hold', label: 'Paused' },
  { key: 'complete', label: 'Complete' },
];

import { Badge } from '@/components/ui/badge';

type MaintenanceInput = {
  estimated_hours?: number | string | null;
  estimatedHours?: number | string | null;
  maintenance_interval_hours?: number | string | null;
  maintenanceIntervalHours?: number | string | null;
  hours_at_last_service?: number | string | null;
  hoursAtLastService?: number | string | null;
};

export type EquipmentMaintenanceState = {
  enabled: boolean;
  due: boolean;
  dueSoon: boolean;
  estimatedHours: number;
  intervalHours: number | null;
  hoursAtLastService: number;
  usedSinceService: number;
  remainingHours: number | null;
  label: string;
  description: string;
  badgeClassName: string;
};

function toFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatHours(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function getEquipmentMaintenanceState(unit: MaintenanceInput): EquipmentMaintenanceState {
  const estimatedHours = toFiniteNumber(unit.estimated_hours ?? unit.estimatedHours, 0);
  const intervalRaw = unit.maintenance_interval_hours ?? unit.maintenanceIntervalHours;
  const intervalHours = intervalRaw === null || intervalRaw === undefined || intervalRaw === '' ? null : toFiniteNumber(intervalRaw, 0);
  const hoursAtLastService = toFiniteNumber(unit.hours_at_last_service ?? unit.hoursAtLastService, 0);
  const usedSinceService = Math.max(0, estimatedHours - hoursAtLastService);

  if (!intervalHours || intervalHours <= 0) {
    return {
      enabled: false,
      due: false,
      dueSoon: false,
      estimatedHours,
      intervalHours: null,
      hoursAtLastService,
      usedSinceService,
      remainingHours: null,
      label: 'Tracking off',
      description: 'Set an interval to track service by usage hours.',
      badgeClassName: 'border-surface-border bg-surface-elevated text-text-muted',
    };
  }

  const remainingHours = intervalHours - usedSinceService;
  const due = remainingHours <= 0;
  const dueSoon = !due && remainingHours <= Math.max(5, intervalHours * 0.1);

  if (due) {
    return {
      enabled: true,
      due: true,
      dueSoon: false,
      estimatedHours,
      intervalHours,
      hoursAtLastService,
      usedSinceService,
      remainingHours,
      label: 'Service due',
      description: `${formatHours(usedSinceService)}h used since service / ${formatHours(intervalHours)}h interval`,
      badgeClassName: 'border-status-warning/30 bg-status-warning/10 text-status-warning',
    };
  }

  if (dueSoon) {
    return {
      enabled: true,
      due: false,
      dueSoon: true,
      estimatedHours,
      intervalHours,
      hoursAtLastService,
      usedSinceService,
      remainingHours,
      label: `${formatHours(remainingHours)}h left`,
      description: `${formatHours(usedSinceService)}h used since service / ${formatHours(intervalHours)}h interval`,
      badgeClassName: 'border-status-pending/30 bg-status-pending/10 text-status-pending',
    };
  }

  return {
    enabled: true,
    due: false,
    dueSoon: false,
    estimatedHours,
    intervalHours,
    hoursAtLastService,
    usedSinceService,
    remainingHours,
    label: `${formatHours(remainingHours)}h left`,
    description: `${formatHours(usedSinceService)}h used since service / ${formatHours(intervalHours)}h interval`,
    badgeClassName: 'border-status-active/20 bg-status-active/10 text-status-active',
  };
}

export function EquipmentMaintenanceBadge({ unit }: { unit: MaintenanceInput }) {
  const state = getEquipmentMaintenanceState(unit);
  return (
    <Badge variant="outline" className={state.badgeClassName} title={state.description}>
      {state.label}
    </Badge>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Gauge, Wrench } from 'lucide-react';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { createClient } from '@/lib/supabase';
import { useFlagEquipmentIssue, useLogEquipmentService, useUpdateEquipmentUsage } from '@/lib/supabase-queries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { EquipmentMaintenanceBadge, getEquipmentMaintenanceState } from './EquipmentMaintenanceBadge';

type EquipmentScanRow = {
  id: string;
  org_id: string | null;
  property_id: string | null;
  name: string | null;
  unit_name: string | null;
  type: string | null;
  status: string | null;
  location: string | null;
  notes: string | null;
  last_serviced: string | null;
  estimated_hours: number | null;
  qr_token: string | null;
  maintenance_interval_hours: number | null;
  hours_at_last_service: number | null;
};

type AbortableSupabaseRequest<T> = {
  abortSignal: (signal: AbortSignal) => PromiseLike<T>;
};

async function withScanTimeout<T>(request: AbortableSupabaseRequest<T>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    return await request.abortSignal(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Equipment scan request timed out after 15 seconds.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeNumber(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function EquipmentScanActions({ qrToken }: { qrToken: string }) {
  const { currentUser } = useOrgProfile();
  const orgId = currentUser?.orgId ?? '';
  const queryClient = useQueryClient();
  const updateUsage = useUpdateEquipmentUsage();
  const flagIssue = useFlagEquipmentIssue();
  const logService = useLogEquipmentService();
  const [usageHours, setUsageHours] = useState('');
  const [issueNotes, setIssueNotes] = useState('');

  const scanQuery = useQuery({
    queryKey: ['equipment-scan', orgId || 'no-org', qrToken],
    enabled: Boolean(orgId && qrToken),
    queryFn: async () => {
      const supabase = createClient();
      const request = supabase
        .from('equipment_units')
        .select('id, org_id, property_id, name, unit_name, type, status, location, notes, last_serviced, estimated_hours, qr_token, maintenance_interval_hours, hours_at_last_service')
        .eq('org_id', orgId)
        .eq('qr_token', qrToken)
        .maybeSingle();
      const { data, error } = await withScanTimeout(request);
      if (error) throw error;
      return data as EquipmentScanRow | null;
    },
    staleTime: 1000 * 30,
    retry: 1,
  });

  const unit = scanQuery.data ?? null;
  const displayName = unit?.unit_name || unit?.name || 'Equipment unit';
  const estimatedHours = normalizeNumber(unit?.estimated_hours);
  const maintenanceState = useMemo(() => unit ? getEquipmentMaintenanceState(unit) : null, [unit]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['equipment-scan', orgId || 'no-org', qrToken] });
  };

  const handleLogUsage = async () => {
    if (!unit || !orgId) return;
    const addedHours = Number(usageHours);
    if (!Number.isFinite(addedHours) || addedHours <= 0) {
      toast.error('Enter usage hours greater than 0.');
      return;
    }
    await updateUsage.mutateAsync({ unitId: unit.id, orgId, estimatedHours: estimatedHours + addedHours });
    setUsageHours('');
    await refresh();
    toast.success(`Logged ${addedHours}h on ${displayName}`);
  };

  const handleFlagIssue = async () => {
    if (!unit || !orgId) return;
    await flagIssue.mutateAsync({ unitId: unit.id, orgId, notes: issueNotes });
    setIssueNotes('');
    await refresh();
    toast.success(`${displayName} flagged for maintenance`);
  };

  const handleLogService = async () => {
    if (!unit || !orgId) return;
    await logService.mutateAsync({ unitId: unit.id, orgId, estimatedHours });
    await refresh();
    toast.success(`Service logged for ${displayName}`);
  };

  if (!orgId) {
    return <div className="p-6 text-sm text-text-muted">Loading your workspace...</div>;
  }

  if (scanQuery.isLoading) {
    return <div className="p-6 text-sm text-text-muted">Loading equipment...</div>;
  }

  if (scanQuery.error) {
    const message = scanQuery.error instanceof Error ? scanQuery.error.message : 'Could not load equipment.';
    return (
      <div className="p-6">
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-sm text-status-warning">
          {message}
        </div>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-surface-border bg-surface-card p-4 text-sm text-text-muted">
          No equipment unit was found for this QR code.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-bold tracking-tight text-text-primary">{displayName}</p>
            <p className="text-sm text-text-muted">{unit.type || 'Equipment'}{unit.location ? ` · ${unit.location}` : ''}</p>
          </div>
          <Badge variant="outline" className="border-surface-border bg-surface-elevated text-text-secondary">
            {unit.status || 'unknown'}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
            <div className="flex items-center gap-2 text-text-muted"><Gauge className="h-4 w-4" /> Hours</div>
            <p className="mt-1 text-lg font-semibold text-text-primary">{estimatedHours.toFixed(1)}h</p>
          </div>
          <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
            <div className="flex items-center gap-2 text-text-muted"><Wrench className="h-4 w-4" /> Service</div>
            <div className="mt-1"><EquipmentMaintenanceBadge unit={unit} /></div>
          </div>
        </div>
        {maintenanceState?.description ? <p className="mt-3 text-xs text-text-muted">{maintenanceState.description}</p> : null}
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Gauge className="h-4 w-4" /> Log usage hours
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            type="number"
            min="0"
            step="0.1"
            value={usageHours}
            onChange={(event) => setUsageHours(event.target.value)}
            placeholder="Hours used"
          />
          <Button onClick={() => void handleLogUsage()} disabled={updateUsage.isPending}>Save</Button>
        </div>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <CheckCircle2 className="h-4 w-4" /> Service complete
        </div>
        <p className="mt-1 text-sm text-text-muted">Sets hours at last service to the current meter reading.</p>
        <Button className="mt-3" variant="outline" onClick={() => void handleLogService()} disabled={logService.isPending}>
          Log service at {estimatedHours.toFixed(1)}h
        </Button>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <AlertTriangle className="h-4 w-4 text-status-pending" /> Flag an issue
        </div>
        <Textarea
          className="mt-3 min-h-20"
          value={issueNotes}
          onChange={(event) => setIssueNotes(event.target.value)}
          placeholder="Optional issue notes"
        />
        <Button className="mt-3" variant="outline" onClick={() => void handleFlagIssue()} disabled={flagIssue.isPending}>
          Flag issue
        </Button>
      </div>
    </div>
  );
}

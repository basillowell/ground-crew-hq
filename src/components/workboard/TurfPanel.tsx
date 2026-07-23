import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History as HistoryIcon, Loader2, Scissors } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import type { Employee } from '@/data/seedData';
import { createClient } from '@/lib/supabase';

const supabase = createClient();

type ApplicationAreaRow = {
  id: string;
  name: string;
  property: string;
  org_id: string | null;
};

type TurfMowPatternRow = {
  id: string;
  org_id: string | null;
  application_area_id: string;
  pattern: string;
  rotation: string;
  applied_by: string | null;
  applied_at: string;
  created_at: string;
};

type TurfDraft = {
  pattern: string;
  rotation: string;
};

type TurfPanelProps = {
  orgId?: string | null;
  propertyId?: string | null;
  currentEmployeeId?: string | null;
  employees?: Employee[];
};

function formatAppliedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function employeeName(employee: Employee | undefined) {
  if (!employee) return null;
  return [employee.firstName, employee.lastName].filter(Boolean).join(' ') || 'Crew member';
}

export function TurfPanel({ orgId, propertyId, currentEmployeeId, employees = [] }: TurfPanelProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, TurfDraft>>({});
  const [savingAreaId, setSavingAreaId] = useState<string | null>(null);
  const [historyAreaId, setHistoryAreaId] = useState<string | null>(null);

  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : null;
  const employeesById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const areasQuery = useQuery({
    queryKey: ['turf-application-areas', orgId ?? 'all-orgs', scopedPropertyId ?? 'no-property'],
    enabled: Boolean(orgId && scopedPropertyId),
    queryFn: async () => {
      if (!orgId || !scopedPropertyId) return [] as ApplicationAreaRow[];
      const { data, error } = await supabase
        .from('application_areas')
        .select('id, name, property, org_id')
        .eq('org_id', orgId)
        .eq('property', scopedPropertyId)
        .order('name');
      if (error) throw error;
      return (data ?? []) as ApplicationAreaRow[];
    },
  });

  const areaIds = useMemo(() => (areasQuery.data ?? []).map((area) => area.id), [areasQuery.data]);

  const patternsQuery = useQuery({
    queryKey: ['turf-mow-patterns', orgId ?? 'all-orgs', areaIds.join('|')],
    enabled: Boolean(orgId && areaIds.length > 0),
    queryFn: async () => {
      if (!orgId || areaIds.length === 0) return [] as TurfMowPatternRow[];
      const { data, error } = await supabase
        .from('turf_mow_patterns')
        .select('id, org_id, application_area_id, pattern, rotation, applied_by, applied_at, created_at')
        .eq('org_id', orgId)
        .in('application_area_id', areaIds)
        .order('applied_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TurfMowPatternRow[];
    },
  });

  const patternsByArea = useMemo(() => {
    const grouped = new Map<string, TurfMowPatternRow[]>();
    (patternsQuery.data ?? []).forEach((row) => {
      const current = grouped.get(row.application_area_id) ?? [];
      current.push(row);
      grouped.set(row.application_area_id, current);
    });
    return grouped;
  }, [patternsQuery.data]);

  async function applyPattern(area: ApplicationAreaRow) {
    if (!orgId) {
      toast.error('Session is reconnecting - please try again in a moment.');
      return;
    }

    const current = patternsByArea.get(area.id)?.[0] ?? null;
    const draft = drafts[area.id] ?? { pattern: current?.pattern ?? '', rotation: current?.rotation ?? '' };
    const pattern = draft.pattern.trim();
    const rotation = draft.rotation.trim();

    if (!pattern || !rotation) {
      toast.error('Enter both pattern and rotation before applying.');
      return;
    }

    setSavingAreaId(area.id);
    try {
      const { error } = await supabase.from('turf_mow_patterns').insert({
        application_area_id: area.id,
        pattern,
        rotation,
        applied_by: currentEmployeeId || null,
        org_id: orgId,
      });
      if (error) throw error;
      setDrafts((currentDrafts) => {
        const next = { ...currentDrafts };
        delete next[area.id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['turf-mow-patterns', orgId] });
      toast.success('Applied ' + pattern + ' to ' + area.name + '.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to apply turf pattern.';
      toast.error(message);
    } finally {
      setSavingAreaId(null);
    }
  }

  if (!scopedPropertyId) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
        Select a property to manage turf mow patterns.
      </div>
    );
  }

  if (areasQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading turf areas...
      </div>
    );
  }

  if (areasQuery.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Unable to load turf areas.
      </div>
    );
  }

  const areas = areasQuery.data ?? [];

  if (areas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
        No application areas are configured for this property.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Turf Management</h3>
          <p className="text-xs text-muted-foreground">Apply mow patterns by application area.</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {areas.length} areas
        </Badge>
      </div>

      {areas.map((area) => {
        const history = patternsByArea.get(area.id) ?? [];
        const current = history[0] ?? null;
        const draft = drafts[area.id] ?? { pattern: current?.pattern ?? '', rotation: current?.rotation ?? '' };
        const isHistoryOpen = historyAreaId === area.id;

        return (
          <section key={area.id} className="rounded-xl border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold text-foreground">{area.name}</h4>
                <p className="text-xs text-muted-foreground">
                  Current:{' '}
                  {current ? (
                    <span className="font-medium text-foreground">
                      {current.pattern} / {current.rotation}
                    </span>
                  ) : (
                    'No pattern applied'
                  )}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setHistoryAreaId((openId) => (openId === area.id ? null : area.id))}
              >
                <HistoryIcon className="h-3.5 w-3.5" />
                History
              </Button>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <label className="text-xs text-muted-foreground">
                Pattern
                <Input
                  value={draft.pattern}
                  onChange={(event) =>
                    setDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [area.id]: { ...draft, pattern: event.target.value },
                    }))
                  }
                  className="mt-1 h-9"
                  placeholder="Cross cut"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Rotation
                <Input
                  value={draft.rotation}
                  onChange={(event) =>
                    setDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [area.id]: { ...draft, rotation: event.target.value },
                    }))
                  }
                  className="mt-1 h-9"
                  placeholder="Weekly"
                />
              </label>
              <Button
                type="button"
                size="sm"
                className="mt-5 h-9"
                onClick={() => void applyPattern(area)}
                disabled={savingAreaId === area.id}
              >
                {savingAreaId === area.id ? 'Applying...' : 'Apply'}
              </Button>
            </div>

            {isHistoryOpen ? (
              <div className="mt-3 space-y-2 rounded-lg border bg-muted/20 p-2">
                {patternsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading history...</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No pattern history yet.</p>
                ) : (
                  history.map((row) => {
                    const appliedBy = employeeName(employeesById.get(row.applied_by ?? '')) ?? 'Unknown applicator';
                    return (
                      <div key={row.id} className="rounded-md border bg-card px-2 py-1.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {row.pattern} / {row.rotation}
                          </span>
                          <span className="text-muted-foreground">{formatAppliedAt(row.applied_at)}</span>
                        </div>
                        <p className="mt-0.5 text-muted-foreground">Applied by {appliedBy}</p>
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

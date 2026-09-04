'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Clock, MonitorSmartphone, Wrench } from 'lucide-react';
import { Badge, type BadgeProps } from '@/src/components/ui/badge';
import { getContrastText } from '@/src/lib/colorContrast';
import { createClient } from '@/src/lib/supabase';

type PublicBoardAssignment = {
  title: string;
  taskName: string;
  taskCategory: string;
  crewName: string;
  equipmentLabel: string | null;
  startTime: string | null;
  estimatedHours: number;
  status: string;
};

type PublicDisplayBoard = {
  businessName: string;
  logoUrl: string | null;
  property: {
    name: string;
    shortName: string;
    logoInitials: string;
    color: string;
  };
  boardDate: string;
  generatedAt: string | null;
  assignments: PublicBoardAssignment[];
};

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringFrom(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberFrom(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function getField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return null;
}

function withTimeout<T extends PromiseLike<unknown>>(promise: T, message: string): Promise<Awaited<T>> {
  let timeoutId = 0;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), 12_000);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
}

function normalizeAssignment(payload: unknown): PublicBoardAssignment {
  const row = (payload ?? {}) as Record<string, unknown>;
  const taskName = stringFrom(getField(row, 'task_name', 'taskName'), '');
  return {
    title: stringFrom(getField(row, 'title'), taskName || 'Assignment'),
    taskName: taskName || stringFrom(getField(row, 'title'), 'Assignment'),
    taskCategory: stringFrom(getField(row, 'task_category', 'taskCategory'), 'General'),
    crewName: stringFrom(getField(row, 'crew_name', 'crewName'), 'Crew'),
    equipmentLabel: stringFrom(getField(row, 'equipment_label', 'equipmentLabel'), '') || null,
    startTime: stringFrom(getField(row, 'start_time', 'startTime'), '') || null,
    estimatedHours: numberFrom(getField(row, 'estimated_hours', 'estimatedHours')),
    status: stringFrom(getField(row, 'status'), 'planned'),
  };
}

function normalizeBoard(payload: unknown): PublicDisplayBoard | null {
  const row = (payload ?? {}) as Record<string, unknown>;
  const propertyRow = (getField(row, 'property') ?? {}) as Record<string, unknown>;
  const businessName = stringFrom(getField(row, 'business_name', 'businessName'), '');
  const propertyName = stringFrom(getField(propertyRow, 'name'), '');
  if (!businessName && !propertyName) return null;

  const assignmentPayload = getField(row, 'assignments');
  const assignments = Array.isArray(assignmentPayload) ? assignmentPayload.map(normalizeAssignment) : [];

  return {
    businessName: businessName || 'Ground Crew HQ',
    logoUrl: stringFrom(getField(row, 'logo_url', 'logoUrl'), '') || null,
    property: {
      name: propertyName || 'Property',
      shortName: stringFrom(getField(propertyRow, 'short_name', 'shortName'), propertyName || 'Property'),
      logoInitials: stringFrom(getField(propertyRow, 'logo_initials', 'logoInitials'), 'GC'),
      color: stringFrom(getField(propertyRow, 'color'), ''),
    },
    boardDate: stringFrom(getField(row, 'board_date', 'boardDate'), new Date().toLocaleDateString('en-CA')),
    generatedAt: stringFrom(getField(row, 'generated_at', 'generatedAt'), '') || null,
    assignments,
  };
}

function formatBoardDate(value: string) {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(value: string | null) {
  if (!value) return 'Unscheduled';
  const [hoursRaw, minutesRaw] = value.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function getStatusVariant(status: string): BadgeProps['variant'] {
  const value = status.toLowerCase();
  if (['done', 'completed', 'complete'].includes(value)) return 'complete';
  if (['in_progress', 'in-progress', 'active'].includes(value)) return 'active';
  if (['hold', 'on_hold', 'paused'].includes(value)) return 'hold';
  if (['blocked', 'issue', 'error'].includes(value)) return 'warning';
  return 'pending';
}

function formatStatus(status: string) {
  return status.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PageSkeleton() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-6 text-text-primary md:px-8">
      <section className="mx-auto max-w-7xl rounded-2xl border border-surface-border bg-surface-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-2xl bg-surface-elevated" />
          <div className="space-y-3">
            <div className="h-6 w-60 animate-pulse rounded bg-surface-elevated" />
            <div className="h-4 w-40 animate-pulse rounded bg-surface-elevated" />
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="h-40 animate-pulse rounded-xl bg-surface-elevated" />
          <div className="h-40 animate-pulse rounded-xl bg-surface-elevated" />
          <div className="h-40 animate-pulse rounded-xl bg-surface-elevated" />
        </div>
      </section>
    </main>
  );
}

function MessageState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-10 text-text-primary">
      <section className="mx-auto max-w-xl rounded-lg border border-surface-border bg-surface-card p-8 text-center shadow-sm">
        <MonitorSmartphone className="mx-auto h-10 w-10 text-text-secondary" />
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-text-secondary">{body}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-text-inverse hover:bg-brand/90"
          >
            Retry
          </button>
        ) : null}
      </section>
    </main>
  );
}

export default function PublicDisplayBoardPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const [state, setState] = useState<LoadState>('loading');
  const [board, setBoard] = useState<PublicDisplayBoard | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const refreshDebounceRef = useRef<number | null>(null);

  const loadBoard = useCallback(async (showLoading = true) => {
    if (!uuidPattern.test(token)) {
      setState('missing');
      return;
    }

    if (showLoading) setState('loading');
    try {
      const supabase = createClient();
      const { data, error } = await withTimeout(
        supabase.rpc('get_public_display_board', { p_token: token }),
        'Display board lookup timed out.',
      );
      if (error) throw error;
      const normalized = normalizeBoard(data);
      if (!normalized) {
        setBoard(null);
        setState('missing');
        return;
      }
      setBoard(normalized);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!uuidPattern.test(token)) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`public-display-board:${token}`)
      .on('broadcast', { event: 'refresh' }, () => {
        if (refreshDebounceRef.current !== null) {
          window.clearTimeout(refreshDebounceRef.current);
        }
        refreshDebounceRef.current = window.setTimeout(() => {
          refreshDebounceRef.current = null;
          void loadBoard(false);
        }, 500);
      })
      .subscribe();

    return () => {
      if (refreshDebounceRef.current !== null) {
        window.clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadBoard, token]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const groupedAssignments = useMemo(() => {
    const groups = new Map<string, PublicBoardAssignment[]>();
    (board?.assignments ?? []).forEach((assignment) => {
      const key = `${assignment.taskCategory}::${assignment.taskName}`;
      const existing = groups.get(key) ?? [];
      existing.push(assignment);
      groups.set(key, existing);
    });
    return Array.from(groups.entries()).map(([key, assignments]) => {
      const [category, taskName] = key.split('::');
      return {
        key,
        category,
        taskName,
        assignments,
        hours: assignments.reduce((sum, assignment) => sum + assignment.estimatedHours, 0),
      };
    });
  }, [board?.assignments]);

  if (state === 'loading') return <PageSkeleton />;
  if (state === 'missing') {
    return <MessageState title="This display board is not available" body="Please ask your crew for a current display board link." />;
  }
  if (state === 'error') {
    return <MessageState title="We could not load this display board" body="Please try again." onRetry={() => void loadBoard()} />;
  }
  if (!board) return null;

  const propertyColor = board.property.color;
  const clockLabel = clock.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const totalHours = board.assignments.reduce((sum, assignment) => sum + assignment.estimatedHours, 0);

  return (
    <main className="min-h-screen bg-surface-base px-4 py-5 text-text-primary md:px-8 md:py-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-2xl border border-surface-border bg-surface-card p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-surface-border bg-brand text-xl font-bold text-text-inverse"
                style={propertyColor ? { backgroundColor: propertyColor, color: getContrastText(propertyColor) } : undefined}
              >
                {board.logoUrl ? (
                  <img src={board.logoUrl} alt={`${board.businessName} logo`} className="h-full w-full object-contain p-2" />
                ) : (
                  board.property.logoInitials
                )}
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-semibold uppercase tracking-wide text-text-muted">{board.businessName}</p>
                <h1 className="truncate text-3xl font-bold tracking-tight text-text-primary md:text-5xl">{board.property.name}</h1>
                <p className="mt-1 text-sm text-text-secondary md:text-base">{formatBoardDate(board.boardDate)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-right">
              <div className="rounded-xl border border-surface-border bg-surface-elevated px-3 py-2">
                <p className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Live Clock</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">{clockLabel}</p>
              </div>
              <div className="rounded-xl border border-status-pending/20 bg-status-pending/10 px-3 py-2">
                <p className="text-3xs font-semibold uppercase tracking-wide text-status-pending">Jobs</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-status-pending">{groupedAssignments.length}</p>
              </div>
              <div className="rounded-xl border border-status-active/20 bg-status-active/10 px-3 py-2">
                <p className="text-3xs font-semibold uppercase tracking-wide text-status-active">Hours</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-status-active">{totalHours.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </header>

        {groupedAssignments.length === 0 ? (
          <section className="rounded-2xl border border-surface-border bg-surface-card p-8 text-center shadow-sm">
            <Clock className="mx-auto h-10 w-10 text-text-secondary" />
            <h2 className="mt-4 text-2xl font-semibold text-text-primary">No published work yet</h2>
            <p className="mt-2 text-sm text-text-secondary">Once today&apos;s assignments are published, they will appear here.</p>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {groupedAssignments.map((group) => (
              <article key={group.key} className="rounded-2xl border border-surface-border bg-surface-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border pb-3">
                  <div>
                    <Badge variant="pending">{group.category}</Badge>
                    <h2 className="mt-2 text-xl font-semibold text-text-primary">{group.taskName}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Estimated</p>
                    <p className="text-lg font-semibold tabular-nums text-text-primary">{group.hours.toFixed(1)}h</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {group.assignments.map((assignment, index) => (
                    <div key={`${group.key}-${assignment.crewName}-${assignment.startTime ?? index}`} className="rounded-xl border border-surface-border bg-surface-elevated px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{assignment.crewName}</p>
                          <p className="mt-0.5 text-xs text-text-secondary">{formatTime(assignment.startTime)} · {assignment.estimatedHours.toFixed(1)}h</p>
                        </div>
                        <Badge variant={getStatusVariant(assignment.status)}>{formatStatus(assignment.status)}</Badge>
                      </div>
                      {assignment.equipmentLabel ? (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
                          <Wrench className="h-3.5 w-3.5 text-text-muted" />
                          {assignment.equipmentLabel}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}

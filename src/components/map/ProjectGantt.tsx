'use client';

import { useMemo } from 'react';
import { CalendarDays, Circle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useEmployees,
  useTimelineEvents,
  type ProjectTimelineEvent,
  type PropertyProject,
} from '@/lib/supabase-queries';
import { cn } from '@/lib/utils';

type ProjectGanttProps = {
  projects: PropertyProject[];
  orgId?: string | null;
  selectedProjectId?: string | null;
  onSelectProject: (projectId: string) => void;
};

type TimelineRange = {
  axisStart: number;
  axisEnd: number;
  totalDays: number;
  ticks: number[];
  minWidth: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function dayToDate(day: number) {
  return new Date(day * DAY_MS);
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No date';
  const parsed = parseDay(value);
  if (parsed === null) return value;
  return dayToDate(parsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function formatAxisDate(day: number) {
  return dayToDate(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function projectStartDay(project: PropertyProject) {
  return parseDay(project.startDate) ?? parseDay(project.createdAt);
}

function projectEndDay(project: PropertyProject) {
  return parseDay(project.targetEndDate) ?? parseDay(project.startDate) ?? parseDay(project.createdAt);
}

function buildRange(projects: PropertyProject[]): TimelineRange | null {
  const starts = projects.map(projectStartDay).filter((day): day is number => day !== null);
  const ends = projects.map(projectEndDay).filter((day): day is number => day !== null);
  if (starts.length === 0 || ends.length === 0) return null;

  const minDay = Math.min(...starts);
  const maxDay = Math.max(...ends);
  const axisStart = minDay - 7;
  const axisEnd = Math.max(maxDay + 7, axisStart + 14);
  const totalDays = Math.max(axisEnd - axisStart, 1);
  const tickStep = totalDays <= 21 ? 3 : totalDays <= 70 ? 7 : totalDays <= 180 ? 14 : 30;
  const ticks: number[] = [];
  for (let day = axisStart; day <= axisEnd; day += tickStep) {
    ticks.push(day);
  }

  return {
    axisStart,
    axisEnd,
    totalDays,
    ticks,
    minWidth: Math.max(980, totalDays * 34 + 260),
  };
}

function dayToPercent(day: number, range: TimelineRange) {
  const clamped = Math.min(range.axisEnd, Math.max(range.axisStart, day));
  return ((clamped - range.axisStart) / range.totalDays) * 100;
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'completed' || normalized === 'done' || normalized === 'complete') {
    return 'border-status-complete/30 bg-status-complete/15 text-status-complete';
  }
  if (normalized === 'paused' || normalized === 'delay' || normalized === 'on_hold') {
    return 'border-status-warning/30 bg-status-warning/15 text-status-warning';
  }
  if (normalized === 'planned' || normalized === 'pending') {
    return 'border-status-pending/30 bg-status-pending/15 text-status-pending';
  }
  return 'border-status-active/30 bg-status-active/15 text-status-active';
}

function projectDateLabel(project: PropertyProject) {
  if (!project.startDate && !project.targetEndDate) return `Created ${formatDate(project.createdAt)}`;
  return `${formatDate(project.startDate)} to ${formatDate(project.targetEndDate)}`;
}

function eventSubmitterName(event: ProjectTimelineEvent, employeeNames: Map<string, string>) {
  if (!event.createdBy) return 'No submitter recorded';
  return employeeNames.get(event.createdBy) ?? 'Unknown teammate';
}

function ProjectGanttRow({
  project,
  range,
  selected,
  employeeNames,
  orgId,
  onSelectProject,
}: {
  project: PropertyProject;
  range: TimelineRange;
  selected: boolean;
  employeeNames: Map<string, string>;
  orgId?: string | null;
  onSelectProject: (projectId: string) => void;
}) {
  const eventsQuery = useTimelineEvents(project.id, orgId ?? undefined);
  const events = eventsQuery.data ?? [];
  const startDay = projectStartDay(project);
  const rawEndDay = projectEndDay(project);
  const endDay = startDay !== null && rawEndDay !== null ? Math.max(rawEndDay, startDay) : null;
  const leftPct = startDay === null ? 0 : dayToPercent(startDay, range);
  const rightPct = endDay === null ? leftPct : dayToPercent(endDay + 1, range);
  const widthPct = Math.max(rightPct - leftPct, 1.2);
  const hasExplicitDates = Boolean(project.startDate || project.targetEndDate);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'grid min-h-[88px] cursor-pointer grid-cols-[240px_1fr] border-t border-surface-border transition hover:bg-surface-hover/60',
        selected ? 'bg-brand-ghost/70 ring-1 ring-inset ring-brand-bright/30' : 'bg-surface-card',
      )}
      onClick={() => onSelectProject(project.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectProject(project.id);
        }
      }}
    >
      <div className="border-r border-surface-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-status-active"
            style={project.color ? { backgroundColor: project.color } : undefined}
          />
          <div className="truncate text-sm font-semibold text-text-primary">{project.name}</div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusTone(project.status)}>{project.status}</Badge>
          {!hasExplicitDates ? (
            <span className="text-[11px] font-medium text-text-muted">No dates set</span>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-text-muted">
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="truncate">{projectDateLabel(project)}</span>
        </div>
      </div>

      <div className="relative overflow-hidden px-4 py-4">
        <div className="absolute inset-0">
          {range.ticks.map((tick) => (
            <div
              key={`${project.id}-grid-${tick}`}
              className="absolute bottom-0 top-0 border-l border-dashed border-surface-border/70"
              style={{ left: `${dayToPercent(tick, range)}%` }}
            />
          ))}
        </div>
        <div className="relative h-14">
          {startDay === null ? (
            <div className="absolute left-0 top-4 rounded-md border border-dashed border-surface-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-secondary">
              No project dates available
            </div>
          ) : (
            <div
              className={cn('absolute top-4 h-5 rounded-full border shadow-sm', project.color ? 'border-text-inverse/30' : statusTone(project.status))}
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                ...(project.color ? { backgroundColor: project.color } : {}),
              }}
            />
          )}
          {events.map((event, index) => {
            const eventDay = parseDay(event.eventDate);
            if (eventDay === null) return null;
            const lane = index % 3;
            return (
              <Tooltip key={event.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="absolute z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-surface-card bg-surface-elevated text-brand-bright shadow-sm transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brand-bright"
                    style={{ left: `${dayToPercent(eventDay, range)}%`, top: `${lane * 11 + 1}px` }}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onSelectProject(project.id);
                    }}
                    aria-label={`${event.title} on ${formatDate(event.eventDate)}`}
                  >
                    <Circle className="h-2.5 w-2.5 fill-current" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] text-xs">
                  <div className="font-semibold text-text-primary">{event.title || event.eventType}</div>
                  <div className="mt-1 text-text-secondary">{event.eventType} - {formatDate(event.eventDate)}</div>
                  <div className="text-text-muted">Submitted by {eventSubmitterName(event, employeeNames)}</div>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {eventsQuery.isLoading && !eventsQuery.data ? (
            <Skeleton className="absolute right-3 top-2 h-3 w-24 rounded-full" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProjectGantt({ projects, orgId, selectedProjectId, onSelectProject }: ProjectGanttProps) {
  const employeesQuery = useEmployees(undefined, orgId ?? undefined, 'all');
  const range = useMemo(() => buildRange(projects), [projects]);
  const employeeNames = useMemo(() => {
    const names = new Map<string, string>();
    (employeesQuery.data ?? []).forEach((employee) => {
      names.set(employee.id, `${employee.firstName} ${employee.lastName}`.trim());
    });
    return names;
  }, [employeesQuery.data]);

  if (projects.length === 0) return null;

  if (!range) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Project calendar</div>
            <h3 className="mt-1 text-lg font-bold text-text-primary">No project dates available</h3>
          </div>
        </div>
      </section>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <section className="overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-surface-border bg-surface-elevated px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Project calendar</div>
            <h3 className="mt-1 text-lg font-bold text-text-primary">Planned schedule and progress submissions</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-6 rounded-full bg-status-active" /> Planned</span>
            <span className="inline-flex items-center gap-1"><Circle className="h-3 w-3 fill-current text-brand-bright" /> Submission</span>
            {employeesQuery.isFetching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div style={{ minWidth: range.minWidth }}>
            <div className="grid grid-cols-[240px_1fr] bg-surface-elevated/80">
              <div className="border-r border-surface-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                Project
              </div>
              <div className="relative px-4 py-2">
                <div className="relative h-6">
                  {range.ticks.map((tick) => (
                    <div
                      key={`axis-${tick}`}
                      className="absolute top-0 -translate-x-1/2 text-[11px] font-medium text-text-muted"
                      style={{ left: `${dayToPercent(tick, range)}%` }}
                    >
                      {formatAxisDate(tick)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {projects.map((project) => (
              <ProjectGanttRow
                key={project.id}
                project={project}
                range={range}
                selected={selectedProjectId === project.id}
                employeeNames={employeeNames}
                orgId={orgId}
                onSelectProject={onSelectProject}
              />
            ))}
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}

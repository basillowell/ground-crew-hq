import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { createClient } from '@/lib/supabase';
import { useEmployees, useProperties } from '@/lib/supabase-queries';
import { formatTime } from '@/utils/formatTime';

const supabase = createClient();

const HISTORY_KEY = 'ground-crew-command-history';
const QUICK_PROMPTS = [
  "What's my crew status today?",
  'Any open needs?',
  'Who has no tasks assigned?',
  'What was our labor cost this week?',
  'Any equipment overdue?',
];

type CommandBarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDate: Date;
  currentPropertyId: string;
};

type ContextPayload = {
  today: string;
  property: string;
  crewCount: number;
  crewNames: string[];
  shifts: Array<{ employee: string; shiftStart: string; shiftEnd: string }>;
  taskCount: number;
  tasks: Array<{ title: string; employee: string; status: string; hours: number }>;
  equipmentAlerts: string[];
  openNeeds: number;
  lastWeekHours: { scheduled: number; actual: number };
  unassignedCrew: string[];
};

function readHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function writeHistory(value: string) {
  if (typeof window === 'undefined') return;
  const nextValue = value.trim();
  if (!nextValue) return;
  const next = [nextValue, ...readHistory().filter((entry) => entry !== nextValue)].slice(0, 5);
  window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

function inferNav(response: string): { label: string; route: string } | null {
  const lower = response.toLowerCase();
  if (lower.includes('scheduler')) return { label: 'Open Scheduler', route: '/app/scheduler' };
  if (lower.includes('workboard') || lower.includes('workflow')) return { label: 'Open Workboard', route: '/app/workboard' };
  if (lower.includes('property') || lower.includes('properties') || lower.includes('map')) return { label: 'Open Properties', route: '/app/properties' };
  if (lower.includes('equipment')) return { label: 'Open Equipment', route: '/app/equipment' };
  if (lower.includes('reports')) return { label: 'Open Reports', route: '/app/reports' };
  return null;
}

function answerLocally(question: string, context: ContextPayload): string {
  const lower = question.toLowerCase();
  if (lower.includes('who') && (lower.includes('working') || lower.includes('crew'))) {
    if (!context.shifts.length) return 'No crew members are scheduled today. I can help you navigate there by opening the Scheduler.';
    const crewLine = context.shifts
      .slice(0, 4)
      .map((shift) => `${shift.employee} (${formatTime(shift.shiftStart)}-${formatTime(shift.shiftEnd)})`)
      .join(', ');
    return `${context.crewCount} crew members are scheduled today: ${crewLine}${context.shifts.length > 4 ? ', and more.' : '.'}`;
  }
  if (lower.includes('no tasks') || lower.includes('unassigned')) {
    if (!context.unassignedCrew.length) return 'Everyone scheduled today has at least one task assignment.';
    return `${context.unassignedCrew.join(', ')} currently have no tasks assigned. I can help you navigate there by opening the Workboard.`;
  }
  if (lower.includes('labor') || lower.includes('hours') || lower.includes('cost')) {
    return `Last 7 days: ${context.lastWeekHours.scheduled.toFixed(1)} scheduled hours and ${context.lastWeekHours.actual.toFixed(1)} actual hours. For full labor cost detail, open Reports.`;
  }
  if (lower.includes('equipment') || lower.includes('overdue')) {
    if (!context.equipmentAlerts.length) return 'No equipment is currently overdue for service.';
    return `${context.equipmentAlerts.length} equipment items are overdue: ${context.equipmentAlerts.slice(0, 3).join(', ')}${context.equipmentAlerts.length > 3 ? ', and more.' : '.'}`;
  }
  return `Today at ${context.property}, you have ${context.crewCount} crew scheduled and ${context.taskCount} tasks assigned, with ${context.openNeeds} open needs. I can help you navigate there if you want to take action.`;
}

export function CommandBar({ open, onOpenChange, currentDate, currentPropertyId }: CommandBarProps) {
  const router = useRouter();
  const { orgId } = useOrgProfile();
  const { data: properties = [] } = useProperties(orgId ?? undefined);
  const { data: employees = [] } = useEmployees(undefined, orgId ?? undefined, 'all');
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setRecent(readHistory());
  }, [open]);

  const selectedProperty = useMemo(() => {
    if (currentPropertyId && currentPropertyId !== 'all') {
      return properties.find((entry) => entry.id === currentPropertyId) ?? null;
    }
    return properties[0] ?? null;
  }, [currentPropertyId, properties]);

  const buildContext = async (): Promise<ContextPayload> => {
    const today = currentDate.toISOString().slice(0, 10);
    if (!supabase || !orgId) {
      return {
        today,
        property: selectedProperty?.name ?? 'All Properties',
        crewCount: 0,
        crewNames: [],
        shifts: [],
        taskCount: 0,
        tasks: [],
        equipmentAlerts: [],
        openNeeds: 0,
        lastWeekHours: { scheduled: 0, actual: 0 },
        unassignedCrew: [],
      };
    }

    const employeeNameMap = new Map<string, string>();
    const scopedEmployees = employees.filter(
      (employee) =>
        !currentPropertyId ||
        currentPropertyId === 'all' ||
        employee.propertyId === currentPropertyId,
    );
    for (const employee of scopedEmployees) {
      employeeNameMap.set(employee.id, `${employee.firstName} ${employee.lastName}`.trim());
    }

    let schedulesQuery = supabase
      .from('schedule_entries')
      .select('employee_id, shift_start, shift_end, date, property_id')
      .eq('org_id', orgId)
      .eq('date', today)
      .eq('status', 'scheduled');
    let assignmentsQuery = supabase
      .from('assignments')
      .select('employee_id, title, status, estimated_hours, actual_hours, date, property_id')
      .eq('org_id', orgId)
      .eq('date', today);
    let equipmentQuery = supabase
      .from('equipment_units')
      .select('name, unit_name, last_serviced, property_id')
      .eq('org_id', orgId)
      .eq('active', true);
    let needsQuery = supabase
      .from('task_requests')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('status', ['open', 'pending']);
    const weekStart = new Date(`${today}T00:00:00`);
    weekStart.setDate(weekStart.getDate() - 6);
    let lastWeekQuery = supabase
      .from('assignments')
      .select('estimated_hours, actual_hours, date, property_id')
      .eq('org_id', orgId)
      .gte('date', weekStart.toISOString().slice(0, 10))
      .lte('date', today);

    if (currentPropertyId && currentPropertyId !== 'all') {
      schedulesQuery = schedulesQuery.eq('property_id', currentPropertyId);
      assignmentsQuery = assignmentsQuery.eq('property_id', currentPropertyId);
      equipmentQuery = equipmentQuery.eq('property_id', currentPropertyId);
      needsQuery = needsQuery.eq('property_id', currentPropertyId);
      lastWeekQuery = lastWeekQuery.eq('property_id', currentPropertyId);
    }

    const overdueCutoff = new Date(`${today}T00:00:00`);
    overdueCutoff.setDate(overdueCutoff.getDate() - 90);
    equipmentQuery = equipmentQuery.lt('last_serviced', overdueCutoff.toISOString().slice(0, 10));

    const [schedulesResult, assignmentsResult, equipmentResult, needsResult, lastWeekResult] = await Promise.all([
      schedulesQuery,
      assignmentsQuery,
      equipmentQuery,
      needsQuery,
      lastWeekQuery,
    ]);

    if (schedulesResult.error) throw schedulesResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;
    if (equipmentResult.error) throw equipmentResult.error;
    if (needsResult.error) throw needsResult.error;
    if (lastWeekResult.error) throw lastWeekResult.error;

    const shifts = (schedulesResult.data ?? []).map((row) => ({
      employee: employeeNameMap.get(String(row.employee_id ?? '')) ?? 'Crew Member',
      shiftStart: String(row.shift_start ?? '').slice(0, 5),
      shiftEnd: String(row.shift_end ?? '').slice(0, 5),
    }));
    const tasks = (assignmentsResult.data ?? []).map((row) => ({
      title: String(row.title ?? 'Task'),
      employee: employeeNameMap.get(String(row.employee_id ?? '')) ?? 'Crew Member',
      status: String(row.status ?? 'planned'),
      hours: Number(row.estimated_hours ?? 0),
    }));
    const assignedEmployeeSet = new Set((assignmentsResult.data ?? []).map((row) => String(row.employee_id ?? '')));
    const unassignedCrew = Array.from(
      new Set(
        (schedulesResult.data ?? [])
          .map((row) => String(row.employee_id ?? ''))
          .filter((employeeId) => employeeId && !assignedEmployeeSet.has(employeeId))
          .map((employeeId) => employeeNameMap.get(employeeId) ?? 'Crew Member'),
      ),
    );
    const weeklyHours = (lastWeekResult.data ?? []).reduce(
      (acc, row) => {
        acc.scheduled += Number(row.estimated_hours ?? 0);
        acc.actual += Number(row.actual_hours ?? 0);
        return acc;
      },
      { scheduled: 0, actual: 0 },
    );

    return {
      today,
      property: selectedProperty?.name ?? 'All Properties',
      crewCount: shifts.length,
      crewNames: shifts.map((shift) => shift.employee),
      shifts,
      taskCount: tasks.length,
      tasks,
      equipmentAlerts: (equipmentResult.data ?? []).map((row) => {
        const name = String(row.name ?? '').trim();
        const unit = String(row.unit_name ?? '').trim();
        return unit ? `${name} (${unit})` : name;
      }),
      openNeeds: needsResult.count ?? 0,
      lastWeekHours: { scheduled: Number(weeklyHours.scheduled.toFixed(1)), actual: Number(weeklyHours.actual.toFixed(1)) },
      unassignedCrew,
    };
  };

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setLoading(true);
    setAnswer('');
    try {
      const context = await buildContext();
      writeHistory(trimmed);
      setRecent(readHistory());
      setAnswer(answerLocally(trimmed, context));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setAnswer(`I could not load operations data right now: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await ask(input);
  };

  const navigationAction = useMemo(() => inferNav(answer), [answer]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={() => onOpenChange(false)} aria-label="Close command bar backdrop" />
      <div className="absolute left-1/2 top-24 w-[min(900px,94vw)] -translate-x-1/2">
        <Card className="rounded-2xl border-border/70 bg-background p-4 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              autoFocus
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your operations..."
              className="h-12 text-base"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Ctrl+K</Badge>
              <span>Press Escape to close</span>
            </div>
          </form>

          {!input.trim() ? (
            <div className="mt-4 space-y-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick Start</div>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setInput(prompt);
                      void ask(prompt);
                    }}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
              {recent.length ? (
                <>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent</div>
                  <div className="space-y-1">
                    {recent.map((entry) => (
                      <button
                        key={entry}
                        type="button"
                        className="block w-full rounded-md border border-border/70 px-3 py-2 text-left text-sm hover:bg-muted/40"
                        onClick={() => {
                          setInput(entry);
                          void ask(entry);
                        }}
                      >
                        {entry}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 max-h-[45vh] overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-3">
            {loading ? <p className="animate-pulse text-sm text-muted-foreground">Reviewing current operations...</p> : null}
            {!loading && answer ? <p className="text-sm leading-6">{answer}</p> : null}
            {!loading && !answer ? <p className="text-sm text-muted-foreground">Ask a question to get a quick operations summary.</p> : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {navigationAction ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  router.push(navigationAction.route);
                }}
              >
                {navigationAction.label}
              </Button>
            ) : null}
            {answer ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(answer);
                    toast.success('Response copied.');
                  } catch {
                    toast.error('Could not copy response.');
                  }
                }}
              >
                Copy
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    </div>,
    document.body,
  );
}



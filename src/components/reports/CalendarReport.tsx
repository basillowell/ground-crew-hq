'use client';

import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorRetry } from '@/components/ErrorRetry';
import { TableSkeleton } from '@/components/TableSkeleton';

type CalendarAssignment = {
  id: string;
  task_id: string | null;
  date: string;
  status: string | null;
};

type CalendarTask = {
  id: string;
  name: string | null;
  category: string | null;
};

type CalendarReportProps = {
  assignments: CalendarAssignment[];
  tasks: CalendarTask[];
  startDate: string;
  endDate: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

const REPORT_COLORS = [
  'hsl(152,55%,38%)',
  'hsl(210,80%,52%)',
  'hsl(38,92%,50%)',
  'hsl(262,72%,58%)',
  'hsl(188,72%,42%)',
  'hsl(14,78%,52%)',
  'hsl(330,72%,52%)',
  'hsl(85,55%,38%)',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function quoteCsv(value: string | number) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function monthRange(startDate: string, endDate: string) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const months: Date[] = [];
  while (cursor <= end) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function daysForMonth(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function CalendarReport({ assignments, tasks, startDate, endDate, loading, error, onRetry }: CalendarReportProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const categories = useMemo(() => {
    const names = new Set<string>();
    assignments.forEach((assignment) => {
      const category = taskById.get(assignment.task_id ?? '')?.category?.trim() || 'Uncategorized';
      names.add(category);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [assignments, taskById]);

  const categoryColors = useMemo(() => {
    return new Map(categories.map((category, index) => [category, REPORT_COLORS[index % REPORT_COLORS.length]]));
  }, [categories]);

  const assignedTasks = useMemo(() => {
    const assignedTaskIds = new Set(assignments.map((assignment) => assignment.task_id).filter(Boolean));
    return tasks
      .filter((task) => assignedTaskIds.has(task.id))
      .sort((a, b) => (a.name ?? 'Unnamed Task').localeCompare(b.name ?? 'Unnamed Task'));
  }, [assignments, tasks]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      const task = taskById.get(assignment.task_id ?? '');
      const category = task?.category?.trim() || 'Uncategorized';
      const categoryMatches = selectedCategories.size === 0 || selectedCategories.has(category);
      const taskMatches = selectedTasks.size === 0 || selectedTasks.has(assignment.task_id ?? '');
      return categoryMatches && taskMatches;
    });
  }, [assignments, selectedCategories, selectedTasks, taskById]);

  const assignmentsByDate = useMemo(() => {
    const byDate = new Map<string, CalendarAssignment[]>();
    filteredAssignments.forEach((assignment) => {
      const dateAssignments = byDate.get(assignment.date) ?? [];
      dateAssignments.push(assignment);
      byDate.set(assignment.date, dateAssignments);
    });
    return byDate;
  }, [filteredAssignments]);

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) => {
      const next = current.size === 0 ? new Set(categories) : new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next.size === categories.length ? new Set() : next;
    });
  };

  const toggleTask = (taskId: string) => {
    setSelectedTasks((current) => {
      const next = current.size === 0 ? new Set(assignedTasks.map((task) => task.id)) : new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next.size === assignedTasks.length ? new Set() : next;
    });
  };

  const exportCalendarCsv = () => {
    const headers = ['Date', 'Category', 'Task', 'Assignments', 'Completed'];
    const rows = filteredAssignments.map((assignment) => {
      const task = taskById.get(assignment.task_id ?? '');
      return [
        assignment.date,
        task?.category?.trim() || 'Uncategorized',
        task?.name?.trim() || 'Unassigned Task',
        1,
        (assignment.status ?? '').toLowerCase() === 'done' ? 1 : 0,
      ];
    });
    const csv = [headers, ...rows].map((cells) => cells.map((cell) => quoteCsv(cell)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `calendar-report-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorRetry message={error} onRetry={onRetry} />;
  if (assignments.length === 0) {
    return <EmptyState icon={BarChart3} title="No calendar data" description="Assign tasks in Workflow to populate the calendar report." />;
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Calendar Report</h3>
            <p className="mt-1 text-xs text-text-muted">{startDate} to {endDate}</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <button className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary" onClick={exportCalendarCsv}>
              Export CSV
            </button>
            <button className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </div>

        <div className="no-print mt-4 grid gap-3 border-t border-surface-border pt-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const selected = selectedCategories.size === 0 || selectedCategories.has(category);
              return (
                <button key={category} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${selected ? 'border-transparent text-text-inverse' : 'border-surface-border bg-surface-elevated text-text-muted'}`} style={selected ? { backgroundColor: categoryColors.get(category) } : undefined} onClick={() => toggleCategory(category)} aria-pressed={selected}>
                  {category}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {assignedTasks.map((task) => {
              const selected = selectedTasks.size === 0 || selectedTasks.has(task.id);
              return (
                <button key={task.id} className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${selected ? 'border-brand-primary bg-brand-muted text-brand-primary' : 'border-surface-border bg-surface-elevated text-text-muted hover:bg-surface-hover'}`} onClick={() => toggleTask(task.id)} aria-pressed={selected}>
                  {task.name?.trim() || 'Unnamed Task'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {monthRange(startDate, endDate).map((month) => (
          <div key={month.toISOString()} className="rounded-xl border border-surface-border bg-surface-card p-4">
            <h4 className="mb-3 text-sm font-semibold text-text-primary">
              {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h4>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-text-muted">
              {WEEKDAYS.map((weekday) => <div key={weekday}>{weekday}</div>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {daysForMonth(month).map((day) => {
                const dateKey = toIsoDate(day);
                const inMonth = day.getMonth() === month.getMonth();
                const inRange = dateKey >= startDate && dateKey <= endDate;
                const dayAssignments = inRange ? assignmentsByDate.get(dateKey) ?? [] : [];
                const categoryCounts = new Map<string, number>();
                dayAssignments.forEach((assignment) => {
                  const category = taskById.get(assignment.task_id ?? '')?.category?.trim() || 'Uncategorized';
                  categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
                });
                const dominant = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
                return (
                  <div key={dateKey} className={`min-h-[84px] rounded-lg border p-2 text-left ${inMonth && inRange ? 'border-surface-border bg-surface-elevated' : 'border-transparent bg-surface-card text-text-muted opacity-45'}`} style={dominant ? { boxShadow: `inset 0 3px 0 ${categoryColors.get(dominant)}` } : undefined}>
                    <div className="text-xs font-medium text-text-primary">{day.getDate()}</div>
                    <div className="mt-2 space-y-1">
                      {Array.from(categoryCounts.entries()).slice(0, 3).map(([category, count]) => (
                        <div key={`${dateKey}-${category}`} className="truncate rounded px-1.5 py-1 text-[11px] font-medium text-text-inverse" style={{ backgroundColor: categoryColors.get(category) }}>
                          {category} ({count})
                        </div>
                      ))}
                      {categoryCounts.size > 3 ? <div className="text-[11px] text-text-muted">+{categoryCounts.size - 3} more</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

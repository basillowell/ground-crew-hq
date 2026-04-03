import type { Assignment, ScheduleEntry, Task } from '@/data/seedData';
import type { ClockEvent } from '@/lib/supabase-queries';

function toMillis(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function differenceInMinutes(start: number, end: number) {
  return Math.max(Math.round((end - start) / 60000), 0);
}

export function getClockStatusLabel(eventType?: ClockEvent['eventType']) {
  switch (eventType) {
    case 'in':
      return 'Clocked in';
    case 'break':
      return 'On break';
    case 'out':
      return 'Clocked out';
    default:
      return 'Ready to start';
  }
}

export function computeTimecardSummary(events: ClockEvent[], nowIso = new Date().toISOString()) {
  const sortedEvents = [...events].sort((left, right) => toMillis(left.timestamp) - toMillis(right.timestamp));
  const now = toMillis(nowIso);
  let activeStart: number | null = null;
  let breakStart: number | null = null;
  let workedMinutes = 0;
  let breakMinutes = 0;

  for (const event of sortedEvents) {
    const timestamp = toMillis(event.timestamp);
    if (!timestamp) continue;

    if (event.eventType === 'in') {
      if (breakStart != null) {
        breakMinutes += differenceInMinutes(breakStart, timestamp);
        breakStart = null;
      }
      activeStart = timestamp;
    }

    if (event.eventType === 'break') {
      if (activeStart != null) {
        workedMinutes += differenceInMinutes(activeStart, timestamp);
        activeStart = null;
      }
      breakStart = timestamp;
    }

    if (event.eventType === 'out') {
      if (activeStart != null) {
        workedMinutes += differenceInMinutes(activeStart, timestamp);
        activeStart = null;
      }
      if (breakStart != null) {
        breakMinutes += differenceInMinutes(breakStart, timestamp);
        breakStart = null;
      }
    }
  }

  if (activeStart != null) {
    workedMinutes += differenceInMinutes(activeStart, now);
  }

  if (breakStart != null) {
    breakMinutes += differenceInMinutes(breakStart, now);
  }

  const latestEvent = sortedEvents[sortedEvents.length - 1] ?? null;

  return {
    workedMinutes,
    breakMinutes,
    workedHours: Number((workedMinutes / 60).toFixed(2)),
    latestEventType: latestEvent?.eventType,
    statusLabel: getClockStatusLabel(latestEvent?.eventType),
    isClockedIn: latestEvent?.eventType === 'in',
    isOnBreak: latestEvent?.eventType === 'break',
    isClockedOut: latestEvent?.eventType === 'out',
  };
}

export function getShiftMinutes(entry?: ScheduleEntry | null) {
  if (!entry) return 0;
  const [startHour, startMinute] = entry.shiftStart.split(':').map(Number);
  const [endHour, endMinute] = entry.shiftEnd.split(':').map(Number);
  if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return 0;
  return Math.max(endHour * 60 + endMinute - (startHour * 60 + startMinute), 0);
}

export function getOrderedAssignmentsForEmployee(assignments: Assignment[], tasks: Task[]) {
  const taskRank = new Map(tasks.map((task) => [task.id, task.priority ?? 999]));
  const statusRank: Record<string, number> = {
    'in-progress': 0,
    planned: 1,
    completed: 2,
  };

  return [...assignments].sort((left, right) => {
    const leftStatus = statusRank[left.status ?? 'planned'] ?? 1;
    const rightStatus = statusRank[right.status ?? 'planned'] ?? 1;
    if (leftStatus !== rightStatus) return leftStatus - rightStatus;
    const leftPriority = taskRank.get(left.taskId) ?? 999;
    const rightPriority = taskRank.get(right.taskId) ?? 999;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.startTime.localeCompare(right.startTime);
  });
}

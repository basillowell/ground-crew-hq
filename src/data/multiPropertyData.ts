export type EscalationRule = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  condition: string;
  message: string;
  notifyRoles: string[];
  isActive: boolean;
};

export type ScheduleTemplateShift = {
  role: string;
  shiftStart: string;
  shiftEnd: string;
  count: number;
};

export type ScheduleTemplateTask = {
  taskName: string;
  dayOfWeek: number;
  startTime: string;
  duration: number;
};

export type ScheduleTemplate = {
  id: string;
  name: string;
  description: string;
  season: 'spring' | 'summer' | 'fall' | 'winter' | 'year-round';
  daysOfWeek: number[];
  shifts: ScheduleTemplateShift[];
  tasks: ScheduleTemplateTask[];
  isActive: boolean;
};

export const escalationRules: EscalationRule[] = [
  {
    id: 'esc-1',
    severity: 'warning',
    condition: 'unscheduled crew before next operating day',
    message: '{count} crew members need shifts for tomorrow',
    notifyRoles: ['admin', 'manager'],
    isActive: true,
  },
  {
    id: 'esc-2',
    severity: 'critical',
    condition: 'equipment service threshold exceeded',
    message: 'Equipment unit is overdue for service by {hours}h',
    notifyRoles: ['admin', 'manager'],
    isActive: true,
  },
  {
    id: 'esc-3',
    severity: 'warning',
    condition: 'rain or gust event near planned spray window',
    message: 'Rain expected - review spray operations for {property}',
    notifyRoles: ['admin', 'manager'],
    isActive: true,
  },
  {
    id: 'esc-4',
    severity: 'info',
    condition: 'weather station offline or stale',
    message: 'Primary weather feed needs review',
    notifyRoles: ['admin'],
    isActive: true,
  },
  {
    id: 'esc-5',
    severity: 'critical',
    condition: 'scheduled crew without assignments',
    message: '{count} crew members are scheduled but unassigned',
    notifyRoles: ['admin', 'manager'],
    isActive: true,
  },
];

export const scheduleTemplates: ScheduleTemplate[] = [
  {
    id: 'sched-summer-mowing',
    name: 'Summer Mowing Pattern',
    description: 'Daily mowing coverage with early start windows and a lighter afternoon task load.',
    season: 'summer',
    daysOfWeek: [1, 2, 3, 4, 5],
    isActive: true,
    shifts: [
      { role: 'Lead Operator', shiftStart: '05:30', shiftEnd: '14:00', count: 1 },
      { role: 'Grounds Crew', shiftStart: '05:30', shiftEnd: '14:00', count: 3 },
      { role: 'Support Tech', shiftStart: '06:00', shiftEnd: '14:30', count: 1 },
    ],
    tasks: [
      { taskName: 'Mow primary surfaces', dayOfWeek: 1, startTime: '06:00', duration: 180 },
      { taskName: 'Trim detail edges', dayOfWeek: 3, startTime: '10:00', duration: 90 },
      { taskName: 'Clean equipment and stage next day', dayOfWeek: 5, startTime: '12:30', duration: 60 },
    ],
  },
  {
    id: 'sched-tournament-prep',
    name: 'Tournament Prep',
    description: 'Front-load labor for event setup, presentation details, and finish mowing.',
    season: 'spring',
    daysOfWeek: [2, 3, 4, 5, 6],
    isActive: true,
    shifts: [
      { role: 'Supervisor', shiftStart: '05:00', shiftEnd: '15:00', count: 1 },
      { role: 'Grounds Crew', shiftStart: '05:00', shiftEnd: '15:00', count: 4 },
      { role: 'Irrigation Tech', shiftStart: '06:00', shiftEnd: '14:00', count: 1 },
    ],
    tasks: [
      { taskName: 'Tournament setup sweep', dayOfWeek: 2, startTime: '06:30', duration: 120 },
      { taskName: 'Bunker detail and edges', dayOfWeek: 4, startTime: '08:00', duration: 150 },
      { taskName: 'Event signage and staging', dayOfWeek: 5, startTime: '13:00', duration: 60 },
    ],
  },
  {
    id: 'sched-winter-maintenance',
    name: 'Winter Maintenance',
    description: 'Reduced seasonal staffing focused on repair, cleanup, and preventative maintenance.',
    season: 'winter',
    daysOfWeek: [1, 2, 3, 4],
    isActive: false,
    shifts: [
      { role: 'Mechanic', shiftStart: '07:00', shiftEnd: '15:30', count: 1 },
      { role: 'Grounds Crew', shiftStart: '07:30', shiftEnd: '16:00', count: 2 },
    ],
    tasks: [
      { taskName: 'Equipment service block', dayOfWeek: 1, startTime: '08:00', duration: 180 },
      { taskName: 'Dormant cleanup route', dayOfWeek: 3, startTime: '09:30', duration: 120 },
    ],
  },
];

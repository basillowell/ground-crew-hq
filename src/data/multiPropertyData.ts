// Multi-property seed data for command center dashboard

export interface Property {
  id: string;
  name: string;
  shortName: string;
  type: string;
  address: string;
  city: string;
  state: string;
  acreage: number;
  logoInitials: string;
  color: string;
  status: 'active' | 'onboarding' | 'paused';
}

export interface PropertyStats {
  propertyId: string;
  crewScheduled: number;
  crewActive: number;
  tasksCompleted: number;
  tasksTotal: number;
  equipmentActive: number;
  equipmentDown: number;
  openWorkOrders: number;
  weatherAlert: boolean;
  complianceScore: number;
}

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  propertyId: string;
  status: 'active' | 'on-break' | 'traveling' | 'off-site';
  currentTask?: string;
  lat?: number;
  lng?: number;
}

export const properties: Property[] = [
  { id: 'prop-1', name: 'Ground Crew HQ', shortName: 'GC HQ', type: 'golf-course', address: '1200 Championship Dr', city: 'Scottsdale', state: 'AZ', acreage: 180, logoInitials: 'GC', color: 'hsl(152, 55%, 38%)', status: 'active' },
  { id: 'prop-2', name: 'Pine Valley Club', shortName: 'PVC', type: 'golf-course', address: '450 Fairway Ln', city: 'Pine Valley', state: 'NJ', acreage: 220, logoInitials: 'PV', color: 'hsl(210, 80%, 52%)', status: 'active' },
  { id: 'prop-3', name: 'Oceanview Resort & Spa', shortName: 'OVR', type: 'resort', address: '8900 Coastal Blvd', city: 'Carlsbad', state: 'CA', acreage: 95, logoInitials: 'OV', color: 'hsl(270, 60%, 55%)', status: 'active' },
  { id: 'prop-4', name: 'Willowbrook Estate', shortName: 'WBE', type: 'estate', address: '77 Heritage Way', city: 'Greenwich', state: 'CT', acreage: 45, logoInitials: 'WB', color: 'hsl(38, 92%, 50%)', status: 'onboarding' },
];

export const propertyStats: PropertyStats[] = [
  { propertyId: 'prop-1', crewScheduled: 12, crewActive: 10, tasksCompleted: 34, tasksTotal: 48, equipmentActive: 18, equipmentDown: 2, openWorkOrders: 3, weatherAlert: false, complianceScore: 94 },
  { propertyId: 'prop-2', crewScheduled: 8, crewActive: 7, tasksCompleted: 22, tasksTotal: 30, equipmentActive: 14, equipmentDown: 1, openWorkOrders: 1, weatherAlert: true, complianceScore: 98 },
  { propertyId: 'prop-3', crewScheduled: 6, crewActive: 5, tasksCompleted: 18, tasksTotal: 22, equipmentActive: 9, equipmentDown: 0, openWorkOrders: 0, weatherAlert: false, complianceScore: 100 },
  { propertyId: 'prop-4', crewScheduled: 3, crewActive: 2, tasksCompleted: 5, tasksTotal: 12, equipmentActive: 4, equipmentDown: 1, openWorkOrders: 2, weatherAlert: false, complianceScore: 78 },
];

export const crewMembers: CrewMember[] = [
  { id: 'cm-1', name: 'Mike Johnson', role: 'Lead', propertyId: 'prop-1', status: 'active', currentTask: 'Mowing Greens #1-9' },
  { id: 'cm-2', name: 'Carlos Rivera', role: 'Operator', propertyId: 'prop-1', status: 'active', currentTask: 'Fairway Mowing' },
  { id: 'cm-3', name: 'James Wilson', role: 'Operator', propertyId: 'prop-1', status: 'on-break' },
  { id: 'cm-4', name: 'Sarah Chen', role: 'Lead', propertyId: 'prop-2', status: 'active', currentTask: 'Irrigation Check' },
  { id: 'cm-5', name: 'Tom Baker', role: 'Laborer', propertyId: 'prop-2', status: 'traveling' },
  { id: 'cm-6', name: 'Ana Garcia', role: 'Specialist', propertyId: 'prop-3', status: 'active', currentTask: 'Chemical Application' },
];

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  season: 'spring' | 'summer' | 'fall' | 'winter' | 'year-round';
  daysOfWeek: number[];
  shifts: { role: string; shiftStart: string; shiftEnd: string; count: number }[];
  tasks: { taskName: string; dayOfWeek: number; startTime: string; duration: number }[];
  isActive: boolean;
}

export const scheduleTemplates: ScheduleTemplate[] = [
  {
    id: 'tmpl-1', name: 'Summer Mowing Pattern', description: 'Full crew mowing rotation for peak season. Greens daily, fairways 3x/week.',
    season: 'summer', daysOfWeek: [1, 2, 3, 4, 5, 6], isActive: true,
    shifts: [
      { role: 'Lead', shiftStart: '05:00', shiftEnd: '13:30', count: 2 },
      { role: 'Operator', shiftStart: '05:30', shiftEnd: '14:00', count: 4 },
      { role: 'Laborer', shiftStart: '06:00', shiftEnd: '14:30', count: 3 },
    ],
    tasks: [
      { taskName: 'Greens Mowing', dayOfWeek: 1, startTime: '05:30', duration: 120 },
      { taskName: 'Fairway Mowing', dayOfWeek: 1, startTime: '06:00', duration: 180 },
      { taskName: 'Bunker Raking', dayOfWeek: 1, startTime: '05:30', duration: 90 },
    ],
  },
  {
    id: 'tmpl-2', name: 'Tournament Prep', description: 'Pre-tournament intensive with double mow and detail work.',
    season: 'year-round', daysOfWeek: [1, 2, 3, 4, 5], isActive: false,
    shifts: [
      { role: 'Lead', shiftStart: '04:30', shiftEnd: '15:00', count: 3 },
      { role: 'Operator', shiftStart: '05:00', shiftEnd: '15:00', count: 6 },
      { role: 'Laborer', shiftStart: '05:00', shiftEnd: '13:30', count: 4 },
    ],
    tasks: [
      { taskName: 'Double Mow Greens', dayOfWeek: 1, startTime: '05:00', duration: 180 },
      { taskName: 'Hand Water Greens', dayOfWeek: 1, startTime: '06:00', duration: 120 },
    ],
  },
  {
    id: 'tmpl-3', name: 'Winter Maintenance', description: 'Reduced crew for dormant season turf care and equipment maintenance.',
    season: 'winter', daysOfWeek: [1, 2, 3, 4, 5], isActive: false,
    shifts: [
      { role: 'Lead', shiftStart: '07:00', shiftEnd: '15:30', count: 1 },
      { role: 'Operator', shiftStart: '07:00', shiftEnd: '15:30', count: 2 },
    ],
    tasks: [
      { taskName: 'Equipment Maintenance', dayOfWeek: 1, startTime: '07:30', duration: 240 },
      { taskName: 'Debris Cleanup', dayOfWeek: 2, startTime: '08:00', duration: 180 },
    ],
  },
];

export interface EscalationRule {
  id: string;
  trigger: string;
  condition: string;
  severity: 'critical' | 'warning' | 'info';
  notifyRoles: string[];
  message: string;
  isActive: boolean;
}

export const escalationRules: EscalationRule[] = [
  { id: 'esc-1', trigger: 'unscheduled_crew', condition: 'Crew members without shifts > 0', severity: 'warning', notifyRoles: ['admin', 'manager'], message: '{count} crew members need shifts for tomorrow', isActive: true },
  { id: 'esc-2', trigger: 'equipment_overdue', condition: 'Service hours exceeded', severity: 'critical', notifyRoles: ['admin', 'manager'], message: 'Equipment #{unit} is overdue for service by {hours}h', isActive: true },
  { id: 'esc-3', trigger: 'weather_rain', condition: 'Rainfall forecast > 0.5in', severity: 'warning', notifyRoles: ['admin', 'manager', 'supervisor'], message: 'Rain expected — review spray operations for {property}', isActive: true },
  { id: 'esc-4', trigger: 'compliance_gap', condition: 'Missing license or weather link', severity: 'critical', notifyRoles: ['admin'], message: '{count} application logs missing compliance fields', isActive: true },
  { id: 'esc-5', trigger: 'no_assignments', condition: 'Scheduled crew without tasks', severity: 'critical', notifyRoles: ['manager', 'supervisor'], message: '{count} crew members are scheduled but unassigned', isActive: true },
];

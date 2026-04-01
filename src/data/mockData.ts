export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  group: string;
  role: string;
  wage: number;
  phone: string;
  email: string;
  photo: string;
  status: 'active' | 'inactive';
  department: string;
  language: string;
  workerType: 'full-time' | 'part-time' | 'seasonal';
  hireDate: string;
}

export interface Task {
  id: string;
  name: string;
  category: string;
  duration: number; // minutes
  color: string;
  icon: string;
}

export interface EquipmentType {
  id: string;
  name: string;
  category: string;
  totalUnits: number;
  activeUnits: number;
  inRepair: number;
}

export interface EquipmentUnit {
  id: string;
  typeId: string;
  unitNumber: string;
  status: 'available' | 'in-use' | 'maintenance' | 'out-of-service';
  assignedTo?: string;
  location: string;
  hours: number;
  lastService: string;
  nextService: string;
}

export interface WorkOrder {
  id: string;
  unitId: string;
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  createdDate: string;
  completedDate?: string;
  cost: number;
}

export interface ScheduleEntry {
  id: string;
  employeeId: string;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  status: 'scheduled' | 'day-off' | 'vacation' | 'sick';
}

export interface Note {
  id: string;
  type: 'daily' | 'general' | 'geo' | 'alert';
  title: string;
  content: string;
  author: string;
  date: string;
  location?: string;
}

export interface Assignment {
  employeeId: string;
  taskId: string;
  equipmentId?: string;
  startTime: string;
  duration: number;
  area: string;
}

export const employees: Employee[] = [
  { id: 'e1', firstName: 'Mike', lastName: 'Johnson', group: 'Greens', role: 'Lead', wage: 22, phone: '555-0101', email: 'mike.j@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'English', workerType: 'full-time', hireDate: '2019-03-15' },
  { id: 'e2', firstName: 'Carlos', lastName: 'Rivera', group: 'Fairways', role: 'Operator', wage: 18, phone: '555-0102', email: 'carlos.r@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'Spanish', workerType: 'full-time', hireDate: '2020-06-01' },
  { id: 'e3', firstName: 'Sarah', lastName: 'Chen', group: 'Landscape', role: 'Specialist', wage: 20, phone: '555-0103', email: 'sarah.c@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'English', workerType: 'full-time', hireDate: '2021-01-10' },
  { id: 'e4', firstName: 'James', lastName: 'Wilson', group: 'Irrigation', role: 'Technician', wage: 24, phone: '555-0104', email: 'james.w@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'English', workerType: 'full-time', hireDate: '2018-08-20' },
  { id: 'e5', firstName: 'David', lastName: 'Park', group: 'Greens', role: 'Operator', wage: 17, phone: '555-0105', email: 'david.p@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'English', workerType: 'part-time', hireDate: '2022-04-01' },
  { id: 'e6', firstName: 'Maria', lastName: 'Santos', group: 'Bunkers', role: 'Operator', wage: 16, phone: '555-0106', email: 'maria.s@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'Spanish', workerType: 'seasonal', hireDate: '2023-05-15' },
  { id: 'e7', firstName: 'Tom', lastName: 'Bradley', group: 'Mechanic', role: 'Lead Mechanic', wage: 28, phone: '555-0107', email: 'tom.b@course.com', photo: '', status: 'active', department: 'Equipment', language: 'English', workerType: 'full-time', hireDate: '2017-02-01' },
  { id: 'e8', firstName: 'Alex', lastName: 'Kim', group: 'Fairways', role: 'Operator', wage: 17, phone: '555-0108', email: 'alex.k@course.com', photo: '', status: 'inactive', department: 'Maintenance', language: 'English', workerType: 'seasonal', hireDate: '2023-06-01' },
];

export const tasks: Task[] = [
  { id: 't1', name: 'Mow Greens', category: 'Mowing', duration: 120, color: 'hsl(152, 55%, 38%)', icon: '🌿' },
  { id: 't2', name: 'Mow Fairways', category: 'Mowing', duration: 180, color: 'hsl(152, 40%, 50%)', icon: '🌾' },
  { id: 't3', name: 'Mow Tees', category: 'Mowing', duration: 90, color: 'hsl(152, 35%, 55%)', icon: '⛳' },
  { id: 't4', name: 'Rake Bunkers', category: 'Bunkers', duration: 60, color: 'hsl(38, 70%, 55%)', icon: '🏖️' },
  { id: 't5', name: 'Change Cups', category: 'Greens', duration: 45, color: 'hsl(210, 60%, 50%)', icon: '🏌️' },
  { id: 't6', name: 'Water Plants', category: 'Irrigation', duration: 60, color: 'hsl(200, 70%, 50%)', icon: '💧' },
  { id: 't7', name: 'Trim Edges', category: 'Landscape', duration: 90, color: 'hsl(80, 50%, 45%)', icon: '✂️' },
  { id: 't8', name: 'Apply Fertilizer', category: 'Chemical', duration: 120, color: 'hsl(30, 80%, 50%)', icon: '🧪' },
  { id: 't9', name: 'Spray Greens', category: 'Chemical', duration: 60, color: 'hsl(270, 50%, 55%)', icon: '🔬' },
  { id: 't10', name: 'Repair Divots', category: 'Greens', duration: 45, color: 'hsl(120, 40%, 45%)', icon: '🔧' },
  { id: 't11', name: 'Set Up Range', category: 'Range', duration: 30, color: 'hsl(45, 70%, 50%)', icon: '🎯' },
  { id: 't12', name: 'Blow Debris', category: 'Clean Up', duration: 60, color: 'hsl(0, 0%, 55%)', icon: '🍃' },
];

export const equipmentTypes: EquipmentType[] = [
  { id: 'eq1', name: 'Greens Mower', category: 'Mowing', totalUnits: 6, activeUnits: 5, inRepair: 1 },
  { id: 'eq2', name: 'Fairway Mower', category: 'Mowing', totalUnits: 4, activeUnits: 3, inRepair: 1 },
  { id: 'eq3', name: 'Utility Vehicle', category: 'Transport', totalUnits: 8, activeUnits: 7, inRepair: 1 },
  { id: 'eq4', name: 'Sprayer', category: 'Chemical', totalUnits: 3, activeUnits: 3, inRepair: 0 },
  { id: 'eq5', name: 'Aerator', category: 'Turf', totalUnits: 2, activeUnits: 2, inRepair: 0 },
  { id: 'eq6', name: 'Bunker Machine', category: 'Bunkers', totalUnits: 3, activeUnits: 2, inRepair: 1 },
  { id: 'eq7', name: 'Blower', category: 'Clean Up', totalUnits: 5, activeUnits: 5, inRepair: 0 },
  { id: 'eq8', name: 'Topdresser', category: 'Turf', totalUnits: 2, activeUnits: 1, inRepair: 1 },
];

export const equipmentUnits: EquipmentUnit[] = [
  { id: 'u1', typeId: 'eq1', unitNumber: 'GM-001', status: 'available', location: 'Shop', hours: 1250, lastService: '2024-03-01', nextService: '2024-04-01' },
  { id: 'u2', typeId: 'eq1', unitNumber: 'GM-002', status: 'in-use', assignedTo: 'e1', location: 'Hole 3', hours: 980, lastService: '2024-02-15', nextService: '2024-03-15' },
  { id: 'u3', typeId: 'eq1', unitNumber: 'GM-003', status: 'maintenance', location: 'Shop', hours: 2100, lastService: '2024-01-10', nextService: '2024-02-10' },
  { id: 'u4', typeId: 'eq2', unitNumber: 'FM-001', status: 'in-use', assignedTo: 'e2', location: 'Fairway 7', hours: 3200, lastService: '2024-03-10', nextService: '2024-04-10' },
  { id: 'u5', typeId: 'eq3', unitNumber: 'UV-001', status: 'available', location: 'Shop', hours: 5600, lastService: '2024-03-05', nextService: '2024-04-05' },
  { id: 'u6', typeId: 'eq3', unitNumber: 'UV-002', status: 'in-use', assignedTo: 'e4', location: 'Irrigation Pump', hours: 4300, lastService: '2024-02-20', nextService: '2024-03-20' },
  { id: 'u7', typeId: 'eq4', unitNumber: 'SP-001', status: 'available', location: 'Chemical Shed', hours: 890, lastService: '2024-03-12', nextService: '2024-04-12' },
  { id: 'u8', typeId: 'eq6', unitNumber: 'BM-001', status: 'maintenance', location: 'Shop', hours: 1560, lastService: '2024-01-20', nextService: '2024-02-20' },
];

export const workOrders: WorkOrder[] = [
  { id: 'wo1', unitId: 'u3', title: 'Reel grinding', description: 'Annual reel grinding and bedknife replacement', status: 'in-progress', priority: 'high', createdDate: '2024-03-15', cost: 450 },
  { id: 'wo2', unitId: 'u8', title: 'Hydraulic leak repair', description: 'Fix hydraulic line leak on conveyor system', status: 'open', priority: 'medium', createdDate: '2024-03-18', cost: 280 },
  { id: 'wo3', unitId: 'u4', title: 'Oil change', description: 'Scheduled 500hr oil change and filter', status: 'completed', priority: 'low', createdDate: '2024-03-01', completedDate: '2024-03-02', cost: 85 },
  { id: 'wo4', unitId: 'u1', title: 'Belt replacement', description: 'Replace drive belt showing wear', status: 'completed', priority: 'medium', createdDate: '2024-02-25', completedDate: '2024-02-26', cost: 120 },
  { id: 'wo5', unitId: 'u6', title: 'Tire replacement', description: 'Replace two rear tires', status: 'open', priority: 'low', createdDate: '2024-03-20', cost: 340 },
];

export const scheduleEntries: ScheduleEntry[] = [
  { id: 's1', employeeId: 'e1', date: '2024-03-25', shiftStart: '05:00', shiftEnd: '13:30', status: 'scheduled' },
  { id: 's2', employeeId: 'e2', date: '2024-03-25', shiftStart: '05:30', shiftEnd: '14:00', status: 'scheduled' },
  { id: 's3', employeeId: 'e3', date: '2024-03-25', shiftStart: '06:00', shiftEnd: '14:30', status: 'scheduled' },
  { id: 's4', employeeId: 'e4', date: '2024-03-25', shiftStart: '05:00', shiftEnd: '13:30', status: 'scheduled' },
  { id: 's5', employeeId: 'e5', date: '2024-03-25', shiftStart: '06:00', shiftEnd: '12:00', status: 'scheduled' },
  { id: 's6', employeeId: 'e6', date: '2024-03-25', shiftStart: '06:00', shiftEnd: '14:00', status: 'scheduled' },
  { id: 's7', employeeId: 'e7', date: '2024-03-25', shiftStart: '06:30', shiftEnd: '15:00', status: 'scheduled' },
  { id: 's8', employeeId: 'e1', date: '2024-03-26', shiftStart: '05:00', shiftEnd: '13:30', status: 'scheduled' },
  { id: 's9', employeeId: 'e2', date: '2024-03-26', shiftStart: '05:30', shiftEnd: '14:00', status: 'day-off' },
  { id: 's10', employeeId: 'e3', date: '2024-03-26', shiftStart: '06:00', shiftEnd: '14:30', status: 'scheduled' },
];

export const notes: Note[] = [
  { id: 'n1', type: 'daily', title: 'Morning Setup Complete', content: 'All greens mowed and cups changed. Pin positions set per Tuesday rotation. Dew removal completed by 7:15 AM.', author: 'Mike Johnson', date: '2024-03-25' },
  { id: 'n2', type: 'general', title: 'Tournament Prep Notes', content: 'Member-guest tournament this weekend. Need extra bunker work Wed-Fri. Cart path cleanup needed on holes 12-15.', author: 'Sarah Chen', date: '2024-03-24' },
  { id: 'n3', type: 'alert', title: 'Irrigation Leak - Hole 9', content: 'Sprinkler head broken on #9 fairway, left side 150yd marker. Water pooling. James assigned to repair.', author: 'Carlos Rivera', date: '2024-03-25' },
  { id: 'n4', type: 'geo', title: 'Drainage Issue', content: 'Standing water near #14 green approach. Needs french drain evaluation.', author: 'James Wilson', date: '2024-03-23', location: 'Hole 14 Approach' },
  { id: 'n5', type: 'daily', title: 'Chemical Application Log', content: 'Applied fungicide to greens 1-9 this morning. 24hr re-entry period. Flags placed.', author: 'Mike Johnson', date: '2024-03-25' },
];

export const assignments: Assignment[] = [
  { employeeId: 'e1', taskId: 't1', equipmentId: 'u2', startTime: '05:00', duration: 120, area: 'Greens 1-9' },
  { employeeId: 'e1', taskId: 't5', startTime: '07:00', duration: 45, area: 'All Greens' },
  { employeeId: 'e2', taskId: 't2', equipmentId: 'u4', startTime: '05:30', duration: 180, area: 'Fairways 1-9' },
  { employeeId: 'e3', taskId: 't7', startTime: '06:00', duration: 90, area: 'Clubhouse Landscape' },
  { employeeId: 'e3', taskId: 't12', startTime: '07:30', duration: 60, area: 'Cart Paths' },
  { employeeId: 'e4', taskId: 't6', startTime: '05:00', duration: 60, area: 'New Plantings' },
  { employeeId: 'e5', taskId: 't3', startTime: '06:00', duration: 90, area: 'Tees 1-18' },
  { employeeId: 'e6', taskId: 't4', startTime: '06:00', duration: 120, area: 'All Bunkers' },
  { employeeId: 'e7', taskId: 't10', startTime: '06:30', duration: 120, area: 'Shop' },
];

export const departments = ['Maintenance', 'Equipment', 'Landscape', 'Irrigation'];
export const groups = ['Greens', 'Fairways', 'Bunkers', 'Landscape', 'Irrigation', 'Mechanic', 'Range'];

export const turfData = {
  mowPatterns: ['Single Cut', 'Double Cut', 'Cross Cut', 'Diagonal', 'Straight'],
  heightOfCut: [
    { area: 'Greens', height: '0.125"', frequency: 'Daily' },
    { area: 'Tees', height: '0.500"', frequency: '3x/week' },
    { area: 'Fairways', height: '0.625"', frequency: '3x/week' },
    { area: 'Rough', height: '2.000"', frequency: 'Weekly' },
  ],
  chemicals: [
    { name: 'Primo Maxx', type: 'Growth Regulator', lastApplied: '2024-03-20', nextDue: '2024-04-03' },
    { name: 'Banner Maxx', type: 'Fungicide', lastApplied: '2024-03-25', nextDue: '2024-04-08' },
    { name: 'Revolver', type: 'Herbicide', lastApplied: '2024-03-10', nextDue: '2024-04-10' },
  ],
};

export const reportCategories = [
  { id: 'r1', name: 'Labor Reports', reports: ['Daily Labor Summary', 'Weekly Hours by Employee', 'Overtime Report', 'Labor Cost by Task'] },
  { id: 'r2', name: 'Equipment Reports', reports: ['Equipment Usage Summary', 'Repair Cost Analysis', 'Downtime Report', 'Maintenance Schedule'] },
  { id: 'r3', name: 'Task Reports', reports: ['Task Completion Rate', 'Task Distribution', 'Area Coverage', 'Chemical Application Log'] },
  { id: 'r4', name: 'Safety Reports', reports: ['Incident Log', 'Safety Training Status', 'Equipment Inspection', 'Chemical Exposure'] },
];

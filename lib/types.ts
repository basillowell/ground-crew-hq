export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  photo_url?: string;
  active: boolean;
  group_id?: number;
  group_name?: string;
  worker_type?: string;
  hourly_rate: number;
  overtime_rule_id?: number;
  created_at: string;
}

export interface Group {
  id: number;
  name: string;
}

export interface Shift {
  id: number;
  employee_id: number;
  date: string; // ISO date string YYYY-MM-DD
  start_time?: string;
  end_time?: string;
  is_day_off: boolean;
}

export interface TaskGroup {
  id: number;
  name: string;
}

export interface Task {
  id: number;
  name: string;
  group_id?: number;
  group_name?: string;
}

export interface EquipmentType {
  id: number;
  name: string;
  short_name?: string;
}

export interface EquipmentUnit {
  id: number;
  equipment_type_id: number;
  type_name?: string;
  unit_name: string;
  status: "ready" | "issue" | "maintenance" | "disabled";
}

export interface TaskAssignment {
  id: number;
  shift_id: number;
  task_id: number;
  task_name?: string;
  duration: number;
  position: number;
  equipment_unit_id?: number;
  equipment_unit_name?: string;
}

export interface WorkOrder {
  id: number;
  equipment_unit_id: number;
  description?: string;
  status?: string;
  created_at: string;
}

export interface Note {
  id: number;
  date: string;
  type?: string;
  content: string;
}

export interface ScheduleTemplate {
  id: number;
  name: string;
  week_data: Array<{
    employee_id: number;
    weekday: number;
    start_time?: string | null;
    end_time?: string | null;
    is_day_off: boolean;
  }>;
}

// ---- Derived / view types ----

export interface ShiftWithAssignments extends Shift {
  assignments: TaskAssignment[];
  total_hours: number;
}

export interface WorkboardEmployee {
  employee: Employee;
  shift: Shift | null;
  assignments: TaskAssignment[];
}

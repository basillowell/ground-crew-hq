import type { SupabaseClient } from '@supabase/supabase-js';

type CrewRow = {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
};

type ShiftRow = {
  id: string;
  employee_id: string;
  property_id: string;
  date: string;
  shift_start: string;
  shift_end: string;
  status: string | null;
};

type AssignmentRow = {
  id: string;
  employee_id: string;
  property_id: string;
  task_id: string | null;
  date: string;
  status: string | null;
  notes: string | null;
  location: string | null;
};


export type OpsContext = {
  orgId: string;
  generatedAt: string;
  today: string;
  crew: CrewRow[];
  shifts: ShiftRow[];
  assignments: AssignmentRow[];
};

export async function buildOpsContext(
  client: SupabaseClient,
  orgId: string,
): Promise<OpsContext> {
  const today = new Date().toISOString().slice(0, 10);

  const [crewResult, shiftsResult, assignmentsResult] = await Promise.all([
    client
      .from('employees')
      .select('id,first_name,last_name,role')
      .eq('org_id', orgId),
    client
      .from('schedule_entries')
      .select('id,employee_id,property_id,date,shift_start,shift_end,status')
      .eq('org_id', orgId)
      .gte('date', today)
      .order('date', { ascending: true }),
    client
      .from('assignments')
      .select('id,employee_id,property_id,task_id,date,status,notes,location')
      .eq('org_id', orgId)
      .eq('date', today)
      .order('created_at', { ascending: true }),
  ]);

  if (crewResult.error) throw crewResult.error;
  if (shiftsResult.error) throw shiftsResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  return {
    orgId,
    generatedAt: new Date().toISOString(),
    today,
    crew: (crewResult.data ?? []) as CrewRow[],
    shifts: (shiftsResult.data ?? []) as ShiftRow[],
    assignments: (assignmentsResult.data ?? []) as AssignmentRow[],
  };
}

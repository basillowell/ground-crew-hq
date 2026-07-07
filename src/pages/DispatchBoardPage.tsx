import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { useAssignments, useEmployees, useProperties, useTasks } from '@/lib/supabase-queries';
import { createClient } from '@/lib/supabase';

const supabase = createClient();

type AbortableSupabaseRequest<T> = {
  abortSignal: (signal: AbortSignal) => PromiseLike<T>;
};

async function withDispatchAbortControllerTimeout<T extends { error: unknown }>(
  request: AbortableSupabaseRequest<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    return await request.abortSignal(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      return { data: null, error: new Error('Save timed out — please try again') } as T;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function DispatchBoardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentPropertyId, orgId } = useOrgProfile();
  const todayKey = new Date().toISOString().slice(0, 10);

  const { data: assignments = [], isLoading: assignmentsLoading } =
    useAssignments(todayKey, currentPropertyId ?? undefined, orgId ?? undefined);
  const { data: employees = [], isLoading: employeesLoading } =
    useEmployees(currentPropertyId ?? undefined, orgId ?? undefined);
  const { data: tasks = [] } =
    useTasks(currentPropertyId ?? undefined, orgId ?? undefined);
  const { data: properties = [] } = useProperties(orgId ?? undefined);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.id ?? '');
  const [startTime, setStartTime] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLoading = assignmentsLoading || employeesLoading;

  useEffect(() => {
    if (!selectedPropertyId && properties[0]?.id) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  useEffect(() => {
    if (!selectedEmployeeId && employees[0]?.id) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const resetCreateForm = () => {
    setSelectedEmployeeId(employees[0]?.id ?? '');
    setSelectedTaskId('');
    setSelectedPropertyId(properties[0]?.id ?? '');
    setStartTime('');
    setEstimatedHours('');
  };

  const handleCreateOpenChange = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) resetCreateForm();
  };

  const handleCreateAssignment = async () => {
    if (!orgId) {
      toast.error('Workspace is still loading. Try again in a moment.');
      return;
    }

    if (!selectedEmployeeId) {
      toast.error('Select a crew member before creating an assignment');
      return;
    }

    if (!selectedPropertyId) {
      toast.error('Select a property before creating an assignment');
      return;
    }

    setIsSubmitting(true);

    const { error } = await withDispatchAbortControllerTimeout(
      supabase.from('assignments').insert({
        employee_id: selectedEmployeeId,
        task_id: selectedTaskId || null,
        property_id: selectedPropertyId,
        org_id: orgId,
        date: todayKey,
        status: 'planned',
        start_time: startTime || null,
        estimated_hours: estimatedHours ? Number(estimatedHours) : null,
      }),
    );

    setIsSubmitting(false);

    if (error) {
      console.error('[DispatchBoard] Assignment create failed:', error);
      toast.error('Failed to create assignment');
      return;
    }

    toast.success('Assignment created');
    resetCreateForm();
    setIsCreateOpen(false);
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const employeesWithAssignments = employees
    .filter((employee) =>
      employee.status === 'active' &&
      !employee.firstName?.toLowerCase().includes('demo') &&
      !employee.lastName?.toLowerCase().includes('demo') &&
      !employee.lastName?.toLowerCase().includes('viewer'),
    )
    .map((employee) => ({
      employee,
      assignments: assignments.filter((assignment) => assignment.employeeId === employee.id),
    }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispatch</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Today's crew assignments - {todayKey}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Assignment
          </Button>
          <Button onClick={() => navigate('/app/workboard')}>
            Open Workboard
          </Button>
        </div>
      </div>

      {employeesWithAssignments.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm font-medium">No crew scheduled today</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add shifts in the Scheduler first.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate('/app/scheduler')}
          >
            Open Scheduler
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {employeesWithAssignments.map(({ employee, assignments: employeeAssignments }) => (
            <Card key={employee.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {employee.firstName?.[0]}
                    {employee.lastName?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {employee.department}
                    </p>
                  </div>
                </div>
                <Badge variant={employeeAssignments.length > 0 ? 'default' : 'outline'}>
                  {employeeAssignments.length} task{employeeAssignments.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {employeeAssignments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No tasks assigned yet
                </p>
              ) : (
                <div className="space-y-1.5">
                  {employeeAssignments.map((assignment) => {
                    const task = tasks.find((item) => item.id === assignment.taskId);
                    return (
                      <div
                        key={assignment.id}
                        className="rounded-lg bg-muted/40 px-3 py-2 text-xs"
                      >
                        <p className="font-medium">{task?.name ?? 'Task'}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          {assignment.area ?? 'No location set'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Assignment</DialogTitle>
            <DialogDescription>
              Create a dispatch assignment for today with a required property.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignment-employee">Crew member</Label>
              <select
                id="assignment-employee"
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select crew member</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignment-task">Task</Label>
              <select
                id="assignment-task"
                value={selectedTaskId}
                onChange={(event) => setSelectedTaskId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">General assignment</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignment-property">Property</Label>
              <select
                id="assignment-property"
                value={selectedPropertyId}
                onChange={(event) => setSelectedPropertyId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assignment-start-time">Start time</Label>
                <Input
                  id="assignment-start-time"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignment-hours">Estimated hours</Label>
                <Input
                  id="assignment-hours"
                  type="number"
                  min="0"
                  step="0.25"
                  value={estimatedHours}
                  onChange={(event) => setEstimatedHours(event.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleCreateOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateAssignment()} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



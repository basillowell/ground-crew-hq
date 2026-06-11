import { useAuth } from '@/contexts/AuthContext';
import { useAssignments, useEmployees, useTasks } from '@/lib/supabase-queries';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function DispatchBoardPage() {
  const navigate = useNavigate();
  const { currentPropertyId, orgId } = useAuth();
  const todayKey = new Date().toISOString().slice(0, 10);

  const { data: assignments = [], isLoading: assignmentsLoading } =
    useAssignments(todayKey, currentPropertyId ?? undefined, orgId ?? undefined);
  const { data: employees = [], isLoading: employeesLoading } =
    useEmployees(currentPropertyId ?? undefined, orgId ?? undefined);
  const { data: tasks = [] } =
    useTasks(currentPropertyId ?? undefined, orgId ?? undefined);

  const isLoading = assignmentsLoading || employeesLoading;

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  const employeesWithAssignments = employees
    .filter(e =>
      e.status === 'active' &&
      !e.firstName?.toLowerCase().includes('demo') &&
      !e.lastName?.toLowerCase().includes('demo') &&
      !e.lastName?.toLowerCase().includes('viewer')
    )
    .map(employee => ({
      employee,
      assignments: assignments.filter(a => a.employeeId === employee.id),
    }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispatch</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Today's crew assignments · {todayKey}
          </p>
        </div>
        <Button onClick={() => navigate('/app/workboard')}>
          Open Workboard →
        </Button>
      </div>

      {employeesWithAssignments.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm font-medium">No crew scheduled today</p>
          <p className="text-xs text-muted-foreground mt-1">
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
          {employeesWithAssignments.map(({ employee, assignments: empAssignments }) => (
            <Card key={employee.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex
                    items-center justify-center text-xs font-semibold text-primary">
                    {employee.firstName?.[0]}{employee.lastName?.[0]}
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
                <Badge variant={empAssignments.length > 0 ? 'default' : 'outline'}>
                  {empAssignments.length} task{empAssignments.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {empAssignments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No tasks assigned yet
                </p>
              ) : (
                <div className="space-y-1.5">
                  {empAssignments.map(assignment => {
                    const task = tasks.find(t => t.id === assignment.taskId);
                    return (
                      <div
                        key={assignment.id}
                        className="rounded-lg bg-muted/40 px-3 py-2 text-xs"
                      >
                        <p className="font-medium">{task?.name ?? 'Task'}</p>
                        <p className="text-muted-foreground mt-0.5">
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
    </div>
  );
}

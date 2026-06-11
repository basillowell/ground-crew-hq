import { useMemo } from 'react';
import { ListChecks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/shared';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/lib/supabase-queries';

type TaskListItem = {
  id: string;
  name: string;
  category: string | null;
  status: string | null;
  priority: number | null;
  estimated_hours: number | null;
  color: string | null;
};

function groupedByCategory(tasks: TaskListItem[]) {
  return tasks.reduce<Record<string, TaskListItem[]>>((acc, task) => {
    const key = task.category?.trim() || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});
}

export default function TasksCatalogPage() {
  const navigate = useNavigate();
  const { currentUser, currentPropertyId } = useAuth();
  const {
    data: taskRows = [],
    isLoading: loading,
    error,
    refetch,
  } = useTasks(currentPropertyId || undefined, currentUser?.orgId);
  const tasks = useMemo<TaskListItem[]>(
    () =>
      taskRows.map((task) => ({
        id: task.id,
        name: task.name,
        category: task.category,
        status: task.status ?? 'active',
        priority: task.priority ?? null,
        estimated_hours: task.duration / 60,
        color: task.color,
      })),
    [taskRows],
  );

  const groups = useMemo(() => groupedByCategory(tasks), [tasks]);
  const orderedCategories = useMemo(() => Object.keys(groups).sort((a, b) => a.localeCompare(b)), [groups]);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="Task Management"
        subtitle="Task library used by Workflow assignment and operations planning."
        badge={<Badge variant="secondary">{tasks.length} tasks</Badge>}
      />

      {loading ? (
        <Card className="p-4 space-y-3">
          <div className="h-5 w-48 rounded bg-muted animate-pulse" />
          <div className="h-10 rounded bg-muted animate-pulse" />
          <div className="h-10 rounded bg-muted animate-pulse" />
        </Card>
      ) : error ? (
        <Card className="p-4 space-y-3">
          <p className="text-sm text-destructive">{error.message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            Retry
          </button>
        </Card>
      ) : orderedCategories.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks in your library"
          description="Create tasks your crew can be assigned to on the workboard. Manage your task library in Settings."
          actionLabel="Go to Settings"
          onAction={() => navigate('/app/settings')}
        />
      ) : (
        orderedCategories.map((category) => (
          <Card key={category} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{category}</h2>
              <Badge variant="outline">{groups[category].length}</Badge>
            </div>
            <div className="space-y-2">
              {groups[category].map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full border border-border shrink-0"
                      style={{ backgroundColor: task.color ?? '#9ca3af' }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{task.name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{task.category ?? 'General'}</Badge>
                        <span>{task.estimated_hours ?? 0}h</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={task.status === 'active' ? 'default' : 'outline'}>
                    {task.status ?? 'active'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

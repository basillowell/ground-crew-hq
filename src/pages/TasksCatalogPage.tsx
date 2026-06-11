import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/shared';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/utils/handleSupabaseError';
import { useAppStore } from '@/store/appStore';

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
  const { currentUser } = useAuth();
  const isHydrated = useAppStore((state) => state.isHydrated);
  const orgId = currentUser?.orgId ?? '';
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!supabase || !orgId) {
      setTasks([]);
      setLoading(false);
      setError('Unable to load tasks without organization context.');
      return;
    }

    setLoading(true);
    setError(null);

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out.')), 8000);
    });

    try {
      const request = supabase
        .from('tasks')
        .select('id, name, category, status, priority, estimated_hours, color')
        .eq('org_id', orgId)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      const result = await Promise.race([request, timeout]);
      const { data, error: queryError } = result as Awaited<typeof request>;
      if (queryError) throw queryError;
      setTasks((data ?? []) as TaskListItem[]);
    } catch (err) {
      const message = handleSupabaseError(err, 'TasksCatalogPage.fetchTasks') || 'Failed to load tasks.';
      setError(message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!isHydrated) return;
    void fetchTasks();
  }, [fetchTasks, isHydrated]);

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
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => void fetchTasks()}
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

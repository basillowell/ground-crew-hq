import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DataTable, PageHeader, SearchFilter } from '@/components/shared';
import { Clock3, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { loadTasks, saveTasks } from '@/lib/dataStore';
import type { Task } from '@/data/seedData';

type SortMode = 'name' | 'category' | 'duration-asc' | 'duration-desc';

const defaultDraft = {
  id: '',
  name: '',
  category: 'Mowing',
  duration: '60',
  color: '#3f8f63',
  icon: '🛠️',
};

function makeId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `t-${crypto.randomUUID()}`
    : `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function TasksManagementPage() {
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('category');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(defaultDraft);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  useEffect(() => {
    setTaskList(loadTasks());
  }, []);

  const categories = useMemo(
    () => [...new Set(taskList.map((task) => task.category))].sort((left, right) => left.localeCompare(right)),
    [taskList],
  );

  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = taskList.filter((task) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        task.name.toLowerCase().includes(normalizedSearch) ||
        task.category.toLowerCase().includes(normalizedSearch);
      const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    next.sort((left, right) => {
      switch (sortMode) {
        case 'name':
          return left.name.localeCompare(right.name);
        case 'category':
          return left.category.localeCompare(right.category) || left.name.localeCompare(right.name);
        case 'duration-asc':
          return left.duration - right.duration || left.name.localeCompare(right.name);
        case 'duration-desc':
          return right.duration - left.duration || left.name.localeCompare(right.name);
        default:
          return 0;
      }
    });

    return next;
  }, [categoryFilter, search, sortMode, taskList]);

  const totalMinutes = filteredTasks.reduce((sum, task) => sum + task.duration, 0);

  function persistTasks(nextTasks: Task[]) {
    setTaskList(nextTasks);
    saveTasks(nextTasks);
  }

  function openAddDialog() {
    setEditingTaskId(null);
    setDraft(defaultDraft);
    setDialogOpen(true);
  }

  function openEditDialog(task: Task) {
    setEditingTaskId(task.id);
    setDraft({
      id: task.id,
      name: task.name,
      category: task.category,
      duration: String(task.duration),
      color: task.color,
      icon: task.icon,
    });
    setDialogOpen(true);
  }

  function handleSaveTask() {
    if (!draft.name.trim() || !draft.category.trim()) return;

    const nextTask: Task = {
      id: editingTaskId ?? makeId(),
      name: draft.name.trim(),
      category: draft.category.trim(),
      duration: Number(draft.duration || 0),
      color: draft.color,
      icon: draft.icon || '🛠️',
    };

    const nextTasks = editingTaskId
      ? taskList.map((task) => (task.id === editingTaskId ? nextTask : task))
      : [...taskList, nextTask];

    persistTasks(nextTasks);
    setDialogOpen(false);
    setDraft(defaultDraft);
    toast(editingTaskId ? 'Task updated' : 'Task added', {
      description: `${nextTask.name} is ready for scheduling and workboard assignment.`,
    });
  }

  function handleDeleteTask(taskId: string) {
    const task = taskList.find((entry) => entry.id === taskId);
    const nextTasks = taskList.filter((entry) => entry.id !== taskId);
    persistTasks(nextTasks);
    toast('Task deleted', {
      description: task ? `${task.name} has been removed from the task catalog.` : 'Task removed.',
    });
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="Task Management"
        subtitle="Review, sort, edit, and maintain the task catalog that drives scheduling and workboard assignment."
        badge={<Badge variant="secondary">{taskList.length} tasks</Badge>}
        action={{ label: 'Add Task', onClick: openAddDialog, icon: <Plus className="h-3.5 w-3.5" /> }}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Task Catalog</p>
              <p className="mt-2 text-2xl font-semibold">{taskList.length}</p>
            </div>
            <Tag className="h-5 w-5 text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Categories</p>
              <p className="mt-2 text-2xl font-semibold">{categories.length}</p>
            </div>
            <Badge variant="outline">Grouped</Badge>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Filtered Minutes</p>
              <p className="mt-2 text-2xl font-semibold">{totalMinutes}</p>
            </div>
            <Clock3 className="h-5 w-5 text-primary" />
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr_0.7fr]">
          <SearchFilter value={search} onChange={setSearch} placeholder="Search tasks, categories, or keywords..." />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="category">Sort by category</option>
            <option value="name">Sort by name</option>
            <option value="duration-asc">Shortest duration</option>
            <option value="duration-desc">Longest duration</option>
          </select>
        </div>
      </Card>

      <DataTable
        columns={[
          {
            key: 'task',
            header: 'Task',
            render: (task) => (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-background text-lg">
                  {task.icon}
                </div>
                <div>
                  <div className="font-medium">{task.name}</div>
                  <div className="text-xs text-muted-foreground">ID: {task.id}</div>
                </div>
              </div>
            ),
          },
          {
            key: 'category',
            header: 'Category',
            render: (task) => <Badge variant="outline">{task.category}</Badge>,
          },
          {
            key: 'duration',
            header: 'Duration',
            render: (task) => <span className="font-medium">{task.duration} min</span>,
          },
          {
            key: 'color',
            header: 'Visual',
            render: (task) => (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: task.color }} />
                <span className="text-xs text-muted-foreground">{task.color}</span>
              </div>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            className: 'w-[170px]',
            render: (task) => (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEditDialog(task);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteTask(task.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            ),
          },
        ]}
        data={filteredTasks}
        keyExtractor={(task) => task.id}
        onRowClick={openEditDialog}
        emptyMessage="No tasks match the current filters."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? 'Edit Task' : 'Add Task'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Task Name</label>
                <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
                <Input value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Color</label>
                <input
                  type="color"
                  value={draft.color}
                  onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Icon</label>
                <Input value={draft.icon} onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))} className="mt-1" />
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Preview</p>
              <div className="mt-3 flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border text-lg">{draft.icon || '🛠️'}</div>
                <div className="flex-1">
                  <div className="font-medium">{draft.name || 'Task name preview'}</div>
                  <div className="text-xs text-muted-foreground">{draft.category || 'Category'} · {draft.duration || '0'} minutes</div>
                </div>
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: draft.color }} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveTask}>{editingTaskId ? 'Save Changes' : 'Save Task'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

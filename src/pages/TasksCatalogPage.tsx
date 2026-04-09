import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Pencil, Plus, Trash2, GripVertical, Clock } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useTasks } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/data/seedData';

type TaskDraft = {
  name: string;
  category: string;
  duration: string;
  color: string;
  notes: string;
};

const CATEGORY_PRESETS = [
  'Mowing', 'Edging', 'Irrigation', 'Fertilizing', 'Spraying',
  'Clean-up', 'Aeration', 'Overseeding', 'Renovation', 'Inspection', 'Other',
];

const COLOR_PRESETS = [
  '#3f8f63', '#2563eb', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#059669', '#db2777', '#6b7280', '#ea580c',
];

const defaultDraft: TaskDraft = {
  name: '',
  category: 'Mowing',
  duration: '60',
  color: '#3f8f63',
  notes: '',
};

function makeId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `t-${crypto.randomUUID()}`
    : `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function TasksCatalogPage() {
  const { currentUser, currentPropertyId } = useAuth();
  const queryClient = useQueryClient();
  const tasksQuery = useTasks(currentPropertyId, currentUser?.orgId);
  const taskList = tasksQuery.data ?? [];
  const isLoading = tasksQuery.isLoading;

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(defaultDraft);
  const [isSaving, setIsSaving] = useState(false);

  const sortedTasks = useMemo(
    () =>
      [...taskList]
        .filter((t) => t.status !== 'archived')
        .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || a.name.localeCompare(b.name)),
    [taskList],
  );

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedTasks;
    return sortedTasks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q),
    );
  }, [sortedTasks, search]);

  const categories = useMemo(
    () => [...new Set(taskList.map((t) => t.category))].sort(),
    [taskList],
  );

  async function saveTask() {
    if (!draft.name.trim()) {
      toast('Task name is required.');
      return;
    }
    setIsSaving(true);

    const existing = editingTaskId ? taskList.find((t) => t.id === editingTaskId) : undefined;
    const taskId = editingTaskId ?? makeId();
    const priority = existing?.priority ?? (taskList.length + 1);

    const { error } = await supabase.from('tasks').upsert({
      id: taskId,
      name: draft.name.trim(),
      category: draft.category.trim() || 'General',
      duration: Number(draft.duration) || 60,
      color: draft.color,
      icon: 'TK',
      status: 'active',
      priority,
      description: draft.notes.trim() || null,
      skillTags: [],
      equipmentTags: [],
      property_id: currentPropertyId,
      org_id: currentUser?.orgId ?? null,
    });

    setIsSaving(false);

    if (error) {
      toast('Could not save task', { description: error.message });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    setDialogOpen(false);
    setDraft(defaultDraft);
    setEditingTaskId(null);
    toast(editingTaskId ? 'Task updated' : 'Task added', {
      description: `"${draft.name.trim()}" is ready to assign in Workflow.`,
    });
  }

  async function deleteTask(task: Task) {
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) { toast('Delete failed', { description: error.message }); return; }
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    toast('Task removed', { description: `"${task.name}" has been deleted.` });
  }

  async function moveTask(taskId: string, direction: 'up' | 'down') {
    const ordered = [...sortedTasks];
    const idx = ordered.findIndex((t) => t.id === taskId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= ordered.length) return;
    [ordered[idx], ordered[targetIdx]] = [ordered[targetIdx], ordered[idx]];
    // Re-number and persist
    const updates = ordered.map((t, i) => ({ id: t.id, priority: i + 1 }));
    await Promise.all(
      updates.map((u) => supabase.from('tasks').update({ priority: u.priority }).eq('id', u.id)),
    );
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }

  function openAdd() {
    setEditingTaskId(null);
    setDraft(defaultDraft);
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTaskId(task.id);
    setDraft({
      name: task.name,
      category: task.category,
      duration: String(task.duration ?? 60),
      color: task.color ?? '#3f8f63',
      notes: task.notes ?? '',
    });
    setDialogOpen(true);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">

      {/* Header */}
      <div className="border-b bg-card px-5 py-4 flex items-center gap-3 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define the tasks your crew performs. These populate the Workflow assignment dropdown.
          </p>
        </div>
        <Badge variant="secondary">{sortedTasks.length} tasks</Badge>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={openAdd} data-testid="button-add-task">
          <Plus className="h-3.5 w-3.5" /> Add Task
        </Button>
      </div>

      {/* Search */}
      <div className="border-b bg-muted/20 px-5 py-2.5 shrink-0">
        <Input
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-sm text-sm"
          data-testid="input-search-tasks"
        />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl border bg-muted/40" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {search ? `No tasks match "${search}"` : 'No tasks yet'}
              </p>
              {!search && (
                <p className="text-xs text-muted-foreground mt-1">
                  Add your first task to start building your crew's assignment library.
                </p>
              )}
            </div>
            {!search && (
              <Button size="sm" onClick={openAdd} className="mt-2">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add your first task
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {filteredTasks.map((task, index) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm hover:shadow-md transition-shadow group"
                data-testid={`row-task-${task.id}`}
              >
                {/* Color swatch */}
                <div
                  className="h-9 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: task.color ?? '#6b7280' }}
                />

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{task.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{task.category}</Badge>
                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDuration(task.duration)}
                    </span>
                    {task.notes && (
                      <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{task.notes}</span>
                    )}
                  </div>
                </div>

                {/* Reorder */}
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveTask(task.id, 'up')}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move up"
                    data-testid={`button-move-up-${task.id}`}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={index === filteredTasks.length - 1}
                    onClick={() => moveTask(task.id, 'down')}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move down"
                    data-testid={`button-move-down-${task.id}`}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(task)}
                    data-testid={`button-edit-task-${task.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteTask(task)}
                    data-testid={`button-delete-task-${task.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingTaskId(null); setDraft(defaultDraft); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? 'Edit Task' : 'Add Task'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Task name <span className="text-destructive">*</span></label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Mow fairways, Irrigation check, Edge cart paths"
                className="mt-1"
                autoFocus
                data-testid="input-task-name"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <div className="mt-1 flex gap-2">
                <Input
                  list="category-presets"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  placeholder="Category"
                  className="flex-1"
                  data-testid="input-task-category"
                />
                <datalist id="category-presets">
                  {[...new Set([...CATEGORY_PRESETS, ...categories])].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Estimated duration (minutes)</label>
              <Input
                type="number"
                min="1"
                value={draft.duration}
                onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
                className="mt-1"
                data-testid="input-task-duration"
              />
              {Number(draft.duration) > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDuration(Number(draft.duration))}</p>
              )}
            </div>

            {/* Color */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Color</label>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft({ ...draft, color: c })}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${draft.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
                <input
                  type="color"
                  value={draft.color}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                  className="h-7 w-7 rounded-full border-2 border-border cursor-pointer bg-transparent p-0 overflow-hidden"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes <span className="text-muted-foreground/60">(optional)</span></label>
              <Textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Setup instructions, equipment needed, frequency reminders…"
                className="mt-1 min-h-20 resize-none"
                data-testid="input-task-notes"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {editingTaskId && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  const task = taskList.find((t) => t.id === editingTaskId);
                  if (task) deleteTask(task);
                  setDialogOpen(false);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
            )}
            <div className={`flex gap-2 ${editingTaskId ? '' : 'ml-auto'}`}>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => void saveTask()} disabled={isSaving || !draft.name.trim()} data-testid="button-save-task">
                {isSaving ? 'Saving…' : editingTaskId ? 'Save Changes' : 'Add Task'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

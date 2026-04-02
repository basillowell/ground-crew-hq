import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DataTable, PageHeader, SearchFilter } from '@/components/shared';
import { ArrowDown, ArrowUp, Clock3, Layers3, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { loadTasks, saveTasks } from '@/lib/dataStore';
import type { Task } from '@/data/seedData';

type SortMode = 'priority' | 'name' | 'category' | 'duration-asc' | 'duration-desc';
type TaskStatus = 'active' | 'inactive' | 'archived';

type TaskDraft = {
  id: string;
  name: string;
  category: string;
  duration: string;
  color: string;
  icon: string;
  status: TaskStatus;
  skillTags: string;
  equipmentTags: string;
  notes: string;
};

const defaultDraft: TaskDraft = {
  id: '',
  name: '',
  category: 'Mowing',
  duration: '60',
  color: '#3f8f63',
  icon: 'TK',
  status: 'active',
  skillTags: '',
  equipmentTags: '',
  notes: '',
};

function makeId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `t-${crypto.randomUUID()}`
    : `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTask(task: Task, index: number): Task & Required<Pick<Task, 'status' | 'priority' | 'skillTags' | 'equipmentTags' | 'notes'>> {
  return {
    ...task,
    status: task.status ?? 'active',
    priority: task.priority ?? index + 1,
    skillTags: task.skillTags ?? [],
    equipmentTags: task.equipmentTags ?? [],
    notes: task.notes ?? '',
  };
}

function statusBadgeVariant(status: TaskStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'inactive') return 'secondary';
  return 'outline';
}

export default function TasksCatalogPage() {
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(defaultDraft);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  useEffect(() => {
    setTaskList(loadTasks().map(normalizeTask));
  }, []);

  const categories = useMemo(
    () => [...new Set(taskList.map((task) => task.category))].sort((left, right) => left.localeCompare(right)),
    [taskList],
  );

  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = taskList
      .map(normalizeTask)
      .filter((task) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          task.name.toLowerCase().includes(normalizedSearch) ||
          task.category.toLowerCase().includes(normalizedSearch) ||
          task.skillTags.some((tag) => tag.toLowerCase().includes(normalizedSearch)) ||
          task.equipmentTags.some((tag) => tag.toLowerCase().includes(normalizedSearch));
        const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        return matchesSearch && matchesCategory && matchesStatus;
      });

    next.sort((left, right) => {
      switch (sortMode) {
        case 'priority':
          return (left.priority ?? 999) - (right.priority ?? 999) || left.name.localeCompare(right.name);
        case 'name':
          return left.name.localeCompare(right.name);
        case 'category':
          return left.category.localeCompare(right.category) || (left.priority ?? 999) - (right.priority ?? 999);
        case 'duration-asc':
          return left.duration - right.duration || left.name.localeCompare(right.name);
        case 'duration-desc':
          return right.duration - left.duration || left.name.localeCompare(right.name);
      }
    });

    return next;
  }, [categoryFilter, search, sortMode, statusFilter, taskList]);

  const totalMinutes = filteredTasks.reduce((sum, task) => sum + task.duration, 0);
  const activeCount = taskList.filter((task) => normalizeTask(task, 0).status === 'active').length;
  const inactiveCount = taskList.filter((task) => normalizeTask(task, 0).status === 'inactive').length;
  const archivedCount = taskList.filter((task) => normalizeTask(task, 0).status === 'archived').length;
  const selectedTasks = taskList.filter((task) => selectedIds.includes(task.id)).map(normalizeTask);

  function persistTasks(nextTasks: Task[]) {
    const normalized = nextTasks.map(normalizeTask).sort((left, right) => (left.priority ?? 999) - (right.priority ?? 999));
    const resequenced = normalized.map((task, index) => ({ ...task, priority: index + 1 }));
    setTaskList(resequenced);
    saveTasks(resequenced);
  }

  function openAddDialog() {
    setEditingTaskId(null);
    setDraft(defaultDraft);
    setDialogOpen(true);
  }

  function openEditDialog(task: Task) {
    const normalized = normalizeTask(task, 0);
    setEditingTaskId(task.id);
    setDraft({
      id: normalized.id,
      name: normalized.name,
      category: normalized.category,
      duration: String(normalized.duration),
      color: normalized.color,
      icon: normalized.icon,
      status: normalized.status,
      skillTags: normalized.skillTags.join(', '),
      equipmentTags: normalized.equipmentTags.join(', '),
      notes: normalized.notes,
    });
    setDialogOpen(true);
  }

  function parseTags(value: string) {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function handleSaveTask() {
    if (!draft.name.trim() || !draft.category.trim()) return;

    const existing = editingTaskId ? taskList.find((task) => task.id === editingTaskId) : undefined;
    const nextTask: Task = {
      id: editingTaskId ?? makeId(),
      name: draft.name.trim(),
      category: draft.category.trim(),
      duration: Number(draft.duration || 0),
      color: draft.color,
      icon: draft.icon.trim() || 'TK',
      status: draft.status,
      priority: existing?.priority ?? taskList.length + 1,
      skillTags: parseTags(draft.skillTags),
      equipmentTags: parseTags(draft.equipmentTags),
      notes: draft.notes.trim(),
    };

    const nextTasks = editingTaskId
      ? taskList.map((task) => (task.id === editingTaskId ? nextTask : task))
      : [...taskList, nextTask];

    persistTasks(nextTasks);
    setDialogOpen(false);
    setDraft(defaultDraft);
    toast(editingTaskId ? 'Task updated' : 'Task added', {
      description: `${nextTask.name} is ready for scheduling and workflow assignment.`,
    });
  }

  function handleDeleteTask(taskId: string) {
    const task = taskList.find((entry) => entry.id === taskId);
    const nextTasks = taskList.filter((entry) => entry.id !== taskId);
    persistTasks(nextTasks);
    setSelectedIds((current) => current.filter((id) => id !== taskId));
    toast('Task deleted', {
      description: task ? `${task.name} has been removed from the task catalog.` : 'Task removed.',
    });
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedIds((current) => (current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]));
  }

  function toggleSelectAllFiltered(checked: boolean) {
    setSelectedIds(checked ? filteredTasks.map((task) => task.id) : []);
  }

  function applyBulkStatus(status: TaskStatus) {
    if (selectedIds.length === 0) return;
    persistTasks(taskList.map((task) => (selectedIds.includes(task.id) ? { ...task, status } : task)));
    toast('Tasks updated', {
      description: `${selectedIds.length} task${selectedIds.length === 1 ? '' : 's'} moved to ${status}.`,
    });
  }

  function bulkDeleteSelected() {
    if (selectedIds.length === 0) return;
    persistTasks(taskList.filter((task) => !selectedIds.includes(task.id)));
    toast('Tasks deleted', {
      description: `${selectedIds.length} task${selectedIds.length === 1 ? '' : 's'} removed from the catalog.`,
    });
    setSelectedIds([]);
  }

  function moveTask(taskId: string, direction: 'up' | 'down') {
    const ordered = [...taskList].map(normalizeTask).sort((left, right) => (left.priority ?? 999) - (right.priority ?? 999));
    const index = ordered.findIndex((task) => task.id === taskId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
    persistTasks(ordered);
  }

  const allFilteredSelected = filteredTasks.length > 0 && filteredTasks.every((task) => selectedIds.includes(task.id));

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <PageHeader
        title="Task Management"
        subtitle="Bulk-manage, prioritize, and enrich the task catalog that drives scheduling, workflow assignment, and operational setup."
        badge={<Badge variant="secondary">{taskList.length} tasks</Badge>}
        action={{ label: 'Add Task', onClick: openAddDialog, icon: <Plus className="h-3.5 w-3.5" /> }}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Catalog</p>
              <p className="mt-2 text-2xl font-semibold">{taskList.length}</p>
            </div>
            <Tag className="h-5 w-5 text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Active</p>
              <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
            </div>
            <Badge>Ready</Badge>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Needs Review</p>
              <p className="mt-2 text-2xl font-semibold">{inactiveCount}</p>
            </div>
            <Badge variant="secondary">Inactive</Badge>
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

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr]">
              <SearchFilter value={search} onChange={setSearch} placeholder="Search tasks, skills, equipment, or categories..." />
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | TaskStatus)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                <option value="priority">Sort by priority</option>
                <option value="category">Sort by category</option>
                <option value="name">Sort by name</option>
                <option value="duration-asc">Shortest duration</option>
                <option value="duration-desc">Longest duration</option>
              </select>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Checkbox checked={allFilteredSelected} onCheckedChange={(checked) => toggleSelectAllFiltered(Boolean(checked))} />
                <div>
                  <div className="text-sm font-medium">{selectedIds.length} selected</div>
                  <div className="text-xs text-muted-foreground">Archive, delete, or change status for multiple tasks at once.</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => applyBulkStatus('active')} disabled={selectedIds.length === 0}>Set Active</Button>
                <Button variant="outline" size="sm" onClick={() => applyBulkStatus('inactive')} disabled={selectedIds.length === 0}>Set Inactive</Button>
                <Button variant="outline" size="sm" onClick={() => applyBulkStatus('archived')} disabled={selectedIds.length === 0}>Archive</Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={bulkDeleteSelected} disabled={selectedIds.length === 0}>Delete Selected</Button>
              </div>
            </div>
          </Card>

          <DataTable
            columns={[
              {
                key: 'select',
                header: '',
                className: 'w-[44px]',
                render: (task) => (
                  <Checkbox
                    checked={selectedIds.includes(task.id)}
                    onCheckedChange={() => toggleTaskSelection(task.id)}
                    onClick={(event) => event.stopPropagation()}
                  />
                ),
              },
              {
                key: 'priority',
                header: 'Order',
                className: 'w-[110px]',
                render: (task) => {
                  const normalized = normalizeTask(task, 0);
                  return (
                    <div className="flex items-center gap-1">
                      <span className="min-w-8 text-sm font-semibold">#{normalized.priority}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); moveTask(task.id, 'up'); }}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); moveTask(task.id, 'down'); }}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                },
              },
              {
                key: 'task',
                header: 'Task',
                render: (task) => (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-background text-sm font-semibold">
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
                key: 'status',
                header: 'Status',
                render: (task) => <Badge variant={statusBadgeVariant(normalizeTask(task, 0).status)}>{normalizeTask(task, 0).status}</Badge>,
              },
              {
                key: 'duration',
                header: 'Duration',
                render: (task) => <span className="font-medium">{task.duration} min</span>,
              },
              {
                key: 'tags',
                header: 'Tags',
                render: (task) => {
                  const normalized = normalizeTask(task, 0);
                  return (
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {normalized.skillTags.slice(0, 2).map((tag) => (
                          <Badge key={`skill-${task.id}-${tag}`} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {normalized.equipmentTags.slice(0, 2).map((tag) => (
                          <Badge key={`equipment-${task.id}-${tag}`} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'actions',
                header: 'Actions',
                className: 'w-[170px]',
                render: (task) => (
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="gap-1" onClick={(event) => { event.stopPropagation(); openEditDialog(task); }}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={(event) => { event.stopPropagation(); handleDeleteTask(task.id); }}>
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
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Review Snapshot</h3>
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Archived Tasks</div>
                <div className="mt-2 text-3xl font-semibold">{archivedCount}</div>
                <p className="mt-2 text-sm text-muted-foreground">Archive old workflows instead of deleting them when you want a cleaner workflow catalog.</p>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Selected for Review</div>
                <div className="mt-2 text-3xl font-semibold">{selectedIds.length}</div>
                <p className="mt-2 text-sm text-muted-foreground">Use bulk status controls to clean up seasonal or specialty tasks faster.</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold">Selected Task Notes</h3>
            <div className="mt-4 space-y-3">
              {selectedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Select one or more tasks to review statuses, tags, and notes together.</p>
              ) : (
                selectedTasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="rounded-2xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{task.name}</div>
                      <Badge variant={statusBadgeVariant((task.status ?? 'active') as TaskStatus)}>{task.status ?? 'active'}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{task.category} · {task.duration} minutes</div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(task.skillTags ?? []).map((tag) => (
                        <Badge key={`${task.id}-skill-${tag}`} variant="secondary">{tag}</Badge>
                      ))}
                      {(task.equipmentTags ?? []).map((tag) => (
                        <Badge key={`${task.id}-equipment-${tag}`} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                    {task.notes ? <p className="mt-3 text-sm text-muted-foreground">{task.notes}</p> : null}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
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
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as TaskStatus }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Color</label>
                <input type="color" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Icon</label>
                <Input value={draft.icon} onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Skill Tags</label>
                <Input value={draft.skillTags} onChange={(event) => setDraft((current) => ({ ...current, skillTags: event.target.value }))} className="mt-1" placeholder="Greens, Licensed, Detail" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Equipment Tags</label>
                <Input value={draft.equipmentTags} onChange={(event) => setDraft((current) => ({ ...current, equipmentTags: event.target.value }))} className="mt-1" placeholder="Sprayer, Utility Vehicle" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Task Notes</label>
                <Textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} className="mt-1 min-h-24" placeholder="Shift notes, compliance reminders, or setup instructions." />
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Preview</p>
              <div className="mt-3 rounded-xl border bg-background px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold">{draft.icon || 'TK'}</div>
                  <div className="flex-1">
                    <div className="font-medium">{draft.name || 'Task name preview'}</div>
                    <div className="text-xs text-muted-foreground">{draft.category || 'Category'} · {draft.duration || '0'} minutes</div>
                  </div>
                  <Badge variant={statusBadgeVariant(draft.status)}>{draft.status}</Badge>
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: draft.color }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {parseTags(draft.skillTags).map((tag) => (
                    <Badge key={`preview-skill-${tag}`} variant="secondary">{tag}</Badge>
                  ))}
                  {parseTags(draft.equipmentTags).map((tag) => (
                    <Badge key={`preview-equipment-${tag}`} variant="outline">{tag}</Badge>
                  ))}
                </div>
                {draft.notes ? <p className="mt-3 text-sm text-muted-foreground">{draft.notes}</p> : null}
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

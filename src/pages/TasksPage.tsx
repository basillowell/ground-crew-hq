import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeader, SearchFilter } from '@/components/shared';
import { GripVertical } from 'lucide-react';
import { loadTasks, saveTasks } from '@/lib/dataStore';
import type { Task } from '@/data/seedData';

export default function TasksPage() {
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    category: 'Mowing',
    duration: '60',
    color: '#3f8f63',
    icon: '🛠️',
  });

  useEffect(() => {
    setTaskList(loadTasks());
  }, []);

  const categories = useMemo(() => [...new Set(taskList.map((task) => task.category))], [taskList]);
  const filtered = useMemo(
    () => taskList.filter((task) => task.name.toLowerCase().includes(search.toLowerCase())),
    [search, taskList],
  );

  function handleAddTask() {
    if (!draft.name.trim()) return;

    const nextTasks = [
      ...taskList,
      {
        id: `t${Date.now()}`,
        name: draft.name.trim(),
        category: draft.category.trim(),
        duration: Number(draft.duration || 0),
        color: draft.color,
        icon: draft.icon,
      },
    ];

    setTaskList(nextTasks);
    saveTasks(nextTasks);
    setDialogOpen(false);
    setDraft({ name: '', category: 'Mowing', duration: '60', color: '#3f8f63', icon: '🛠️' });
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <PageHeader title="Task Management" action={{ label: 'Add Task', onClick: () => setDialogOpen(true) }} />
      <SearchFilter value={search} onChange={setSearch} placeholder="Search tasks..." className="mb-4" />

      {categories.map(cat => {
        const catTasks = filtered.filter(t => t.category === cat);
        if (catTasks.length === 0) return null;
        return (
          <div key={cat} className="mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h3>
            <div className="space-y-1.5">
              {catTasks.map(task => (
                <Card key={task.id} className="p-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
                  <span className="text-lg">{task.icon}</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{task.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{task.duration}m</Badge>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: task.color }} />
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Task Name</label>
              <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Duration</label>
              <Input value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Color</label>
              <input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Icon</label>
              <Input value={draft.icon} onChange={(event) => setDraft({ ...draft, icon: event.target.value })} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTask}>Save Task</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { tasks, groups } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search, GripVertical } from 'lucide-react';
import { useState } from 'react';

export default function TasksPage() {
  const [search, setSearch] = useState('');
  const categories = [...new Set(tasks.map(t => t.category))];
  const filtered = tasks.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Task Management</h2>
        <Button size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Task</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

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
    </div>
  );
}

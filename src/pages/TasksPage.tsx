import { tasks } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, SearchFilter } from '@/components/shared';
import { GripVertical } from 'lucide-react';
import { useState } from 'react';

export default function TasksPage() {
  const [search, setSearch] = useState('');
  const categories = [...new Set(tasks.map(t => t.category))];
  const filtered = tasks.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <PageHeader title="Task Management" action={{ label: 'Add Task' }} />
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
    </div>
  );
}

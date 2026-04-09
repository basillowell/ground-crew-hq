import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Calendar, Copy, Play, Pause, Clock, Users, ListChecks, ChevronRight } from 'lucide-react';
import { scheduleTemplates, type ScheduleTemplate } from '@/data/multiPropertyData';
import { toast } from '@/components/ui/sonner';

const seasonColors: Record<string, string> = {
  spring: 'bg-green-100 text-green-800 border-green-200',
  summer: 'bg-amber-100 text-amber-800 border-amber-200',
  fall: 'bg-orange-100 text-orange-800 border-orange-200',
  winter: 'bg-blue-100 text-blue-800 border-blue-200',
  'year-round': 'bg-purple-100 text-purple-800 border-purple-200',
};

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScheduleTemplates({ onApply }: { onApply?: (template: ScheduleTemplate) => void }) {
  const [templates, setTemplates] = useState(scheduleTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);

  function toggleActive(id: string) {
    setTemplates((prev) =>
      prev.map((t) => t.id === id ? { ...t, isActive: !t.isActive } : t)
    );
  }

  function handleApply(template: ScheduleTemplate) {
    onApply?.(template);
    toast.success(`Applied "${template.name}" template`, {
      description: `${template.shifts.reduce((a, s) => a + s.count, 0)} crew positions populated across ${template.daysOfWeek.length} days.`,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Schedule Templates</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Reusable weekly patterns that auto-populate shifts and tasks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={`overflow-hidden border transition-all hover:shadow-md cursor-pointer ${template.isActive ? 'border-primary/30' : ''}`}
            onClick={() => setSelectedTemplate(template)}
          >
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">{template.name}</h4>
                  <Badge variant="outline" className={`text-[10px] border ${seasonColors[template.season]}`}>
                    {template.season}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {template.isActive && (
                    <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Active</Badge>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {template.daysOfWeek.map((d) => dayLabels[d]).join(', ')}
                </span>
              </div>

              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {template.shifts.reduce((a, s) => a + s.count, 0)} positions
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <ListChecks className="h-3 w-3" />
                  {template.tasks.length} tasks
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1 h-8 text-xs"
                  onClick={(e) => { e.stopPropagation(); handleApply(template); }}
                >
                  <Play className="h-3 w-3 mr-1" /> Apply to Week
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent className="max-w-lg">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedTemplate.name}
                  <Badge variant="outline" className={`text-[10px] ${seasonColors[selectedTemplate.season]}`}>
                    {selectedTemplate.season}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active</span>
                  <Switch
                    checked={selectedTemplate.isActive}
                    onCheckedChange={() => {
                      toggleActive(selectedTemplate.id);
                      setSelectedTemplate((prev) => prev ? { ...prev, isActive: !prev.isActive } : null);
                    }}
                  />
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Shift Coverage</h4>
                  <div className="space-y-1.5">
                    {selectedTemplate.shifts.map((shift, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                        <span className="font-medium">{shift.role}</span>
                        <span className="text-muted-foreground">{shift.shiftStart}–{shift.shiftEnd}</span>
                        <Badge variant="secondary" className="text-[10px]">{shift.count}x</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Task Assignments</h4>
                  <div className="space-y-1.5">
                    {selectedTemplate.tasks.map((task, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                        <span className="font-medium">{task.taskName}</span>
                        <span className="text-muted-foreground">{dayLabels[task.dayOfWeek]} {task.startTime}</span>
                        <span className="text-xs text-muted-foreground">{task.duration}min</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button className="w-full" onClick={() => { handleApply(selectedTemplate); setSelectedTemplate(null); }}>
                  <Play className="h-4 w-4 mr-2" /> Apply This Template
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

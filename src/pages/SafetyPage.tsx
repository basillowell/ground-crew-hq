import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, FileText, CheckCircle, AlertTriangle, Users } from 'lucide-react';

const safetyItems = [
  { title: 'Chemical Handling Training', status: 'completed', assignees: 6, dueDate: '2024-03-01' },
  { title: 'Equipment Safety Orientation', status: 'in-progress', assignees: 3, dueDate: '2024-04-01' },
  { title: 'Heat Stress Prevention', status: 'upcoming', assignees: 8, dueDate: '2024-05-15' },
  { title: 'First Aid Certification', status: 'completed', assignees: 4, dueDate: '2024-02-15' },
  { title: 'PPE Compliance Check', status: 'overdue', assignees: 8, dueDate: '2024-03-10' },
];

const incidents = [
  { date: '2024-03-15', description: 'Minor cut during edging work', employee: 'David Park', severity: 'low' },
  { date: '2024-02-28', description: 'Near-miss with utility vehicle', employee: 'Carlos Rivera', severity: 'medium' },
];

const statusVariant = { completed: 'success', 'in-progress': 'info', upcoming: 'neutral', overdue: 'danger' } as const;

export default function SafetyPage() {
  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h2 className="text-lg font-semibold mb-4">Safety Management</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 text-center">
          <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold">12</div>
          <div className="text-xs text-muted-foreground">Trainings Completed</div>
        </Card>
        <Card className="p-4 text-center">
          <AlertTriangle className="h-8 w-8 text-warning mx-auto mb-2" />
          <div className="text-2xl font-bold">1</div>
          <div className="text-xs text-muted-foreground">Overdue Items</div>
        </Card>
        <Card className="p-4 text-center">
          <FileText className="h-8 w-8 text-info mx-auto mb-2" />
          <div className="text-2xl font-bold">2</div>
          <div className="text-xs text-muted-foreground">Incidents (90 days)</div>
        </Card>
        <Card className="p-4 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <div className="text-2xl font-bold">95%</div>
          <div className="text-xs text-muted-foreground">Compliance Rate</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Training Programs</h3>
          <div className="space-y-2">
            {safetyItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.assignees} employees • Due: {item.dueDate}</div>
                </div>
                <Badge variant={statusVariant[item.status as keyof typeof statusVariant] === 'success' ? 'default' : 'outline'} className="text-xs shrink-0 capitalize">
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Recent Incidents</h3>
          <div className="space-y-2">
            {incidents.map((inc, i) => (
              <div key={i} className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{inc.description}</span>
                  <Badge variant="outline" className="text-xs capitalize">{inc.severity}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{inc.employee} • {inc.date}</div>
              </div>
            ))}
            {incidents.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">No recent incidents</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

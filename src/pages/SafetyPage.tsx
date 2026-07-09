import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, FileText, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';

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
  const [showLogTalkModal, setShowLogTalkModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [talkDraft, setTalkDraft] = useState({
    topic: '',
    content: '',
    presenter: '',
    date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    document.title = 'Safety — Ground Crew HQ';
  }, []);

  const closeLogTalkModal = (forceDiscard = false) => {
    if (!forceDiscard && isDirty) {
      const shouldDiscard = window.confirm('You have unsaved changes. Discard?');
      if (!shouldDiscard) return;
    }
    setShowLogTalkModal(false);
    setIsDirty(false);
    setTalkDraft({
      topic: '',
      content: '',
      presenter: '',
      date: new Date().toISOString().slice(0, 10),
    });
  };

  useEffect(() => {
    if (!showLogTalkModal || !isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, showLogTalkModal]);

  if (safetyItems.length === 0) {
    return (
      <div className="p-4 mx-auto max-w-5xl">
        <EmptyState
          icon={Shield}
          title="No safety talks recorded"
          description="Log your first toolbox talk to keep a safety record."
          actionLabel="Log Safety Talk"
          onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowLogTalkModal(true)}>Log Safety Talk</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-xl border bg-card p-4 text-center">
          <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold">12</div>
          <div className="text-xs text-muted-foreground">Trainings Completed</div>
        </Card>
        <Card className="rounded-xl border bg-card p-4 text-center">
          <AlertTriangle className="h-8 w-8 text-warning mx-auto mb-2" />
          <div className="text-2xl font-bold">1</div>
          <div className="text-xs text-muted-foreground">Overdue Items</div>
        </Card>
        <Card className="rounded-xl border bg-card p-4 text-center">
          <FileText className="h-8 w-8 text-info mx-auto mb-2" />
          <div className="text-2xl font-bold">2</div>
          <div className="text-xs text-muted-foreground">Incidents (90 days)</div>
        </Card>
        <Card className="rounded-xl border bg-card p-4 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <div className="text-2xl font-bold">95%</div>
          <div className="text-xs text-muted-foreground">Compliance Rate</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-xl border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Training Programs</h3>
          <div className="space-y-2">
            {safetyItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-3">
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

        <Card className="rounded-xl border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent Incidents</h3>
          <div className="space-y-2">
            {incidents.map((inc, i) => (
              <div key={i} className="rounded-xl border bg-card p-3">
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

      <Dialog
        open={showLogTalkModal}
        onOpenChange={(open) => {
          if (open) {
            setShowLogTalkModal(true);
            return;
          }
          closeLogTalkModal();
        }}
      >
        <DialogContent aria-describedby="dialog-desc" className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Safety Talk</DialogTitle>
            <DialogDescription id="dialog-desc" className="sr-only">
              Log a safety talk topic, presenter, date, and notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Topic</label>
              <Input
                value={talkDraft.topic}
                onChange={(event) => {
                  setIsDirty(true);
                  setTalkDraft((current) => ({ ...current, topic: event.target.value }));
                }}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Presented By</label>
              <Input
                value={talkDraft.presenter}
                onChange={(event) => {
                  setIsDirty(true);
                  setTalkDraft((current) => ({ ...current, presenter: event.target.value }));
                }}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <DateInput
                value={talkDraft.date}
                onChange={(event) => {
                  setIsDirty(true);
                  setTalkDraft((current) => ({ ...current, date: event.target.value }));
                }}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea
                value={talkDraft.content}
                onChange={(event) => {
                  setIsDirty(true);
                  setTalkDraft((current) => ({ ...current, content: event.target.value }));
                }}
                className="mt-1 min-h-24"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => closeLogTalkModal()}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-9 gap-1.5 rounded-lg"
              onClick={() => {
                toast.success('Safety talk logged');
                closeLogTalkModal(true);
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

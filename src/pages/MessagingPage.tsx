import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Mail, Phone, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { PageSkeleton } from '@/components/PageSkeleton';
import { useEmployees } from '@/lib/supabase-queries';

export default function MessagingPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const { currentPropertyId, currentUser } = useOrgProfile();
  const { data: liveEmployees = [], isLoading: employeesLoading } = useEmployees(undefined, currentUser?.orgId ?? undefined, 'all');
  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || undefined;

  // TODO: Restore inbox history and realtime updates when a typed chat table is added to the live schema.

  const employees = useMemo(
    () =>
      liveEmployees
        .filter((employee) => propertyScope === 'all' || !propertyScope || employee.propertyId === propertyScope)
        .map((employee) => ({
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          status: employee.status,
        })),
    [liveEmployees, propertyScope],
  );

  const filtered = useMemo(
    () =>
      employees.filter(
        (employee) =>
          `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(search.toLowerCase()) &&
          employee.status === 'active',
      ),
    [employees, search],
  );

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const send = () => {
    toast({ title: 'Message Sent', description: `Sent to ${selected.length} recipients` });
    setSelected([]);
    setSubject('');
    setBody('');
  };

  if (!currentUser?.orgId || employeesLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Recipients */}
      <div className="w-72 border-r bg-card overflow-auto p-3">
        <h3 className="text-sm font-semibold mb-3">Recipients</h3>
        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-7 text-xs" />
        </div>
        <div className="mb-3">
          <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setSelected(filtered.map(e => e.id))}>
            Select All
          </Button>
        </div>
        <div className="space-y-1">
          {filtered.map(emp => (
            <div
              key={emp.id}
              onClick={() => toggle(emp.id)}
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm ${
                selected.includes(emp.id) ? 'bg-accent' : 'hover:bg-muted/50'
              }`}
            >
              <Checkbox checked={selected.includes(emp.id)} />
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                {emp.firstName[0]}{emp.lastName[0]}
              </div>
              <span className="text-xs">{emp.firstName} {emp.lastName}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Compose */}
      <div className="flex-1 p-6 flex flex-col max-w-3xl">

        <div className="mb-4 rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Recent Messages</div>
              <div className="text-xs text-muted-foreground">Inbox history for the current signed-in user.</div>
            </div>
            <Badge variant="outline">Coming soon</Badge>
          </div>
          <div className="mt-3 space-y-2">
            <div className="text-sm text-muted-foreground">
              Message history will appear here when inbox delivery is available.
            </div>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selected.map(id => {
              const emp = employees.find(e => e.id === id)!;
              return (
                <Badge key={id} variant="secondary" className="gap-1 pr-1">
                  {emp.firstName} {emp.lastName}
                  <button onClick={() => toggle(id)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <Button variant="outline" size="sm" className="gap-1 text-xs"><Mail className="h-3 w-3" /> Email</Button>
          <Button variant="outline" size="sm" className="gap-1 text-xs"><Phone className="h-3 w-3" /> Text</Button>
        </div>

        <Input
          placeholder="Subject"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="mb-3"
        />

        <Textarea
          placeholder="Type your message..."
          value={body}
          onChange={e => setBody(e.target.value)}
          className="flex-1 min-h-[200px] mb-4 resize-none"
        />

        <div className="flex justify-end">
          <Button onClick={send} disabled={selected.length === 0 || !body} className="gap-1.5">
            <Send className="h-4 w-4" /> Send Message
          </Button>
        </div>
      </div>
    </div>
  );
}


import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, Leaf, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DATA_STORE_UPDATED_EVENT, loadAppUsers, loadCurrentAppUserId, loadProgramSettings, saveCurrentAppUserId } from '@/lib/dataStore';
import type { AppUser } from '@/data/seedData';

const launchSteps = [
  'Select the correct client workspace',
  'Choose the user entering operations today',
  'Go straight into Command Center or Workflow',
];

export default function LaunchWorkspacePage() {
  const navigate = useNavigate();
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [clientName, setClientName] = useState('Ground Crew HQ');
  const [appName, setAppName] = useState('WorkForce App');
  const [shellImageUrl, setShellImageUrl] = useState('');

  useEffect(() => {
    const refresh = () => {
      const settings = loadProgramSettings()[0];
      const users = loadAppUsers().filter((entry) => entry.status === 'active');
      const savedUserId = loadCurrentAppUserId();
      const defaultUser = users.find((entry) => entry.id === savedUserId) || users[0];
      setAppUsers(users);
      setSelectedUserId(defaultUser?.id || '');
      setClientName(settings?.clientLabel || settings?.organizationName || 'Ground Crew HQ');
      setAppName(settings?.appName || 'WorkForce App');
      setShellImageUrl(settings?.shellImageUrl || settings?.logoUrl || '');
    };

    refresh();
    window.addEventListener(DATA_STORE_UPDATED_EVENT, refresh as EventListener);
    window.addEventListener('program-setup-updated', refresh as EventListener);
    window.addEventListener('user-session-updated', refresh as EventListener);
    return () => {
      window.removeEventListener(DATA_STORE_UPDATED_EVENT, refresh as EventListener);
      window.removeEventListener('program-setup-updated', refresh as EventListener);
      window.removeEventListener('user-session-updated', refresh as EventListener);
    };
  }, []);

  const selectedUser = useMemo(
    () => appUsers.find((entry) => entry.id === selectedUserId),
    [appUsers, selectedUserId],
  );

  const launchTo = (route: string) => {
    if (selectedUserId) {
      saveCurrentAppUserId(selectedUserId);
      window.dispatchEvent(new CustomEvent('user-session-updated'));
    }
    navigate(route);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,245,1))]">
      <header
        className="border-b"
        style={{
          backgroundImage: shellImageUrl
            ? `linear-gradient(120deg, rgba(15,23,42,0.86), rgba(15,23,42,0.62)), url(${shellImageUrl})`
            : 'linear-gradient(120deg, rgba(32,49,39,1), rgba(47,133,90,0.94))',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 backdrop-blur">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <div className="text-white">
              <div className="text-lg font-bold">{appName}</div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/70">{clientName}</div>
            </div>
          </div>
          <Button onClick={() => launchTo('/app/dashboard')} className="gap-1.5">
            Enter App <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <div className="max-w-2xl">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            {clientName}
            <br />
            <span className="text-primary">{appName}</span>
          </h1>
          <p className="mb-8 text-lg text-muted-foreground">
            A calmer launch experience for daily operations. Pick the right user, enter the right workspace, and move directly into today&apos;s work.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {launchSteps.map((step) => (
              <div key={step} className="rounded-2xl border bg-card/80 px-4 py-4 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{step}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-primary/15 bg-card/95 p-5 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Launch Profile
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose the person entering the workspace. Their role, notifications, and navigation context will follow them into the app.
          </p>
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border bg-muted/40 px-3 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Client workspace</div>
              <div className="mt-2 font-semibold">{clientName}</div>
              <div className="text-xs text-muted-foreground">{appName}</div>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Login as</div>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Choose a user profile" />
                </SelectTrigger>
                <SelectContent>
                  {appUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName} · {user.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedUser ? (
              <div className="rounded-xl border bg-background px-3 py-3">
                <div className="text-sm font-semibold">{selectedUser.fullName}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedUser.title} · {selectedUser.department} · {selectedUser.role.toUpperCase()}
                </div>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="gap-2" onClick={() => launchTo('/app/dashboard')}>
                Command Center <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => launchTo('/app/workboard')}>
                Go to Workflow
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-muted-foreground">
          {appName} · {clientName} · Client-specific workforce operations
        </div>
      </footer>
    </div>
  );
}

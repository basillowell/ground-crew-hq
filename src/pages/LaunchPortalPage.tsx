import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DATA_STORE_UPDATED_EVENT,
  loadAppUsers,
  loadCurrentAppUserId,
  loadProgramSettings,
  saveCurrentAppUserId,
} from '@/lib/dataStore';
import type { AppUser } from '@/data/seedData';

export default function LaunchPortalPage() {
  const navigate = useNavigate();
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [clientName, setClientName] = useState('Ground Crew HQ');
  const [appName, setAppName] = useState('WorkForce App');
  const [shellImageUrl, setShellImageUrl] = useState('');

  useEffect(() => {
    const refresh = () => {
      const settings = loadProgramSettings()[0];
      const users = loadAppUsers().filter((entry) => entry.status === 'active');
      const savedUserId = loadCurrentAppUserId();
      const employees = users.filter((entry) => entry.role !== 'admin');
      const admins = users.filter((entry) => entry.role === 'admin');

      setAppUsers(users);
      setSelectedEmployeeId(
        employees.find((entry) => entry.id === savedUserId)?.id || employees[0]?.id || '',
      );
      setSelectedAdminId(
        admins.find((entry) => entry.id === savedUserId)?.id || admins[0]?.id || '',
      );
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

  const employeeUsers = useMemo(
    () => appUsers.filter((entry) => entry.role !== 'admin'),
    [appUsers],
  );

  const adminUsers = useMemo(
    () => appUsers.filter((entry) => entry.role === 'admin'),
    [appUsers],
  );

  const selectedEmployee = useMemo(
    () => employeeUsers.find((entry) => entry.id === selectedEmployeeId),
    [employeeUsers, selectedEmployeeId],
  );

  const selectedAdmin = useMemo(
    () => adminUsers.find((entry) => entry.id === selectedAdminId),
    [adminUsers, selectedAdminId],
  );

  const launchAs = (userId: string) => {
    if (!userId) {
      return;
    }

    saveCurrentAppUserId(userId);
    window.dispatchEvent(new CustomEvent('user-session-updated'));
    navigate('/app/dashboard');
  };

  const scrollToAccess = () => {
    document.getElementById('launch-access')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(247,250,248,1),rgba(237,243,239,1))]">
      <header
        className="border-b border-white/10"
        style={{
          backgroundImage: shellImageUrl
            ? `linear-gradient(120deg, rgba(15,23,42,0.86), rgba(18,54,36,0.72)), url(${shellImageUrl})`
            : 'linear-gradient(120deg, rgba(18,54,36,1), rgba(30,93,62,0.92))',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">{appName}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/70">{clientName}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,420px)] lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-primary">
              Ground operations workspace
            </div>
            <h1 className="max-w-xl text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Workforce coordination for crews, properties, and daily field execution.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Ground Crew HQ gives supervisors, admins, and field teams one place to organize schedules,
              tasks, weather, and communication across every property.
            </p>
            <div className="mt-8">
              <Button size="lg" className="gap-2 px-6" onClick={scrollToAccess}>
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card id="launch-access" className="border-primary/15 bg-card/95 p-6 shadow-xl shadow-primary/5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Login and access
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose the right entry point for today. Employee and admin access stay separate so the login
              flow stays clear and direct.
            </p>

            <div className="mt-6 space-y-4">
              <Card className="border-border/70 bg-background/80 p-4 shadow-none">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  Employee Login
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  For crew members checking schedule, tasks, messages, and field activity.
                </p>
                <div className="mt-4 space-y-3">
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select employee access" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName} - {user.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedEmployee ? (
                    <div className="rounded-xl border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                      <div className="text-sm font-medium text-foreground">{selectedEmployee.fullName}</div>
                      <div>
                        {selectedEmployee.department} - {selectedEmployee.title}
                      </div>
                    </div>
                  ) : null}
                  <Button
                    className="w-full gap-2"
                    disabled={!selectedEmployeeId}
                    onClick={() => launchAs(selectedEmployeeId)}
                  >
                    Enter as Employee
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </Card>

              <Card className="border-border/70 bg-background/80 p-4 shadow-none">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Admin Login
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  For managers and administrators running operations, staffing, and reporting.
                </p>
                <div className="mt-4 space-y-3">
                  <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select admin access" />
                    </SelectTrigger>
                    <SelectContent>
                      {adminUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName} - {user.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAdmin ? (
                    <div className="rounded-xl border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                      <div className="text-sm font-medium text-foreground">{selectedAdmin.fullName}</div>
                      <div>
                        {selectedAdmin.department} - {selectedAdmin.title}
                      </div>
                    </div>
                  ) : null}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    disabled={!selectedAdminId}
                    onClick={() => launchAs(selectedAdminId)}
                  >
                    Enter as Admin
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle,
  Clock,
  LayoutDashboard,
  Leaf,
  ListChecks,
  MessageSquare,
  Shield,
  ShieldCheck,
  Smartphone,
  Users,
  Wrench,
} from 'lucide-react';
import { loadAppUsers, loadCurrentAppUserId, loadProgramSettings, saveCurrentAppUserId } from '@/lib/dataStore';
import type { AppUser } from '@/data/seedData';

const modules = [
  { title: 'Workboard', desc: 'Dispatch daily labor, sequence assignments, and hand work cleanly into the breakroom view.', icon: LayoutDashboard, route: '/app/workboard', color: 'hsl(152,55%,38%)' },
  { title: 'Scheduler', desc: 'Build crew coverage by day, department, and reusable labor pattern.', icon: Clock, route: '/app/scheduler', color: 'hsl(210,80%,52%)' },
  { title: 'Employees', desc: 'Manage roster setup, defaults, and the people that power every workflow downstream.', icon: Users, route: '/app/employees', color: 'hsl(270,60%,55%)' },
  { title: 'Tasks', desc: 'Maintain the live task catalog used by scheduling, workboard dispatching, and reporting.', icon: ListChecks, route: '/app/tasks', color: 'hsl(38,92%,50%)' },
  { title: 'Equipment', desc: 'Track fleet readiness, location, assignment, and maintenance pressure.', icon: Wrench, route: '/app/equipment', color: 'hsl(0,72%,55%)' },
  { title: 'Safety', desc: 'Keep compliance, incidents, and crew readiness visible to the operation.', icon: Shield, route: '/app/safety', color: 'hsl(25,90%,55%)' },
  { title: 'Reports', desc: 'Turn labor, application, weather, and equipment data into client-facing insight.', icon: BarChart3, route: '/app/reports', color: 'hsl(152,40%,50%)' },
  { title: 'Messaging', desc: 'Coordinate supervisors, crews, and client communications from one workspace.', icon: MessageSquare, route: '/app/messaging', color: 'hsl(200,70%,50%)' },
];

const features = [
  'Client-branded launch and workspace shell',
  'Role-based admin notifications and crew dispatch awareness',
  'Integrated scheduler, workboard, breakroom, and reports flow',
  'Weather and applications tied into planning and compliance',
  'Program setup that drives real dropdowns and workflow defaults',
  'Scalable foundation for multiple clubs and client profiles',
];

export default function LaunchpadPage() {
  const navigate = useNavigate();
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [clientName, setClientName] = useState('Ground Crew HQ');
  const [appName, setAppName] = useState('WorkForce App');
  const [shellImageUrl, setShellImageUrl] = useState('');

  useEffect(() => {
    const settings = loadProgramSettings()[0];
    const users = loadAppUsers().filter((entry) => entry.status === 'active');
    const savedUserId = loadCurrentAppUserId();
    const defaultUser = users.find((entry) => entry.id === savedUserId) || users[0];
    setAppUsers(users);
    setSelectedUserId(defaultUser?.id || '');
    setClientName(settings?.clientLabel || settings?.organizationName || 'Ground Crew HQ');
    setAppName(settings?.appName || 'WorkForce App');
    setShellImageUrl(settings?.shellImageUrl || settings?.logoUrl || '');
  }, []);

  const selectedUser = useMemo(
    () => appUsers.find((entry) => entry.id === selectedUserId),
    [appUsers, selectedUserId],
  );

  const handleLaunch = () => {
    if (selectedUserId) {
      saveCurrentAppUserId(selectedUserId);
      window.dispatchEvent(new CustomEvent('user-session-updated'));
    }
    navigate('/app/workboard');
  };

  return (
    <div className="min-h-screen bg-background">
      <header
        className="border-b"
        style={{
          backgroundImage: shellImageUrl
            ? `linear-gradient(120deg, rgba(15,23,42,0.84), rgba(15,23,42,0.64)), url(${shellImageUrl})`
            : 'linear-gradient(120deg, rgba(32,49,39,1), rgba(47,133,90,0.95))',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/15">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div className="text-white">
              <div className="font-bold text-lg">{appName}</div>
              <div className="text-xs text-white/70 uppercase tracking-[0.18em]">{clientName}</div>
            </div>
          </div>
          <Button onClick={handleLaunch} className="gap-1.5">
            Launch App <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
              {clientName},<br />
              <span className="text-foreground">powered by </span>
              <span className="text-primary">{appName}</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
              Enter a client-specific workspace with the right admin, manager, or supervisor profile already attached to the club’s brand, notifications, and daily operations flow.
            </p>
            <div className="flex gap-3">
              <Button size="lg" onClick={handleLaunch} className="gap-2">
                Enter Workspace <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/app/workboard')}>
                <Smartphone className="h-4 w-4 mr-2" /> Mobile Preview
              </Button>
            </div>
          </div>
          <Card className="border-primary/15 bg-card/95 p-5 shadow-lg">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Launch Profile
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose the user entering this club workspace. This is the starting point for scalable client-specific notifications and role-aware actions.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Client workspace</div>
                <div className="rounded-xl border bg-muted/40 px-3 py-2">
                  <div className="font-semibold">{clientName}</div>
                  <div className="text-xs text-muted-foreground">{appName}</div>
                </div>
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
              <Button className="w-full gap-2" onClick={handleLaunch}>
                Launch as {selectedUser?.fullName || 'selected user'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <section className="bg-card border-y">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                {feature}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Platform Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((module) => (
            <Card
              key={module.title}
              className="p-5 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group"
              onClick={() => navigate(module.route)}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${module.color}18` }}>
                <module.icon className="h-5 w-5" style={{ color: module.color }} />
              </div>
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">{module.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{module.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-muted-foreground">
          {appName} · {clientName} · Built for scalable client-specific workforce operations
        </div>
      </footer>
    </div>
  );
}

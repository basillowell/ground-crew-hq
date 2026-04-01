import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Clock, Users, ListChecks, Wrench, Shield,
  BarChart3, MessageSquare, Smartphone, ArrowRight, Leaf, CheckCircle
} from 'lucide-react';

const modules = [
  { title: 'Workboard', desc: 'Daily task assignment board with employee cards, drag-and-drop tasks, equipment tracking, and real-time notes.', icon: LayoutDashboard, route: '/app/workboard', color: 'hsl(152,55%,38%)' },
  { title: 'Scheduler', desc: 'Weekly employee scheduling grid with shift management, day-off tracking, and exportable views.', icon: Clock, route: '/app/scheduler', color: 'hsl(210,80%,52%)' },
  { title: 'Employees', desc: 'Full employee management with profiles, contact info, groups, wage tracking, and activation controls.', icon: Users, route: '/app/employees', color: 'hsl(270,60%,55%)' },
  { title: 'Tasks', desc: 'Task library with categories, duration estimates, color coding, and reusable templates.', icon: ListChecks, route: '/app/tasks', color: 'hsl(38,92%,50%)' },
  { title: 'Equipment', desc: 'Equipment fleet management with units, work orders, maintenance tracking, and uptime reporting.', icon: Wrench, route: '/app/equipment', color: 'hsl(0,72%,55%)' },
  { title: 'Safety', desc: 'Safety training programs, incident logging, compliance tracking, and certification management.', icon: Shield, route: '/app/safety', color: 'hsl(25,90%,55%)' },
  { title: 'Reports', desc: 'Comprehensive reporting with charts, heatmaps, filters, and export to CSV/PDF/Print.', icon: BarChart3, route: '/app/reports', color: 'hsl(152,40%,50%)' },
  { title: 'Messaging', desc: 'Send email and text messages to individuals or groups with built-in recipient management.', icon: MessageSquare, route: '/app/messaging', color: 'hsl(200,70%,50%)' },
];

const features = [
  'Real-time daily workboard for task assignment',
  'Equipment fleet tracking with QR scanning',
  'Automated scheduling & shift management',
  'Chemical application & turf management logs',
  'Mobile-first field access for crews',
  'Comprehensive labor & operations reporting',
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="bg-card border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">GroundsCrew</span>
          </div>
          <Button onClick={() => navigate('/app/workboard')} className="gap-1.5">
            Launch App <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            Golf Course Maintenance,<br />
            <span className="text-primary">All in One Place</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
            The complete workforce operations platform for golf course superintendents. Plan tasks, manage crews, track equipment, and run reports — from the office or the field.
          </p>
          <div className="flex gap-3">
            <Button size="lg" onClick={() => navigate('/app/workboard')} className="gap-2">
              Open Demo <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/app/workboard')}>
              <Smartphone className="h-4 w-4 mr-2" /> Mobile Preview
            </Button>
          </div>
        </div>
      </section>

      {/* Features checklist */}
      <section className="bg-card border-y">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {features.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules grid */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Platform Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map(mod => (
            <Card
              key={mod.title}
              className="p-5 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group"
              onClick={() => navigate(mod.route)}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: mod.color + '18' }}>
                <mod.icon className="h-5 w-5" style={{ color: mod.color }} />
              </div>
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">{mod.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{mod.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-muted-foreground">
          GroundsCrew Task Tracker • Demo Application • Built with React + Tailwind
        </div>
      </footer>
    </div>
  );
}

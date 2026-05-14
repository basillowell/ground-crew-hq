import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  CloudSun,
  Loader2,
  ShieldCheck,
  Smartphone,
  Wrench,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { hasSupabaseConfig, supabase, supabaseConfigError } from '@/lib/supabase';
import { useProgramSettings } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

type FeatureItem = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

const FEATURES: FeatureItem[] = [
  {
    icon: CalendarDays,
    title: 'Crew Scheduling',
    description: 'Week grid, shift templates, and one-click copy week to keep mornings efficient.',
  },
  {
    icon: ClipboardList,
    title: 'Task Dispatch',
    description: 'Assign tasks, track status, and keep supervisors synced with real-time updates.',
  },
  {
    icon: CloudSun,
    title: 'Weather Intelligence',
    description: 'Spray windows, heat alerts, and inline weather warnings where work decisions happen.',
  },
  {
    icon: BarChart3,
    title: 'Labor Reports',
    description: 'Actual vs planned hours, labor cost tracking, and export-ready CSV reporting.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Crew App',
    description: 'Clock in, complete tasks, and log hours directly from the field in real time.',
  },
  {
    icon: Wrench,
    title: 'Equipment Tracking',
    description: 'Service alerts, assignment linking, and a full fleet readiness overview.',
  },
];

export default function LaunchPortalPage() {
  const navigate = useNavigate();
  const { currentUser, authDebugMessage, isLoading, authState, hasSession, retryAuthHydration } = useAuth();
  const programSettingsQuery = useProgramSettings();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAwaitingProfile, setIsAwaitingProfile] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  const appName = programSettingsQuery.data?.appName || 'Ground Crew HQ';
  const clientName = programSettingsQuery.data?.clientLabel || 'Ground Crew HQ';
  const DEMO_EMAIL = 'demo@groundcrewhq.com';
  const DEMO_PASSWORD = 'GroundCrewHQDemo!2026';

  useEffect(() => {
    if (currentUser) {
      setIsAwaitingProfile(false);
      setIsSubmitting(false);
      setErrorMessage('');
      navigate('/app/dashboard', { replace: true });
      return;
    }

    if (isAwaitingProfile && !isLoading) {
      setIsAwaitingProfile(false);
      setIsSubmitting(false);
      setErrorMessage(authDebugMessage || 'Sign-in completed, but your app profile could not be loaded.');
    }
  }, [authDebugMessage, currentUser, isAwaitingProfile, isLoading, navigate]);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setErrorMessage(supabaseConfigError);
    }
  }, []);

  const mapAuthError = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.includes('invalid login credentials')) return 'Invalid credentials. Please check your email and password.';
    if (normalized.includes('email not confirmed')) return 'Email not confirmed. Please verify your email before signing in.';
    return message;
  };

  const signInWithCredentials = async (nextEmail: string, nextPassword: string) => {
    if (!supabase) {
      setErrorMessage(supabaseConfigError || 'Supabase is not configured for this environment.');
      return;
    }

    setIsSubmitting(true);
    setIsAwaitingProfile(false);
    setErrorMessage('');
    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email: nextEmail, password: nextPassword }),
        new Promise<{ error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ error: { message: 'Sign-in timed out. Please try again.' } }), 15000),
        ),
      ]);

      if (result.error) {
        setErrorMessage(mapAuthError(result.error.message));
        setIsSubmitting(false);
        return;
      }

      setIsAwaitingProfile(true);
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await signInWithCredentials(email, password);
  };

  const handleDemoLogin = async () => {
    await signInWithCredentials(DEMO_EMAIL, DEMO_PASSWORD);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbf8_0%,#eef6f1_100%)] text-foreground">
      <header className="sticky top-0 z-20 border-b border-emerald-100/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <div>
            <div className="text-base font-semibold tracking-tight">{appName}</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{clientName}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setLoginOpen(true)}>
              Sign In
            </Button>
            <Button onClick={() => setLoginOpen(true)}>Start Free Trial</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <section className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-emerald-950 md:text-5xl">
              Your Digital Whiteboard for Grounds Operations
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Schedule crews, dispatch tasks, track labor, and make weather-smart decisions — all in one platform built for superintendents.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setLoginOpen(true)}>
                Start Free Trial
              </Button>
              <Button size="lg" variant="outline" onClick={() => void handleDemoLogin()}>
                Try Demo
              </Button>
            </div>
          </div>
          <Card className="overflow-hidden rounded-2xl border-emerald-100 bg-white shadow-lg">
            <img
              src="/images/hero-workboard.png"
              alt="Ground Crew HQ workboard preview"
              className="h-full w-full object-cover"
            />
          </Card>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">
            Every morning, you erase yesterday&apos;s whiteboard and start over.
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              'Scheduling takes 30+ minutes every day',
              'Weather wrecks your plan and nobody knows',
              "Your GM asks for labor reports you can't produce",
            ].map((item) => (
              <Card key={item} className="rounded-xl border-emerald-100 bg-white p-5">
                <p className="text-sm font-medium text-foreground">{item}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">Feature Showcase</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="rounded-xl border-emerald-100 bg-white p-5">
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-emerald-100 bg-white p-6">
          <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">Built for Turf, Not Tech</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
            Unlike generic field service tools, Ground Crew HQ speaks your language. Mow greens. Roll greens.
            Bunker maintenance. Irrigation check. Your task library, your schedule, your weather.
          </p>
        </section>

        <section className="mt-16">
          <Card className="mx-auto max-w-xl rounded-2xl border-emerald-200 bg-emerald-50/60 p-6 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">Early Access — Free during beta</h2>
            <p className="mt-2 text-sm text-muted-foreground">Full platform access. No credit card required.</p>
            <Button className="mt-5" size="lg" onClick={() => setLoginOpen(true)}>
              Get Started
            </Button>
          </Card>
        </section>
      </main>

      <footer className="border-t border-emerald-100 bg-white/90">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground md:flex-row md:px-6">
          <div>Ground Crew HQ · © 2026 · support@groundcrewhq.com</div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-foreground">Privacy Policy</a>
            <a href="#" className="hover:text-foreground">Terms of Service</a>
          </div>
        </div>
      </footer>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Sign in to your workspace
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@club.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
            {errorMessage ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3 text-xs text-destructive">
                {errorMessage}
              </div>
            ) : null}
            {!errorMessage && authDebugMessage ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-950">
                {authDebugMessage}
                {hasSession &&
                (authState === 'network-timeout' || authState === 'profile-error' || authState === 'profile-missing') ? (
                  <div className="mt-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => void retryAuthHydration()}>
                      Retry profile load
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <Button className="w-full gap-2" disabled={isSubmitting || !email || !password || !hasSupabaseConfig} type="submit">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? (isAwaitingProfile ? 'Loading workspace profile...' : 'Signing in...') : 'Sign In'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isSubmitting || !hasSupabaseConfig}
              onClick={() => void handleDemoLogin()}
            >
              Try Demo
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

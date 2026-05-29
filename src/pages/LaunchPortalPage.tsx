import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, ClipboardList, Loader2, Radar, ShieldCheck, Smartphone, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { hasSupabaseConfig, supabase, supabaseConfigError } from '@/lib/supabase';
import { useProgramSettings } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

type FeatureItem = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  size: 'large' | 'medium' | 'small';
};

type TestimonialItem = {
  quote: string;
  byline: string;
  initials: string;
};

const FEATURES: FeatureItem[] = [
  {
    icon: Radar,
    title: 'Weather Intelligence Built In',
    description:
      'Live radar, spray window alerts, and severe weather notifications. No other scheduling tool has this.',
    size: 'large',
  },
  {
    icon: CalendarDays,
    title: 'Schedule in Minutes',
    description: 'Drag, drop, copy week. Templates that learn your patterns.',
    size: 'medium',
  },
  {
    icon: Smartphone,
    title: 'Mobile Crew App',
    description: 'Field page works with gloves on. English + Spanish. Offline mode.',
    size: 'medium',
  },
  {
    icon: ClipboardList,
    title: 'Task Dispatch',
    description: 'Weather-conflict warnings before you send crew out.',
    size: 'small',
  },
  {
    icon: BarChart3,
    title: 'Reports That Justify the Budget',
    description: 'Labor costs, completion rates, equipment health — the numbers your GM needs.',
    size: 'small',
  },
  {
    icon: Wrench,
    title: 'Equipment Tracking',
    description: 'Service alerts before breakdowns happen.',
    size: 'small',
  },
];

const TESTIMONIALS: TestimonialItem[] = [
  {
    quote: 'This replaced our whiteboard in week one. The spray window feature alone saves us hours.',
    byline: 'Superintendent, Private Club',
    initials: 'SP',
  },
  {
    quote: 'My crew uses the mobile app every morning. In English and Spanish.',
    byline: 'Head Groundskeeper, Municipal Course',
    initials: 'HG',
  },
  {
    quote: 'The weather alerts caught a storm we would have missed. Saved $3,000 in chemical waste.',
    byline: 'Asst. Superintendent, Resort',
    initials: 'AR',
  },
];

function ScrollReveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      {children}
    </div>
  );
}

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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <div>
            <div className="text-base font-semibold tracking-tight">{appName}</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{clientName}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="rounded-lg" onClick={() => setLoginOpen(true)}>
              Sign In
            </Button>
            <Button className="h-10 rounded-lg bg-emerald-700 hover:bg-emerald-800" onClick={() => setLoginOpen(true)}>
              Start Free — No Credit Card
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div className="animate-[hero-enter_600ms_ease-out_forwards] opacity-0 [animation-delay:120ms]">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Your Crew. Your Course. One Command Center.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Built for golf course superintendents, grounds managers, and turf professionals who need weather-aware
              scheduling, EPA-compliant chemical logging, and a mobile crew app that works with gloves on.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="h-11 rounded-lg bg-emerald-700 px-6 text-sm font-semibold text-white hover:bg-emerald-800 animate-[pulse-soft_2s_ease-in-out_infinite]"
                onClick={() => setLoginOpen(true)}
              >
                Start Free — No Credit Card
              </Button>
              <Button size="lg" variant="outline" className="h-11 rounded-lg px-6" onClick={() => void handleDemoLogin()}>
                Watch Demo
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Join 50+ facilities already using Ground Crew HQ</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">Weather-Aware</span>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">Bilingual Crews</span>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">Mobile-First</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">Golf Course Operations</span>
              <span className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">Turf Management</span>
              <span className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">Grounds Crew Scheduling</span>
              <span className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">Chemical Application Tracking</span>
              <span className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">Weather Intelligence</span>
            </div>
          </div>
          <Card className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            <div className="flex h-8 items-center gap-2 border-b border-border bg-muted/40 px-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 text-[11px] text-muted-foreground">ground-crew-hq.vercel.app/dashboard</span>
            </div>
            <div className="grid grid-cols-[80px_1fr]">
              <div className="space-y-2 bg-emerald-900 p-3">
                {['Dashboard', 'Workboard', 'Scheduler', 'Weather'].map((item) => (
                  <div key={item} className="rounded-md bg-emerald-800/70 px-2 py-1 text-[10px] text-emerald-100">
                    {item}
                  </div>
                ))}
              </div>
              <div className="space-y-3 p-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-border p-2">
                    <div className="text-[10px] text-muted-foreground">Crew</div>
                    <div className="text-sm font-semibold">3 Scheduled</div>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <div className="text-[10px] text-muted-foreground">Tasks</div>
                    <div className="text-sm font-semibold">8 Assigned</div>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <div className="text-[10px] text-muted-foreground">Weather</div>
                    <div className="text-sm font-semibold">84°F</div>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <div className="mb-2 text-[10px] text-muted-foreground">Schedule Grid</div>
                  <div className="space-y-1">
                    <div className="h-5 rounded bg-emerald-100" />
                    <div className="h-5 rounded bg-blue-100" />
                    <div className="h-5 rounded bg-amber-100" />
                  </div>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <div className="mb-2 text-[10px] text-muted-foreground">Spray Window Timeline</div>
                  <div className="flex h-3 overflow-hidden rounded-full">
                    <div className="w-1/2 bg-emerald-400" />
                    <div className="w-1/4 bg-amber-400" />
                    <div className="w-1/4 bg-red-400" />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">Why Ground Crew HQ?</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">vs. Spreadsheets</h3>
              <p className="mt-2 text-sm text-muted-foreground">Real-time crew tracking, weather alerts, mobile access.</p>
            </Card>
            <Card className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">vs. Generic FSM</h3>
              <p className="mt-2 text-sm text-muted-foreground">Turf-specific workflows, spray windows, EPA compliance.</p>
            </Card>
            <Card className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">vs. Enterprise Tools</h3>
              <p className="mt-2 text-sm text-muted-foreground">Starts at $100/mo. No implementation fee. No contract.</p>
            </Card>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">Built for daily operations, not spreadsheets</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              const sizeClass = feature.size === 'large' ? 'lg:col-span-2' : '';
              return (
                <ScrollReveal key={feature.title} className={sizeClass}>
                  <Card className="h-full rounded-2xl border border-border bg-card p-6 transition-shadow duration-200 hover:shadow-md">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-emerald-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                  </Card>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">Trusted by Grounds Teams Across the Country</h2>
          <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-center text-sm font-medium">
            500+ tasks dispatched · 2,000+ hours tracked · 50+ facilities
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <Card key={item.quote} className="rounded-2xl border border-border bg-card p-5 transition-transform duration-200 hover:-translate-y-0.5">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                  {item.initials}
                </div>
                <p className="text-sm leading-6 text-foreground">{item.quote}</p>
                <p className="mt-3 text-xs font-medium text-muted-foreground">— {item.byline}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <Card className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">Built by People Who Know the Course</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Ground Crew HQ was designed by turf professionals who&apos;ve walked the course at 5 AM, managed crews in
              95° heat, and dealt with weather cancellations. We built the tool we wished we had.
            </p>
          </Card>
        </section>

        <section className="mt-16">
          <Card className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Ready to run your crew smarter?</h2>
            <Button
              className="mt-5 h-11 rounded-lg bg-emerald-700 px-6 text-sm font-semibold text-white hover:bg-emerald-800"
              size="lg"
              onClick={() => setLoginOpen(true)}
            >
              Start Free — No Credit Card
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">14-day free trial. All features included.</p>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border bg-background/90">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground md:flex-row md:px-6">
          <div>
            <div className="font-semibold text-foreground">Ground Crew HQ</div>
            <div>© 2026 Ground Crew HQ · Built for the people who keep courses perfect.</div>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-foreground">Features</a>
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <button type="button" className="hover:text-foreground" onClick={() => setLoginOpen(true)}>Login</button>
            <a href="mailto:support@groundcrewhq.com" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent aria-describedby="dialog-desc" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Sign in to your workspace
            </DialogTitle>
            <DialogDescription id="dialog-desc" className="sr-only">
              Sign in with your workspace email and password to continue.
            </DialogDescription>
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

      <style>{`
        @keyframes hero-enter {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-soft {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, CheckCircle2, Clock, ClipboardList, Loader2, Repeat2, ShieldCheck, Smartphone, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { hasSupabaseConfig, supabase, supabaseConfigError } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/store/appStore';

type AuthPanel = 'sign-in' | 'sign-up' | 'forgot-password';

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
    icon: CalendarDays,
    title: 'Drag-Drop Dispatch Board',
    description:
      'Plan the entire week in minutes. Assign crew to properties, reorder on the fly, and see the full picture at a glance.',
    size: 'large',
  },
  {
    icon: Clock,
    title: 'GPS-Verified Clock In/Out',
    description: 'Verified labor tracking that eliminates buddy-punching. Location recorded on every punch.',
    size: 'medium',
  },
  {
    icon: Smartphone,
    title: 'Mobile Field View',
    description: 'Built for crew members in the field. Works with gloves on. English + Spanish.',
    size: 'medium',
  },
  {
    icon: Repeat2,
    title: 'Recurring Job Automation',
    description: 'Set schedules once — lawn care runs on repeat. No more manual weekly entry.',
    size: 'small',
  },
  {
    icon: BarChart3,
    title: 'Job Costing Dashboard',
    description: 'Know your margin per job. Actual vs. estimated hours, labor cost, gross margin.',
    size: 'small',
  },
  {
    icon: ShieldCheck,
    title: 'Chemical Compliance Logs',
    description: 'EPA-ready application records. NWS spray window alerts built in — no extra setup.',
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

// ── Shared dialog field components ──────────────────────────────────────────

function DarkInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={`border-surface-border bg-surface-base text-text-primary placeholder:text-text-muted focus-visible:border-brand/50 focus-visible:ring-brand/30 ${props.className ?? ''}`}
    />
  );
}

function DarkLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <Label htmlFor={htmlFor} className="text-sm text-text-secondary">
      {children}
    </Label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-400">
      {message}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-3 text-xs text-brand-bright">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-bright" />
      {message}
    </div>
  );
}

function PanelLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-brand-bright underline-offset-2 hover:underline"
    >
      {children}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function LaunchPortalPage() {
  const navigate = useNavigate();
  const { currentUser, authDebugMessage, isLoading, authState, hasSession, retryAuthHydration } = useAuth();
  const programSettings = useAppStore((state) => state.programSettings);

  // ── Sign-in state (unchanged) ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAwaitingProfile, setIsAwaitingProfile] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  // ── Auth panel routing ──
  const [authPanel, setAuthPanel] = useState<AuthPanel>('sign-in');

  // ── Sign-up state ──
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  // ── Forgot-password state ──
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const appName = programSettings?.app_name || 'Ground Crew HQ';
  const clientName = programSettings?.client_label || 'Ground Crew HQ';
  const DEMO_EMAIL = 'demo@groundcrewhq.com';
  const DEMO_PASSWORD = 'GroundCrewHQDemo!2026';

  const openDialog = (panel: AuthPanel = 'sign-in') => {
    setAuthPanel(panel);
    setErrorMessage('');
    setSignUpError('');
    setForgotError('');
    setSignUpSuccess(false);
    setForgotSuccess(false);
    setLoginOpen(true);
  };

  const switchPanel = (panel: AuthPanel) => {
    setAuthPanel(panel);
    setErrorMessage('');
    setSignUpError('');
    setForgotError('');
    setSignUpSuccess(false);
    setForgotSuccess(false);
  };

  // After form sign-in: navigate to app only when the user triggered it (isAwaitingProfile).
  // Visiting the landing page while already authenticated shows "Go to App →" instead.
  useEffect(() => {
    if (currentUser && isAwaitingProfile) {
      setIsAwaitingProfile(false);
      setIsSubmitting(false);
      setErrorMessage('');
      navigate('/app/scheduler', { replace: true });
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

  // ── Existing sign-in logic (untouched) ──
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

  // ── New: sign-up handler ──
  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) { setSignUpError(supabaseConfigError || 'Supabase is not configured.'); return; }
    if (signUpPassword !== signUpConfirmPassword) { setSignUpError('Passwords do not match.'); return; }
    if (signUpPassword.length < 8) { setSignUpError('Password must be at least 8 characters.'); return; }
    setIsSigningUp(true);
    setSignUpError('');
    try {
      const { error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: { data: { full_name: signUpName.trim() } },
      });
      if (error) { setSignUpError(error.message); return; }
      setSignUpSuccess(true);
    } catch {
      setSignUpError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSigningUp(false);
    }
  };

  // ── New: forgot-password handler ──
  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) { setForgotError(supabaseConfigError || 'Supabase is not configured.'); return; }
    setIsSendingReset(true);
    setForgotError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) { setForgotError(error.message); return; }
      setForgotSuccess(true);
    } catch {
      setForgotError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  // ── Dialog title map ──
  const dialogTitles: Record<AuthPanel, string> = {
    'sign-in': 'Sign in to your workspace',
    'sign-up': 'Create your account',
    'forgot-password': 'Reset your password',
  };

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-20 border-b border-surface-border bg-surface-base/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <div>
            <div className="text-base font-semibold tracking-tight text-text-primary">{appName}</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{clientName}</div>
          </div>
          <div className="flex items-center gap-2">
            {currentUser ? (
              <Link
                to="/app/scheduler"
                className="rounded-full bg-brand-bright px-5 py-2 text-sm font-semibold text-text-inverse transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
              >
                Go to App →
              </Link>
            ) : (
              <>
                <button
                  className="rounded-full px-4 py-2 text-sm text-text-secondary transition-colors duration-200 hover:text-text-primary"
                  onClick={() => openDialog('sign-in')}
                >
                  Sign In
                </button>
                <button
                  className="rounded-full bg-brand-bright px-5 py-2 text-sm font-semibold text-text-inverse transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                  onClick={() => openDialog('sign-up')}
                >
                  Start Free — No Credit Card
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
        {/* ── Hero ── */}
        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div className="animate-[hero-enter_600ms_ease-out_forwards] opacity-0 [animation-delay:120ms]">
            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight text-text-primary">
              The Operations Brain for Your Grounds Crew
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-text-secondary md:text-lg">
              Scheduling. Dispatch. Payroll. One Platform. GPS clock-in, drag-drop dispatch,
              and automated invoicing — built for golf course superintendents and grounds managers.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {currentUser ? (
                <Link
                  to="/app/scheduler"
                  className="rounded-full bg-brand-bright px-8 py-3 text-sm font-semibold text-text-inverse transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                >
                  Go to App →
                </Link>
              ) : (
                <>
                  <button
                    className="rounded-full bg-brand-bright px-8 py-3 text-sm font-semibold text-text-inverse transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                    onClick={() => openDialog('sign-up')}
                  >
                    Start Free — No Credit Card
                  </button>
                  <button
                    className="rounded-full border border-brand bg-transparent px-8 py-3 text-sm font-semibold text-brand transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-ghost"
                    onClick={() => void handleDemoLogin()}
                  >
                    Try Live Demo
                  </button>
                </>
              )}
            </div>
            <p className="mt-4 text-sm text-text-muted">Join 50+ facilities already running smarter crews</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-surface-border bg-surface-elevated px-3 py-1 text-xs font-medium text-text-secondary">GPS Clock In/Out</span>
              <span className="rounded-full border border-surface-border bg-surface-elevated px-3 py-1 text-xs font-medium text-text-secondary">Bilingual Crews</span>
              <span className="rounded-full border border-surface-border bg-surface-elevated px-3 py-1 text-xs font-medium text-text-secondary">Mobile-First</span>
              <span className="rounded-full border border-surface-border bg-surface-elevated px-3 py-1 text-xs font-medium text-text-secondary">EPA Compliant</span>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card shadow-2xl">
            <div className="flex h-8 items-center gap-2 border-b border-surface-border bg-surface-elevated/50 px-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-lime-400/70" />
              <span className="ml-2 text-[11px] text-text-muted">ground-crew-hq.vercel.app/dashboard</span>
            </div>
            <div className="grid grid-cols-[80px_1fr]">
              <div className="space-y-2 bg-surface-base p-3">
                {['Dashboard', 'Workboard', 'Scheduler', 'Weather'].map((item) => (
                  <div key={item} className="rounded-md bg-surface-elevated px-2 py-1 text-[10px] text-text-secondary">
                    {item}
                  </div>
                ))}
              </div>
              <div className="space-y-3 p-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-surface-border bg-surface-elevated p-2">
                    <div className="text-[10px] text-text-muted">Crew</div>
                    <div className="text-sm font-semibold text-text-primary">3 Scheduled</div>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface-elevated p-2">
                    <div className="text-[10px] text-text-muted">Tasks</div>
                    <div className="text-sm font-semibold text-text-primary">8 Assigned</div>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface-elevated p-2">
                    <div className="text-[10px] text-text-muted">Weather</div>
                    <div className="text-sm font-semibold text-text-primary">84°F</div>
                  </div>
                </div>
                <div className="rounded-lg border border-surface-border bg-surface-elevated p-2">
                  <div className="mb-2 text-[10px] text-text-muted">Schedule Grid</div>
                  <div className="space-y-1">
                    <div className="h-5 rounded bg-lime-400/25" />
                    <div className="h-5 rounded bg-sky-400/25" />
                    <div className="h-5 rounded bg-amber-400/25" />
                  </div>
                </div>
                <div className="rounded-lg border border-surface-border bg-surface-elevated p-2">
                  <div className="mb-2 text-[10px] text-text-muted">Spray Window Timeline</div>
                  <div className="flex h-3 overflow-hidden rounded-full">
                    <div className="w-1/2 bg-lime-400/60" />
                    <div className="w-1/4 bg-amber-400/60" />
                    <div className="w-1/4 bg-red-400/60" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Why GCHQ comparison ── */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Why Ground Crew HQ?</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { title: 'vs. Spreadsheets', desc: 'Real-time crew tracking, GPS verification, mobile access.' },
              { title: 'vs. Generic FSM', desc: 'Turf-specific workflows, recurring jobs, EPA compliance.' },
              { title: 'vs. Enterprise Tools', desc: 'Starts at $29/mo. No implementation fee. No contract.' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-surface-border bg-surface-card p-5">
                <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bento Feature Grid ── */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Built for daily operations, not spreadsheets</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              const sizeClass = feature.size === 'large' ? 'md:col-span-2' : '';
              return (
                <ScrollReveal key={feature.title} className={sizeClass}>
                  <div className="group h-full rounded-2xl border border-surface-border bg-surface-card p-6 transition-all duration-[250ms] hover:-translate-y-1 hover:border-brand/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] active:scale-[0.98]">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated text-brand transition-colors duration-200 group-hover:bg-brand/10">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-[18px] font-semibold leading-snug text-text-primary">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">{feature.description}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Simple, Transparent Pricing</h2>
          <p className="mt-2 text-sm text-text-secondary">No implementation fees. No contracts. Cancel anytime.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                name: 'Starter',
                price: '$29',
                period: '/mo',
                crew: '≤ 10 crew',
                features: ['Scheduling & job tracking', 'Mobile field view', 'Team messaging', 'Equipment tracking'],
                cta: 'Start Free',
                highlight: false,
              },
              {
                name: 'Pro',
                price: '$79',
                period: '/mo',
                crew: '≤ 30 crew',
                features: ['Everything in Starter', 'GPS clock in/out', 'Recurring jobs', 'Invoicing', 'Job costing dashboard'],
                cta: 'Start Free',
                highlight: true,
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                period: '',
                crew: 'Unlimited crew',
                features: ['Everything in Pro', 'Route optimization', 'Multi-location', 'API access', 'Dedicated support'],
                cta: 'Contact Us',
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 ${
                  plan.highlight
                    ? 'border-brand bg-surface-elevated'
                    : 'border-surface-border bg-surface-elevated'
                }`}
              >
                {plan.highlight && (
                  <div className="mb-3 inline-flex rounded-full bg-brand-ghost px-2.5 py-0.5 text-xs font-semibold text-brand">
                    Most Popular
                  </div>
                )}
                <div className="text-lg font-bold text-text-primary">{plan.name}</div>
                <div className="mt-1 flex items-baseline gap-0.5">
                  <span className="text-3xl font-extrabold text-text-primary">{plan.price}</span>
                  {plan.period && <span className="text-sm text-text-muted">{plan.period}</span>}
                </div>
                <div className="mt-0.5 text-xs text-text-muted">{plan.crew}</div>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => openDialog(plan.cta === 'Contact Us' ? 'sign-up' : 'sign-up')}
                  className={`mt-6 w-full rounded-full py-2.5 text-sm font-semibold transition-all duration-200 ${
                    plan.highlight
                      ? 'bg-brand-bright text-text-inverse hover:brightness-110'
                      : 'border border-surface-border bg-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Trusted by Grounds Teams Across the Country</h2>
          <div className="mt-4 rounded-xl border border-surface-border bg-surface-card px-4 py-3 text-center text-sm font-medium text-text-secondary">
            500+ tasks dispatched · 2,000+ hours tracked · 50+ facilities
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <div
                key={item.quote}
                className="rounded-2xl border border-surface-border bg-surface-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/10"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-sm font-semibold text-brand-bright">
                  {item.initials}
                </div>
                <p className="text-sm leading-6 text-text-secondary">"{item.quote}"</p>
                <p className="mt-3 text-xs font-medium text-text-muted">— {item.byline}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── About ── */}
        <section className="mt-16">
          <div className="rounded-2xl border border-surface-border bg-surface-card p-6 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Built by People Who Know the Course</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
              Ground Crew HQ was designed by turf professionals who&apos;ve walked the course at 5 AM, managed crews in
              95° heat, and dealt with weather cancellations. We built the tool we wished we had.
            </p>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="mt-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-brand/20 bg-surface-card p-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Ready to run your crew smarter?</h2>
            {currentUser ? (
              <Link
                to="/app/scheduler"
                className="mt-5 inline-block rounded-full bg-brand-bright px-8 py-3 text-sm font-semibold text-text-inverse transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
              >
                Go to App →
              </Link>
            ) : (
              <button
                className="mt-5 rounded-full bg-brand-bright px-8 py-3 text-sm font-semibold text-text-inverse transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                onClick={() => openDialog('sign-up')}
              >
                Start Free — No Credit Card
              </button>
            )}
            <p className="mt-3 text-sm text-text-muted">14-day free trial. All features included.</p>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-surface-border bg-surface-base">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-text-muted md:flex-row md:px-6">
          <div>
            <div className="font-semibold text-text-secondary">Ground Crew HQ</div>
            <div>© 2026 Ground Crew HQ · Built for the people who keep courses perfect.</div>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="transition-colors hover:text-text-secondary">Features</a>
            <Link to="/pricing" className="transition-colors hover:text-text-secondary">Pricing</Link>
            <button type="button" className="transition-colors hover:text-text-secondary" onClick={() => openDialog('sign-in')}>Login</button>
            <a href="mailto:support@groundcrewhq.com" className="transition-colors hover:text-text-secondary">Contact</a>
          </div>
        </div>
      </footer>

      {/* ── Auth Dialog ── */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent
          aria-describedby="dialog-desc"
          className="max-w-md border-surface-border bg-surface-card text-text-primary backdrop-blur-xl"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-text-primary">
              <ShieldCheck className="h-4 w-4 text-brand-bright" />
              {dialogTitles[authPanel]}
            </DialogTitle>
            <DialogDescription id="dialog-desc" className="sr-only">
              {dialogTitles[authPanel]}
            </DialogDescription>
          </DialogHeader>

          {/* ── Panel: Sign In ── */}
          {authPanel === 'sign-in' && (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <DarkLabel htmlFor="email">Email</DarkLabel>
                <DarkInput
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@club.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <DarkLabel htmlFor="password">Password</DarkLabel>
                  <PanelLink onClick={() => switchPanel('forgot-password')}>
                    Forgot password?
                  </PanelLink>
                </div>
                <DarkInput
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>

              {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
              {!errorMessage && authDebugMessage ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-xs text-amber-300">
                  {authDebugMessage}
                  {hasSession && (authState === 'network-timeout' || authState === 'profile-error' || authState === 'profile-missing') ? (
                    <div className="mt-2">
                      <Button type="button" size="sm" variant="outline" className="border-surface-border text-text-secondary hover:bg-surface-hover hover:text-text-primary" onClick={() => void retryAuthHydration()}>
                        Retry profile load
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Button
                className="w-full gap-2 rounded-full bg-brand-bright font-semibold text-text-inverse transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                disabled={isSubmitting || !email || !password || !hasSupabaseConfig}
                type="submit"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? (isAwaitingProfile ? 'Loading workspace...' : 'Signing in...') : 'Sign In'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-surface-border text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                disabled={isSubmitting || !hasSupabaseConfig}
                onClick={() => void handleDemoLogin()}
              >
                Try Demo
              </Button>
              <p className="text-center text-xs text-text-muted">
                Don't have an account?{' '}
                <PanelLink onClick={() => switchPanel('sign-up')}>Create one</PanelLink>
              </p>
            </form>
          )}

          {/* ── Panel: Sign Up ── */}
          {authPanel === 'sign-up' && (
            <form className="space-y-4" onSubmit={handleSignUp}>
              {signUpSuccess ? (
                <div className="space-y-4">
                  <SuccessBanner message="Check your email to confirm your account. You'll receive a verification link within a few minutes." />
                  <p className="text-center text-xs text-text-muted">
                    Already have an account?{' '}
                    <PanelLink onClick={() => switchPanel('sign-in')}>Sign in</PanelLink>
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <DarkLabel htmlFor="su-name">Full name</DarkLabel>
                    <DarkInput
                      id="su-name"
                      type="text"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      placeholder="Jane Smith"
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <DarkLabel htmlFor="su-email">Work email</DarkLabel>
                    <DarkInput
                      id="su-email"
                      type="email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      placeholder="name@club.com"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <DarkLabel htmlFor="su-password">Password</DarkLabel>
                    <DarkInput
                      id="su-password"
                      type="password"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <DarkLabel htmlFor="su-confirm">Confirm password</DarkLabel>
                    <DarkInput
                      id="su-confirm"
                      type="password"
                      value={signUpConfirmPassword}
                      onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                    />
                  </div>

                  {signUpError ? <ErrorBanner message={signUpError} /> : null}

                  <Button
                    className="w-full gap-2 rounded-full bg-brand-bright font-semibold text-text-inverse transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                    disabled={isSigningUp || !signUpEmail || !signUpPassword || !hasSupabaseConfig}
                    type="submit"
                  >
                    {isSigningUp ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isSigningUp ? 'Creating account...' : 'Create account'}
                  </Button>
                  <p className="text-center text-xs text-text-muted">
                    Already have an account?{' '}
                    <PanelLink onClick={() => switchPanel('sign-in')}>Sign in</PanelLink>
                  </p>
                </>
              )}
            </form>
          )}

          {/* ── Panel: Forgot Password ── */}
          {authPanel === 'forgot-password' && (
            <form className="space-y-4" onSubmit={handleForgotPassword}>
              {forgotSuccess ? (
                <div className="space-y-4">
                  <SuccessBanner message="Password reset link sent. Check your inbox — the link expires in 1 hour." />
                  <p className="text-center text-xs text-text-muted">
                    <PanelLink onClick={() => switchPanel('sign-in')}>Back to sign in</PanelLink>
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-text-secondary">
                    Enter the email address on your account and we'll send you a reset link.
                  </p>
                  <div className="space-y-2">
                    <DarkLabel htmlFor="fp-email">Email</DarkLabel>
                    <DarkInput
                      id="fp-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@club.com"
                      autoComplete="email"
                    />
                  </div>

                  {forgotError ? <ErrorBanner message={forgotError} /> : null}

                  <Button
                    className="w-full gap-2 rounded-full bg-brand-bright font-semibold text-text-inverse transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                    disabled={isSendingReset || !forgotEmail || !hasSupabaseConfig}
                    type="submit"
                  >
                    {isSendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isSendingReset ? 'Sending...' : 'Send reset link'}
                  </Button>
                  <p className="text-center text-xs text-text-muted">
                    Remembered it?{' '}
                    <PanelLink onClick={() => switchPanel('sign-in')}>Back to sign in</PanelLink>
                  </p>
                </>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes hero-enter {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

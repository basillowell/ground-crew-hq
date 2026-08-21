import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { BarChart3, CalendarDays, CheckCircle2, Clock, DollarSign, Inbox, Repeat2, ShieldCheck, Smartphone, Wrench } from 'lucide-react';

const LaunchAuthDialog = dynamic(() => import('@/components/launch/LaunchAuthDialog'), { ssr: false });

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
    icon: CheckCircle2,
    title: 'Work orders, start to finish',
    description:
      "Client requests and equipment-due repairs flow through one funnel — review, accept, assign to a crew member, and verify the work before it's marked done.",
    size: 'large',
  },
  {
    icon: Inbox,
    title: 'Client request portal',
    description:
      'Give clients a link to submit work requests. Each one lands in your queue for review — no phone tag, no lost sticky notes.',
    size: 'medium',
  },
  {
    icon: CalendarDays,
    title: 'Drag-drop dispatch board',
    description:
      'Plan the entire week in minutes. Assign crews to properties, reorder on the fly, and see the full picture at a glance.',
    size: 'medium',
  },
  {
    icon: DollarSign,
    title: 'Payroll review & sign-off',
    description:
      "Review each crew member's hours by pay period, submit to payroll in one click, and export a packet for your accountant. Approved time locks — no accidental edits.",
    size: 'small',
  },
  {
    icon: Wrench,
    title: 'Equipment & maintenance',
    description:
      'Track every asset and its service intervals. When maintenance comes due, Ground Crew HQ generates the service work order for you.',
    size: 'medium',
  },
  {
    icon: Clock,
    title: 'GPS-verified clock in/out',
    description: 'Verified labor tracking that ends buddy-punching. Location recorded on every punch.',
    size: 'small',
  },
  {
    icon: Smartphone,
    title: 'Mobile field view',
    description:
      "Built for crew members in the field. Today's tasks, clock in/out, photos and signatures. Works with gloves on — English and Spanish.",
    size: 'small',
  },
  {
    icon: BarChart3,
    title: 'Job costing dashboard',
    description: 'Know your margin per job — actual vs. estimated hours, labor cost, gross margin.',
    size: 'small',
  },
  {
    icon: Repeat2,
    title: 'Recurring job automation',
    description: 'Set schedules once — recurring work runs on repeat. No more manual weekly entry.',
    size: 'small',
  },
  {
    icon: ShieldCheck,
    title: 'Chemical compliance logs',
    description: 'EPA-ready application records. NWS spray-window alerts built in — no extra setup.',
    size: 'small',
  },
];

const TESTIMONIALS: TestimonialItem[] = [
  {
    quote: 'Requests come in, get assigned, and nothing falls through the cracks anymore.',
    byline: 'Property Manager, Commercial Portfolio',
    initials: 'PM',
  },
  {
    quote: 'Payroll used to take a day. Now I review, approve, and export in about an hour.',
    byline: 'Owner, Landscape & Lawn Care',
    initials: 'OL',
  },
  {
    quote: 'My crew clocks in from the field every morning, in English and Spanish. The spray-window alerts save us hours.',
    byline: 'Superintendent, Golf & Sports Turf',
    initials: 'ST',
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

// ── Main component ───────────────────────────────────────────────────────────

export default function LaunchPortalPage() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [authPanel, setAuthPanel] = useState<AuthPanel>('sign-in');
  const [demoLoginNonce, setDemoLoginNonce] = useState(0);

  const appName = 'Ground Crew HQ';
  const clientName = 'Ground Crew HQ';

  const openDialog = (panel: AuthPanel = 'sign-in') => {
    setAuthPanel(panel);
    setLoginOpen(true);
  };

  const openDemoLogin = () => {
    setAuthPanel('sign-in');
    setDemoLoginNonce((nonce) => nonce + 1);
    setLoginOpen(true);
  };

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-20 border-b border-surface-border bg-surface-base/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <div>
            <div className="text-base font-semibold tracking-tight text-text-primary">{appName}</div>
            <div className="text-3xs uppercase tracking-[0.16em] text-text-muted">{clientName}</div>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
        {/* ── Hero ── */}
        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight text-text-primary">
              The Operations Brain for Your Grounds Crew
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-text-secondary md:text-lg">
              Scheduling, dispatch, work orders, equipment, and payroll — one platform for the teams who maintain properties, grounds, and facilities. From the first client request to a signed-off payroll.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="rounded-full bg-brand-bright px-8 py-3 text-sm font-semibold text-text-inverse transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                onClick={() => openDialog('sign-up')}
              >
                Start Free — No Credit Card
              </button>
              <button
                className="rounded-full border border-brand bg-transparent px-8 py-3 text-sm font-semibold text-brand transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-ghost"
                onClick={openDemoLogin}
              >
                Try Live Demo
              </button>
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
              <span className="h-2.5 w-2.5 rounded-full bg-status-warning/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-status-pending/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-status-active/70" />
              <span className="ml-2 text-2xs text-text-muted">ground-crew-hq.vercel.app/dashboard</span>
            </div>
            <div className="grid grid-cols-[80px_1fr]">
              <div className="space-y-2 bg-surface-base p-3">
                {['Dashboard', 'Workboard', 'Scheduler', 'Equipment'].map((item) => (
                  <div key={item} className="rounded-md bg-surface-elevated px-2 py-1 text-3xs text-text-secondary">
                    {item}
                  </div>
                ))}
              </div>
              <div className="space-y-3 p-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-surface-border bg-surface-elevated p-2">
                    <div className="text-3xs text-text-muted">Crew</div>
                    <div className="text-sm font-semibold text-text-primary">3 Scheduled</div>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface-elevated p-2">
                    <div className="text-3xs text-text-muted">Tasks</div>
                    <div className="text-sm font-semibold text-text-primary">8 Assigned</div>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface-elevated p-2">
                    <div className="text-3xs text-text-muted">Equipment</div>
                    <div className="text-sm font-semibold text-text-primary">12 Ready</div>
                  </div>
                </div>
                <div className="rounded-lg border border-surface-border bg-surface-elevated p-2">
                  <div className="mb-2 text-3xs text-text-muted">Schedule Grid</div>
                  <div className="space-y-1">
                    <div className="h-5 rounded bg-status-active/25" />
                    <div className="h-5 rounded bg-status-complete/25" />
                    <div className="h-5 rounded bg-status-pending/25" />
                  </div>
                </div>
                <div className="rounded-lg border border-surface-border bg-surface-elevated p-2">
                  <div className="mb-2 text-3xs text-text-muted">Task Timeline</div>
                  <div className="flex h-3 overflow-hidden rounded-full">
                    <div className="w-1/2 bg-status-active/60" />
                    <div className="w-1/4 bg-status-pending/60" />
                    <div className="w-1/4 bg-status-warning/60" />
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
              { title: 'vs. Generic FSM', desc: 'Field-ready workflows for grounds & facilities, work orders, recurring jobs.' },
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
                  <div className="group h-full rounded-2xl border border-surface-border bg-surface-card p-6 transition-all duration-[250ms] hover:-translate-y-1 hover:border-brand/20 hover:shadow-2xl active:scale-[0.98]">
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
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Built by people who&apos;ve run the crew</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
              Ground Crew HQ was built by people who&apos;ve walked the property at 5 AM, managed crews in the heat, and dealt with last-minute schedule changes. We built the tool we wished we had.
            </p>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="mt-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-brand/20 bg-surface-card p-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Ready to run your crew smarter?</h2>
            <button
              className="mt-5 rounded-full bg-brand-bright px-8 py-3 text-sm font-semibold text-text-inverse transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
              onClick={() => openDialog('sign-up')}
            >
              Start Free — No Credit Card
            </button>
            <p className="mt-3 text-sm text-text-muted">14-day free trial. All features included.</p>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-surface-border bg-surface-base">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-text-muted md:flex-row md:px-6">
          <div>
            <div className="font-semibold text-text-secondary">Ground Crew HQ</div>
            <div>© 2026 Ground Crew HQ · Built for the people who keep properties, grounds, and facilities moving.</div>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="transition-colors hover:text-text-secondary">Features</a>
            <Link href="/pricing" className="transition-colors hover:text-text-secondary">Pricing</Link>
            <button type="button" className="transition-colors hover:text-text-secondary" onClick={() => openDialog('sign-in')}>Login</button>
            <a href="mailto:support@groundcrewhq.com" className="transition-colors hover:text-text-secondary">Contact</a>
          </div>
        </div>
      </footer>

      {loginOpen ? (
        <LaunchAuthDialog
          open={loginOpen}
          initialPanel={authPanel}
          demoLoginNonce={demoLoginNonce}
          onOpenChange={setLoginOpen}
        />
      ) : null}

    </div>
  );
}


import { Check, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Tier = {
  name: string;
  price: string;
  subtitle: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
};

const tiers: Tier[] = [
  {
    name: 'Starter',
    price: '$100/mo',
    subtitle: 'For small crews getting started',
    features: [
      'Up to 10 employees',
      '1 property',
      'Crew scheduling + task dispatch',
      'Crew scheduling + task dispatch',
      'Mobile crew access (Field page)',
      'Basic labor reports',
    ],
    ctaLabel: 'Start Free Beta',
    ctaHref: '/',
  },
  {
    name: 'Professional',
    price: '$175/mo',
    subtitle: 'For growing operations',
    highlighted: true,
    features: [
      'Up to 30 employees',
      'Unlimited properties',
      'Everything in Starter, plus:',
      'Schedule templates + copy week',
      'Labor reports + CSV export + cost tracking',
      'Equipment tracking + service alerts',
      'Chemical application logs + export workflows',
      'WhatsApp + email schedule sharing',
      'Priority support',
    ],
    ctaLabel: 'Start Free Trial',
    ctaHref: '/',
  },
  {
    name: 'Enterprise',
    price: 'Custom pricing',
    subtitle: 'For large facilities and multi-site operations',
    features: [
      '30+ employees (per-user pricing)',
      'Everything in Professional',
      'Multi-facility management',
      'Advanced budget & cost analytics',
      'API access + custom integrations',
      'Dedicated onboarding + account manager',
      'Custom operational dashboards',
      'Custom reporting',
    ],
    ctaLabel: 'Contact Sales',
    ctaHref: 'mailto:sales@groundcrewhq.com?subject=Ground%20Crew%20HQ%20Enterprise%20Inquiry',
  },
];

const featureRows = [
  { label: 'Properties', starter: '1', pro: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Employees', starter: 'Up to 10', pro: 'Up to 30', enterprise: 'Unlimited' },
  { label: 'Scheduling', starter: true, pro: true, enterprise: true },
  { label: 'Task dispatch', starter: true, pro: true, enterprise: true },
  { label: 'Mobile crew access', starter: true, pro: true, enterprise: true },
  { label: 'Schedule templates + copy week', starter: false, pro: true, enterprise: true },
  { label: 'Labor reports', starter: 'Basic', pro: 'Advanced + CSV', enterprise: 'Advanced + CSV' },
  { label: 'Cost tracking', starter: false, pro: true, enterprise: true },
  { label: 'Equipment tracking', starter: false, pro: true, enterprise: true },
  { label: 'Spray window alerts', starter: false, pro: true, enterprise: true },
  { label: 'Live radar', starter: false, pro: false, enterprise: true },
  { label: 'WhatsApp sharing', starter: false, pro: true, enterprise: true },
  { label: 'Multi-facility management', starter: false, pro: false, enterprise: true },
  { label: 'Budget & cost tracking', starter: false, pro: false, enterprise: true },
  { label: 'API access', starter: false, pro: false, enterprise: true },
  { label: 'Custom integrations', starter: false, pro: false, enterprise: true },
  { label: 'Dedicated onboarding + account manager', starter: false, pro: false, enterprise: true },
];

function renderFeatureValue(value: boolean | string) {
  if (typeof value === 'boolean') {
    return value
      ? <Check className="mx-auto h-4 w-4 text-brand-bright" />
      : <span className="text-text-muted">—</span>;
  }
  return <span className="text-text-secondary">{value}</span>;
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    document.title = 'Pricing — Ground Crew HQ';
  }, []);

  const effectiveTiers = tiers.map((tier) =>
    tier.name === 'Professional'
      ? { ...tier, price: billingCycle === 'annual' ? '$150/mo' : '$175/mo' }
      : tier,
  );

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      {/* Navbar */}
      <header className="border-b border-surface-border bg-surface-base/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="text-base font-semibold tracking-tight text-text-primary">Ground Crew HQ</div>
          <Link
            to="/"
            className="text-sm font-medium text-brand transition-colors hover:text-brand-bright"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-text-primary md:text-5xl">
            Simple Pricing for Every Operation
          </h1>
          <p className="mt-3 text-sm text-text-secondary md:text-base">
            All plans include a 14-day free trial. No credit card required.
          </p>

          {/* Billing toggle */}
          <div className="mt-5 inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface-card p-1 text-xs">
            <button
              type="button"
              className={`rounded-full px-4 py-1.5 font-medium transition-all duration-200 ${
                billingCycle === 'monthly'
                  ? 'bg-brand-bright text-text-inverse'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-1.5 font-medium transition-all duration-200 ${
                billingCycle === 'annual'
                  ? 'bg-brand-bright text-text-inverse'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              onClick={() => setBillingCycle('annual')}
            >
              Annual
            </button>
          </div>
          {billingCycle === 'annual' ? (
            <p className="mt-2 text-xs text-brand-bright">Professional annual plan: $150/mo (save $300/year).</p>
          ) : null}
        </div>

        {/* Tier cards */}
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {effectiveTiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-6 transition-all duration-200 ${
                tier.highlighted
                  ? 'scale-[1.02] border-brand/30 bg-surface-elevated'
                  : 'border-surface-border bg-surface-card hover:-translate-y-0.5'
              }`}
            >
              {tier.highlighted ? (
                <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-brand-bright px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-inverse">
                  <Star className="h-3 w-3" />
                  Most Popular
                </div>
              ) : null}
              <h2 className="text-xl font-semibold text-text-primary">{tier.name}</h2>
              <div className="mt-2 text-3xl font-bold tracking-tight text-text-primary">{tier.price}</div>
              <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">{tier.subtitle}</p>

              <ul className="mt-5 space-y-2">
                {tier.features.map((feature) => (
                  <li key={`${tier.name}-${feature}`} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-bright" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {tier.ctaHref.startsWith('mailto:') ? (
                  <a
                    href={tier.ctaHref}
                    className={`block w-full rounded-full py-2.5 text-center text-sm font-semibold transition-all duration-200 ${
                      tier.highlighted
                        ? 'bg-brand-bright text-text-inverse hover:brightness-110'
                        : 'border border-surface-border text-text-secondary hover:border-brand/30 hover:bg-surface-hover'
                    }`}
                  >
                    {tier.ctaLabel}
                  </a>
                ) : (
                  <Link
                    to={tier.ctaHref}
                    className={`block w-full rounded-full py-2.5 text-center text-sm font-semibold transition-all duration-200 ${
                      tier.highlighted
                        ? 'bg-brand-bright text-text-inverse hover:brightness-110'
                        : 'border border-surface-border text-text-secondary hover:border-brand/30 hover:bg-surface-hover'
                    }`}
                  >
                    {tier.ctaLabel}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Feature comparison table */}
        <section className="mt-10">
          <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="border-b border-surface-border bg-surface-elevated">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-text-primary">Features</th>
                    <th className="px-4 py-3 text-center font-semibold text-text-primary">Starter</th>
                    <th className="px-4 py-3 text-center font-semibold text-brand-bright">Pro</th>
                    <th className="px-4 py-3 text-center font-semibold text-text-primary">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {featureRows.map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-t border-surface-border/40 ${i % 2 === 0 ? '' : 'bg-surface-elevated/30'}`}
                    >
                      <td className="px-4 py-3 text-left text-text-secondary">{row.label}</td>
                      <td className="px-4 py-3 text-center text-text-muted">{renderFeatureValue(row.starter)}</td>
                      <td className="px-4 py-3 text-center text-text-secondary">{renderFeatureValue(row.pro)}</td>
                      <td className="px-4 py-3 text-center text-text-secondary">{renderFeatureValue(row.enterprise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-text-muted">
            Questions?{' '}
            <a href="mailto:support@groundcrewhq.com" className="text-brand hover:text-brand-bright">
              support@groundcrewhq.com
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}

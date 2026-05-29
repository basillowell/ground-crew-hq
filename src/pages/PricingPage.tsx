import { Check, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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
      'Weather dashboard + spray window alerts',
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
      'Spray window + weather-conflict detection',
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
      'Live radar + severe weather notifications',
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
  { label: 'Weather dashboard', starter: true, pro: true, enterprise: true },
  { label: 'Mobile crew access', starter: true, pro: true, enterprise: true },
  { label: 'Schedule templates + copy week', starter: false, pro: true, enterprise: true },
  { label: 'Labor reports', starter: 'Basic', pro: 'Advanced + CSV', enterprise: 'Advanced + CSV' },
  { label: 'Cost tracking', starter: false, pro: true, enterprise: true },
  { label: 'Equipment tracking', starter: false, pro: true, enterprise: true },
  { label: 'Spray window alerts', starter: false, pro: true, enterprise: true },
  { label: 'Live radar', starter: false, pro: false, enterprise: true },
  { label: 'Severe weather alerts', starter: false, pro: false, enterprise: true },
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
      ? <Check className="mx-auto h-4 w-4 text-lime-400" />
      : <span className="text-slate-600">—</span>;
  }
  return <span className="text-slate-300">{value}</span>;
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
    <div className="min-h-screen bg-[#0f1a14] text-slate-100">
      {/* Navbar */}
      <header className="border-b border-white/[0.06] bg-[#0f1a14]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="text-base font-semibold tracking-tight text-slate-100">Ground Crew HQ</div>
          <Link
            to="/"
            className="text-sm font-medium text-lime-400 transition-colors hover:text-lime-300"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="bg-gradient-to-br from-slate-100 to-lime-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent md:text-5xl">
            Simple Pricing for Every Operation
          </h1>
          <p className="mt-3 text-sm text-slate-400 md:text-base">
            All plans include a 14-day free trial. No credit card required.
          </p>

          {/* Billing toggle */}
          <div className="mt-5 inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#1a2d1f] p-1 text-xs">
            <button
              type="button"
              className={`rounded-full px-4 py-1.5 font-medium transition-all duration-200 ${
                billingCycle === 'monthly'
                  ? 'bg-lime-400 text-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-1.5 font-medium transition-all duration-200 ${
                billingCycle === 'annual'
                  ? 'bg-lime-400 text-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setBillingCycle('annual')}
            >
              Annual
            </button>
          </div>
          {billingCycle === 'annual' ? (
            <p className="mt-2 text-xs text-lime-400">Professional annual plan: $150/mo (save $300/year).</p>
          ) : null}
        </div>

        {/* Tier cards */}
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {effectiveTiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-6 transition-all duration-200 ${
                tier.highlighted
                  ? 'scale-[1.02] border-lime-400/30 bg-[#243828] shadow-[0_0_30px_rgba(163,230,53,0.08)]'
                  : 'border-white/[0.06] bg-[#1a2d1f] hover:-translate-y-0.5'
              }`}
            >
              {tier.highlighted ? (
                <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-lime-400 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black">
                  <Star className="h-3 w-3" />
                  Most Popular
                </div>
              ) : null}
              <h2 className="text-xl font-semibold text-slate-100">{tier.name}</h2>
              <div className="mt-2 text-3xl font-bold tracking-tight text-slate-100">{tier.price}</div>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{tier.subtitle}</p>

              <ul className="mt-5 space-y-2">
                {tier.features.map((feature) => (
                  <li key={`${tier.name}-${feature}`} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
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
                        ? 'bg-lime-400 text-black hover:brightness-110 hover:shadow-[0_0_16px_rgba(163,230,53,0.35)]'
                        : 'border border-white/[0.12] text-slate-300 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    {tier.ctaLabel}
                  </a>
                ) : (
                  <Link
                    to={tier.ctaHref}
                    className={`block w-full rounded-full py-2.5 text-center text-sm font-semibold transition-all duration-200 ${
                      tier.highlighted
                        ? 'bg-lime-400 text-black hover:brightness-110 hover:shadow-[0_0_16px_rgba(163,230,53,0.35)]'
                        : 'border border-white/[0.12] text-slate-300 hover:border-white/20 hover:bg-white/5'
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
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a2d1f]">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="border-b border-white/[0.06] bg-[#243828]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-200">Features</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-200">Starter</th>
                    <th className="px-4 py-3 text-center font-semibold text-lime-400">Pro</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-200">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {featureRows.map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-t border-white/[0.04] ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
                    >
                      <td className="px-4 py-3 text-left text-slate-300">{row.label}</td>
                      <td className="px-4 py-3 text-center text-slate-400">{renderFeatureValue(row.starter)}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{renderFeatureValue(row.pro)}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{renderFeatureValue(row.enterprise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-slate-500">
            Questions?{' '}
            <a href="mailto:support@groundcrewhq.com" className="text-lime-400 hover:text-lime-300">
              support@groundcrewhq.com
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}

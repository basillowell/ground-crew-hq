import { Check, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
    return value ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : <span className="text-muted-foreground">—</span>;
  }
  return <span>{value}</span>;
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbf8_0%,#eef6f1_100%)]">
      <header className="border-b border-emerald-100/80 bg-white/95">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="text-base font-semibold tracking-tight">Ground Crew HQ</div>
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-emerald-950 md:text-5xl">Simple Pricing for Every Operation</h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            All plans include a 14-day free trial. No credit card required.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border bg-white p-1 text-xs">
            <button
              type="button"
              className={`rounded-full px-3 py-1 ${billingCycle === 'monthly' ? 'bg-emerald-600 text-white' : ''}`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 ${billingCycle === 'annual' ? 'bg-emerald-600 text-white' : ''}`}
              onClick={() => setBillingCycle('annual')}
            >
              Annual
            </button>
          </div>
          {billingCycle === 'annual' ? <p className="mt-2 text-xs text-emerald-700">Professional annual plan: $150/mo (save $300/year).</p> : null}
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {effectiveTiers.map((tier) => (
            <Card
              key={tier.name}
              className={`relative rounded-2xl p-6 ${tier.highlighted ? 'border-emerald-400 bg-emerald-50/70 shadow-md' : 'border-emerald-100 bg-white'}`}
            >
              {tier.highlighted ? (
                <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  <Star className="h-3 w-3" />
                  Most Popular
                </div>
              ) : null}
              <h2 className="text-xl font-semibold">{tier.name}</h2>
              <div className="mt-2 text-3xl font-bold tracking-tight text-emerald-900">{tier.price}</div>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{tier.subtitle}</p>

              <ul className="mt-5 space-y-2">
                {tier.features.map((feature) => (
                  <li key={`${tier.name}-${feature}`} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {tier.ctaHref.startsWith('mailto:') ? (
                  <a href={tier.ctaHref}>
                    <Button className="w-full" variant={tier.highlighted ? 'default' : 'outline'}>
                      {tier.ctaLabel}
                    </Button>
                  </a>
                ) : (
                  <Link to={tier.ctaHref}>
                    <Button className="w-full" variant={tier.highlighted ? 'default' : 'outline'}>
                      {tier.ctaLabel}
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </section>

        <section className="mt-10">
          <Card className="overflow-hidden rounded-2xl border-emerald-100 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-emerald-50/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Features</th>
                    <th className="px-4 py-3 text-center font-semibold">Starter</th>
                    <th className="px-4 py-3 text-center font-semibold">Pro</th>
                    <th className="px-4 py-3 text-center font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {featureRows.map((row) => (
                    <tr key={row.label} className="border-t">
                      <td className="px-4 py-3 text-left">{row.label}</td>
                      <td className="px-4 py-3 text-center">{renderFeatureValue(row.starter)}</td>
                      <td className="px-4 py-3 text-center">{renderFeatureValue(row.pro)}</td>
                      <td className="px-4 py-3 text-center">{renderFeatureValue(row.enterprise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Questions? Email support@groundcrewhq.com
          </p>
        </section>
      </main>
    </div>
  );
}


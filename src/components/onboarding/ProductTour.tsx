'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ProductTourProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const tourSteps = [
  {
    title: 'Welcome',
    body: 'Welcome aboard. Ground Crew HQ runs your whole operation — properties, crews, work, and payroll — in one place. This quick tour points out where everything lives.',
  },
  {
    title: 'Command Center',
    body: "Your day at a glance: who's working, what's assigned, open work orders, and equipment status across every property.",
    href: '/app/dashboard',
  },
  {
    title: 'Work Orders',
    body: "Requests from clients and equipment that's due for service, all vetted through one funnel — review → accept → assign to a crew member → verify complete.",
    href: '/app/work-orders',
  },
  {
    title: 'Scheduler & Workflow',
    body: 'Plan the week and dispatch your crew to tasks at each property.',
    href: '/app/scheduler',
  },
  {
    title: 'Properties',
    body: 'Every site you maintain, with maps, boundaries, and per-project areas.',
    href: '/app/properties',
  },
  {
    title: 'Team & Equipment',
    body: 'Your crew and your assets. Set service intervals on equipment and generate service work orders when maintenance is due.',
    href: '/app/equipment',
  },
  {
    title: 'Payroll',
    body: "Review each employee's hours for the pay period, approve to submit to payroll, and export a packet for your accountant. Once submitted, entries lock — review only.",
    href: '/app/payroll',
  },
  {
    title: 'Field view',
    body: "What your crew sees on their phones: today's tasks, clock in/out, and photo & signature capture.",
    href: '/app/field',
  },
];

export function ProductTour({ open, onOpenChange }: ProductTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = tourSteps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tourSteps.length - 1;

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-surface-border bg-surface-card text-text-primary sm:max-w-xl">
        <DialogHeader>
          <div className="mb-2 inline-flex w-fit rounded-full border border-brand-dim bg-brand-ghost px-2.5 py-1 text-xs font-medium text-brand">
            Step {stepIndex + 1} of {tourSteps.length}
          </div>
          <DialogTitle className="text-xl text-text-primary">{step.title}</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-text-secondary">
            {step.body}
          </DialogDescription>
        </DialogHeader>

        {step.href ? (
          <Button
            asChild
            variant="outline"
            className="w-fit border-surface-border bg-surface-elevated text-text-primary hover:bg-surface-hover"
          >
            <Link href={step.href}>
              Go there →
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="border-surface-border bg-surface-elevated text-text-primary hover:bg-surface-hover"
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            disabled={isFirst}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {isLast ? (
            <Button
              type="button"
              className="bg-brand text-text-inverse hover:bg-brand-bright"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-brand text-text-inverse hover:bg-brand-bright"
              onClick={() => setStepIndex((current) => Math.min(tourSteps.length - 1, current + 1))}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

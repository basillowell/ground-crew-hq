'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, Compass, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { useDismissOnboarding } from '@/lib/supabase-queries';
import { ProductTour } from './ProductTour';

type GettingStartedPanelProps = {
  orgId?: string | null;
  isVisible: boolean;
  onboardingDismissed?: boolean;
  properties: ReadonlyArray<unknown>;
  employees: ReadonlyArray<unknown>;
  equipment: ReadonlyArray<unknown>;
};

type ChecklistItem = {
  title: string;
  description: string;
  href: string;
  done?: boolean;
};

export function GettingStartedPanel({
  orgId,
  isVisible,
  onboardingDismissed = false,
  properties,
  employees,
  equipment,
}: GettingStartedPanelProps) {
  const [tourOpen, setTourOpen] = useState(false);
  const dismissMutation = useDismissOnboarding(orgId ?? undefined);

  const checklist = useMemo<ChecklistItem[]>(() => [
    {
      title: 'Add the properties you maintain',
      description: 'The sites, facilities, and grounds your crew takes care of.',
      href: '/app/properties',
      done: properties.length > 0,
    },
    {
      title: 'Add your crew',
      description: 'Your team members and their roles.',
      href: '/app/employees',
      done: employees.length > 0,
    },
    {
      title: 'Add your equipment',
      description: 'Mowers, trucks, and tools. Set service intervals and Ground Crew HQ can auto-generate service work orders when maintenance comes due.',
      href: '/app/equipment',
      done: equipment.length > 0,
    },
    {
      title: 'Plan the week',
      description: 'Assign your crew to tasks at each property, day by day, on the Scheduler and Workflow board.',
      href: '/app/scheduler',
    },
    {
      title: 'Handle a work order',
      description: 'Client requests and equipment-due repairs flow through one funnel: review → accept → assign → verify complete.',
      href: '/app/work-orders',
    },
  ], [employees.length, equipment.length, properties.length]);

  const autoCheckItems = checklist.filter((item) => typeof item.done === 'boolean');
  const allAutoChecksDone = autoCheckItems.every((item) => item.done);

  if (!isVisible || onboardingDismissed || allAutoChecksDone) return null;

  const handleDismiss = async () => {
    try {
      await dismissMutation.mutateAsync();
      toast.success('Getting Started dismissed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not dismiss Getting Started.');
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-surface-border bg-surface-card text-text-primary shadow-sm">
        <div className="h-1 bg-brand" />
        <CardHeader className="space-y-3 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="active" className="gap-1">
                  <Compass className="h-3.5 w-3.5" />
                  Tour
                </Badge>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                  Getting Started
                </p>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Welcome to Ground Crew HQ</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
                  Your command center for managing properties, crews, and the work that keeps them sharp. Here's how to get set up — do these in any order.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-start text-text-muted hover:bg-surface-hover hover:text-text-primary"
              onClick={() => void handleDismiss()}
              disabled={dismissMutation.isPending}
              aria-label="Dismiss Getting Started"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-5 pt-0">
          <div className="grid gap-2">
            {checklist.map((item) => {
              const hasAutoCheck = typeof item.done === 'boolean';
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group flex items-start gap-3 rounded-lg border border-surface-border bg-surface-elevated p-3 transition-colors hover:border-brand-dim hover:bg-surface-hover"
                >
                  <span className="mt-0.5">
                    {item.done ? (
                      <CheckCircle2 className="h-5 w-5 text-status-active" />
                    ) : (
                      <Circle className="h-5 w-5 text-text-muted" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-primary">
                      {item.title}
                      {hasAutoCheck ? (
                        <Badge variant={item.done ? 'complete' : 'hold'}>
                          {item.done ? 'Done' : 'To do'}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-text-secondary">{item.description}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-text-muted transition-colors group-hover:text-brand" />
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 border-t border-surface-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              className="bg-brand text-text-inverse hover:bg-brand-bright"
              onClick={() => setTourOpen(true)}
            >
              <Compass className="h-4 w-4" />
              Take a guided tour
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-text-muted hover:bg-surface-hover hover:text-text-primary"
              onClick={() => void handleDismiss()}
              disabled={dismissMutation.isPending}
            >
              {dismissMutation.isPending ? 'Dismissing...' : 'Dismiss'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProductTour open={tourOpen} onOpenChange={setTourOpen} />
    </>
  );
}

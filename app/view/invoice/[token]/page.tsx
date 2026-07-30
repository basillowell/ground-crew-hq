'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/src/lib/supabase';

type SharedLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type SharedInvoice = {
  businessName: string;
  clientName: string;
  invoiceNumber: number | string;
  createdAt: string | null;
  status: string;
  subtotal: number;
  taxRate: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes: string;
  lineItems: SharedLineItem[];
};

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function numberFrom(value: unknown): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function stringFrom(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value.includes('T') ? value : `${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return null;
}

function normalizeLineItems(items: unknown): SharedLineItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      description: stringFrom(getField(row, 'description'), 'Item'),
      quantity: numberFrom(getField(row, 'quantity', 'qty')),
      unitPrice: numberFrom(getField(row, 'unit_price', 'unitPrice')),
      lineTotal: numberFrom(getField(row, 'line_total', 'lineTotal')),
    };
  });
}

function normalizeInvoice(payload: unknown): SharedInvoice {
  const row = (payload ?? {}) as Record<string, unknown>;
  const subtotal = numberFrom(getField(row, 'subtotal'));
  const total = numberFrom(getField(row, 'total'));
  const taxRate = numberFrom(getField(row, 'tax_rate', 'taxRate'));
  const taxTotal = numberFrom(getField(row, 'tax_total', 'taxTotal')) || Math.max(total - subtotal, 0);
  const amountPaid = numberFrom(getField(row, 'amount_paid', 'amountPaid'));

  return {
    businessName: stringFrom(getField(row, 'business_name', 'businessName', 'organization_name'), 'Ground Crew HQ'),
    clientName: stringFrom(getField(row, 'client_name', 'clientName'), ''),
    invoiceNumber: stringFrom(getField(row, 'invoice_number', 'invoiceNumber'), '') || numberFrom(getField(row, 'invoice_number', 'invoiceNumber')),
    createdAt: stringFrom(getField(row, 'created_at', 'createdAt', 'date'), '') || null,
    status: stringFrom(getField(row, 'status'), 'open').toLowerCase(),
    subtotal,
    taxRate,
    taxTotal,
    total,
    amountPaid,
    balanceDue: Math.max(numberFrom(getField(row, 'balance_due', 'balanceDue')) || total - amountPaid, 0),
    notes: stringFrom(getField(row, 'notes'), ''),
    lineItems: normalizeLineItems(getField(row, 'line_items', 'lineItems')),
  };
}

function withTimeout<T extends PromiseLike<unknown>>(promise: T, message: string): Promise<Awaited<T>> {
  let timeoutId = 0;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), 12_000);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full border border-surface-border bg-surface-elevated px-3 py-1 text-sm font-medium capitalize text-text-primary">
      {status}
    </span>
  );
}

function PageSkeleton() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-10 text-text-primary">
      <div className="mx-auto max-w-4xl rounded-lg border border-surface-border bg-surface-card p-6 shadow-sm md:p-10">
        <div className="h-7 w-48 animate-pulse rounded bg-surface-elevated" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="h-20 animate-pulse rounded bg-surface-elevated" />
          <div className="h-20 animate-pulse rounded bg-surface-elevated" />
          <div className="h-20 animate-pulse rounded bg-surface-elevated" />
        </div>
        <div className="mt-8 space-y-3">
          <div className="h-10 animate-pulse rounded bg-surface-elevated" />
          <div className="h-10 animate-pulse rounded bg-surface-elevated" />
          <div className="h-10 animate-pulse rounded bg-surface-elevated" />
        </div>
      </div>
    </main>
  );
}

function MessageState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-10 text-text-primary">
      <section className="mx-auto max-w-xl rounded-lg border border-surface-border bg-surface-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-text-secondary">{body}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-text-inverse hover:bg-brand/90"
          >
            Retry
          </button>
        ) : null}
      </section>
    </main>
  );
}

export default function SharedInvoicePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const [state, setState] = useState<LoadState>('loading');
  const [invoice, setInvoice] = useState<SharedInvoice | null>(null);

  const loadInvoice = useCallback(async () => {
    if (!uuidPattern.test(token)) {
      setState('missing');
      return;
    }

    setState('loading');
    try {
      const supabase = createClient();
      const { data, error } = await withTimeout(
        supabase.rpc('get_shared_invoice', { p_token: token }),
        'Invoice request timed out.',
      );
      if (error) throw error;
      if (!data) {
        setInvoice(null);
        setState('missing');
        return;
      }
      setInvoice(normalizeInvoice(data));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  if (state === 'loading') return <PageSkeleton />;
  if (state === 'missing') {
    return <MessageState title="Invoice unavailable" body="This link is not valid or has expired." />;
  }
  if (state === 'error') {
    return <MessageState title="We could not load this invoice" body="Please try again." onRetry={() => void loadInvoice()} />;
  }
  if (!invoice) return null;

  return (
    <main className="min-h-screen bg-surface-base px-4 py-8 text-text-primary md:py-12">
      <article className="mx-auto max-w-4xl rounded-lg border border-surface-border bg-surface-card p-6 shadow-sm md:p-10">
        <header className="flex flex-col gap-6 border-b border-surface-border pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-text-secondary">Invoice</p>
            <h1 className="mt-2 text-3xl font-bold">{invoice.businessName}</h1>
            {invoice.clientName ? <p className="mt-2 text-text-secondary">Prepared for {invoice.clientName}</p> : null}
          </div>
          <div className="space-y-2 text-left sm:text-right">
            <div className="text-2xl font-bold">#{invoice.invoiceNumber}</div>
            <StatusBadge status={invoice.status} />
          </div>
        </header>

        <section className="grid gap-4 border-b border-surface-border py-6 sm:grid-cols-4">
          <div>
            <div className="text-sm text-text-secondary">Date</div>
            <div className="mt-1 font-medium">{formatDate(invoice.createdAt)}</div>
          </div>
          <div>
            <div className="text-sm text-text-secondary">Amount</div>
            <div className="mt-1 font-medium">{formatCurrency(invoice.total)}</div>
          </div>
          <div>
            <div className="text-sm text-text-secondary">Paid</div>
            <div className="mt-1 font-medium">{formatCurrency(invoice.amountPaid)}</div>
          </div>
          <div>
            <div className="text-sm text-text-secondary">Balance</div>
            <div className="mt-1 text-xl font-bold">{formatCurrency(invoice.balanceDue)}</div>
          </div>
        </section>

        <section className="py-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-text-secondary">
                  <th className="py-3 pr-4 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Unit price</th>
                  <th className="py-3 pl-4 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {invoice.lineItems.length === 0 ? (
                  <tr>
                    <td className="py-6 text-text-secondary" colSpan={4}>No line items listed.</td>
                  </tr>
                ) : (
                  invoice.lineItems.map((item, index) => (
                    <tr key={`${item.description}-${index}`}>
                      <td className="py-4 pr-4">{item.description}</td>
                      <td className="px-4 py-4 text-right">{item.quantity}</td>
                      <td className="px-4 py-4 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-4 pl-4 text-right font-medium">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex justify-end border-b border-surface-border pb-6">
          <div className="w-full max-w-sm space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Subtotal</span>
              <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Tax {invoice.taxRate ? `(${invoice.taxRate}%)` : ''}</span>
              <span className="font-medium">{formatCurrency(invoice.taxTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-surface-border pt-3 text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Paid</span>
              <span className="font-medium">{formatCurrency(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Balance</span>
              <span>{formatCurrency(invoice.balanceDue)}</span>
            </div>
          </div>
        </section>

        {invoice.notes ? (
          <section className="pt-6">
            <h2 className="text-sm font-semibold">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{invoice.notes}</p>
          </section>
        ) : null}
      </article>
    </main>
  );
}

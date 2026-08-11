'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/src/lib/supabase';

type RequestContext = {
  businessName: string;
  clientName: string;
};

type SubmitResult = {
  ok?: boolean;
  id?: string;
  error?: string;
};

type LoadState = 'loading' | 'ready' | 'missing' | 'error' | 'submitted';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringFrom(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function getField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return null;
}

function normalizeContext(payload: unknown): RequestContext | null {
  const row = (payload ?? {}) as Record<string, unknown>;
  const businessName = stringFrom(getField(row, 'business_name', 'businessName'), '');
  const clientName = stringFrom(getField(row, 'client_name', 'clientName'), '');
  if (!businessName && !clientName) return null;
  return {
    businessName: businessName || 'Ground Crew HQ',
    clientName,
  };
}

function withTimeout<T extends PromiseLike<unknown>>(promise: T, message: string): Promise<Awaited<T>> {
  let timeoutId = 0;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), 12_000);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
}

function PageSkeleton() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-10 text-text-primary">
      <div className="mx-auto max-w-2xl rounded-lg border border-surface-border bg-surface-card p-6 shadow-sm md:p-10">
        <div className="h-7 w-56 animate-pulse rounded bg-surface-elevated" />
        <div className="mt-4 h-4 w-44 animate-pulse rounded bg-surface-elevated" />
        <div className="mt-8 space-y-4">
          <div className="h-10 animate-pulse rounded bg-surface-elevated" />
          <div className="h-32 animate-pulse rounded bg-surface-elevated" />
          <div className="h-10 w-36 animate-pulse rounded bg-surface-elevated" />
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

function SuccessState() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-10 text-text-primary">
      <section className="mx-auto max-w-xl rounded-lg border border-status-active/30 bg-surface-card p-8 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 text-status-active" />
          <div>
            <h1 className="text-2xl font-bold">Request submitted</h1>
            <p className="mt-3 text-sm text-text-secondary">Your crew will review it shortly.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ClientWorkRequestPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const [state, setState] = useState<LoadState>('loading');
  const [context, setContext] = useState<RequestContext | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadContext = useCallback(async () => {
    if (!uuidPattern.test(token)) {
      setState('missing');
      return;
    }

    setState('loading');
    setSubmitError(null);
    try {
      const supabase = createClient();
      const { data, error } = await withTimeout(
        supabase.rpc('get_client_request_context', { p_token: token }),
        'Request link lookup timed out.',
      );
      if (error) throw error;
      const normalized = normalizeContext(data);
      if (!normalized) {
        setContext(null);
        setState('missing');
        return;
      }
      setContext(normalized);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const submitRequest = async () => {
    if (submitting || !uuidPattern.test(token)) return;
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    setTitleError(null);
    setSubmitError(null);

    if (!trimmedTitle) {
      setTitleError('Title is required.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await withTimeout(
        supabase.rpc('submit_client_work_order', {
          p_token: token,
          p_title: trimmedTitle,
          p_description: trimmedDescription || null,
        }),
        'Request submission timed out.',
      );
      if (error) throw error;
      const result = (data ?? {}) as SubmitResult;
      if (result.ok) {
        setState('submitted');
        return;
      }
      if (result.error === 'title_required') {
        setTitleError('Title is required.');
        return;
      }
      if (result.error === 'invalid_link') {
        setState('missing');
        return;
      }
      setSubmitError('We could not submit this request. Please try again.');
    } catch {
      setSubmitError('We could not submit this request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') return <PageSkeleton />;
  if (state === 'missing') {
    return <MessageState title="This request link is not valid" body="Please ask your crew for a fresh request link." />;
  }
  if (state === 'error') {
    return <MessageState title="We could not load this request link" body="Please try again." onRetry={() => void loadContext()} />;
  }
  if (state === 'submitted') return <SuccessState />;
  if (!context) return null;

  return (
    <main className="min-h-screen bg-surface-base px-4 py-8 text-text-primary md:py-12">
      <section className="mx-auto max-w-2xl rounded-lg border border-surface-border bg-surface-card p-6 shadow-sm md:p-10">
        <header className="border-b border-surface-border pb-6">
          <p className="text-sm font-semibold uppercase text-text-secondary">Work Request</p>
          <h1 className="mt-2 text-3xl font-bold">Request work from {context.businessName}</h1>
          {context.clientName ? <p className="mt-2 text-text-secondary">Submitting as {context.clientName}</p> : null}
        </header>

        <form
          className="space-y-5 pt-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submitRequest();
          }}
        >
          <div>
            <label className="text-sm font-medium text-text-primary" htmlFor="request-title">
              Title
            </label>
            <input
              id="request-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (titleError) setTitleError(null);
              }}
              disabled={submitting}
              className="mt-2 h-11 w-full rounded-md border border-surface-border bg-surface-card px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
              placeholder="What work do you need?"
              required
            />
            {titleError ? <p className="mt-2 text-sm text-status-warning">{titleError}</p> : null}
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary" htmlFor="request-description">
              Description
            </label>
            <textarea
              id="request-description"
              rows={6}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={submitting}
              className="mt-2 w-full rounded-md border border-surface-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
              placeholder="Add helpful details for the crew."
            />
          </div>

          {submitError ? (
            <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning">
              {submitError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="inline-flex h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-text-inverse hover:bg-brand/90 disabled:opacity-60"
          >
            {submitting ? 'Submitting' : 'Submit Request'}
          </button>
        </form>
      </section>
    </main>
  );
}

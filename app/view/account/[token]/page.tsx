'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  MapPin,
  MonitorSmartphone,
  PenLine,
} from 'lucide-react';
import { Badge, type BadgeProps } from '@/src/components/ui/badge';
import { createClient } from '@/src/lib/supabase';

type PublicAccountProperty = {
  name: string;
  shortName: string;
  logoInitials: string;
  color: string;
};

type PublicScopeItem = {
  description: string;
  quantity: number;
};

type PublicScopeContract = {
  contractName: string;
  propertyName: string | null;
  frequency: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  scopeItems: PublicScopeItem[];
};

type PublicDeliveryAssignment = {
  date: string | null;
  crewName: string;
  taskName: string;
  taskCategory: string | null;
  status: string;
  actualHours: number;
  actualStartAt: string | null;
  actualCompletedAt: string | null;
};

type PublicSignature = {
  signerName: string;
  signedAt: string | null;
};

type PublicPhotoCaption = {
  caption: string;
  createdAt: string | null;
};

type PublicGeoNote = {
  title: string;
  content: string;
  locationGeojson: { type: 'Point'; coordinates: [number, number] } | null;
  createdAt: string | null;
};

type PublicDeliveredResult = {
  title: string;
  description: string | null;
  propertyName: string | null;
  priority: string;
  source: string;
  funnelStage: string;
  acceptedAt: string | null;
  completedAt: string | null;
  dueDate: string | null;
  punchList: string | null;
  deliveryTimestamp: string | null;
  assignmentCount: number;
  actualHours: number;
  assignments: PublicDeliveryAssignment[];
  signatureCount: number;
  signatures: PublicSignature[];
  proofPhotoCount: number;
  proofPhotoCaptions: PublicPhotoCaption[];
  geoNotes: PublicGeoNote[];
};

type PublicAccountResultsBoard = {
  businessName: string;
  logoUrl: string | null;
  account: { name: string };
  period: { monthStart: string; monthEnd: string };
  properties: PublicAccountProperty[];
  scopeBaseline: PublicScopeContract[];
  deliveredResults: PublicDeliveredResult[];
  monthRollup: {
    completedCount: number;
    pendingVerificationCount: number;
    actualHours: number;
  };
  trend: Array<{
    month: string;
    completedCount: number;
    pendingVerificationCount: number;
    actualHours: number;
  }>;
  generatedAt: string | null;
};

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringFrom(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberFrom(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function getField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return null;
}

function withTimeout<T extends PromiseLike<unknown>>(promise: T, message: string): Promise<Awaited<T>> {
  let timeoutId = 0;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), 15_000);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
}

function firstOf(record: Record<string, unknown>, snakeKey: string, camelKey: string) {
  return getField(record, snakeKey, camelKey);
}

function normalizeProperty(payload: unknown): PublicAccountProperty {
  const row = (payload ?? {}) as Record<string, unknown>;
  const name = stringFrom(getField(row, 'name'), 'Property');
  return {
    name,
    shortName: stringFrom(firstOf(row, 'short_name', 'shortName'), name),
    logoInitials: stringFrom(firstOf(row, 'logo_initials', 'logoInitials'), 'GC'),
    color: stringFrom(getField(row, 'color'), ''),
  };
}

function normalizeScopeItem(payload: unknown): PublicScopeItem {
  const row = (payload ?? {}) as Record<string, unknown>;
  return {
    description: stringFrom(getField(row, 'description'), 'Scope item'),
    quantity: numberFrom(getField(row, 'quantity')),
  };
}

function normalizeScopeContract(payload: unknown): PublicScopeContract {
  const row = (payload ?? {}) as Record<string, unknown>;
  const scopeItems = getField(row, 'scope_items', 'scopeItems');
  return {
    contractName: stringFrom(firstOf(row, 'contract_name', 'contractName'), 'Service scope'),
    propertyName: stringFrom(firstOf(row, 'property_name', 'propertyName'), '') || null,
    frequency: stringFrom(getField(row, 'frequency'), 'scheduled'),
    status: stringFrom(getField(row, 'status'), 'active'),
    startDate: stringFrom(firstOf(row, 'start_date', 'startDate'), '') || null,
    endDate: stringFrom(firstOf(row, 'end_date', 'endDate'), '') || null,
    scopeItems: Array.isArray(scopeItems) ? scopeItems.map(normalizeScopeItem) : [],
  };
}

function normalizeAssignment(payload: unknown): PublicDeliveryAssignment {
  const row = (payload ?? {}) as Record<string, unknown>;
  return {
    date: stringFrom(getField(row, 'date'), '') || null,
    crewName: stringFrom(firstOf(row, 'crew_name', 'crewName'), 'Crew'),
    taskName: stringFrom(firstOf(row, 'task_name', 'taskName'), 'Assignment'),
    taskCategory: stringFrom(firstOf(row, 'task_category', 'taskCategory'), '') || null,
    status: stringFrom(getField(row, 'status'), 'completed'),
    actualHours: numberFrom(firstOf(row, 'actual_hours', 'actualHours')),
    actualStartAt: stringFrom(firstOf(row, 'actual_start_at', 'actualStartAt'), '') || null,
    actualCompletedAt: stringFrom(firstOf(row, 'actual_completed_at', 'actualCompletedAt'), '') || null,
  };
}

function normalizeSignature(payload: unknown): PublicSignature {
  const row = (payload ?? {}) as Record<string, unknown>;
  return {
    signerName: stringFrom(firstOf(row, 'signer_name', 'signerName'), 'Signed'),
    signedAt: stringFrom(firstOf(row, 'signed_at', 'signedAt'), '') || null,
  };
}

function normalizePhotoCaption(payload: unknown): PublicPhotoCaption {
  const row = (payload ?? {}) as Record<string, unknown>;
  return {
    caption: stringFrom(getField(row, 'caption'), 'Proof photo'),
    createdAt: stringFrom(firstOf(row, 'created_at', 'createdAt'), '') || null,
  };
}

function normalizeGeoNote(payload: unknown): PublicGeoNote {
  const row = (payload ?? {}) as Record<string, unknown>;
  const locationGeojson = firstOf(row, 'location_geojson', 'locationGeojson');
  const point = (locationGeojson ?? {}) as Record<string, unknown>;
  const coordinates = point.type === 'Point' && Array.isArray(point.coordinates) ? point.coordinates : null;
  return {
    title: stringFrom(getField(row, 'title'), 'Map note'),
    content: stringFrom(getField(row, 'content'), ''),
    locationGeojson: coordinates && coordinates.length >= 2
      ? { type: 'Point', coordinates: [numberFrom(coordinates[0]), numberFrom(coordinates[1])] }
      : null,
    createdAt: stringFrom(firstOf(row, 'created_at', 'createdAt'), '') || null,
  };
}

function normalizeDeliveredResult(payload: unknown): PublicDeliveredResult {
  const row = (payload ?? {}) as Record<string, unknown>;
  const assignments = getField(row, 'assignments');
  const signatures = getField(row, 'signatures');
  const proofPhotoCaptions = getField(row, 'proof_photo_captions', 'proofPhotoCaptions');
  const geoNotes = getField(row, 'geo_notes', 'geoNotes');
  return {
    title: stringFrom(getField(row, 'title'), 'Completed work'),
    description: stringFrom(getField(row, 'description'), '') || null,
    propertyName: stringFrom(firstOf(row, 'property_name', 'propertyName'), '') || null,
    priority: stringFrom(getField(row, 'priority'), 'medium'),
    source: stringFrom(getField(row, 'source'), 'internal'),
    funnelStage: stringFrom(firstOf(row, 'funnel_stage', 'funnelStage'), 'completed'),
    acceptedAt: stringFrom(firstOf(row, 'accepted_at', 'acceptedAt'), '') || null,
    completedAt: stringFrom(firstOf(row, 'completed_at', 'completedAt'), '') || null,
    dueDate: stringFrom(firstOf(row, 'due_date', 'dueDate'), '') || null,
    punchList: stringFrom(firstOf(row, 'punch_list', 'punchList'), '') || null,
    deliveryTimestamp: stringFrom(firstOf(row, 'delivery_timestamp', 'deliveryTimestamp'), '') || null,
    assignmentCount: numberFrom(firstOf(row, 'assignment_count', 'assignmentCount')),
    actualHours: numberFrom(firstOf(row, 'actual_hours', 'actualHours')),
    assignments: Array.isArray(assignments) ? assignments.map(normalizeAssignment) : [],
    signatureCount: numberFrom(firstOf(row, 'signature_count', 'signatureCount')),
    signatures: Array.isArray(signatures) ? signatures.map(normalizeSignature) : [],
    proofPhotoCount: numberFrom(firstOf(row, 'proof_photo_count', 'proofPhotoCount')),
    proofPhotoCaptions: Array.isArray(proofPhotoCaptions) ? proofPhotoCaptions.map(normalizePhotoCaption) : [],
    geoNotes: Array.isArray(geoNotes) ? geoNotes.map(normalizeGeoNote) : [],
  };
}

function normalizeBoard(payload: unknown): PublicAccountResultsBoard | null {
  const row = (payload ?? {}) as Record<string, unknown>;
  const businessName = stringFrom(firstOf(row, 'business_name', 'businessName'), '');
  const accountRow = (getField(row, 'account') ?? {}) as Record<string, unknown>;
  const accountName = stringFrom(getField(accountRow, 'name'), '');
  if (!businessName && !accountName) return null;

  const period = (getField(row, 'period') ?? {}) as Record<string, unknown>;
  const monthRollup = (firstOf(row, 'month_rollup', 'monthRollup') ?? {}) as Record<string, unknown>;
  const properties = getField(row, 'properties');
  const scopeBaseline = firstOf(row, 'scope_baseline', 'scopeBaseline');
  const deliveredResults = firstOf(row, 'delivered_results', 'deliveredResults');
  const trend = getField(row, 'trend');

  return {
    businessName: businessName || 'Ground Crew HQ',
    logoUrl: stringFrom(firstOf(row, 'logo_url', 'logoUrl'), '') || null,
    account: { name: accountName || 'Account' },
    period: {
      monthStart: stringFrom(firstOf(period, 'month_start', 'monthStart'), new Date().toLocaleDateString('en-CA')),
      monthEnd: stringFrom(firstOf(period, 'month_end', 'monthEnd'), new Date().toLocaleDateString('en-CA')),
    },
    properties: Array.isArray(properties) ? properties.map(normalizeProperty) : [],
    scopeBaseline: Array.isArray(scopeBaseline) ? scopeBaseline.map(normalizeScopeContract) : [],
    deliveredResults: Array.isArray(deliveredResults) ? deliveredResults.map(normalizeDeliveredResult) : [],
    monthRollup: {
      completedCount: numberFrom(firstOf(monthRollup, 'completed_count', 'completedCount')),
      pendingVerificationCount: numberFrom(firstOf(monthRollup, 'pending_verification_count', 'pendingVerificationCount')),
      actualHours: numberFrom(firstOf(monthRollup, 'actual_hours', 'actualHours')),
    },
    trend: Array.isArray(trend)
      ? trend.map((entry) => {
          const item = (entry ?? {}) as Record<string, unknown>;
          return {
            month: stringFrom(getField(item, 'month'), ''),
            completedCount: numberFrom(firstOf(item, 'completed_count', 'completedCount')),
            pendingVerificationCount: numberFrom(firstOf(item, 'pending_verification_count', 'pendingVerificationCount')),
            actualHours: numberFrom(firstOf(item, 'actual_hours', 'actualHours')),
          };
        })
      : [],
    generatedAt: stringFrom(firstOf(row, 'generated_at', 'generatedAt'), '') || null,
  };
}

function dateFromMonth(value: string) {
  const parsed = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getInitialMonth() {
  if (typeof window === 'undefined') return new Date().toLocaleDateString('en-CA').slice(0, 7) + '-01';
  const month = new URLSearchParams(window.location.search).get('month') ?? '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(month)) return month.slice(0, 7) + '-01';
  return new Date().toLocaleDateString('en-CA').slice(0, 7) + '-01';
}

function shiftMonth(value: string, offset: number) {
  const date = dateFromMonth(value);
  date.setMonth(date.getMonth() + offset);
  return date.toLocaleDateString('en-CA').slice(0, 7) + '-01';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatMonth(value: string) {
  const parsed = dateFromMonth(value);
  return parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function titleCase(value: string) {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStageVariant(stage: string): BadgeProps['variant'] {
  if (stage === 'completed') return 'complete';
  if (stage === 'pending_verification') return 'pending';
  if (stage === 'rejected') return 'warning';
  if (stage === 'assigned' || stage === 'accepted') return 'active';
  return 'hold';
}

function PageSkeleton() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-6 text-text-primary md:px-8">
      <section className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-2xl border border-surface-border bg-surface-card p-5">
          <div className="h-8 w-72 animate-pulse rounded bg-surface-elevated" />
          <div className="mt-4 h-4 w-48 animate-pulse rounded bg-surface-elevated" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-28 animate-pulse rounded-xl bg-surface-card" />
          <div className="h-28 animate-pulse rounded-xl bg-surface-card" />
          <div className="h-28 animate-pulse rounded-xl bg-surface-card" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-xl bg-surface-card" />
          <div className="h-80 animate-pulse rounded-xl bg-surface-card" />
        </div>
      </section>
    </main>
  );
}

function MessageState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-10 text-text-primary">
      <section className="mx-auto max-w-xl rounded-lg border border-surface-border bg-surface-card p-8 text-center shadow-sm">
        <MonitorSmartphone className="mx-auto h-10 w-10 text-text-secondary" />
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
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

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-surface-border bg-surface-elevated/60 p-6 text-center">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-2 text-sm text-text-secondary">{body}</p>
    </div>
  );
}

export default function PublicAccountResultsBoardPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const [month, setMonth] = useState(getInitialMonth);
  const [state, setState] = useState<LoadState>('loading');
  const [board, setBoard] = useState<PublicAccountResultsBoard | null>(null);
  const refreshDebounceRef = useRef<number | null>(null);

  const loadBoard = useCallback(async (showLoading = true) => {
    if (!uuidPattern.test(token)) {
      setState('missing');
      return;
    }

    if (showLoading) setState('loading');
    try {
      const supabase = createClient();
      const { data, error } = await withTimeout(
        supabase.rpc('get_public_account_results_board', { p_token: token, p_month: month }),
        'Account results board lookup timed out.',
      );
      if (error) throw error;
      const normalized = normalizeBoard(data);
      if (!normalized) {
        setBoard(null);
        setState('missing');
        return;
      }
      setBoard(normalized);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [month, token]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (typeof window === 'undefined' || !uuidPattern.test(token)) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('month', month);
    window.history.replaceState(null, '', nextUrl.toString());
  }, [month, token]);

  useEffect(() => {
    if (!uuidPattern.test(token)) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`public-account-board:${token}`)
      .on('broadcast', { event: 'refresh' }, () => {
        if (refreshDebounceRef.current !== null) {
          window.clearTimeout(refreshDebounceRef.current);
        }
        refreshDebounceRef.current = window.setTimeout(() => {
          refreshDebounceRef.current = null;
          void loadBoard(false);
        }, 500);
      })
      .subscribe();

    return () => {
      if (refreshDebounceRef.current !== null) {
        window.clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadBoard, token]);

  const maxTrendHours = useMemo(
    () => Math.max(1, ...(board?.trend ?? []).map((entry) => entry.actualHours)),
    [board?.trend],
  );

  if (state === 'loading') return <PageSkeleton />;
  if (state === 'missing') {
    return <MessageState title="This results board is not available" body="Please ask your crew for a current account results board link." />;
  }
  if (state === 'error') {
    return <MessageState title="We could not load this results board" body="Please try again." onRetry={() => void loadBoard()} />;
  }
  if (!board) return null;

  return (
    <main className="min-h-screen bg-surface-base px-4 py-5 text-text-primary md:px-8 md:py-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-2xl border border-surface-border bg-surface-card p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-surface-border bg-brand text-xl font-bold text-text-inverse">
                {board.logoUrl ? (
                  <img src={board.logoUrl} alt={`${board.businessName} logo`} className="h-full w-full object-contain p-2" />
                ) : (
                  board.account.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-semibold uppercase tracking-wide text-text-muted">{board.businessName}</p>
                <h1 className="truncate text-3xl font-bold tracking-tight text-text-primary md:text-5xl">{board.account.name}</h1>
                <p className="mt-1 text-sm text-text-secondary md:text-base">
                  Results board · {formatDate(board.period.monthStart)} to {formatDate(board.period.monthEnd)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
                className="inline-flex h-10 items-center justify-center rounded-md border border-surface-border bg-surface-elevated px-3 text-sm font-medium text-text-primary hover:bg-surface-hover"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <div className="rounded-md border border-surface-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary">
                {formatMonth(month)}
              </div>
              <button
                type="button"
                onClick={() => setMonth((current) => shiftMonth(current, 1))}
                className="inline-flex h-10 items-center justify-center rounded-md border border-surface-border bg-surface-elevated px-3 text-sm font-medium text-text-primary hover:bg-surface-hover"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-status-complete/20 bg-status-complete/10 p-4">
            <p className="text-3xs font-semibold uppercase tracking-wide text-status-complete">Completed</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-status-complete">{board.monthRollup.completedCount}</p>
          </div>
          <div className="rounded-xl border border-status-pending/20 bg-status-pending/10 p-4">
            <p className="text-3xs font-semibold uppercase tracking-wide text-status-pending">Pending Verification</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-status-pending">{board.monthRollup.pendingVerificationCount}</p>
          </div>
          <div className="rounded-xl border border-status-active/20 bg-status-active/10 p-4">
            <p className="text-3xs font-semibold uppercase tracking-wide text-status-active">Delivered Hours</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-status-active">{board.monthRollup.actualHours.toFixed(2)}</p>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-5">
            <article className="rounded-2xl border border-surface-border bg-surface-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand" />
                <h2 className="text-lg font-semibold text-text-primary">Properties</h2>
              </div>
              {board.properties.length === 0 ? (
                <EmptyCard title="No properties linked" body="Property relationships will appear here once your account is connected to active properties." />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {board.properties.map((property) => (
                    <div key={`${property.name}-${property.shortName}`} className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                      <p className="font-medium text-text-primary">{property.name}</p>
                      <p className="mt-1 text-xs text-text-secondary">{property.shortName}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-surface-border bg-surface-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-status-active" />
                <h2 className="text-lg font-semibold text-text-primary">Scope Baseline</h2>
              </div>
              {board.scopeBaseline.length === 0 ? (
                <EmptyCard title="No active scope" body="Active service scope and cadence will appear here." />
              ) : (
                <div className="space-y-3">
                  {board.scopeBaseline.map((contract) => (
                    <details key={`${contract.contractName}-${contract.propertyName ?? 'all'}`} className="rounded-xl border border-surface-border bg-surface-elevated p-3" open>
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-text-primary">{contract.contractName}</p>
                            <p className="mt-1 text-xs text-text-secondary">{contract.propertyName ?? 'All account properties'}</p>
                          </div>
                          <Badge variant="active">{titleCase(contract.frequency)}</Badge>
                        </div>
                      </summary>
                      {contract.scopeItems.length > 0 ? (
                        <ul className="mt-3 space-y-2">
                          {contract.scopeItems.map((item, index) => (
                            <li key={`${contract.contractName}-${item.description}-${index}`} className="flex items-start gap-2 rounded-lg border border-surface-border bg-surface-card px-3 py-2 text-sm text-text-secondary">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-complete" />
                              <span className="min-w-0 flex-1">{item.description}</span>
                              <span className="tabular-nums text-text-muted">x{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 rounded-lg border border-dashed border-surface-border bg-surface-card/60 p-3 text-sm text-text-secondary">
                          No line-item checklist is attached to this scope yet.
                        </p>
                      )}
                    </details>
                  ))}
                </div>
              )}
            </article>
          </div>

          <div className="space-y-5">
            <article className="rounded-2xl border border-surface-border bg-surface-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand" />
                <h2 className="text-lg font-semibold text-text-primary">12-Month Trend</h2>
              </div>
              {board.trend.length === 0 ? (
                <EmptyCard title="No trend yet" body="Completed work trends will appear after delivery records exist." />
              ) : (
                <div className="flex h-44 items-end gap-2 rounded-xl border border-surface-border bg-surface-elevated p-3">
                  {board.trend.map((entry) => {
                    const height = Math.max(8, Math.round((entry.actualHours / maxTrendHours) * 100));
                    return (
                      <div key={entry.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="flex h-28 w-full items-end">
                          <div
                            className="w-full rounded-t bg-brand"
                            style={{ height: `${height}%` }}
                            title={`${entry.month}: ${entry.actualHours.toFixed(2)} hours`}
                          />
                        </div>
                        <span className="truncate text-4xs text-text-muted">{entry.month.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-surface-border bg-surface-card p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-status-complete" />
                  <h2 className="text-lg font-semibold text-text-primary">Delivered Results</h2>
                </div>
                <Badge variant="complete">{board.deliveredResults.length}</Badge>
              </div>
              {board.deliveredResults.length === 0 ? (
                <EmptyCard title="No delivered results this month" body="Completed and pending-verification work will appear here." />
              ) : (
                <div className="space-y-3">
                  {board.deliveredResults.map((result) => (
                    <details key={`${result.title}-${result.deliveryTimestamp ?? result.completedAt ?? result.dueDate}`} className="rounded-xl border border-surface-border bg-surface-elevated p-3">
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-text-primary">{result.title}</p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {result.propertyName ?? 'Property not set'} · {formatDate(result.deliveryTimestamp)}
                            </p>
                          </div>
                          <Badge variant={getStageVariant(result.funnelStage)}>{titleCase(result.funnelStage)}</Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-4">
                          <span>{result.assignmentCount} assignment{result.assignmentCount === 1 ? '' : 's'}</span>
                          <span>{result.actualHours.toFixed(2)} hours</span>
                          <span>{result.signatureCount} signature{result.signatureCount === 1 ? '' : 's'}</span>
                          <span>{result.proofPhotoCount} photo{result.proofPhotoCount === 1 ? '' : 's'}</span>
                        </div>
                      </summary>

                      <div className="mt-4 space-y-4 border-t border-surface-border pt-4">
                        {result.description ? <p className="text-sm text-text-secondary">{result.description}</p> : null}
                        {result.punchList ? (
                          <div className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-3 text-sm text-text-secondary">
                            <p className="font-medium text-status-warning">Punch list</p>
                            <p className="mt-1 whitespace-pre-line">{result.punchList}</p>
                          </div>
                        ) : null}

                        <div>
                          <h3 className="text-sm font-semibold text-text-primary">Delivery record</h3>
                          <div className="mt-2 space-y-2">
                            {result.assignments.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-surface-border bg-surface-card/60 p-3 text-sm text-text-secondary">
                                No linked assignment rows were returned for this work order.
                              </p>
                            ) : (
                              result.assignments.map((assignment, index) => (
                                <div key={`${assignment.crewName}-${assignment.date ?? index}`} className="rounded-lg border border-surface-border bg-surface-card p-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-medium text-text-primary">{assignment.taskName}</p>
                                      <p className="mt-1 text-xs text-text-secondary">
                                        {assignment.crewName} · {formatDate(assignment.date)}
                                      </p>
                                    </div>
                                    <Badge variant={getStageVariant(assignment.status)}>{titleCase(assignment.status)}</Badge>
                                  </div>
                                  <div className="mt-2 grid gap-2 text-xs text-text-secondary sm:grid-cols-3">
                                    <span>Start {formatDateTime(assignment.actualStartAt)}</span>
                                    <span>End {formatDateTime(assignment.actualCompletedAt)}</span>
                                    <span>{assignment.actualHours.toFixed(2)}h</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-3">
                          <div className="rounded-lg border border-surface-border bg-surface-card p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                              <PenLine className="h-3.5 w-3.5" />
                              Signatures
                            </div>
                            {result.signatures.length === 0 ? (
                              <p className="mt-2 text-sm text-text-secondary">No signature metadata yet.</p>
                            ) : (
                              <div className="mt-2 space-y-2 text-sm text-text-secondary">
                                {result.signatures.map((signature, index) => (
                                  <p key={`${signature.signerName}-${signature.signedAt ?? index}`}>
                                    {signature.signerName} · {formatDateTime(signature.signedAt)}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="rounded-lg border border-surface-border bg-surface-card p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                              <ImageIcon className="h-3.5 w-3.5" />
                              Proof photos
                            </div>
                            <p className="mt-2 text-sm text-text-secondary">{result.proofPhotoCount} linked photo{result.proofPhotoCount === 1 ? '' : 's'}</p>
                            {result.proofPhotoCaptions.length > 0 ? (
                              <div className="mt-2 space-y-2 text-sm text-text-secondary">
                                {result.proofPhotoCaptions.map((photo, index) => (
                                  <p key={`${photo.caption}-${photo.createdAt ?? index}`}>{photo.caption} · {formatDate(photo.createdAt)}</p>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded-lg border border-surface-border bg-surface-card p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                              <MapPin className="h-3.5 w-3.5" />
                              Geo notes
                            </div>
                            {result.geoNotes.length === 0 ? (
                              <p className="mt-2 text-sm text-text-secondary">No visible geo notes yet.</p>
                            ) : (
                              <div className="mt-2 space-y-2 text-sm text-text-secondary">
                                {result.geoNotes.map((note, index) => (
                                  <div key={`${note.title}-${index}`}>
                                    <p className="font-medium text-text-primary">{note.title}</p>
                                    {note.content ? <p>{note.content}</p> : null}
                                    {note.locationGeojson ? (
                                      <p className="text-xs text-text-muted">
                                        {note.locationGeojson.coordinates[1].toFixed(5)}, {note.locationGeojson.coordinates[0].toFixed(5)}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>

        <footer className="pb-4 text-center text-xs text-text-muted">
          Last generated {formatDateTime(board.generatedAt)} · Photos are summarized as metadata only.
        </footer>
      </section>
    </main>
  );
}

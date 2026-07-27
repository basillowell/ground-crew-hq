'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Check, Loader2, PenLine, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { SignatureCapturePad } from '@/components/field/SignatureCapturePad';
import {
  useAssignmentSignature,
  useCaptureSignature,
  type AssignmentSignature as AssignmentSignatureRecord,
} from '@/lib/supabase-queries';

type AssignmentSignatureProps = {
  orgId?: string | null;
  propertyId?: string | null;
  assignmentId: string;
  capturedBy?: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function isConcreteUuid(value?: string | null): value is string {
  return Boolean(value && value !== 'all' && UUID_PATTERN.test(value));
}

function formatSignedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Signed';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ExistingSignature({ signature }: { signature: AssignmentSignatureRecord }) {
  return (
    <div className="mt-3 rounded-xl border border-surface-border bg-surface-card/80 p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand/10">
          <Check className="h-5 w-5 text-brand" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">Signature captured</p>
          <p className="mt-1 text-xs text-text-muted">
            {signature.signerName} - {formatSignedDate(signature.signedAt)}
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-surface-border bg-surface-base p-2">
        <img
          src={signature.signatureData}
          alt={`Signature from ${signature.signerName}`}
          className="h-20 w-full object-contain"
          loading="lazy"
        />
      </div>
    </div>
  );
}

export function AssignmentSignature({ orgId, propertyId, assignmentId, capturedBy }: AssignmentSignatureProps) {
  const validOrgId = orgId || undefined;
  const validPropertyId = useMemo(() => (isConcreteUuid(propertyId) ? propertyId : undefined), [propertyId]);
  const validAssignmentId = useMemo(() => (isConcreteUuid(assignmentId) ? assignmentId : undefined), [assignmentId]);
  const validCapturedBy = useMemo(() => (isConcreteUuid(capturedBy) ? capturedBy : null), [capturedBy]);
  const signatureQuery = useAssignmentSignature(validAssignmentId, validOrgId);
  const captureSignatureMutation = useCaptureSignature(validOrgId);
  const saveInFlightRef = useRef(false);
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const isSaving = captureSignatureMutation.isPending || saveInFlightRef.current;
  const existingSignature = (signatureQuery.data ?? [])[0] ?? null;

  const handleRetry = useCallback(() => {
    void signatureQuery.refetch();
  }, [signatureQuery]);

  const handleSignatureChange = useCallback((nextSignatureData: string | null, isEmpty: boolean) => {
    setSignatureData(nextSignatureData);
    setSignatureEmpty(isEmpty);
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    if (!validOrgId || !validPropertyId || !validAssignmentId) {
      toast.error('Signature is not available for this task.');
      return;
    }
    const cleanSignerName = signerName.trim();
    if (!cleanSignerName) {
      toast.error('Enter the signer name.');
      return;
    }
    if (signatureEmpty || !signatureData) {
      toast.error('Ask the customer to sign here.');
      return;
    }

    saveInFlightRef.current = true;
    try {
      await captureSignatureMutation.mutateAsync({
        propertyId: validPropertyId,
        assignmentId: validAssignmentId,
        signerName: cleanSignerName,
        signatureData,
        capturedBy: validCapturedBy,
      });
      toast.success('Signature saved.');
      setSignerName('');
      setSignatureData(null);
      setSignatureEmpty(true);
    } catch (error) {
      console.error('Signature save failed:', error);
      toast.error('Signature could not be saved.');
    } finally {
      saveInFlightRef.current = false;
    }
  }, [
    captureSignatureMutation,
    isSaving,
    signerName,
    signatureData,
    signatureEmpty,
    validAssignmentId,
    validCapturedBy,
    validOrgId,
    validPropertyId,
  ]);

  return (
    <section className="mt-3 rounded-xl border border-surface-border bg-surface-card/80 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Customer sign-off</p>
          <p className="mt-1 text-xs text-text-secondary">Sign here when the work is complete.</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
          <PenLine className="h-5 w-5 text-brand-bright" />
        </div>
      </div>

      {!validPropertyId || !validAssignmentId ? (
        <p className="rounded-xl border border-surface-border bg-surface-elevated px-3 py-3 text-sm text-text-secondary">
          Signature is not available for this task.
        </p>
      ) : signatureQuery.isLoading && !signatureQuery.data ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg bg-surface-elevated" />
          <Skeleton className="h-[200px] w-full rounded-xl bg-surface-elevated" />
        </div>
      ) : signatureQuery.isError ? (
        <div className="rounded-xl border border-status-warning/50 bg-surface-elevated px-3 py-3">
          <p className="text-sm font-medium text-text-primary">Signature could not load.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-10 border-surface-border bg-surface-card text-text-primary"
            onClick={handleRetry}
            disabled={signatureQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${signatureQuery.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            Retry
          </Button>
        </div>
      ) : existingSignature ? (
        <ExistingSignature signature={existingSignature} />
      ) : (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-text-secondary">
            Signer name
            <Input
              className="mt-1 min-h-11 border-surface-border bg-surface-base text-text-primary"
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              placeholder="Customer name"
              disabled={isSaving}
            />
          </label>
          <SignatureCapturePad disabled={isSaving} onChange={handleSignatureChange} />
          <Button
            type="button"
            className="min-h-11 w-full bg-brand-bright text-text-inverse hover:bg-brand-bright/90"
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <PenLine className="h-4 w-4" />}
            {isSaving ? 'Saving signature...' : 'Save signature'}
          </Button>
        </div>
      )}
    </section>
  );
}

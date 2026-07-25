import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import type { PaymentMethod, RevenueInvoice } from '@/lib/supabase-queries';
import { useRecordPayment } from '@/lib/supabase-queries';

type RecordPaymentDialogProps = {
  open: boolean;
  invoice: RevenueInvoice | null;
  balanceDue: number;
  onOpenChange: (open: boolean) => void;
};

const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Card' },
  { value: 'ach', label: 'ACH' },
  { value: 'other', label: 'Other' },
];

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function inputDateToIso(value: string) {
  return new Date(`${value}T12:00:00`).toISOString();
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function RecordPaymentDialog({ open, invoice, balanceDue, onOpenChange }: RecordPaymentDialogProps) {
  const { orgId, currentUser } = useOrgProfile();
  const recordPaymentMutation = useRecordPayment(orgId ?? undefined);
  const savingRef = useRef(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('check');
  const [reference, setReference] = useState('');
  const [paidDate, setPaidDate] = useState(todayInputDate);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setAmount(balanceDue > 0 ? String(Number(balanceDue.toFixed(2))) : '');
    setMethod('check');
    setReference('');
    setPaidDate(todayInputDate());
    setNotes('');
    savingRef.current = false;
  }, [balanceDue, open]);

  const close = () => {
    if (recordPaymentMutation.isPending || savingRef.current) return;
    onOpenChange(false);
  };

  const savePayment = async () => {
    if (savingRef.current || recordPaymentMutation.isPending) return;
    if (!invoice) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a payment amount greater than zero');
      return;
    }
    if (!paidDate) {
      toast.error('Choose the paid date');
      return;
    }

    savingRef.current = true;
    try {
      await recordPaymentMutation.mutateAsync({
        invoiceId: invoice.id,
        invoiceTotal: invoice.total,
        amount: parsedAmount,
        method,
        reference: reference.trim() || null,
        paidAt: inputDateToIso(paidDate),
        recordedBy: currentUser?.employeeId || null,
        notes: notes.trim() || null,
      });
      toast.success('Payment recorded');
      onOpenChange(false);
    } catch (error) {
      savingRef.current = false;
      toast.error(error instanceof Error ? error.message : 'Unable to record payment');
    }
  };

  const saving = recordPaymentMutation.isPending || savingRef.current;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="border-surface-border bg-surface-card text-text-primary sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            {invoice ? `Invoice #${invoice.invoiceNumber} balance: ${fmt(Math.max(balanceDue, 0))}` : 'Record a payment for this invoice.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Amount</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={saving}
              className="border-surface-border bg-surface-elevated text-text-primary"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Method</label>
              <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)} disabled={saving}>
                <SelectTrigger className="border-surface-border bg-surface-elevated text-text-primary">
                  <CreditCard className="h-4 w-4 text-text-muted" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Paid Date</label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" />
                <Input
                  type="date"
                  value={paidDate}
                  onChange={(event) => setPaidDate(event.target.value)}
                  disabled={saving}
                  className="border-surface-border bg-surface-elevated pl-9 text-text-primary"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Reference</label>
            <Input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              disabled={saving}
              placeholder="Check number or memo"
              className="border-surface-border bg-surface-elevated text-text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Notes</label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={saving}
              placeholder="Optional notes"
              className="border-surface-border bg-surface-elevated text-text-primary"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={saving}>Cancel</Button>
          <Button
            type="button"
            onClick={() => void savePayment()}
            disabled={saving || !invoice || !amount || Number(amount) <= 0}
            className="bg-brand text-text-inverse hover:bg-brand/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving' : 'Save Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

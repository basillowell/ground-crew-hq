import { useEffect, useMemo, useState } from 'react';
import { Edit3, Mail, Phone, Plus, UserRound, XCircle } from 'lucide-react';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import {
  type BillingClient,
  type ClientMutationPayload,
  useClients,
  useCreateClient,
  useUpdateClient,
} from '@/lib/supabase-queries';

type ClientFormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

const emptyForm: ClientFormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
};

function toClientPayload(form: ClientFormState, active = true): ClientMutationPayload {
  return {
    name: form.name.trim(),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    address: form.address.trim() || null,
    notes: form.notes.trim() || null,
    active,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ClientsPage() {
  const { orgId } = useOrgProfile();
  const clientsQuery = useClients(orgId ?? undefined);
  const createClientMutation = useCreateClient(orgId ?? undefined);
  const updateClientMutation = useUpdateClient(orgId ?? undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<BillingClient | null>(null);
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Clients - Ground Crew HQ';
  }, []);

  const clients = clientsQuery.data ?? [];
  const activeClients = useMemo(() => clients.filter((client) => client.active), [clients]);
  const inactiveClients = useMemo(() => clients.filter((client) => !client.active), [clients]);
  const loading = clientsQuery.isLoading && !clientsQuery.data;
  const error = clientsQuery.error instanceof Error ? clientsQuery.error.message : null;

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingClient(null);
    setForm(emptyForm);
    setSaving(false);
  };

  const openCreateDialog = () => {
    setEditingClient(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (client: BillingClient) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      notes: client.notes,
    });
    setDialogOpen(true);
  };

  const saveClient = async () => {
    if (saving) return;
    const payload = toClientPayload(form, editingClient?.active ?? true);
    if (!payload.name) {
      toast.error('Client name is required');
      return;
    }

    setSaving(true);
    try {
      if (editingClient) {
        await updateClientMutation.mutateAsync({ ...payload, id: editingClient.id });
        toast.success('Client updated');
      } else {
        await createClientMutation.mutateAsync(payload);
        toast.success('Client created');
      }
      closeDialog();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Unable to save client');
      setSaving(false);
    }
  };

  const deactivateClient = async (client: BillingClient) => {
    if (deactivatingId) return;
    setDeactivatingId(client.id);
    try {
      await updateClientMutation.mutateAsync({
        id: client.id,
        name: client.name,
        email: client.email || null,
        phone: client.phone || null,
        address: client.address || null,
        notes: client.notes || null,
        active: false,
      });
      toast.success('Client deactivated');
    } catch (deactivateError) {
      toast.error(deactivateError instanceof Error ? deactivateError.message : 'Unable to deactivate client');
    } finally {
      setDeactivatingId(null);
    }
  };

  if (!orgId || loading) return <PageSkeleton />;
  if (error) {
    return (
      <div className="p-6">
        <ErrorRetry message={error} onRetry={() => void clientsQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Clients</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage billing contacts for invoices and future revenue workflows.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreateDialog}
          className="bg-brand text-text-inverse hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          New Client
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
            <UserRound className="h-4 w-4 text-brand" />
            Active Clients
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{activeClients.length}</div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
            <Mail className="h-4 w-4 text-status-pending" />
            With Email
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">
            {activeClients.filter((client) => client.email).length}
          </div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
            <XCircle className="h-4 w-4 text-text-muted" />
            Inactive
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{inactiveClients.length}</div>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface-card/60 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-elevated">
            <UserRound className="h-6 w-6 text-text-muted" />
          </div>
          <p className="mb-1 text-sm font-semibold text-text-primary">No clients yet</p>
          <p className="max-w-sm text-sm text-text-secondary">
            Add the billing contact that should receive new invoices.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-border bg-surface-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">
                  Client
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted md:table-cell">
                  Contact
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted lg:table-cell">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {clients.map((client) => (
                <tr key={client.id} className={!client.active ? 'bg-surface-elevated/40 opacity-70' : 'transition-colors hover:bg-surface-hover'}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{client.name}</div>
                    <div className="mt-1 text-xs text-text-secondary md:hidden">
                      {client.email || client.phone || 'No contact details'}
                    </div>
                    {!client.active ? (
                      <span className="mt-2 inline-flex rounded-full border border-surface-border px-2 py-0.5 text-xs text-text-muted">
                        Inactive
                      </span>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-text-muted" />
                        <span>{client.email || 'No email'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-text-muted" />
                        <span>{client.phone || 'No phone'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">
                    {formatDate(client.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(client)}>
                        <Edit3 className="h-4 w-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      {client.active ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void deactivateClient(client)}
                          disabled={deactivatingId === client.id}
                        >
                          <XCircle className="h-4 w-4" />
                          <span className="hidden sm:inline">
                            {deactivatingId === client.id ? 'Saving' : 'Deactivate'}
                          </span>
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="border-surface-border bg-surface-card text-text-primary sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Client' : 'New Client'}</DialogTitle>
            <DialogDescription>
              Add billing details used when creating invoices.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Input
              placeholder="Client name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
              <Input
                placeholder="Phone"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <Textarea
              placeholder="Billing address"
              rows={3}
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            />
            <Textarea
              placeholder="Notes"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveClient()}
              disabled={saving || !form.name.trim()}
              className="bg-brand text-text-inverse hover:bg-brand/90"
            >
              {saving ? 'Saving' : 'Save Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

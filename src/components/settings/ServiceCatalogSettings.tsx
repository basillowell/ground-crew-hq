import { useEffect, useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import {
  type ServiceCatalogItem,
  type ServiceCatalogMutationPayload,
  useCreateServiceCatalogItem,
  useDeleteServiceCatalogItem,
  useServiceCatalog,
  useUpdateServiceCatalogItem,
} from '@/lib/supabase-queries';

type CatalogFormState = {
  name: string;
  description: string;
  defaultUnitPrice: string;
  active: boolean;
};

const emptyForm: CatalogFormState = {
  name: '',
  description: '',
  defaultUnitPrice: '0',
  active: true,
};

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function toPayload(form: CatalogFormState): ServiceCatalogMutationPayload {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    defaultUnitPrice: Number(form.defaultUnitPrice || '0'),
    active: form.active,
  };
}

export function ServiceCatalogSettings({ orgId }: { orgId: string | null }) {
  const catalogQuery = useServiceCatalog(orgId ?? undefined);
  const createMutation = useCreateServiceCatalogItem(orgId ?? undefined);
  const updateMutation = useUpdateServiceCatalogItem(orgId ?? undefined);
  const deleteMutation = useDeleteServiceCatalogItem(orgId ?? undefined);
  const [form, setForm] = useState<CatalogFormState>(emptyForm);
  const [editingItem, setEditingItem] = useState<ServiceCatalogItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingItem) return;
    setForm({
      name: editingItem.name,
      description: editingItem.description,
      defaultUnitPrice: String(editingItem.defaultUnitPrice),
      active: editingItem.active,
    });
  }, [editingItem]);

  const resetForm = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setSaving(false);
  };

  const saveCatalogItem = async () => {
    if (saving) return;
    const payload = toPayload(form);
    if (!payload.name) {
      toast.error('Service name is required');
      return;
    }
    if (!Number.isFinite(payload.defaultUnitPrice) || payload.defaultUnitPrice < 0) {
      toast.error('Default price cannot be negative');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ ...payload, id: editingItem.id });
        toast.success('Service updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Service added');
      }
      resetForm();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Unable to save service');
      setSaving(false);
    }
  };

  const toggleActive = async (item: ServiceCatalogItem) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        name: item.name,
        description: item.description || null,
        defaultUnitPrice: item.defaultUnitPrice,
        active: !item.active,
      });
      toast.success(item.active ? 'Service paused' : 'Service activated');
    } catch (toggleError) {
      toast.error(toggleError instanceof Error ? toggleError.message : 'Unable to update service');
    } finally {
      setSaving(false);
    }
  };

  const deleteCatalogItem = async (item: ServiceCatalogItem) => {
    if (deletingId) return;
    setDeletingId(item.id);
    try {
      await deleteMutation.mutateAsync(item.id);
      toast.success('Service removed');
      if (editingItem?.id === item.id) resetForm();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Unable to remove service');
    } finally {
      setDeletingId(null);
    }
  };

  if (!orgId || (catalogQuery.isLoading && !catalogQuery.data)) return <PageSkeleton />;
  if (catalogQuery.error instanceof Error) {
    return <ErrorRetry message={catalogQuery.error.message} onRetry={() => void catalogQuery.refetch()} />;
  }

  const catalog = catalogQuery.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Service Catalog</h2>
            <p className="mt-1 text-sm text-text-muted">Reusable services for estimates and invoices.</p>
          </div>
          <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text-muted">
            {catalog.length} services
          </span>
        </div>

        {catalog.length === 0 ? (
          <div className="rounded-lg border border-dashed border-surface-border bg-surface-elevated/50 px-4 py-8 text-center text-sm text-text-muted">
            Add a service to speed up line-item entry.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-surface-border">
            {catalog.map((item) => (
              <div key={item.id} className="grid gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover sm:grid-cols-[minmax(0,1fr)_120px_220px] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-text-primary">{item.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.active ? 'bg-status-active/10 text-status-active' : 'bg-surface-elevated text-text-muted'}`}>
                      {item.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">{item.description || 'No description'}</p>
                </div>
                <div className="font-medium text-text-primary">{fmt(item.defaultUnitPrice)}</div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingItem(item)} disabled={saving || deletingId === item.id}>
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void toggleActive(item)} disabled={saving || deletingId === item.id}>
                    {item.active ? 'Pause' : 'Activate'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void deleteCatalogItem(item)} disabled={deletingId === item.id}>
                    <Trash2 className="h-4 w-4" />
                    {deletingId === item.id ? 'Saving' : 'Remove'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h2 className="text-base font-semibold text-text-primary">{editingItem ? 'Edit Service' : 'Add Service'}</h2>
        <div className="mt-4 space-y-3">
          <Input
            placeholder="Service name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            disabled={saving}
          />
          <Textarea
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            disabled={saving}
          />
          <label className="grid gap-1.5 text-xs font-medium uppercase tracking-widest text-text-muted">
            Default Price
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.defaultUnitPrice}
              onChange={(event) => setForm((current) => ({ ...current, defaultUnitPrice: event.target.value }))}
              disabled={saving}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              className="rounded border-surface-border"
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              disabled={saving}
            />
            Active
          </label>
          <div className="flex justify-end gap-2">
            {editingItem ? (
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
            ) : null}
            <Button type="button" onClick={() => void saveCatalogItem()} disabled={saving || !form.name.trim()} className="bg-brand text-text-inverse hover:bg-brand/90">
              <Plus className="h-4 w-4" />
              {saving ? 'Saving' : editingItem ? 'Save Service' : 'Add Service'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

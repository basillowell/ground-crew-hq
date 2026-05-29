import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';

type ProductFormState = {
  name: string;
  productType: string;
  targetUse: string;
  rateUnit: string;
  epaRegistrationNumber: string;
  formulation: string;
  signalWord: string;
  reentryIntervalHours: string;
  preHarvestIntervalHours: string;
  defaultApplicationMethod: string;
  restrictedUse: boolean;
};

type ChemicalProductRow = {
  id: string;
  org_id?: string | null;
  name: string;
  productType: string;
  targetUse: string;
  rateUnit: string;
  epaRegistrationNumber: string;
  formulation: string;
  signalWord: string;
  reentryIntervalHours: number;
  preHarvestIntervalHours: number;
  defaultApplicationMethod: string;
  restrictedUse: boolean;
};

const defaultForm: ProductFormState = {
  name: '',
  productType: '',
  targetUse: '',
  rateUnit: '',
  epaRegistrationNumber: '',
  formulation: '',
  signalWord: '',
  reentryIntervalHours: '0',
  preHarvestIntervalHours: '0',
  defaultApplicationMethod: '',
  restrictedUse: false,
};

export default function ProductManager() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);

  const productsQuery = useQuery({
    queryKey: ['chemical-products-manager', orgId ?? 'no-org'],
    enabled: Boolean(orgId),
    retry: false,
    queryFn: async () => {
      if (!orgId) return [] as ChemicalProductRow[];
      const { data, error } = await supabase
        .from('chemical_products')
        .select('id, org_id, name, product_type, target_use, rate_unit, epa_registration_number, formulation, signal_word, reentry_interval_hours, pre_harvest_interval_hours, default_application_method, restricted_use')
        .eq('org_id', orgId)
        .order('name');
      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id ?? ''),
        org_id: row.org_id ? String(row.org_id) : null,
        name: String(row.name ?? ''),
        productType: String(row.product_type ?? ''),
        targetUse: String(row.target_use ?? ''),
        rateUnit: String(row.rate_unit ?? ''),
        epaRegistrationNumber: String(row.epa_registration_number ?? ''),
        formulation: String(row.formulation ?? ''),
        signalWord: String(row.signal_word ?? ''),
        reentryIntervalHours: Number(row.reentry_interval_hours ?? 0),
        preHarvestIntervalHours: Number(row.pre_harvest_interval_hours ?? 0),
        defaultApplicationMethod: String(row.default_application_method ?? ''),
        restrictedUse: Boolean(row.restricted_use),
      }));
    },
  });

  const products = productsQuery.data ?? [];
  const canSave = useMemo(() => Boolean(form.name.trim() && form.productType.trim() && orgId), [form.name, form.productType, orgId]);

  function resetForm() {
    setEditingId(null);
    setForm(defaultForm);
  }

  async function saveProduct() {
    if (!canSave || !orgId) return;
    setIsSaving(true);
    try {
      const payload = {
        org_id: orgId,
        name: form.name.trim(),
        product_type: form.productType.trim(),
        target_use: form.targetUse.trim(),
        rate_unit: form.rateUnit.trim(),
        epa_registration_number: form.epaRegistrationNumber.trim(),
        formulation: form.formulation.trim(),
        signal_word: form.signalWord.trim(),
        reentry_interval_hours: Number(form.reentryIntervalHours || 0),
        pre_harvest_interval_hours: Number(form.preHarvestIntervalHours || 0),
        default_application_method: form.defaultApplicationMethod.trim(),
        restricted_use: form.restrictedUse,
      };

      const target = editingId
        ? supabase.from('chemical_products').update(payload).eq('id', editingId).eq('org_id', orgId)
        : supabase.from('chemical_products').insert({ id: `cp${Date.now()}`, ...payload });

      const { error } = await target;
      if (error) {
        toast.error(`Failed to save product: ${error.message}`);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['chemical-products-manager'] });
      await queryClient.invalidateQueries({ queryKey: ['chemical-products'] });
      await productsQuery.refetch();
      toast.success(editingId ? 'Product updated' : 'Product added');
      if (editingId) {
        setEditingId(null);
      } else {
        resetForm();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!orgId) return;
    const confirmed = window.confirm('Delete this product? This action cannot be undone.');
    if (!confirmed) return;
    const { error } = await supabase.from('chemical_products').delete().eq('id', id).eq('org_id', orgId);
    if (error) {
      toast.error(`Failed to delete product: ${error.message}`);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['chemical-products-manager'] });
    await queryClient.invalidateQueries({ queryKey: ['chemical-products'] });
    await productsQuery.refetch();
    toast.success('Product deleted');
    if (editingId === id) resetForm();
  }

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold">Products</h3>
        <p className="text-xs text-muted-foreground">Manage chemical products used in spray logging.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Input placeholder="Product name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        <Input placeholder="Product type" value={form.productType} onChange={(event) => setForm((current) => ({ ...current, productType: event.target.value }))} />
        <Input placeholder="Target use" value={form.targetUse} onChange={(event) => setForm((current) => ({ ...current, targetUse: event.target.value }))} />
        <Input placeholder="Rate unit" value={form.rateUnit} onChange={(event) => setForm((current) => ({ ...current, rateUnit: event.target.value }))} />
        <Input placeholder="EPA Registration Number" value={form.epaRegistrationNumber} onChange={(event) => setForm((current) => ({ ...current, epaRegistrationNumber: event.target.value }))} />
        <Input placeholder="Formulation" value={form.formulation} onChange={(event) => setForm((current) => ({ ...current, formulation: event.target.value }))} />
        <Input placeholder="Signal Word" value={form.signalWord} onChange={(event) => setForm((current) => ({ ...current, signalWord: event.target.value }))} />
        <Input
          type="number"
          min="0"
          placeholder="REI Hours"
          value={form.reentryIntervalHours}
          onChange={(event) => setForm((current) => ({ ...current, reentryIntervalHours: event.target.value }))}
        />
        <Input
          type="number"
          min="0"
          placeholder="PHI Hours"
          value={form.preHarvestIntervalHours}
          onChange={(event) => setForm((current) => ({ ...current, preHarvestIntervalHours: event.target.value }))}
        />
        <Input
          placeholder="Default application method"
          value={form.defaultApplicationMethod}
          onChange={(event) => setForm((current) => ({ ...current, defaultApplicationMethod: event.target.value }))}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.restrictedUse}
          onChange={(event) => setForm((current) => ({ ...current, restrictedUse: event.target.checked }))}
        />
        Restricted use product
      </label>

      <div className="flex items-center gap-2">
        <Button className="relative z-10 cursor-pointer" onClick={saveProduct} disabled={!canSave || isSaving}>
          {isSaving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
        </Button>
        {editingId ? (
          <Button className="relative z-10 cursor-pointer" variant="outline" onClick={resetForm}>
            Cancel Edit
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        {productsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading products...</p> : null}
        {productsQuery.error ? <p className="text-sm text-destructive">Unable to load products.</p> : null}
        {products.map((product) => (
          <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div className="min-w-[220px]">
              <p className="text-sm font-medium">{product.name}</p>
              <p className="text-xs text-muted-foreground">
                {product.productType} · REI {product.reentryIntervalHours}h · {product.signalWord || 'No signal word'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="relative z-10 cursor-pointer"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(product.id);
                  setForm({
                    name: product.name,
                    productType: product.productType,
                    targetUse: product.targetUse ?? '',
                    rateUnit: product.rateUnit ?? '',
                    epaRegistrationNumber: product.epaRegistrationNumber ?? '',
                    formulation: product.formulation ?? '',
                    signalWord: product.signalWord ?? '',
                    reentryIntervalHours: String(product.reentryIntervalHours ?? 0),
                    preHarvestIntervalHours: String(product.preHarvestIntervalHours ?? 0),
                    defaultApplicationMethod: product.defaultApplicationMethod ?? '',
                    restrictedUse: Boolean(product.restrictedUse),
                  });
                }}
              >
                Edit
              </Button>
              <Button className="relative z-10 cursor-pointer" size="sm" variant="destructive" onClick={() => void deleteProduct(product.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

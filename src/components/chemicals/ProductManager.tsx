import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase';
import { toast } from '@/components/ui/sonner';
import { useOrgProfile } from '@/hooks/useOrgProfile';

const supabase = createClient();

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
  const { orgId } = useOrgProfile();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

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

  const editingProduct = editingId ? products.find((p) => p.id === editingId) : null;

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold">Products</h3>
        <p className="text-xs text-muted-foreground">Manage chemical products used in spray logging.</p>
      </div>

      {editingProduct ? (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          <span className="font-medium">Editing:</span>
          <span>{editingProduct.name}</span>
          <span className="ml-auto text-xs text-muted-foreground">Fill fields above and click Update Product</span>
        </div>
      ) : null}

      <div ref={formRef} className="grid gap-3 md:grid-cols-2">
        <Input id="product-name" name="product_name" placeholder="Product name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        <Input id="product-type" name="product_type" placeholder="Product type" value={form.productType} onChange={(event) => setForm((current) => ({ ...current, productType: event.target.value }))} />
        <Input id="target-use" name="target_use" placeholder="Target use" value={form.targetUse} onChange={(event) => setForm((current) => ({ ...current, targetUse: event.target.value }))} />
        <Input id="rate-unit" name="rate_unit" placeholder="Rate unit" value={form.rateUnit} onChange={(event) => setForm((current) => ({ ...current, rateUnit: event.target.value }))} />
        <Input id="epa-reg" name="epa_registration_number" placeholder="EPA Registration Number" value={form.epaRegistrationNumber} onChange={(event) => setForm((current) => ({ ...current, epaRegistrationNumber: event.target.value }))} />
        <Input id="formulation" name="formulation" placeholder="Formulation" value={form.formulation} onChange={(event) => setForm((current) => ({ ...current, formulation: event.target.value }))} />
        <Input id="signal-word" name="signal_word" placeholder="Signal Word" value={form.signalWord} onChange={(event) => setForm((current) => ({ ...current, signalWord: event.target.value }))} />
        <Input
          id="reentry-interval-hours"
          name="reentry_interval_hours"
          type="number"
          min="0"
          placeholder="REI Hours"
          value={form.reentryIntervalHours}
          onChange={(event) => setForm((current) => ({ ...current, reentryIntervalHours: event.target.value }))}
        />
        <Input
          id="pre-harvest-interval-hours"
          name="pre_harvest_interval_hours"
          type="number"
          min="0"
          placeholder="PHI Hours"
          value={form.preHarvestIntervalHours}
          onChange={(event) => setForm((current) => ({ ...current, preHarvestIntervalHours: event.target.value }))}
        />
        <Input
          id="app-method"
          name="default_application_method"
          placeholder="Default application method"
          value={form.defaultApplicationMethod}
          onChange={(event) => setForm((current) => ({ ...current, defaultApplicationMethod: event.target.value }))}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          id="restricted-use"
          name="restricted_use"
          type="checkbox"
          checked={form.restrictedUse}
          onChange={(event) => setForm((current) => ({ ...current, restrictedUse: event.target.checked }))}
        />
        Restricted use product
      </label>

      <div className="flex items-center gap-2">
        <Button onClick={saveProduct} disabled={!canSave || isSaving}>
          {isSaving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
        </Button>
        {editingId ? (
          <Button variant="outline" onClick={resetForm}>
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
                  formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void deleteProduct(product.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}



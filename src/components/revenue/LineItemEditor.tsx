import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ServiceCatalogItem } from '@/lib/supabase-queries';

export type LineItemDraft = {
  id: string;
  catalogId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type LineItemTotals = {
  subtotal: number;
  total: number;
};

type LineItemEditorProps = {
  items: LineItemDraft[];
  onItemsChange: (items: LineItemDraft[]) => void;
  taxRate: number;
  onTaxRateChange: (taxRate: number) => void;
  serviceCatalog?: ServiceCatalogItem[];
  disabled?: boolean;
};

const CUSTOM_VALUE = 'custom';

function makeDraftId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyLineItem(): LineItemDraft {
  return {
    id: makeDraftId(),
    catalogId: null,
    description: '',
    quantity: 1,
    unitPrice: 0,
  };
}

export function calculateLineItemTotals(items: LineItemDraft[], taxRate: number): LineItemTotals {
  const subtotal = items.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitPrice), 0);
  return {
    subtotal,
    total: subtotal + subtotal * (Math.max(0, taxRate) / 100),
  };
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function normalizeLineItemDrafts(items: LineItemDraft[]) {
  return items
    .map((item, index) => {
      const quantity = Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0;
      const unitPrice = Number.isFinite(item.unitPrice) ? Math.max(0, item.unitPrice) : 0;
      return {
        catalogId: item.catalogId,
        description: item.description.trim(),
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
        sortOrder: index,
      };
    })
    .filter((item) => item.description && item.quantity > 0);
}

export function LineItemEditor({
  items,
  onItemsChange,
  taxRate,
  onTaxRateChange,
  serviceCatalog = [],
  disabled = false,
}: LineItemEditorProps) {
  const activeCatalog = serviceCatalog.filter((item) => item.active);
  const totals = calculateLineItemTotals(items, taxRate);

  const updateItem = (id: string, patch: Partial<LineItemDraft>) => {
    onItemsChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    onItemsChange([...items, createEmptyLineItem()]);
  };

  const removeItem = (id: string) => {
    const nextItems = items.filter((item) => item.id !== id);
    onItemsChange(nextItems.length > 0 ? nextItems : [createEmptyLineItem()]);
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    const index = items.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
    const nextItems = [...items];
    const [moved] = nextItems.splice(index, 1);
    nextItems.splice(nextIndex, 0, moved);
    onItemsChange(nextItems);
  };

  const seedFromCatalog = (lineId: string, catalogId: string) => {
    if (catalogId === CUSTOM_VALUE) {
      updateItem(lineId, { catalogId: null });
      return;
    }
    const catalogItem = activeCatalog.find((item) => item.id === catalogId);
    if (!catalogItem) return;
    updateItem(lineId, {
      catalogId: catalogItem.id,
      description: catalogItem.description || catalogItem.name,
      unitPrice: catalogItem.defaultUnitPrice,
    });
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_110px_130px_120px_104px] gap-3 border-b border-surface-border bg-surface-elevated px-3 py-2 text-xs font-medium uppercase tracking-widest text-text-muted md:grid">
          <span>Description</span>
          <span>Quantity</span>
          <span>Unit Price</span>
          <span className="text-right">Line Total</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-surface-border">
          {items.map((item, index) => {
            const lineTotal = Math.max(0, item.quantity) * Math.max(0, item.unitPrice);
            return (
              <div key={item.id} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_110px_130px_120px_104px] md:items-start">
                <div className="space-y-2">
                  {activeCatalog.length > 0 ? (
                    <Select
                      value={item.catalogId ?? CUSTOM_VALUE}
                      onValueChange={(value) => seedFromCatalog(item.id, value)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="border-surface-border bg-surface-elevated text-text-primary">
                        <SelectValue placeholder="Catalog item" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CUSTOM_VALUE}>Custom item</SelectItem>
                        {activeCatalog.map((catalogItem) => (
                          <SelectItem key={catalogItem.id} value={catalogItem.id}>
                            {catalogItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Input
                    value={item.description}
                    onChange={(event) => updateItem(item.id, { description: event.target.value })}
                    placeholder="Description"
                    disabled={disabled}
                  />
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value || '0') })}
                  disabled={disabled}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value || '0') })}
                  disabled={disabled}
                />
                <div className="flex h-10 items-center justify-between rounded-lg border border-surface-border bg-surface-elevated px-3 text-sm font-medium text-text-primary md:justify-end">
                  <span className="text-xs uppercase tracking-widest text-text-muted md:hidden">Line Total</span>
                  {fmt(lineTotal)}
                </div>
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => moveItem(item.id, -1)}
                    disabled={disabled || index === 0}
                    aria-label="Move line item up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => moveItem(item.id, 1)}
                    disabled={disabled || index === items.length - 1}
                    aria-label="Move line item down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    disabled={disabled}
                    aria-label="Remove line item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Button type="button" variant="outline" onClick={addItem} disabled={disabled}>
          <Plus className="h-4 w-4" />
          Add Line
        </Button>
        <div className="w-full space-y-2 rounded-lg border border-surface-border bg-surface-card p-3 sm:max-w-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Subtotal</span>
            <span className="font-medium text-text-primary">{fmt(totals.subtotal)}</span>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-text-secondary">Tax Rate</span>
            <Input
              className="h-8 w-24 text-right"
              type="number"
              min="0"
              step="0.01"
              value={taxRate}
              onChange={(event) => onTaxRateChange(Number(event.target.value || '0'))}
              disabled={disabled}
            />
          </label>
          <div className="flex items-center justify-between border-t border-surface-border pt-2 text-sm">
            <span className="font-medium text-text-primary">Total</span>
            <span className="text-base font-semibold text-text-primary">{fmt(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

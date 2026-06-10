import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { Pencil, RotateCcw, Trash2, Plus, X, GripVertical } from 'lucide-react';

const SOP_CATEGORIES = [
  'Aeration',
  'Chemical Application',
  'Fertilization',
  'General',
  'General Maintenance',
  'Irrigation',
  'Maintenance',
  'Mowing',
  'Other',
] as const;

interface Sop {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  procedure_body: string | null;
  category: string | null;
  estimated_hours: number | null;
  color: string | null;
  is_active: boolean;
  created_by: string | null;
}

interface ChecklistItem {
  id: string | null;
  label: string;
  is_required: boolean;
  order_index: number;
}

interface SopFormState {
  title: string;
  description: string;
  category: string;
  procedure_body: string;
  estimated_hours: string;
  color: string;
  checklist: ChecklistItem[];
}

const EMPTY_FORM: SopFormState = {
  title: '',
  description: '',
  category: 'General',
  procedure_body: '',
  estimated_hours: '1',
  color: '#166534',
  checklist: [],
};

export function SOPSettings({ orgId }: { orgId: string | null; propertyId?: string | null }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sops, setSops] = useState<Sop[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<SopFormState>(EMPTY_FORM);

  const fetchSops = useCallback(async () => {
    if (!orgId) {
      setSops([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('sops')
      .select('id, org_id, title, description, procedure_body, category, estimated_hours, color, is_active, created_by')
      .eq('org_id', orgId)
      .order('is_active', { ascending: false })
      .order('category', { ascending: true })
      .order('title', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setSops([]);
      setLoading(false);
      return;
    }
    setSops((data as Sop[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void fetchSops();
  }, [fetchSops]);

  const activeSops = useMemo(() => sops.filter((s) => s.is_active), [sops]);
  const inactiveSops = useMemo(() => sops.filter((s) => !s.is_active), [sops]);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormOpen(false);
  }, []);

  const startCreate = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormOpen(true);
  }, []);

  const startEdit = useCallback(async (sop: Sop) => {
    const { data: items } = await supabase
      .from('sop_checklist_items')
      .select('id, label, order_index, is_required')
      .eq('sop_id', sop.id)
      .order('order_index', { ascending: true });

    setForm({
      title: sop.title ?? '',
      description: sop.description ?? '',
      category: sop.category ?? 'General',
      procedure_body: sop.procedure_body ?? '',
      estimated_hours: String(sop.estimated_hours ?? 1),
      color: sop.color ?? '#166534',
      checklist: (items ?? []).map((item) => ({
        id: item.id as string,
        label: item.label as string,
        is_required: item.is_required as boolean,
        order_index: item.order_index as number,
      })),
    });
    setEditingId(sop.id);
    setFormOpen(true);
  }, []);

  const addChecklistItem = useCallback(() => {
    setForm((current) => ({
      ...current,
      checklist: [
        ...current.checklist,
        { id: null, label: '', is_required: true, order_index: current.checklist.length },
      ],
    }));
  }, []);

  const removeChecklistItem = useCallback((index: number) => {
    setForm((current) => ({
      ...current,
      checklist: current.checklist
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, order_index: i })),
    }));
  }, []);

  const updateChecklistItem = useCallback((index: number, patch: Partial<ChecklistItem>) => {
    setForm((current) => ({
      ...current,
      checklist: current.checklist.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }, []);

  const moveChecklistItem = useCallback((index: number, direction: -1 | 1) => {
    setForm((current) => {
      const next = [...current.checklist];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, checklist: next.map((item, i) => ({ ...item, order_index: i })) };
    });
  }, []);

  const onSave = useCallback(async () => {
    if (!orgId) {
      toast.error('No org context — cannot save.');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    const estimatedHours = Number(form.estimated_hours);
    if (!Number.isFinite(estimatedHours) || estimatedHours < 0) {
      toast.error('Estimated hours must be 0 or more.');
      return;
    }

    setSaving(true);

    const payload = {
      org_id: orgId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category || 'General',
      procedure_body: form.procedure_body.trim() || null,
      estimated_hours: estimatedHours,
      color: form.color || null,
      is_active: true,
      ...(editingId ? {} : { created_by: currentUser?.id ?? null }),
    };

    let sopId = editingId;
    if (editingId) {
      const { error: updateError } = await supabase
        .from('sops')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingId)
        .eq('org_id', orgId);
      if (updateError) {
        toast.error(`Unable to save SOP: ${updateError.message}`);
        setSaving(false);
        return;
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('sops')
        .insert(payload)
        .select('id')
        .single();
      if (insertError || !inserted) {
        toast.error(`Unable to create SOP: ${insertError?.message ?? 'unknown error'}`);
        setSaving(false);
        return;
      }
      sopId = inserted.id as string;
    }

    if (sopId && form.checklist.length > 0) {
      await supabase.from('sop_checklist_items').delete().eq('sop_id', sopId).eq('org_id', orgId);
      const checklistRows = form.checklist
        .filter((item) => item.label.trim())
        .map((item, i) => ({
          sop_id: sopId,
          org_id: orgId,
          label: item.label.trim(),
          order_index: i,
          is_required: item.is_required,
        }));
      if (checklistRows.length > 0) {
        const { error: clError } = await supabase.from('sop_checklist_items').insert(checklistRows);
        if (clError) {
          toast.error(`SOP saved but checklist failed: ${clError.message}`);
          setSaving(false);
          resetForm();
          await fetchSops();
          return;
        }
      }
    } else if (sopId && form.checklist.length === 0 && editingId) {
      await supabase.from('sop_checklist_items').delete().eq('sop_id', sopId).eq('org_id', orgId);
    }

    toast.success(editingId ? 'SOP updated' : 'SOP created');
    setSaving(false);
    resetForm();
    await fetchSops();
  }, [currentUser, editingId, fetchSops, form, orgId, resetForm]);

  const setActiveStatus = useCallback(
    async (sop: Sop, isActive: boolean) => {
      if (!orgId) return;
      const verb = isActive ? 'Restore' : 'Deactivate';
      const confirmed = window.confirm(`${verb} SOP "${sop.title}"?`);
      if (!confirmed) return;

      const { error: updateError } = await supabase
        .from('sops')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', sop.id)
        .eq('org_id', orgId);

      if (updateError) {
        toast.error(`Unable to update SOP: ${updateError.message}`);
        return;
      }
      toast.success(isActive ? 'SOP restored' : 'SOP deactivated');
      await fetchSops();
    },
    [fetchSops, orgId]
  );

  const deleteSop = useCallback(
    async (sop: Sop) => {
      if (!orgId) return;
      const confirmed = window.confirm(`Permanently delete SOP "${sop.title}"? This cannot be undone.`);
      if (!confirmed) return;

      await supabase.from('sop_checklist_items').delete().eq('sop_id', sop.id).eq('org_id', orgId);
      const { error: deleteError } = await supabase.from('sops').delete().eq('id', sop.id).eq('org_id', orgId);

      if (deleteError) {
        toast.error(`Unable to delete SOP: ${deleteError.message}`);
        return;
      }
      toast.success('SOP deleted');
      await fetchSops();
    },
    [fetchSops, orgId]
  );

  if (!orgId) {
    return (
      <div className="rounded-xl border border-dashed border-surface-border bg-surface-card p-4 text-sm text-text-muted">
        No organization context — cannot load SOPs.
      </div>
    );
  }

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchSops()} />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Standard Operating Procedures</h3>
            <p className="text-xs text-text-muted">
              Author SOPs with written procedures and checklists. Org-wide — not property-specific.
            </p>
          </div>
          {!formOpen && (
            <button
              type="button"
              onClick={startCreate}
              className="h-8 rounded-lg bg-brand-primary px-3 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-hover"
            >
              + Add SOP
            </button>
          )}
        </div>

        {formOpen ? (
          <div className="mb-4 space-y-3 rounded-lg border border-surface-border bg-surface-elevated p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-text-muted">
                Title *
                <input
                  value={form.title}
                  onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border border-surface-border bg-surface-base px-2 text-sm text-text-primary placeholder:text-text-muted"
                  placeholder="SOP title"
                  autoFocus
                />
              </label>
              <label className="text-xs text-text-muted">
                Category
                <select
                  value={form.category}
                  onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border border-surface-border bg-surface-base px-2 text-sm text-text-primary"
                >
                  {SOP_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-text-muted">
                Estimated Hours
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.estimated_hours}
                  onChange={(e) => setForm((c) => ({ ...c, estimated_hours: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border border-surface-border bg-surface-base px-2 text-sm text-text-primary"
                />
              </label>
              <label className="text-xs text-text-muted">
                Color
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((c) => ({ ...c, color: e.target.value }))}
                    className="h-9 w-12 cursor-pointer rounded-md border border-surface-border bg-surface-base"
                  />
                  <span className="text-xs text-text-muted">{form.color}</span>
                </div>
              </label>
            </div>

            <label className="block text-xs text-text-muted">
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-md border border-surface-border bg-surface-base px-2 py-2 text-sm text-text-primary placeholder:text-text-muted"
                placeholder="Brief summary of what this SOP covers"
              />
            </label>

            <label className="block text-xs text-text-muted">
              Procedure
              <textarea
                value={form.procedure_body}
                onChange={(e) => setForm((c) => ({ ...c, procedure_body: e.target.value }))}
                rows={5}
                className="mt-1 w-full rounded-md border border-surface-border bg-surface-base px-2 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted"
                placeholder="Step-by-step procedure, safety notes, required equipment..."
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">Checklist Items</span>
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="flex items-center gap-1 rounded-md border border-surface-border bg-surface-card px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  <Plus className="h-3 w-3" /> Add Item
                </button>
              </div>
              {form.checklist.length === 0 ? (
                <p className="text-xs text-text-muted">No checklist items yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {form.checklist.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-md border border-surface-border bg-surface-base px-2 py-1.5">
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          value={item.label}
                          onChange={(e) => updateChecklistItem(index, { label: e.target.value })}
                          className="h-7 flex-1 rounded border border-surface-border bg-surface-elevated px-2 text-xs text-text-primary placeholder:text-text-muted"
                          placeholder="Checklist item..."
                        />
                        <label className="flex shrink-0 items-center gap-1 text-[10px] text-text-muted">
                          <input
                            type="checkbox"
                            checked={item.is_required}
                            onChange={(e) => updateChecklistItem(index, { is_required: e.target.checked })}
                            className="h-3 w-3"
                          />
                          Required
                        </label>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveChecklistItem(index, -1)}
                          disabled={index === 0}
                          className="h-6 w-6 rounded text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveChecklistItem(index, 1)}
                          disabled={index === form.checklist.length - 1}
                          className="h-6 w-6 rounded text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeChecklistItem(index)}
                          className="h-6 w-6 rounded text-xs hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Remove item"
                        >
                          <X className="mx-auto h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="h-8 rounded-lg bg-brand-primary px-3 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-hover disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create SOP'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="h-8 rounded-lg border border-surface-border bg-surface-card px-3 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-surface-border">
          <div className="grid grid-cols-[2fr_1fr_80px_80px_100px] border-b border-surface-border bg-surface-elevated px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-muted">
            <span>Title</span>
            <span>Category</span>
            <span>Est. Hrs</span>
            <span>Color</span>
            <span className="text-right">Actions</span>
          </div>
          {activeSops.length === 0 ? (
            <p className="px-3 py-3 text-sm text-text-muted">No active SOPs. Add one above.</p>
          ) : (
            activeSops.map((sop) => (
              <div
                key={sop.id}
                className="grid grid-cols-[2fr_1fr_80px_80px_100px] items-center border-b border-surface-border px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-surface-hover"
              >
                <div className="truncate font-medium text-text-primary">{sop.title}</div>
                <div className="truncate text-muted-foreground">{sop.category ?? '—'}</div>
                <div className="text-muted-foreground">{sop.estimated_hours ?? '—'}</div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-text-primary/10"
                    style={{ backgroundColor: sop.color ?? 'rgb(var(--text-muted))' }}
                  />
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => void startEdit(sop)}
                    className="h-7 w-7 rounded-md border border-surface-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    aria-label={`Edit ${sop.title}`}
                  >
                    <Pencil className="mx-auto h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void setActiveStatus(sop, false)}
                    className="h-7 w-7 rounded-md border border-surface-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    aria-label={`Deactivate ${sop.title}`}
                  >
                    <Trash2 className="mx-auto h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {inactiveSops.length > 0 && (
        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <h3 className="mb-2 text-sm font-semibold text-text-muted">Inactive SOPs</h3>
          <div className="space-y-2">
            {inactiveSops.map((sop) => (
              <div key={sop.id} className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2 transition-colors hover:bg-surface-hover">
                <div>
                  <p className="text-sm font-medium text-text-primary">{sop.title}</p>
                  <p className="text-xs text-muted-foreground">{sop.category ?? '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void setActiveStatus(sop, true)}
                    className="h-8 rounded-lg border border-surface-border bg-surface-card px-3 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                  >
                    <RotateCcw className="mr-1 inline-block h-3.5 w-3.5" />
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSop(sop)}
                    className="h-8 rounded-lg border border-destructive/30 px-3 text-sm text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

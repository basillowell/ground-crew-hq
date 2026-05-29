import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/sonner';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { Pencil, RotateCcw, Trash2 } from 'lucide-react';

type SopStatus = 'active' | 'inactive';

interface SopTask {
  id: string;
  org_id: string | null;
  property_id: string;
  name: string;
  description: string | null;
  category: string;
  status: SopStatus;
  priority: number;
  color: string | null;
  estimated_hours: number | null;
  location: string | null;
}

interface SopFormState {
  name: string;
  category: string;
  description: string;
  estimated_hours: string;
  color: string;
  priority: string;
  location: string;
}

const EMPTY_FORM: SopFormState = {
  name: '',
  category: '',
  description: '',
  estimated_hours: '1',
  color: '#166534',
  priority: '2',
  location: '',
};

export function SOPSettings({ orgId, propertyId }: { orgId: string | null; propertyId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<SopTask[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<SopFormState>(EMPTY_FORM);

  const fetchSops = useCallback(async () => {
    if (!orgId || !propertyId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('id, org_id, property_id, name, description, category, status, priority, color, estimated_hours, location')
      .eq('org_id', orgId)
      .eq('property_id', propertyId)
      .order('status', { ascending: true })
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setTasks([]);
      setLoading(false);
      return;
    }

    setTasks((data as SopTask[]) ?? []);
    setLoading(false);
  }, [orgId, propertyId]);

  useEffect(() => {
    void fetchSops();
  }, [fetchSops]);

  const activeTasks = useMemo(() => tasks.filter((task) => task.status === 'active'), [tasks]);
  const inactiveTasks = useMemo(() => tasks.filter((task) => task.status === 'inactive'), [tasks]);
  const categories = useMemo(() => {
    const set = new Set(['General Maintenance', 'Mowing', 'Maintenance', 'Aeration']);
    tasks.forEach((task) => {
      if (task.category) set.add(task.category);
    });
    return Array.from(set);
  }, [tasks]);

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

  const startEdit = useCallback((task: SopTask) => {
    setForm({
      name: task.name ?? '',
      category: task.category ?? '',
      description: task.description ?? '',
      estimated_hours: String(task.estimated_hours ?? 1),
      color: task.color ?? '#166534',
      priority: String(task.priority ?? 2),
      location: task.location ?? '',
    });
    setEditingId(task.id);
    setFormOpen(true);
  }, []);

  const onSave = useCallback(async () => {
    if (!orgId || !propertyId) {
      toast.error('Select a property before saving SOPs.');
      return;
    }
    if (!form.name.trim()) {
      toast.error('SOP name is required.');
      return;
    }

    const estimatedHours = Number(form.estimated_hours);
    const priority = Number(form.priority);
    if (!Number.isFinite(estimatedHours) || estimatedHours < 0) {
      toast.error('Estimated hours must be 0 or more.');
      return;
    }
    if (!Number.isFinite(priority) || priority < 1 || priority > 5) {
      toast.error('Priority must be between 1 and 5.');
      return;
    }

    setSaving(true);
    const payload = {
      org_id: orgId,
      property_id: propertyId,
      name: form.name.trim(),
      category: form.category.trim() || 'General Maintenance',
      description: form.description.trim() || null,
      estimated_hours: estimatedHours,
      color: form.color || null,
      priority,
      location: form.location.trim() || null,
      status: 'active' as const,
    };

    let writeError: string | null = null;
    if (editingId) {
      const { error: updateError } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', editingId)
        .eq('org_id', orgId)
        .eq('property_id', propertyId);
      writeError = updateError?.message ?? null;
    } else {
      const { error: insertError } = await supabase.from('tasks').insert(payload);
      writeError = insertError?.message ?? null;
    }

    if (writeError) {
      toast.error(`Unable to save SOP: ${writeError}`);
      setSaving(false);
      return;
    }

    toast.success(editingId ? 'SOP updated' : 'SOP created');
    setSaving(false);
    resetForm();
    await fetchSops();
  }, [editingId, fetchSops, form, orgId, propertyId, resetForm]);

  const setTaskStatus = useCallback(
    async (task: SopTask, status: SopStatus) => {
      if (!orgId || !propertyId) return;
      const confirmed =
        status === 'inactive'
          ? window.confirm(`Deactivate SOP "${task.name}"?`)
          : window.confirm(`Restore SOP "${task.name}"?`);
      if (!confirmed) return;

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', task.id)
        .eq('org_id', orgId)
        .eq('property_id', propertyId);

      if (updateError) {
        toast.error(`Unable to update SOP: ${updateError.message}`);
        return;
      }

      toast.success(status === 'inactive' ? 'SOP deactivated' : 'SOP restored');
      await fetchSops();
    },
    [fetchSops, orgId, propertyId]
  );

  if (!orgId || !propertyId) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Select a property to manage SOPs.
      </div>
    );
  }

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchSops()} />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">SOPs</h3>
            <p className="text-xs text-muted-foreground">Manage standard operating procedures backed by the task library.</p>
          </div>
          <button type="button" onClick={startCreate} className="h-8 rounded-lg border px-3 text-sm hover:bg-muted">
            + Add SOP
          </button>
        </div>

        {formOpen ? (
          <div className="mb-4 rounded-lg border bg-muted/20 p-3">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Name *
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                  placeholder="SOP name"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Category
                <input
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  list="sop-categories"
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                  placeholder="General Maintenance"
                />
                <datalist id="sop-categories">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </label>
              <label className="text-xs text-muted-foreground">
                Estimated Hours
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.estimated_hours}
                  onChange={(event) => setForm((current) => ({ ...current, estimated_hours: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Priority (1-5)
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Color
                <input
                  type="color"
                  value={form.color}
                  onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Location
                <input
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                  placeholder="Optional location"
                />
              </label>
            </div>
            <label className="mt-2 block text-xs text-muted-foreground">
              Description
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
                placeholder="Optional SOP description"
              />
            </label>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="h-8 rounded-lg bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create SOP'}
              </button>
              <button type="button" onClick={resetForm} className="h-8 rounded-lg border px-3 text-sm hover:bg-muted">
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border">
          <div className="grid grid-cols-[2fr_1fr_120px_120px_96px] border-b bg-muted/20 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Name</span>
            <span>Category</span>
            <span>Est. Hours</span>
            <span>Color</span>
            <span className="text-right">Actions</span>
          </div>
          {activeTasks.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No active SOPs.</p>
          ) : (
            activeTasks.map((task) => (
              <div key={task.id} className="grid grid-cols-[2fr_1fr_120px_120px_96px] items-center border-b px-3 py-2 text-sm last:border-b-0">
                <div className="truncate font-medium">{task.name}</div>
                <div className="truncate text-muted-foreground">{task.category}</div>
                <div>{task.estimated_hours ?? '—'}</div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: task.color ?? '#9ca3af' }} />
                  <span className="text-xs text-muted-foreground">{task.color ?? 'None'}</span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button type="button" onClick={() => startEdit(task)} className="h-7 w-7 rounded-md border hover:bg-muted" aria-label={`Edit ${task.name}`}>
                    <Pencil className="mx-auto h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void setTaskStatus(task, 'inactive')}
                    className="h-7 w-7 rounded-md border hover:bg-muted"
                    aria-label={`Deactivate ${task.name}`}
                  >
                    <Trash2 className="mx-auto h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Inactive SOPs</h3>
        {inactiveTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No inactive SOPs.</p>
        ) : (
          <div className="space-y-2">
            {inactiveTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{task.name}</p>
                  <p className="text-xs text-muted-foreground">{task.category}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void setTaskStatus(task, 'active')}
                  className="h-8 rounded-lg border px-3 text-sm hover:bg-muted"
                >
                  <RotateCcw className="mr-1 inline-block h-3.5 w-3.5" />
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


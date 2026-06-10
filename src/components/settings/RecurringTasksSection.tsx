import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/appStore';
import { toast } from '@/components/ui/sonner';
import { Switch } from '@/components/ui/switch';

// columns from docs/dev/live-db-state.md — recurring_task_rules
interface RecurringRule {
  id: string;
  org_id: string;
  property_id: string | null;
  task_id: string;
  employee_id: string | null;
  days_of_week: string[];
  active: boolean;
  created_at: string | null;
}

interface TaskOption {
  id: string;
  name: string;
}

const DAY_OPTIONS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

interface Props {
  orgId: string | null;
}

export function RecurringTasksSection({ orgId }: Props) {
  const isHydrated = useAppStore((s) => s.isHydrated);
  const employees = useAppStore((s) => s.employees);
  const properties = useAppStore((s) => s.properties);

  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [taskOptions, setTaskOptions] = useState<TaskOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formTaskId, setFormTaskId] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formDays, setFormDays] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    if (!orgId || !isHydrated) return;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => setError('Request timed out after 8 seconds.'), 8000);
    try {
      const { data, error: err } = await supabase
        .from('recurring_task_rules')
        .select('id, org_id, property_id, task_id, employee_id, days_of_week, active, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setRules(data ?? []);
    } catch (e) {
      setError((e as Error).message || 'Failed to load recurring rules');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [orgId, isHydrated]);

  const fetchTasks = useCallback(async () => {
    if (!orgId || !isHydrated) return;
    const { data } = await supabase
      .from('tasks')
      .select('id, name')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('name');
    setTaskOptions(data ?? []);
  }, [orgId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    void fetchRules();
    void fetchTasks();
  }, [fetchRules, fetchTasks, isHydrated]);

  const resetForm = () => {
    setFormTaskId('');
    setFormEmployeeId('');
    setFormPropertyId('');
    setFormDays([]);
    setFormActive(true);
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!orgId || !formTaskId || formDays.length === 0) {
      toast.error('Task and at least one day of the week are required.');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from('recurring_task_rules').insert({
      org_id: orgId,
      task_id: formTaskId,
      employee_id: formEmployeeId || null,
      property_id: formPropertyId || null,
      days_of_week: formDays,
      active: formActive,
    });
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success('Recurring rule created');
    resetForm();
    void fetchRules();
  };

  const toggleActive = async (rule: RecurringRule) => {
    const { error: err } = await supabase
      .from('recurring_task_rules')
      .update({ active: !rule.active })
      .eq('id', rule.id)
      .eq('org_id', orgId);
    if (err) { toast.error(err.message); return; }
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, active: !r.active } : r));
  };

  const deleteRule = async (id: string) => {
    const { error: err } = await supabase
      .from('recurring_task_rules')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);
    if (err) { toast.error(err.message); return; }
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast.success('Rule deleted');
  };

  const getTaskName = (taskId: string) =>
    taskOptions.find((t) => t.id === taskId)?.name ?? 'Unknown task';

  const getEmployeeName = (id: string | null) => {
    if (!id) return 'Any employee';
    const emp = employees.find((e) => e.id === id);
    return emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
  };

  const getPropertyName = (id: string | null) => {
    if (!id) return 'Any property';
    return properties.find((p) => p.id === id)?.name ?? 'Unknown';
  };

  if (!isHydrated || loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-14 animate-pulse rounded-xl bg-surface-elevated" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-sm text-status-warning">
        {error}
        <button className="ml-2 underline" onClick={() => void fetchRules()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Recurring Tasks</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Rules that generate assignments on a repeating weekly schedule.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-bright"
        >
          <Plus className="h-4 w-4" />
          New Rule
        </button>
      </div>

      {showForm && (
        <div className="space-y-4 rounded-xl border border-surface-border bg-surface-card p-5">
          <h3 className="text-sm font-semibold text-text-primary">Create Recurring Rule</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">
                Task *
              </label>
              <select
                value={formTaskId}
                onChange={(e) => setFormTaskId(e.target.value)}
                className="h-9 w-full rounded-lg border border-surface-border bg-surface-elevated px-3 text-sm text-text-primary"
              >
                <option value="">Select task…</option>
                {taskOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">
                Employee
              </label>
              <select
                value={formEmployeeId}
                onChange={(e) => setFormEmployeeId(e.target.value)}
                className="h-9 w-full rounded-lg border border-surface-border bg-surface-elevated px-3 text-sm text-text-primary"
              >
                <option value="">Any employee</option>
                {employees
                  .filter((emp) => emp.active !== false)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">
                Property
              </label>
              <select
                value={formPropertyId}
                onChange={(e) => setFormPropertyId(e.target.value)}
                className="h-9 w-full rounded-lg border border-surface-border bg-surface-elevated px-3 text-sm text-text-primary"
              >
                <option value="">Any property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">
                Status
              </label>
              <div className="flex min-h-9 items-center gap-3">
                <Switch checked={formActive} onCheckedChange={setFormActive} aria-label="Rule active" />
                <span className={formActive ? 'text-sm text-status-active' : 'text-sm text-text-muted'}>
                  {formActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-text-muted">
              Days of Week *
            </label>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setFormDays((prev) =>
                      prev.includes(day)
                        ? prev.filter((d) => d !== day)
                        : [...prev, day],
                    )
                  }
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    formDays.includes(day)
                      ? 'border-brand bg-brand-ghost text-brand'
                      : 'border-surface-border bg-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void handleCreate()}
              disabled={saving}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-bright disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Create Rule'}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-surface-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
            <CalendarDays className="h-6 w-6 text-text-muted" />
          </div>
          <p className="mb-1 text-sm font-semibold text-text-primary">No recurring rules yet</p>
          <p className="max-w-xs text-sm text-text-secondary">
            Create a rule to auto-generate assignments on a repeating weekly schedule.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-border">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-border bg-surface-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">
                  Task
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted sm:table-cell">
                  Employee
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted md:table-cell">
                  Property
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">
                  Days
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {rules.map((rule) => (
                <tr key={rule.id} className="transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {getTaskName(rule.task_id)}
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">
                    {getEmployeeName(rule.employee_id)}
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                    {getPropertyName(rule.property_id)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {DAY_OPTIONS.map((day) => {
                        const active = (rule.days_of_week ?? []).includes(day);
                        return (
                        <span
                          key={day}
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            active ? 'bg-brand-ghost text-brand' : 'bg-surface-elevated text-text-muted'
                          }`}
                        >
                          {DAY_LABELS[day] ?? day}
                        </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={rule.active}
                      onCheckedChange={() => void toggleActive(rule)}
                      aria-label={`${getTaskName(rule.task_id)} active`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void deleteRule(rule.id)}
                      className="rounded p-1.5 text-text-muted transition-colors hover:bg-status-warning/10 hover:text-status-warning"
                      title="Delete rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

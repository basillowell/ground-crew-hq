import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/utils/formatTime';

const TABS = ['Workspace', 'Workforce', 'Scheduler', 'Tasks', 'Weather', 'Access', 'Help'] as const;
type Tab = (typeof TABS)[number];

interface SchedulerSettings {
  id: string;
  org_id: string;
  operational_day_start: string;
  operational_day_end: string;
  operational_days: string[];
  min_shift_hours: number;
  max_shift_hours: number;
  overtime_threshold_hours: number;
}

interface ShiftTemplate {
  id: string;
  org_id: string;
  name: string;
  start: string;
  end: string;
  days: string[];
  active: boolean;
}

interface TaskLibraryItem {
  id: string;
  org_id: string;
  property_id: string | null;
  name: string;
  category: string | null;
  priority: number | null;
  estimated_hours: number | null;
}

function PlaceholderCard({ text }: { text: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
      <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>{text}</p>
    </div>
  );
}

export default function SettingsPage() {
  const { orgId, user, userRole, currentUser, currentPropertyId } = useAuth();
  const [tab, setTab] = useState<Tab>('Scheduler');
  const taskPropertyId =
    (currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : null) ??
    currentUser?.propertyId ??
    null;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px' }}>Operations Control Center</h1>
      <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 1.5rem' }}>{user?.email}</p>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '0',
          flexWrap: 'wrap',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#166534' : '#6b7280',
              borderBottom: tab === t ? '2px solid #166534' : '2px solid transparent',
              fontSize: '14px',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Workspace' && <WorkspaceTab key="workspace" orgId={orgId} />}
      {tab === 'Workforce' && <WorkforceTab key="workforce" orgId={orgId} />}
      {tab === 'Scheduler' && <SchedulerTab key="scheduler" orgId={orgId ?? ''} />}
      {tab === 'Tasks' && <TasksTab key="tasks" orgId={orgId ?? ''} propertyId={taskPropertyId} />}
      {tab === 'Weather' && <WeatherTab key="weather" orgId={orgId} />}
      {tab === 'Access' && <AccessTab key="access" userEmail={user?.email ?? ''} userRole={userRole} orgId={orgId} />}
      {tab === 'Help' && <HelpTab key="help" />}
    </div>
  );
}

function WorkspaceTab({ orgId }: { orgId: string | null }) {
  if (!orgId) return <div style={{ color: '#6b7280', fontSize: '13px' }}>Loading workspace settings…</div>;
  return <PlaceholderCard text="Workspace settings coming soon." />;
}

function WorkforceTab({ orgId }: { orgId: string | null }) {
  if (!orgId) return <div style={{ color: '#6b7280', fontSize: '13px' }}>Loading workforce settings…</div>;
  return <PlaceholderCard text="Workforce settings coming soon." />;
}

function WeatherTab({ orgId }: { orgId: string | null }) {
  if (!orgId) return <div style={{ color: '#6b7280', fontSize: '13px' }}>Loading weather settings…</div>;
  return <PlaceholderCard text="Weather settings coming soon." />;
}

function AccessTab({
  userEmail,
  userRole,
  orgId,
}: {
  userEmail: string;
  userRole: string | null;
  orgId: string | null;
}) {
  if (!orgId) return <div style={{ color: '#6b7280', fontSize: '13px' }}>Loading access settings…</div>;
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <PlaceholderCard text="Access settings coming soon." />
      <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>{userEmail || 'No user email'}</p>
      <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>Role: {userRole ?? 'Not available'}</p>
    </div>
  );
}

function HelpTab() {
  return <PlaceholderCard text="Help settings coming soon." />;
}

function TasksTab({ orgId, propertyId }: { orgId: string; propertyId: string | null }) {
  const [tasks, setTasks] = useState<TaskLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newPriority, setNewPriority] = useState<'1' | '2' | '3'>('2');
  const [newEstimatedHours, setNewEstimatedHours] = useState('1');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    category: '',
    priority: 2,
    estimated_hours: 0,
  });

  const fetchTasks = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    if (!orgId) {
      setLoading(true);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('id, org_id, property_id, name, category, priority, estimated_hours')
      .eq('org_id', orgId)
      .order('priority', { ascending: true })
      .order('name', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setTasks((data as TaskLibraryItem[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const addTask = async () => {
    if (!supabase || !orgId || !newName.trim()) return;
    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert({
        org_id: orgId,
        property_id: propertyId,
        name: newName.trim(),
        category: newCategory.trim() || 'General',
        priority: Number(newPriority),
        estimated_hours: Number(newEstimatedHours || '0'),
        status: 'active',
      })
      .select('id, org_id, property_id, name, category, priority, estimated_hours')
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTasks((current) =>
      [...current, data as TaskLibraryItem].sort(
        (a, b) => (a.priority ?? 99) - (b.priority ?? 99) || a.name.localeCompare(b.name),
      ),
    );
    setNewName('');
    setNewCategory('General');
    setNewPriority('2');
    setNewEstimatedHours('1');
  };

  const removeTask = async (taskId: string) => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm('Delete this task from the library?');
    if (!confirmed) return;
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', taskId).eq('org_id', orgId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setTasks((current) => current.filter((task) => task.id !== taskId));
  };

  const startEditTask = (task: TaskLibraryItem) => {
    setEditingTaskId(task.id);
    setEditDraft({
      name: task.name,
      category: task.category ?? 'General',
      priority: task.priority ?? 2,
      estimated_hours: Number(task.estimated_hours ?? 0),
    });
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditDraft({ name: '', category: '', priority: 2, estimated_hours: 0 });
  };

  const saveEditTask = async (taskId: string) => {
    if (!supabase || !orgId) return;
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        name: editDraft.name.trim(),
        category: editDraft.category.trim() || 'General',
        priority: editDraft.priority,
        estimated_hours: editDraft.estimated_hours,
      })
      .eq('id', taskId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              name: editDraft.name.trim(),
              category: editDraft.category.trim() || 'General',
              priority: editDraft.priority,
              estimated_hours: editDraft.estimated_hours,
            }
          : task,
      ),
    );
    cancelEditTask();
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>Task Library</h3>
        <p style={{ margin: '0 0 14px', color: '#6b7280', fontSize: '13px' }}>Reusable tasks for daily workflow planning.</p>

        {loading ? (
          <div style={{ height: '140px', borderRadius: '10px', background: '#e5e7eb', animation: 'pulse 1.5s infinite' }} />
        ) : error ? (
          <div>
            <p style={{ color: '#dc2626', marginBottom: '10px' }}>Failed to load: {error}</p>
            <button onClick={() => void fetchTasks()}>Retry</button>
          </div>
        ) : tasks.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '13px' }}>No tasks yet. Add your first reusable task below.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Name</th>
                  <th style={{ padding: '8px' }}>Category</th>
                  <th style={{ padding: '8px' }}>Priority</th>
                  <th style={{ padding: '8px' }}>Est. Hours</th>
                  <th style={{ padding: '8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px' }}>
                      {editingTaskId === task.id ? (
                        <input
                          value={editDraft.name}
                          onChange={(event) => setEditDraft((cur) => ({ ...cur, name: event.target.value }))}
                        />
                      ) : (
                        task.name
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {editingTaskId === task.id ? (
                        <input
                          value={editDraft.category}
                          onChange={(event) => setEditDraft((cur) => ({ ...cur, category: event.target.value }))}
                        />
                      ) : (
                        task.category ?? 'General'
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {editingTaskId === task.id ? (
                        <select
                          value={String(editDraft.priority)}
                          onChange={(event) => setEditDraft((cur) => ({ ...cur, priority: Number(event.target.value) }))}
                        >
                          <option value="1">High</option>
                          <option value="2">Med</option>
                          <option value="3">Low</option>
                        </select>
                      ) : task.priority === 1 ? 'High' : task.priority === 2 ? 'Med' : 'Low'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {editingTaskId === task.id ? (
                        <input
                          type="number"
                          step="0.25"
                          value={String(editDraft.estimated_hours)}
                          onChange={(event) =>
                            setEditDraft((cur) => ({ ...cur, estimated_hours: Number(event.target.value || '0') }))
                          }
                        />
                      ) : (
                        Number(task.estimated_hours ?? 0).toFixed(1)
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {editingTaskId === task.id ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => void saveEditTask(task.id)} style={{ color: '#166534' }}>Save</button>
                          <button onClick={cancelEditTask}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => startEditTask(task)}>Edit</button>
                          <button onClick={() => void removeTask(task.id)} style={{ color: '#dc2626' }}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <strong>Add task</strong>
        <input placeholder="Task name" value={newName} onChange={(event) => setNewName(event.target.value)} />
        <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr 1fr' }}>
          <input placeholder="Category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
          <select value={newPriority} onChange={(event) => setNewPriority(event.target.value as '1' | '2' | '3')}>
            <option value="1">1 (High)</option>
            <option value="2">2 (Med)</option>
            <option value="3">3 (Low)</option>
          </select>
          <input type="number" step="0.25" placeholder="Est. hours" value={newEstimatedHours} onChange={(event) => setNewEstimatedHours(event.target.value)} />
        </div>
        <button
          onClick={() => void addTask()}
          style={{
            width: 'fit-content',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            background: '#166534',
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          Save task
        </button>
      </div>
    </div>
  );
}

function SchedulerTab({ orgId }: { orgId: string }) {
  const [settings, setSettings] = useState<SchedulerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('05:00');
  const [newEnd, setNewEnd] = useState('13:30');
  const [newDays, setNewDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);

  const dayOptions = [
    { key: 'mon', label: 'M' },
    { key: 'tue', label: 'T' },
    { key: 'wed', label: 'W' },
    { key: 'thu', label: 'T' },
    { key: 'fri', label: 'F' },
    { key: 'sat', label: 'S' },
    { key: 'sun', label: 'S' },
  ] as const;

  const fetchSettings = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    if (!orgId) {
      setLoading(true);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from('scheduler_settings').select('*').eq('org_id', orgId).single();
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setSettings(data as SchedulerSettings);
    setLoading(false);
  }, [orgId]);

  const fetchTemplates = useCallback(async () => {
    if (!supabase) {
      setTemplatesLoading(false);
      return;
    }
    if (!orgId) {
      setTemplatesLoading(true);
      setTemplatesError(null);
      return;
    }
    setTemplatesLoading(true);
    setTemplatesError(null);
    const { data, error: fetchError } = await supabase
      .from('shift_templates')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    if (fetchError) {
      setTemplatesError(fetchError.message);
      setTemplatesLoading(false);
      return;
    }
    setTemplates((data as ShiftTemplate[]) ?? []);
    setTemplatesLoading(false);
  }, [orgId]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const toggleDayValue = (currentDays: string[], dayValue: string) =>
    currentDays.includes(dayValue) ? currentDays.filter((day) => day !== dayValue) : [...currentDays, dayValue];

  const saveSettings = async () => {
    if (!supabase || !orgId || !settings) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase
      .from('scheduler_settings')
      .update({
        operational_day_start: settings.operational_day_start,
        operational_day_end: settings.operational_day_end,
        operational_days: settings.operational_days,
        min_shift_hours: settings.min_shift_hours,
        max_shift_hours: settings.max_shift_hours,
        overtime_threshold_hours: settings.overtime_threshold_hours,
      })
      .eq('org_id', orgId);
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const deleteTemplate = async (templateId: string) => {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from('shift_templates').delete().eq('id', templateId);
    if (deleteError) {
      setTemplatesError(deleteError.message);
      return;
    }
    setTemplates((current) => current.filter((template) => template.id !== templateId));
  };

  const addTemplate = async () => {
    if (!supabase || !orgId || !newName.trim()) return;
    const { data, error: insertError } = await supabase
      .from('shift_templates')
      .insert({
        org_id: orgId,
        name: newName.trim(),
        start: newStart,
        end: newEnd,
        days: newDays,
        active: true,
      })
      .select()
      .single();
    if (insertError) {
      setTemplatesError(insertError.message);
      return;
    }
    setTemplates((current) => [...current, data as ShiftTemplate]);
    setNewName('');
    setNewStart('05:00');
    setNewEnd('13:30');
    setNewDays(['mon', 'tue', 'wed', 'thu', 'fri']);
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>Operational Day</h3>
        <p style={{ margin: '0 0 14px', color: '#6b7280', fontSize: '13px' }}>Define your property's standard operating window</p>

        {loading ? (
          <div style={{ height: '200px', borderRadius: '10px', background: '#e5e7eb', animation: 'pulse 1.5s infinite' }} />
        ) : error ? (
          <div>
            <p style={{ color: '#dc2626', marginBottom: '10px' }}>Failed to load: {error}</p>
            <button onClick={() => void fetchSettings()}>Retry</button>
          </div>
        ) : settings ? (
          <div style={{ display: 'grid', gap: '14px' }}>
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Operations Start</span>
                <input
                  type="time"
                  value={settings.operational_day_start.slice(0, 5)}
                  onChange={(event) => setSettings((cur) => (cur ? { ...cur, operational_day_start: `${event.target.value}:00` } : cur))}
                />
              </label>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Operations End</span>
                <input
                  type="time"
                  value={settings.operational_day_end.slice(0, 5)}
                  onChange={(event) => setSettings((cur) => (cur ? { ...cur, operational_day_end: `${event.target.value}:00` } : cur))}
                />
              </label>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Display window: {formatTime(settings.operational_day_start)}–{formatTime(settings.operational_day_end)}
            </div>

            <div style={{ display: 'grid', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Active Days</span>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {dayOptions.map((day) => (
                  <label key={day.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={settings.operational_days.includes(day.key)}
                      onChange={() =>
                        setSettings((cur) => (cur ? { ...cur, operational_days: toggleDayValue(cur.operational_days ?? [], day.key) } : cur))
                      }
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr 1fr' }}>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Min Shift Hours</span>
                <input type="number" value={settings.min_shift_hours} onChange={(event) => setSettings((cur) => (cur ? { ...cur, min_shift_hours: Number(event.target.value) } : cur))} />
              </label>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Max Shift Hours</span>
                <input type="number" value={settings.max_shift_hours} onChange={(event) => setSettings((cur) => (cur ? { ...cur, max_shift_hours: Number(event.target.value) } : cur))} />
              </label>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Overtime Threshold (hrs/wk)</span>
                <input type="number" value={settings.overtime_threshold_hours} onChange={(event) => setSettings((cur) => (cur ? { ...cur, overtime_threshold_hours: Number(event.target.value) } : cur))} />
              </label>
            </div>

            <button
              onClick={() => void saveSettings()}
              style={{
                width: 'fit-content',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                background: saved ? '#15803d' : '#166534',
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        ) : null}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Shift Templates</h3>
        {templatesLoading ? (
          <div style={{ height: '140px', borderRadius: '10px', background: '#e5e7eb', animation: 'pulse 1.5s infinite' }} />
        ) : templatesError ? (
          <div>
            <p style={{ color: '#dc2626', marginBottom: '10px' }}>Failed to load: {templatesError}</p>
            <button onClick={() => void fetchTemplates()}>Retry</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {templates.map((template) => (
              <div key={template.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', display: 'grid', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <strong>{template.name}</strong>
                  <button onClick={() => void deleteTemplate(template.id)} style={{ color: '#dc2626', border: 'none', background: 'transparent', cursor: 'pointer' }}>×</button>
                </div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>{formatTime(template.start)}–{formatTime(template.end)}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(template.days ?? []).map((day) => (
                    <span key={`${template.id}-${day}`} style={{ border: '1px solid #e5e7eb', borderRadius: '999px', padding: '2px 8px', fontSize: '12px' }}>{day}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '14px', borderTop: '1px dashed #d1d5db', paddingTop: '12px', display: 'grid', gap: '10px' }}>
          <strong>Add template</strong>
          <input placeholder="Template name" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
            <input type="time" value={newStart} onChange={(event) => setNewStart(event.target.value)} />
            <input type="time" value={newEnd} onChange={(event) => setNewEnd(event.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {dayOptions.map((day) => (
              <label key={`new-${day.key}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                <input type="checkbox" checked={newDays.includes(day.key)} onChange={() => setNewDays((cur) => toggleDayValue(cur, day.key))} />
                {day.label}
              </label>
            ))}
          </div>
          <button
            onClick={() => void addTemplate()}
            style={{
              width: 'fit-content',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              background: '#166534',
              padding: '8px 14px',
              cursor: 'pointer',
            }}
          >
            Save template
          </button>
        </div>
      </div>
    </div>
  );
}

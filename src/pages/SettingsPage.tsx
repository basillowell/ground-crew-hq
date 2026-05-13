import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const TABS = ['Workspace', 'Workforce', 'Scheduler', 'Tasks', 'Weather', 'Access', 'Help'] as const;

type Tab = (typeof TABS)[number];

interface SchedulerSettings {
  id: string;
  org_id: string;
  operational_day_start: string;
  operational_day_end: string;
  operational_days: string[];
  default_shift_start: string;
  default_shift_end: string;
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
  name: string;
  description: string | null;
  category: string | null;
  status: string | null;
  priority: number | null;
  color: string | null;
  estimated_hours: number | null;
  location: string | null;
  property_id: string | null;
}

export default function SettingsPage() {
  const { orgId, user, userRole } = useAuth();
  const [tab, setTab] = useState<Tab>('Scheduler');

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
      {tab === 'Tasks' && <TasksTab key="tasks" orgId={orgId ?? ''} />}
      {tab === 'Weather' && <WeatherTab key="weather" orgId={orgId} />}
      {tab === 'Access' && (
        <AccessTab key="access" userEmail={user?.email ?? ''} userRole={userRole} orgId={orgId} />
      )}
      {tab === 'Help' && <HelpTab key="help" />}
    </div>
  );
}

function TasksTab({ orgId }: { orgId: string }) {
  const [tasks, setTasks] = useState<TaskLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newEstimatedHours, setNewEstimatedHours] = useState('2');
  const [newLocation, setNewLocation] = useState('');
  const [newColor, setNewColor] = useState('#166534');
  const [customCategory, setCustomCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Partial<TaskLibraryItem>>({});
  const categoryOptions = ['Mowing', 'Irrigation', 'Maintenance', 'Equipment', 'Safety', 'General', 'Custom'];

  const fetchTasks = useCallback(async () => {
    if (!supabase || !orgId) {
      setError('Organization context missing.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('org_id', orgId)
      .order('category', { ascending: true })
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

  const groupedTasks = useMemo(() => {
    const grouped = new Map<string, TaskLibraryItem[]>();
    for (const task of tasks) {
      const key = task.category?.trim() || 'General';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(task);
    }
    return Array.from(grouped.entries());
  }, [tasks]);

  const addTask = async () => {
    if (!supabase || !orgId || !newName.trim()) return;
    const category = newCategory === 'Custom' ? customCategory.trim() || 'General' : newCategory;
    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert({
        org_id: orgId,
        name: newName.trim(),
        category,
        estimated_hours: Number(newEstimatedHours || '0'),
        location: newLocation.trim() || null,
        color: newColor,
        status: 'active',
      })
      .select('*')
      .single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTasks((current) =>
      [...current, data as TaskLibraryItem].sort(
        (a, b) => `${a.category ?? ''}${a.name}`.localeCompare(`${b.category ?? ''}${b.name}`),
      ),
    );
    setNewName('');
    setNewCategory('General');
    setNewEstimatedHours('2');
    setNewLocation('');
    setNewColor('#166534');
    setCustomCategory('');
  };

  const removeTask = async (taskId: string) => {
    if (!supabase || !orgId) return;
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', taskId).eq('org_id', orgId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setTasks((current) => current.filter((task) => task.id !== taskId));
  };

  const openEdit = (task: TaskLibraryItem) => {
    setEditingId(task.id);
    setEditingDraft(task);
  };

  const saveEdit = async () => {
    if (!supabase || !orgId || !editingId) return;
    const patch = {
      name: editingDraft.name ?? '',
      category: editingDraft.category ?? 'General',
      estimated_hours: Number(editingDraft.estimated_hours ?? 0),
      location: editingDraft.location ?? null,
      color: editingDraft.color ?? '#166534',
    };
    const { error: updateError } = await supabase.from('tasks').update(patch).eq('id', editingId).eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setTasks((current) =>
      current.map((task) => (task.id === editingId ? { ...task, ...patch } : task)),
    );
    setEditingId(null);
    setEditingDraft({});
  };

  const seedCommonTasks = async () => {
    if (!supabase || !orgId) return;
    const seeds = [
      { name: 'Roll Greens', category: 'Mowing', estimated_hours: 2 },
      { name: 'Mow Greens', category: 'Mowing', estimated_hours: 3 },
      { name: 'Mow Fairways', category: 'Mowing', estimated_hours: 4 },
      { name: 'Mow Tees', category: 'Mowing', estimated_hours: 2 },
      { name: 'Change Cups', category: 'Maintenance', estimated_hours: 2.5 },
      { name: 'Check Sand Depth', category: 'Maintenance', estimated_hours: 4 },
      { name: 'Irrigation Check', category: 'Irrigation', estimated_hours: 3 },
      { name: 'Collect Balls', category: 'General', estimated_hours: 3 },
      { name: 'Birdhouses', category: 'Maintenance', estimated_hours: 2 },
    ];
    const existingNames = new Set(tasks.map((task) => task.name.toLowerCase()));
    const payload = seeds
      .filter((seed) => !existingNames.has(seed.name.toLowerCase()))
      .map((seed) => ({
        org_id: orgId,
        name: seed.name,
        category: seed.category,
        estimated_hours: seed.estimated_hours,
        status: 'active',
        color: '#166534',
      }));
    if (payload.length === 0) {
      return;
    }
    const { error: insertError } = await supabase.from('tasks').insert(payload);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await fetchTasks();
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>Task Library</h3>
        <p style={{ margin: '0 0 14px', color: '#6b7280', fontSize: '13px' }}>
          Reusable tasks for daily workflow planning
        </p>

        <button
          onClick={() => void seedCommonTasks()}
          style={{
            width: 'fit-content',
            border: '1px solid #166534',
            borderRadius: '8px',
            color: '#166534',
            background: '#f0fdf4',
            padding: '8px 14px',
            cursor: 'pointer',
            marginBottom: '12px',
          }}
        >
          Add common turf tasks
        </button>

        {loading ? (
          <div style={{ height: '140px', borderRadius: '10px', background: '#e5e7eb', animation: 'pulse 1.5s infinite' }} />
        ) : error ? (
          <div>
            <p style={{ color: '#dc2626', marginBottom: '10px' }}>Failed to load: {error}</p>
            <button onClick={() => void fetchTasks()}>Retry</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {groupedTasks.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '13px' }}>No tasks yet. Add your first reusable task below.</p>
            ) : (
              groupedTasks.map(([category, items]) => (
                <div key={category} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600 }}>{category}</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {items.map((task) => (
                      <div key={task.id} style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '8px' }}>
                        {editingId === task.id ? (
                          <div style={{ display: 'grid', gap: '8px' }}>
                            <input
                              value={editingDraft.name ?? ''}
                              onChange={(event) => setEditingDraft((current) => ({ ...current, name: event.target.value }))}
                            />
                            <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr 1fr' }}>
                              <input
                                value={editingDraft.category ?? ''}
                                onChange={(event) => setEditingDraft((current) => ({ ...current, category: event.target.value }))}
                              />
                              <input
                                type="number"
                                step="0.25"
                                value={String(editingDraft.estimated_hours ?? 0)}
                                onChange={(event) => setEditingDraft((current) => ({ ...current, estimated_hours: Number(event.target.value) }))}
                              />
                              <input
                                type="color"
                                value={editingDraft.color ?? '#166534'}
                                onChange={(event) => setEditingDraft((current) => ({ ...current, color: event.target.value }))}
                              />
                            </div>
                            <input
                              placeholder="Location"
                              value={editingDraft.location ?? ''}
                              onChange={(event) => setEditingDraft((current) => ({ ...current, location: event.target.value }))}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => void saveEdit()}>Save</button>
                              <button onClick={() => { setEditingId(null); setEditingDraft({}); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: task.color ?? '#166534', display: 'inline-block' }} />
                                <strong>{task.name}</strong>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => openEdit(task)}>Edit</button>
                                <button onClick={() => void removeTask(task.id)} style={{ color: '#dc2626' }}>Delete</button>
                              </div>
                            </div>
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>
                              {Number(task.estimated_hours ?? 0).toFixed(1)}h · {task.category ?? 'General'} · {task.location ?? 'No location'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <strong>Add reusable task</strong>
        <input placeholder="Task name" value={newName} onChange={(event) => setNewName(event.target.value)} />
        <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr 1fr' }}>
          <select value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <input type="number" step="0.25" placeholder="Est. hours" value={newEstimatedHours} onChange={(event) => setNewEstimatedHours(event.target.value)} />
          <input type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} />
        </div>
        {newCategory === 'Custom' ? (
          <input placeholder="Custom category name" value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} />
        ) : null}
        <input placeholder="Default location" value={newLocation} onChange={(event) => setNewLocation(event.target.value)} />
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

function WorkspaceTab({ orgId }: { orgId: string | null }) {
  return (
    <div>
      <p>Workspace settings coming</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Org: {orgId ?? 'Not available'}</p>
    </div>
  );
}

function WorkforceTab({ orgId }: { orgId: string | null }) {
  return (
    <div>
      <p>Workforce settings coming</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Org: {orgId ?? 'Not available'}</p>
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
    if (!supabase || !orgId) {
      setError('Organization context missing.');
      setLoading(false);
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
    if (!supabase || !orgId) {
      setTemplatesError('Organization context missing.');
      setTemplatesLoading(false);
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
        <p style={{ margin: '0 0 14px', color: '#6b7280', fontSize: '13px' }}>
          Define your property's standard operating window
        </p>

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
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, operational_day_start: `${event.target.value}:00` } : current,
                    )
                  }
                />
              </label>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Operations End</span>
                <input
                  type="time"
                  value={settings.operational_day_end.slice(0, 5)}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, operational_day_end: `${event.target.value}:00` } : current,
                    )
                  }
                />
              </label>
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
                        setSettings((current) =>
                          current
                            ? { ...current, operational_days: toggleDayValue(current.operational_days ?? [], day.key) }
                            : current,
                        )
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
                <input
                  type="number"
                  value={settings.min_shift_hours}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, min_shift_hours: Number(event.target.value) } : current,
                    )
                  }
                />
              </label>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Max Shift Hours</span>
                <input
                  type="number"
                  value={settings.max_shift_hours}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, max_shift_hours: Number(event.target.value) } : current,
                    )
                  }
                />
              </label>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Overtime Threshold (hrs/wk)</span>
                <input
                  type="number"
                  value={settings.overtime_threshold_hours}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, overtime_threshold_hours: Number(event.target.value) } : current,
                    )
                  }
                />
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
              <div
                key={template.id}
                style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', display: 'grid', gap: '6px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <strong>{template.name}</strong>
                  <button
                    onClick={() => void deleteTemplate(template.id)}
                    style={{ color: '#dc2626', border: 'none', background: 'transparent', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>
                  {template.start?.slice(0, 5)}–{template.end?.slice(0, 5)}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(template.days ?? []).map((day) => (
                    <span key={`${template.id}-${day}`} style={{ border: '1px solid #e5e7eb', borderRadius: '999px', padding: '2px 8px', fontSize: '12px' }}>
                      {day}
                    </span>
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
                <input
                  type="checkbox"
                  checked={newDays.includes(day.key)}
                  onChange={() => setNewDays((current) => toggleDayValue(current, day.key))}
                />
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

function WeatherTab({ orgId }: { orgId: string | null }) {
  return (
    <div>
      <p>Weather settings coming</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Org: {orgId ?? 'Not available'}</p>
    </div>
  );
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
  return (
    <div>
      <p>Access settings coming</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>{userEmail || 'No user email'}</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Role: {userRole ?? 'Not available'}</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Org: {orgId ?? 'Not available'}</p>
    </div>
  );
}

function HelpTab() {
  return (
    <div>
      <p>Operations Assistant</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Coming soon</p>
    </div>
  );
}

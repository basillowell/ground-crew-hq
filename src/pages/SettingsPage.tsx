import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const TABS = ['Workspace', 'Workforce', 'Scheduler', 'Weather', 'Access', 'Help'] as const;

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
      {tab === 'Weather' && <WeatherTab key="weather" orgId={orgId} />}
      {tab === 'Access' && (
        <AccessTab key="access" userEmail={user?.email ?? ''} userRole={userRole} orgId={orgId} />
      )}
      {tab === 'Help' && <HelpTab key="help" />}
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

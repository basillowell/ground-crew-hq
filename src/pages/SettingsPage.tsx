import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/utils/formatTime';
import { useLocation } from 'react-router-dom';

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

interface OrganizationInfo {
  name: string;
  plan: string | null;
}

interface PropertyItem {
  id: string;
  name: string;
  org_id: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  created_at: string | null;
}

interface WorkforceSummaryRow {
  role: string | null;
  department: string | null;
}

interface WeatherLocationItem {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  is_active?: boolean | null;
}

interface WeatherDisplayPrefsRow {
  id?: string;
  org_id: string;
  enabled_widgets?: string[] | null;
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
  const location = useLocation();
  const [tab, setTab] = useState<Tab>('Scheduler');
  const taskPropertyId =
    (currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : null) ??
    currentUser?.propertyId ??
    null;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get('tab');
    if (requestedTab && TABS.includes(requestedTab as Tab)) {
      setTab(requestedTab as Tab);
    }
  }, [location.search]);

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
      {tab === 'Tasks' && <TasksTab key="tasks" orgId={orgId} propertyId={taskPropertyId} />}
      {tab === 'Weather' && <WeatherTab key="weather" orgId={orgId} />}
      {tab === 'Access' && <AccessTab key="access" userEmail={user?.email ?? ''} userRole={userRole} orgId={orgId} />}
      {tab === 'Help' && <HelpTab key="help" />}
    </div>
  );
}

function WorkspaceTab({ orgId }: { orgId: string | null }) {
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [orgNameDraft, setOrgNameDraft] = useState('');
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingOrg, setSavingOrg] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingPropertyName, setEditingPropertyName] = useState('');

  const fetchWorkspaceData = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);
    setError(null);

    const [{ data: orgData, error: orgError }, { data: propertiesData, error: propertiesError }] = await Promise.all([
      supabase.from('organizations').select('name, plan').eq('id', orgId).single(),
      supabase
        .from('properties')
        .select('id, name, org_id, address, latitude, longitude, timezone, created_at')
        .eq('org_id', orgId)
        .order('name', { ascending: true }),
    ]);

    if (orgError || propertiesError) {
      setError(orgError?.message ?? propertiesError?.message ?? 'Unable to load workspace settings');
      setLoading(false);
      return;
    }

    setOrgInfo((orgData ?? null) as OrganizationInfo | null);
    setOrgNameDraft(String((orgData as OrganizationInfo | null)?.name ?? ''));
    setProperties((propertiesData ?? []) as PropertyItem[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    void fetchWorkspaceData();
  }, [fetchWorkspaceData, orgId]);

  const saveOrganization = async () => {
    if (!supabase || !orgId || !orgNameDraft.trim()) return;
    setSavingOrg(true);
    setError(null);
    const { error: updateError } = await supabase.from('organizations').update({ name: orgNameDraft.trim() }).eq('id', orgId);
    setSavingOrg(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setOrgInfo((current) => (current ? { ...current, name: orgNameDraft.trim() } : current));
  };

  const addProperty = async () => {
    if (!supabase || !orgId || !newPropertyName.trim()) return;
    setError(null);
    const { data, error: insertError } = await supabase
      .from('properties')
      .insert({ name: newPropertyName.trim(), org_id: orgId })
      .select('id, name, org_id, address, latitude, longitude, timezone, created_at')
      .single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setProperties((current) => [...current, data as PropertyItem].sort((a, b) => a.name.localeCompare(b.name)));
    setNewPropertyName('');
  };

  const startPropertyEdit = (property: PropertyItem) => {
    setEditingPropertyId(property.id);
    setEditingPropertyName(property.name);
  };

  const savePropertyEdit = async (propertyId: string) => {
    if (!supabase || !orgId || !editingPropertyName.trim()) return;
    setError(null);
    const { error: updateError } = await supabase
      .from('properties')
      .update({ name: editingPropertyName.trim() })
      .eq('id', propertyId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setProperties((current) =>
      current
        .map((property) => (property.id === propertyId ? { ...property, name: editingPropertyName.trim() } : property))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setEditingPropertyId(null);
    setEditingPropertyName('');
  };

  const cancelPropertyEdit = () => {
    setEditingPropertyId(null);
    setEditingPropertyName('');
  };

  const deleteProperty = async (propertyId: string) => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm('Delete this property?');
    if (!confirmed) return;
    setError(null);
    const { error: deleteError } = await supabase.from('properties').delete().eq('id', propertyId).eq('org_id', orgId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setProperties((current) => current.filter((property) => property.id !== propertyId));
  };

  if (!orgId || loading) {
    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '13px' }}>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#166534] border-t-transparent" />
            Loading workspace settings...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <p style={{ margin: '0 0 10px', color: '#dc2626', fontSize: '13px' }}>Failed to load: {error}</p>
        <button onClick={() => void fetchWorkspaceData()}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Organization Info</h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '6px', minWidth: '240px' }}>
            <label style={{ color: '#6b7280', fontSize: '12px' }}>Organization name</label>
            <input value={orgNameDraft} onChange={(event) => setOrgNameDraft(event.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ color: '#6b7280', fontSize: '12px' }}>Plan</label>
            <span style={{ border: '1px solid #e5e7eb', borderRadius: '999px', padding: '4px 10px', fontSize: '12px', width: 'fit-content' }}>
              {(orgInfo?.plan ?? 'starter').toString()}
            </span>
          </div>
        </div>
        <button
          onClick={() => void saveOrganization()}
          disabled={savingOrg}
          style={{ width: 'fit-content', border: 'none', borderRadius: '8px', color: '#fff', background: '#166534', padding: '8px 14px', cursor: 'pointer' }}
        >
          {savingOrg ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Properties ({properties.length})</h3>
        {properties.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>No properties yet. Add your first property below.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Name</th>
                  <th style={{ padding: '8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px' }}>
                      {editingPropertyId === property.id ? (
                        <input value={editingPropertyName} onChange={(event) => setEditingPropertyName(event.target.value)} />
                      ) : (
                        property.name
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {editingPropertyId === property.id ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => void savePropertyEdit(property.id)} style={{ color: '#166534' }}>Save</button>
                          <button onClick={cancelPropertyEdit}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => startPropertyEdit(property)}>Edit</button>
                          <button onClick={() => void deleteProperty(property.id)} style={{ color: '#dc2626' }}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: '8px', display: 'grid', gap: '8px', maxWidth: '420px' }}>
          <label style={{ color: '#6b7280', fontSize: '12px' }}>Add property</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input placeholder="Property name" value={newPropertyName} onChange={(event) => setNewPropertyName(event.target.value)} style={{ flex: 1 }} />
            <button
              onClick={() => void addProperty()}
              style={{ border: 'none', borderRadius: '8px', color: '#fff', background: '#166534', padding: '8px 14px', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkforceTab({ orgId }: { orgId: string | null }) {
  const [rows, setRows] = useState<WorkforceSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkforceSummary = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('employees')
      .select('role, department')
      .eq('org_id', orgId);
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as WorkforceSummaryRow[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    void fetchWorkforceSummary();
  }, [fetchWorkforceSummary, orgId]);

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const key = row.role?.trim() || 'Unassigned';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const key = row.department?.trim() || 'Unassigned';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  if (!orgId || loading) {
    return <div style={{ color: '#6b7280', fontSize: '13px' }}>Loading workforce settings…</div>;
  }

  if (error) {
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <p style={{ margin: '0 0 10px', color: '#dc2626', fontSize: '13px' }}>Failed to load: {error}</p>
        <button onClick={() => void fetchWorkforceSummary()}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '12px' }}>
      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Workforce Summary</h3>
      <div style={{ display: 'grid', gap: '8px' }}>
        <p style={{ margin: 0, color: '#374151', fontSize: '13px' }}>
          <strong>Roles:</strong>{' '}
          {roleCounts.length > 0 ? roleCounts.map(([name, count]) => `${name} (${count})`).join(' · ') : 'No roles available'}
        </p>
        <p style={{ margin: 0, color: '#374151', fontSize: '13px' }}>
          <strong>Departments:</strong>{' '}
          {departmentCounts.length > 0
            ? departmentCounts.map(([name, count]) => `${name} (${count})`).join(' · ')
            : 'No departments available'}
        </p>
      </div>
      <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
        To change employee roles, go to the Employees page.
      </p>
    </div>
  );
}

function WeatherTab({ orgId }: { orgId: string | null }) {
  const [locations, setLocations] = useState<WeatherLocationItem[]>([]);
  const [prefs, setPrefs] = useState<{ show_hourly: boolean; show_forecast: boolean; show_rainfall: boolean }>({
    show_hourly: true,
    show_forecast: true,
    show_rainfall: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeatherSettings = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);
    setError(null);
    const [{ data: locationData, error: locationError }, { data: prefsData, error: prefsError }] = await Promise.all([
      supabase
        .from('weather_locations')
        .select('id, name, latitude, longitude, is_active')
        .eq('org_id', orgId),
      supabase
        .from('weather_display_prefs')
        .select('id, org_id, enabled_widgets')
        .eq('org_id', orgId)
        .maybeSingle(),
    ]);

    if (locationError || prefsError) {
      setError(locationError?.message ?? prefsError?.message ?? 'Unable to load weather settings');
      setLoading(false);
      return;
    }

    setLocations((locationData ?? []) as WeatherLocationItem[]);

    const enabledWidgets = ((prefsData as WeatherDisplayPrefsRow | null)?.enabled_widgets ?? []) as string[];
    const defaultWidgets = ['hourly-forecast', 'daily-forecast', 'rain', 'precipitation'];
    const hasWidgets = enabledWidgets.length > 0;
    setPrefs({
      show_hourly: hasWidgets ? enabledWidgets.includes('hourly-forecast') || enabledWidgets.includes('hourly_forecast') : defaultWidgets.includes('hourly-forecast'),
      show_forecast: hasWidgets ? enabledWidgets.includes('daily-forecast') || enabledWidgets.includes('7day_forecast') : defaultWidgets.includes('daily-forecast'),
      show_rainfall: hasWidgets ? enabledWidgets.includes('rain') || enabledWidgets.includes('precipitation') : true,
    });
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    void fetchWeatherSettings();
  }, [fetchWeatherSettings, orgId]);

  const savePrefs = useCallback(async (nextPrefs: { show_hourly: boolean; show_forecast: boolean; show_rainfall: boolean }) => {
    if (!supabase || !orgId) return;
    setSavingPrefs(true);
    setError(null);
    const enabledWidgets = [
      ...(nextPrefs.show_hourly ? ['hourly-forecast'] : []),
      ...(nextPrefs.show_forecast ? ['daily-forecast'] : []),
      ...(nextPrefs.show_rainfall ? ['rain'] : []),
    ];
    const { error: upsertError } = await supabase
      .from('weather_display_prefs')
      .upsert(
        {
          org_id: orgId,
          enabled_widgets: enabledWidgets,
        },
        { onConflict: 'org_id' },
      );
    setSavingPrefs(false);
    if (upsertError) {
      setError(upsertError.message);
    }
  }, [orgId]);

  const updatePref = (key: 'show_hourly' | 'show_forecast' | 'show_rainfall', checked: boolean) => {
    const next = { ...prefs, [key]: checked };
    setPrefs(next);
    void savePrefs(next);
  };

  const activeLocation = useMemo(
    () => locations.find((location) => location.is_active) ?? locations[0] ?? null,
    [locations],
  );

  if (!orgId || loading) return <div style={{ color: '#6b7280', fontSize: '13px' }}>Loading weather settings…</div>;

  if (error) {
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <p style={{ margin: '0 0 10px', color: '#dc2626', fontSize: '13px' }}>Failed to load: {error}</p>
        <button onClick={() => void fetchWeatherSettings()}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Active Weather Location</h3>
        {activeLocation ? (
          <>
            <p style={{ margin: 0, fontSize: '13px', color: '#111827' }}>{activeLocation.name}</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              {activeLocation.latitude ?? '—'}, {activeLocation.longitude ?? '—'}
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>No weather location configured.</p>
        )}
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
          Weather data is sourced from Open-Meteo based on this location.
        </p>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          Display Preferences {savingPrefs ? '· Saving…' : ''}
        </h3>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#374151' }}>
          <input type="checkbox" checked={prefs.show_hourly} onChange={(event) => updatePref('show_hourly', event.target.checked)} />
          Show hourly
        </label>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#374151' }}>
          <input type="checkbox" checked={prefs.show_forecast} onChange={(event) => updatePref('show_forecast', event.target.checked)} />
          Show forecast
        </label>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#374151' }}>
          <input type="checkbox" checked={prefs.show_rainfall} onChange={(event) => updatePref('show_rainfall', event.target.checked)} />
          Show rainfall
        </label>
      </div>
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
  if (!orgId) return <div style={{ color: '#6b7280', fontSize: '13px' }}>Loading access settings…</div>;
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <PlaceholderCard text="Access settings — view your account details and manage team access. Coming in the next update." />
      <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>{userEmail || 'No user email'}</p>
      <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>Role: {userRole ?? 'Not available'}</p>
    </div>
  );
}

function HelpTab() {
  return <PlaceholderCard text="Need help? Contact support at support@groundcrewhq.com or visit our documentation at docs.groundcrewhq.com." />;
}

function TasksTab({ orgId, propertyId }: { orgId: string | null; propertyId: string | null }) {
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
    if (!orgId) return;

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

        {!orgId || loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '13px' }}>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#166534] border-t-transparent" />
            Loading tasks...
          </div>
        ) : error ? (
          <div>
            <p style={{ color: '#dc2626', marginBottom: '10px' }}>Failed to load: {error}</p>
            <button onClick={() => void fetchTasks()}>Retry</button>
          </div>
        ) : tasks.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '13px' }}>No tasks yet. Add your first task below.</p>
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

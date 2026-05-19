import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/utils/formatTime';
import { APP_VERSION } from '@/constants/version';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { isPro } from '@/utils/planGating';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

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
  escalation_config?: Partial<EscalationThresholds> | null;
}

interface EscalationThresholds {
  equipment_service_overdue_days: number;
  shift_coverage_warning_pct: number;
  wind_speed_spray_cutoff_mph: number;
  rain_probability_spray_cutoff_pct: number;
  heat_advisory_temp_f: number;
}

const DEFAULT_ESCALATION_THRESHOLDS: EscalationThresholds = {
  equipment_service_overdue_days: 90,
  shift_coverage_warning_pct: 50,
  wind_speed_spray_cutoff_mph: 10,
  rain_probability_spray_cutoff_pct: 40,
  heat_advisory_temp_f: 95,
};

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

interface RecurringTaskRule {
  id: string;
  org_id: string;
  property_id: string | null;
  task_id: string;
  employee_id: string | null;
  days_of_week: string[];
  active: boolean;
}

interface OrganizationInfo {
  name: string;
  plan: string | null;
  subscription_status?: string | null;
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

interface UsageStats {
  properties: number;
  employees: number;
  tasks: number;
  scheduleEntriesThisMonth: number;
  weatherLocations: number;
  departments: number;
  shiftTemplates: number;
}

interface WeatherLocationItem {
  id: string;
  name: string;
  property?: string | null;
  area?: string | null;
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
  const isReadOnly = String(userRole ?? '') === 'viewer';
  const location = useLocation();
  const [tab, setTab] = useState<Tab>('Scheduler');
  const taskPropertyId =
    (currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : null) ??
    currentUser?.propertyId ??
    null;

  useEffect(() => {
    document.title = 'Settings — Ground Crew HQ';
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get('tab');
    if (requestedTab && TABS.includes(requestedTab as Tab)) {
      setTab(requestedTab as Tab);
    }
  }, [location.search]);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Operations Control Center</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <div className="mb-4 md:hidden">
        <label className="mb-1 block text-xs text-muted-foreground">Section</label>
        <select
          value={tab}
          onChange={(event) => setTab(event.target.value as Tab)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
        >
          {TABS.map((t) => (
            <option key={`mobile-tab-${t}`} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:flex flex-wrap items-center gap-2 border-b pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-9 rounded-lg px-3 text-sm ${tab === t ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {isReadOnly ? (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Demo Mode — Viewing sample data (read-only)
        </div>
      ) : null}

      <fieldset disabled={isReadOnly} style={{ border: 'none', margin: 0, padding: 0 }}>
        {tab === 'Workspace' && (
          <WorkspaceTab
            key="workspace"
            orgId={orgId}
            userRole={userRole}
            currentPropertyId={currentPropertyId}
          />
        )}
        {tab === 'Workforce' && <WorkforceTab key="workforce" orgId={orgId} />}
        {tab === 'Scheduler' && <SchedulerTab key="scheduler" orgId={orgId} />}
        {tab === 'Tasks' && <TasksTab key="tasks" orgId={orgId} propertyId={taskPropertyId} />}
        {tab === 'Weather' && <WeatherTab key="weather" orgId={orgId} />}
      </fieldset>
      {tab === 'Access' && (
        <AccessTab
          key="access"
          userEmail={user?.email ?? ''}
          userRole={userRole}
          orgId={orgId}
          employeeName={currentUser?.fullName ?? ''}
        />
      )}
      {tab === 'Help' && <HelpTab key="help" />}
    </div>
  );
}

function WorkspaceTab({
  orgId,
  userRole,
  currentPropertyId,
}: {
  orgId: string | null;
  userRole: string | null;
  currentPropertyId: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [orgNameDraft, setOrgNameDraft] = useState('');
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Manager' | 'Field Staff'>('Manager');
  const [savingOrg, setSavingOrg] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyAddress, setNewPropertyAddress] = useState('');
  const [newPropertyTimezone, setNewPropertyTimezone] = useState('America/New_York');
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingPropertyName, setEditingPropertyName] = useState('');
  const [equipmentTypes, setEquipmentTypes] = useState<Array<{ id: string; name: string; category: string | null }>>([]);
  const [newEquipmentTypeName, setNewEquipmentTypeName] = useState('');
  const [newEquipmentTypeCategory, setNewEquipmentTypeCategory] = useState('General');
  const [editingEquipmentTypeId, setEditingEquipmentTypeId] = useState<string | null>(null);
  const [editingEquipmentTypeName, setEditingEquipmentTypeName] = useState('');
  const [loadingDemoData, setLoadingDemoData] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    properties: 0,
    employees: 0,
    tasks: 0,
    scheduleEntriesThisMonth: 0,
    weatherLocations: 0,
    departments: 0,
    shiftTemplates: 0,
  });
  const timezoneOptions = [
    { label: 'Eastern', value: 'America/New_York' },
    { label: 'Central', value: 'America/Chicago' },
    { label: 'Mountain', value: 'America/Denver' },
    { label: 'Pacific', value: 'America/Los_Angeles' },
  ] as const;
  const equipmentTypeCategoryOptions = ['Mowing', 'Transport', 'Chemical', 'Trimming', 'Maintenance', 'General'] as const;

  const fetchWorkspaceData = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);
    setError(null);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    const monthStartKey = monthStart.toISOString().slice(0, 10);
    const monthEndKey = monthEnd.toISOString().slice(0, 10);

    const [
      { data: orgData, error: orgError },
      { data: propertiesData, error: propertiesError },
      { count: employeesCount, error: employeesError },
      { count: tasksCount, error: tasksError },
      { count: scheduleCount, error: scheduleError },
      { count: weatherCount, error: weatherError },
      { count: departmentsCount, error: departmentsError },
      { count: shiftTemplatesCount, error: shiftTemplatesError },
      { data: equipmentTypesData, error: equipmentTypesError },
    ] = await Promise.all([
      supabase.from('organizations').select('name, plan, subscription_status').eq('id', orgId).single(),
      supabase
        .from('properties')
        .select('id, name, org_id, address, latitude, longitude, timezone, created_at')
        .eq('org_id', orgId)
        .order('name', { ascending: true }),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase
        .from('schedule_entries')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('date', monthStartKey)
        .lte('date', monthEndKey),
      supabase.from('weather_locations').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true),
      supabase.from('departments').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
      supabase.from('shift_templates').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
      supabase.from('equipment_types').select('id, name, category').eq('org_id', orgId).eq('active', true).order('name', { ascending: true }),
    ]);

    if (orgError || propertiesError || employeesError || tasksError || scheduleError || weatherError || departmentsError || shiftTemplatesError || equipmentTypesError) {
      setError(
        orgError?.message ??
          propertiesError?.message ??
          employeesError?.message ??
          tasksError?.message ??
          scheduleError?.message ??
          weatherError?.message ??
          departmentsError?.message ??
          shiftTemplatesError?.message ??
          equipmentTypesError?.message ??
          'Unable to load workspace settings',
      );
      setLoading(false);
      return;
    }

    setOrgInfo((orgData ?? null) as OrganizationInfo | null);
    setOrgNameDraft(String((orgData as OrganizationInfo | null)?.name ?? ''));
    setProperties((propertiesData ?? []) as PropertyItem[]);
    setEquipmentTypes((equipmentTypesData ?? []) as Array<{ id: string; name: string; category: string | null }>);
    setUsageStats({
      properties: (propertiesData ?? []).length,
      employees: employeesCount ?? 0,
      tasks: tasksCount ?? 0,
      scheduleEntriesThisMonth: scheduleCount ?? 0,
      weatherLocations: weatherCount ?? 0,
      departments: departmentsCount ?? 0,
      shiftTemplates: shiftTemplatesCount ?? 0,
    });
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
      toast.error(`Failed to save organization name: ${updateError.message}`);
      return;
    }
    setOrgInfo((current) => (current ? { ...current, name: orgNameDraft.trim() } : current));
    toast.success(`Organization name updated to ${orgNameDraft.trim()}`);
  };

  const addProperty = async () => {
    if (!supabase || !orgId || !newPropertyName.trim()) return;
    setError(null);
    const { data, error: insertError } = await supabase
      .from('properties')
      .insert({
        name: newPropertyName.trim(),
        org_id: orgId,
        address: newPropertyAddress.trim() || null,
        timezone: newPropertyTimezone || 'America/New_York',
      })
      .select('id, name, org_id, address, latitude, longitude, timezone, created_at')
      .single();
    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add property: ${insertError.message}`);
      return;
    }
    setProperties((current) => [...current, data as PropertyItem].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success(`Property added: ${newPropertyName.trim()}`);
    setNewPropertyName('');
    setNewPropertyAddress('');
    setNewPropertyTimezone('America/New_York');
    await queryClient.invalidateQueries({ queryKey: ['properties'] });
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
      toast.error(`Failed to update property: ${updateError.message}`);
      return;
    }
    setProperties((current) =>
      current
        .map((property) => (property.id === propertyId ? { ...property, name: editingPropertyName.trim() } : property))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setEditingPropertyId(null);
    setEditingPropertyName('');
    toast.success(`Property renamed to ${editingPropertyName.trim()}`);
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
      toast.error(`Failed to delete property: ${deleteError.message}`);
      return;
    }
    setProperties((current) => current.filter((property) => property.id !== propertyId));
    toast.success('Property deleted');
  };

  const addEquipmentType = async () => {
    if (!supabase || !orgId || !newEquipmentTypeName.trim()) return;
    const { error: insertError } = await supabase.from('equipment_types').insert({
      id: crypto.randomUUID(),
      org_id: orgId,
      property_id: currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : null,
      name: newEquipmentTypeName.trim(),
      category: newEquipmentTypeCategory,
      active: true,
    });
    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add equipment type: ${insertError.message}`);
      return;
    }
    toast.success(`Equipment type added: ${newEquipmentTypeName.trim()}`);
    setNewEquipmentTypeName('');
    setNewEquipmentTypeCategory('General');
    await fetchWorkspaceData();
  };

  const saveEquipmentTypeEdit = async (equipmentTypeId: string) => {
    if (!supabase || !orgId || !editingEquipmentTypeName.trim()) return;
    const { error: updateError } = await supabase
      .from('equipment_types')
      .update({ name: editingEquipmentTypeName.trim() })
      .eq('id', equipmentTypeId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update equipment type: ${updateError.message}`);
      return;
    }
    toast.success(`Equipment type updated: ${editingEquipmentTypeName.trim()}`);
    setEditingEquipmentTypeId(null);
    setEditingEquipmentTypeName('');
    await fetchWorkspaceData();
  };

  const deactivateEquipmentType = async (equipmentTypeId: string, name: string) => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm(`Delete equipment type "${name}"?`);
    if (!confirmed) return;
    const { error: updateError } = await supabase
      .from('equipment_types')
      .update({ active: false })
      .eq('id', equipmentTypeId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to delete equipment type: ${updateError.message}`);
      return;
    }
    toast.success(`Equipment type deleted: ${name}`);
    await fetchWorkspaceData();
  };

  const loadDemoData = async () => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm(
      'This will add sample employees, tasks, schedule entries, and assignments for demo purposes. Continue?',
    );
    if (!confirmed) return;

    setError(null);
    setLoadingDemoData(true);
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const monday = new Date(today);
    const dayOfWeek = monday.getDay();
    const offsetToMonday = (dayOfWeek + 6) % 7;
    monday.setDate(monday.getDate() - offsetToMonday);
    const weekdayKeys = Array.from({ length: 5 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date.toISOString().slice(0, 10);
    });

    const activePropertyId =
      (currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : null) ??
      properties[0]?.id ??
      null;

    if (!activePropertyId) {
      setLoadingDemoData(false);
      setError('Add a property first to load demo data.');
      toast.error('Failed to load demo data: add a property first.');
      return;
    }

    const [{ count: employeeCount }, { count: taskCount }, { count: equipmentTypeCount }, { count: equipmentCount }] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('equipment_types').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('equipment_units').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    ]);

    const demoEmployeesSeed = [
      { first_name: 'Alex', last_name: 'Rivera', role: 'Field Staff', department: 'Maintenance' },
      { first_name: 'Jordan', last_name: 'Martinez', role: 'Field Staff', department: 'Irrigation' },
      { first_name: 'Sam', last_name: 'Thompson', role: 'Field Manager', department: 'Maintenance' },
      { first_name: 'Casey', last_name: 'Williams', role: 'Field Staff', department: 'General' },
    ];

    let demoEmployees: Array<{ id: string; first_name: string; last_name: string }> = [];

    if ((employeeCount ?? 0) < 3) {
      const employeeRows = demoEmployeesSeed.map((employee) => ({
        id: crypto.randomUUID(),
        org_id: orgId,
        property_id: activePropertyId,
        first_name: employee.first_name,
        last_name: employee.last_name,
        role: employee.role,
        department: employee.department,
        status: 'active',
        active: true,
      }));
      const { data: insertedEmployees, error: employeeError } = await supabase
        .from('employees')
        .insert(employeeRows)
        .select('id, first_name, last_name');
      if (employeeError) {
        setLoadingDemoData(false);
        setError(employeeError.message);
        toast.error(`Failed to seed demo employees: ${employeeError.message}`);
        return;
      }
      demoEmployees = (insertedEmployees ?? []) as Array<{ id: string; first_name: string; last_name: string }>;
    } else {
      const { data: existingEmployees, error: existingError } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('last_name', { ascending: true })
        .limit(4);
      if (existingError) {
        setLoadingDemoData(false);
        setError(existingError.message);
        toast.error(`Failed to read employees for demo seed: ${existingError.message}`);
        return;
      }
      demoEmployees = (existingEmployees ?? []) as Array<{ id: string; first_name: string; last_name: string }>;
    }

    const taskSeed = [
      { name: 'Mow Greens', category: 'Mowing', estimated_hours: 3, priority: 1 },
      { name: 'Mow Fairways', category: 'Mowing', estimated_hours: 4, priority: 1 },
      { name: 'Roll Greens', category: 'Mowing', estimated_hours: 2, priority: 2 },
      { name: 'Bunker Maintenance', category: 'Maintenance', estimated_hours: 3, priority: 2 },
      { name: 'Irrigation Check', category: 'Irrigation', estimated_hours: 3, priority: 2 },
      { name: 'Trim & Edge', category: 'Maintenance', estimated_hours: 2, priority: 2 },
      { name: 'Collect Balls', category: 'General', estimated_hours: 3, priority: 2 },
      { name: 'Change Cups', category: 'Maintenance', estimated_hours: 2.5, priority: 2 },
      { name: 'Mow Tees', category: 'Mowing', estimated_hours: 2, priority: 2 },
      { name: 'Bunker Rake', category: 'Maintenance', estimated_hours: 2, priority: 3 },
      { name: 'Cart Path Blow Off', category: 'General', estimated_hours: 1.5, priority: 3 },
      { name: 'Debris Patrol', category: 'General', estimated_hours: 1, priority: 3 },
    ];

    let taskRowsForAssignments: Array<{ id: string; name: string; estimated_hours: number | null }> = [];

    if ((taskCount ?? 0) < 5) {
      const rows = taskSeed.map((task) => ({
        id: crypto.randomUUID(),
        org_id: orgId,
        property_id: activePropertyId,
        name: task.name,
        category: task.category,
        status: 'active',
        priority: task.priority,
        estimated_hours: task.estimated_hours,
      }));
      const { data: insertedTasks, error: taskInsertError } = await supabase
        .from('tasks')
        .insert(rows)
        .select('id, name, estimated_hours');
      if (taskInsertError) {
        setLoadingDemoData(false);
        setError(taskInsertError.message);
        toast.error(`Failed to seed demo tasks: ${taskInsertError.message}`);
        return;
      }
      taskRowsForAssignments = (insertedTasks ?? []) as Array<{ id: string; name: string; estimated_hours: number | null }>;
    } else {
      const { data: existingTasks, error: existingTaskError } = await supabase
        .from('tasks')
        .select('id, name, estimated_hours')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('priority', { ascending: true })
        .order('name', { ascending: true })
        .limit(12);
      if (existingTaskError) {
        setLoadingDemoData(false);
        setError(existingTaskError.message);
        toast.error(`Failed to read tasks for demo seed: ${existingTaskError.message}`);
        return;
      }
      taskRowsForAssignments = (existingTasks ?? []) as Array<{ id: string; name: string; estimated_hours: number | null }>;
    }

    if (demoEmployees.length > 0) {
      const { data: existingWeekSchedule, error: weekScheduleError } = await supabase
        .from('schedule_entries')
        .select('employee_id, date')
        .eq('org_id', orgId)
        .in('employee_id', demoEmployees.map((employee) => employee.id))
        .in('date', weekdayKeys);
      if (weekScheduleError) {
        setLoadingDemoData(false);
        setError(weekScheduleError.message);
        toast.error(`Failed to read schedules for demo seed: ${weekScheduleError.message}`);
        return;
      }
      const existingWeekKeySet = new Set((existingWeekSchedule ?? []).map((row) => `${row.employee_id}-${row.date}`));
      const scheduleRows = demoEmployees.flatMap((employee) =>
        weekdayKeys
          .filter((dateKey) => !existingWeekKeySet.has(`${employee.id}-${dateKey}`))
          .map((dateKey) => ({
            id: crypto.randomUUID(),
            org_id: orgId,
            employee_id: employee.id,
            property_id: activePropertyId,
            date: dateKey,
            shift_start: '07:00',
            shift_end: '15:30',
            status: 'scheduled',
          })),
      );
      if (scheduleRows.length > 0) {
        const { error: scheduleError } = await supabase.from('schedule_entries').insert(scheduleRows);
        if (scheduleError) {
          setLoadingDemoData(false);
          setError(scheduleError.message);
          toast.error(`Failed to seed demo schedule entries: ${scheduleError.message}`);
          return;
        }
      }

      if (taskRowsForAssignments.length > 0) {
        const { data: existingAssignments, error: assignmentFetchError } = await supabase
          .from('assignments')
          .select('employee_id')
          .eq('org_id', orgId)
          .eq('date', todayKey)
          .in('employee_id', demoEmployees.map((employee) => employee.id));
        if (assignmentFetchError) {
          setLoadingDemoData(false);
          setError(assignmentFetchError.message);
          toast.error(`Failed to read assignments for demo seed: ${assignmentFetchError.message}`);
          return;
        }
        const assignedTodaySet = new Set((existingAssignments ?? []).map((row) => row.employee_id as string));
        const targetTasks = taskRowsForAssignments.slice(0, Math.max(3, Math.min(6, taskRowsForAssignments.length)));
        const assignmentRows = demoEmployees
          .filter((employee) => !assignedTodaySet.has(employee.id))
          .flatMap((employee) =>
            targetTasks.slice(0, 3).map((task, index) => ({
              id: crypto.randomUUID(),
              org_id: orgId,
              property_id: activePropertyId,
              employee_id: employee.id,
              task_id: task.id,
              title: task.name,
              date: todayKey,
              status: 'planned',
              estimated_hours: Number(task.estimated_hours ?? 0),
              order_index: index,
            })),
          );
        if (assignmentRows.length > 0) {
          const { error: assignmentInsertError } = await supabase.from('assignments').insert(assignmentRows);
          if (assignmentInsertError) {
            setLoadingDemoData(false);
            setError(assignmentInsertError.message);
            toast.error(`Failed to seed demo assignments: ${assignmentInsertError.message}`);
            return;
          }
        }
      }
    }

    let equipmentTypesByName = new Map<string, { id: string; name: string }>();
    if ((equipmentTypeCount ?? 0) === 0) {
      const equipmentTypeRows = [
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'Walk Mower', short_name: 'WM', category: 'Mowing', active: true },
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'Riding Mower', short_name: 'RM', category: 'Mowing', active: true },
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'Utility Vehicle', short_name: 'UV', category: 'Transport', active: true },
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'String Trimmer', short_name: 'ST', category: 'Trimming', active: true },
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'Sprayer', short_name: 'SP', category: 'Chemical', active: true },
        { id: crypto.randomUUID(), org_id: orgId, property_id: activePropertyId, name: 'Aerator', short_name: 'AE', category: 'Maintenance', active: true },
      ];
      const { data: insertedTypes, error: typeInsertError } = await supabase
        .from('equipment_types')
        .insert(equipmentTypeRows)
        .select('id, name');
      if (typeInsertError) {
        setLoadingDemoData(false);
        setError(typeInsertError.message);
        toast.error(`Failed to seed equipment types: ${typeInsertError.message}`);
        return;
      }
      equipmentTypesByName = new Map(
        ((insertedTypes ?? []) as Array<{ id: string; name: string }>).map((row) => [row.name, row]),
      );
    } else {
      const { data: existingTypes, error: typeFetchError } = await supabase
        .from('equipment_types')
        .select('id, name')
        .eq('org_id', orgId)
        .order('name', { ascending: true });
      if (typeFetchError) {
        setLoadingDemoData(false);
        setError(typeFetchError.message);
        toast.error(`Failed to read equipment types: ${typeFetchError.message}`);
        return;
      }
      equipmentTypesByName = new Map(
        ((existingTypes ?? []) as Array<{ id: string; name: string }>).map((row) => [row.name, row]),
      );
    }

    if ((equipmentCount ?? 0) === 0) {
      const now = new Date();
      const daysAgo = (days: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() - days);
        return d.toISOString().slice(0, 10);
      };
      const equipmentSeed = [
        { name: 'Toro Greensmaster 3150', unit_name: 'T-001', type: 'Walk Mower', status: 'available', location: 'Equipment barn', last_serviced: daysAgo(30) },
        { name: 'John Deere 2500E', unit_name: 'JD-001', type: 'Riding Mower', status: 'available', location: 'Equipment barn', last_serviced: daysAgo(95) },
        { name: 'Toro Workman HDX', unit_name: 'T-002', type: 'Utility Vehicle', status: 'in_use', location: 'Course', last_serviced: daysAgo(45) },
        { name: 'Stihl FS 131', unit_name: 'ST-001', type: 'String Trimmer', status: 'available', location: 'Equipment barn', last_serviced: daysAgo(10) },
      ];

      const equipmentRows = equipmentSeed
        .map((equipment) => {
          const equipmentTypeId = equipmentTypesByName.get(equipment.type)?.id ?? null;
          if (!equipmentTypeId) return null;
          return {
            id: crypto.randomUUID(),
            org_id: orgId,
            property_id: activePropertyId,
            equipment_type_id: equipmentTypeId,
            name: equipment.name,
            unit_name: equipment.unit_name,
            type: equipment.type,
            status: equipment.status,
            location: equipment.location,
            last_serviced: equipment.last_serviced,
            active: true,
          };
        })
        .filter(Boolean);

      if (equipmentRows.length > 0) {
        const { error: equipmentError } = await supabase.from('equipment_units').insert(equipmentRows);
        if (equipmentError) {
          setLoadingDemoData(false);
          setError(equipmentError.message);
          toast.error(`Failed to seed equipment units: ${equipmentError.message}`);
          return;
        }
      }
    }

    setLoadingDemoData(false);
    await fetchWorkspaceData();
    toast.success('Demo data loaded! Navigate to the Workboard to see it.');
  };

  const isProPlan =
    String(orgInfo?.subscription_status ?? '').toLowerCase() === 'active' ||
    String(orgInfo?.plan ?? '').toLowerCase().includes('pro');
  const usageLimits = {
    properties: isProPlan ? null : 1,
    employees: isProPlan ? null : 5,
    tasks: isProPlan ? null : 20,
    scheduleEntriesThisMonth: isProPlan ? null : 100,
  } as const;
  const usageRows = [
    { key: 'properties', label: 'Properties', value: usageStats.properties, limit: usageLimits.properties },
    { key: 'employees', label: 'Employees', value: usageStats.employees, limit: usageLimits.employees },
    { key: 'tasks', label: 'Tasks', value: usageStats.tasks, limit: usageLimits.tasks },
    { key: 'scheduleEntriesThisMonth', label: 'Schedule entries (this month)', value: usageStats.scheduleEntriesThisMonth, limit: usageLimits.scheduleEntriesThisMonth },
  ] as const;
  const usageAtLimit = usageRows.some((row) => row.limit != null && row.value >= row.limit);
  const setupChecklist = [
    {
      label: 'Organization name',
      done: Boolean(orgNameDraft.trim() && orgNameDraft.trim().toLowerCase() !== 'ground crew hq'),
      href: '/app/settings?tab=Workspace',
    },
    { label: 'Add property', done: usageStats.properties > 0, href: '/app/settings?tab=Workspace' },
    { label: 'Configure weather', done: usageStats.weatherLocations > 0, href: '/app/settings?tab=Weather' },
    { label: 'Add departments', done: usageStats.departments > 0, href: '/app/settings?tab=Workforce' },
    { label: 'Add employees', done: usageStats.employees > 0, href: '/app/employees' },
    { label: 'Create shift templates', done: usageStats.shiftTemplates > 0, href: '/app/scheduler' },
    { label: 'Build task library', done: usageStats.tasks > 0, href: '/app/settings?tab=Tasks' },
  ];
  const setupComplete = setupChecklist.every((item) => item.done);

  const usageTone = (ratio: number) => {
    if (ratio >= 0.9) return '#dc2626';
    if (ratio >= 0.75) return '#d97706';
    return '#16a34a';
  };

  if (!orgId || loading) return <PageSkeleton />;

  if (error) {
    return (
      <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchWorkspaceData()} />
    );
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Setup Checklist</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="Setup checklist help" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                <HelpCircle size={14} color="#6b7280" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Complete these steps to fully configure your operation.</TooltipContent>
          </Tooltip>
        </div>
        {setupComplete ? (
          <p style={{ margin: 0, color: '#166534', fontSize: '13px', fontWeight: 600 }}>Setup complete ✓</p>
        ) : (
          <div style={{ display: 'grid', gap: '6px' }}>
            {setupChecklist.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.href)}
                style={{
                  textAlign: 'left',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  background: '#fff',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  color: item.done ? '#166534' : '#111827',
                }}
              >
                {item.done ? '☑' : '☐'} {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

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
        {userRole === 'admin' ? (
          <button
            onClick={() => void loadDemoData()}
            disabled={loadingDemoData}
            style={{
              width: 'fit-content',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              color: '#111827',
              background: '#ffffff',
              padding: '8px 14px',
              cursor: 'pointer',
            }}
          >
            {loadingDemoData ? 'Loading Demo Data...' : 'Load Demo Data'}
          </button>
        ) : null}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Usage</h3>
        {usageRows.map((row) => {
          const ratio = row.limit ? Math.min(1, row.value / row.limit) : 0;
          const barColor = usageTone(ratio);
          const limitLabel = row.limit == null ? 'Unlimited' : row.limit;
          return (
            <div key={`usage-${row.key}`} style={{ display: 'grid', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>{row.label}</span>
                <span style={{ color: '#6b7280' }}>
                  {row.value} / {limitLabel}
                </span>
              </div>
              <div style={{ height: '8px', width: '100%', borderRadius: '999px', background: '#e5e7eb', overflow: 'hidden' }}>
                <div
                  style={{
                    width: row.limit == null ? '20%' : `${Math.min(100, Math.max(2, ratio * 100))}%`,
                    height: '100%',
                    background: row.limit == null ? '#16a34a' : barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
        {usageAtLimit && !isProPlan ? (
          <button
            type="button"
            onClick={() => navigate('/app/settings?tab=Access')}
            style={{ width: 'fit-content', border: 'none', background: 'transparent', color: '#166534', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '13px' }}
          >
            Upgrade to Pro for unlimited access
          </button>
        ) : null}
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
          <div style={{ display: 'grid', gap: '8px' }}>
            <input placeholder="Property name" value={newPropertyName} onChange={(event) => setNewPropertyName(event.target.value)} style={{ flex: 1 }} />
            <input placeholder="Address (optional)" value={newPropertyAddress} onChange={(event) => setNewPropertyAddress(event.target.value)} style={{ flex: 1 }} />
            <select
              value={newPropertyTimezone}
              onChange={(event) => setNewPropertyTimezone(event.target.value)}
              style={{ height: '40px' }}
            >
              {timezoneOptions.map((timezoneOption) => (
                <option key={timezoneOption.value} value={timezoneOption.value}>
                  {timezoneOption.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => void addProperty()}
              style={{ border: 'none', borderRadius: '8px', color: '#fff', background: '#166534', padding: '8px 14px', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Equipment Types</h3>
        {equipmentTypes.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>No equipment types yet.</p>
        ) : null}
        {equipmentTypes.map((type) => (
          <div key={type.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {editingEquipmentTypeId === type.id ? (
              <>
                <input value={editingEquipmentTypeName} onChange={(event) => setEditingEquipmentTypeName(event.target.value)} />
                <button onClick={() => void saveEquipmentTypeEdit(type.id)} style={{ color: '#166534' }}>Save</button>
                <button onClick={() => { setEditingEquipmentTypeId(null); setEditingEquipmentTypeName(''); }}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1 }}>{type.name} <span style={{ color: '#6b7280' }}>({type.category ?? 'General'})</span></span>
                <button onClick={() => { setEditingEquipmentTypeId(type.id); setEditingEquipmentTypeName(type.name); }}>Edit</button>
                <button onClick={() => void deactivateEquipmentType(type.id, type.name)} style={{ color: '#dc2626' }}>Delete</button>
              </>
            )}
          </div>
        ))}
        <div style={{ display: 'grid', gap: '8px', maxWidth: '420px' }}>
          <input
            value={newEquipmentTypeName}
            onChange={(event) => setNewEquipmentTypeName(event.target.value)}
            placeholder="Type name"
          />
          <select value={newEquipmentTypeCategory} onChange={(event) => setNewEquipmentTypeCategory(event.target.value)} style={{ height: '40px' }}>
            {equipmentTypeCategoryOptions.map((category) => (
              <option key={`equipment-type-category-${category}`} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button
            onClick={() => void addEquipmentType()}
            style={{ border: 'none', borderRadius: '8px', color: '#fff', background: '#166534', padding: '8px 14px', cursor: 'pointer', width: 'fit-content' }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkforceTab({ orgId }: { orgId: string | null }) {
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingDepartmentName, setEditingDepartmentName] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkforceSummary = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);
    setError(null);
    const [departmentResult, rolesResult] = await Promise.all([
      supabase.from('departments').select('id, name').eq('org_id', orgId).eq('active', true).order('name', { ascending: true }),
      supabase.from('workforce_roles').select('id, name').eq('org_id', orgId).eq('active', true).order('name', { ascending: true }),
    ]);
    if (departmentResult.error || rolesResult.error) {
      setError(departmentResult.error?.message ?? rolesResult.error?.message ?? 'Failed to load workforce data');
      setLoading(false);
      return;
    }
    setDepartments((departmentResult.data ?? []) as Array<{ id: string; name: string }>);
    setRoles(((rolesResult.data ?? []) as Array<{ id: string; name: string }>).filter((row) => row.name?.trim()));
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    void fetchWorkforceSummary();
  }, [fetchWorkforceSummary, orgId]);

  const addDepartment = useCallback(async () => {
    if (!supabase || !orgId || !newDepartmentName.trim()) return;
    const { error: insertError } = await supabase.from('departments').insert({
      id: crypto.randomUUID(),
      org_id: orgId,
      name: newDepartmentName.trim(),
      active: true,
    });
    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add department: ${insertError.message}`);
      return;
    }
    toast.success(`Department added: ${newDepartmentName.trim()}`);
    setNewDepartmentName('');
    await fetchWorkforceSummary();
  }, [fetchWorkforceSummary, newDepartmentName, orgId]);

  const saveDepartmentEdit = useCallback(async () => {
    if (!supabase || !orgId || !editingDepartmentId || !editingDepartmentName.trim()) return;
    const { error: updateError } = await supabase
      .from('departments')
      .update({ name: editingDepartmentName.trim() })
      .eq('id', editingDepartmentId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update department: ${updateError.message}`);
      return;
    }
    toast.success(`Department updated: ${editingDepartmentName.trim()}`);
    setEditingDepartmentId(null);
    setEditingDepartmentName('');
    await fetchWorkforceSummary();
  }, [editingDepartmentId, editingDepartmentName, fetchWorkforceSummary, orgId]);

  const deactivateDepartment = useCallback(async (departmentId: string, departmentName: string) => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm(`Deactivate department "${departmentName}"?`);
    if (!confirmed) return;
    const { error: updateError } = await supabase
      .from('departments')
      .update({ active: false })
      .eq('id', departmentId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to deactivate department: ${updateError.message}`);
      return;
    }
    toast.success(`Department deactivated: ${departmentName}`);
    await fetchWorkforceSummary();
  }, [fetchWorkforceSummary, orgId]);

  const addRole = useCallback(async () => {
    if (!supabase || !orgId || !newRoleName.trim()) return;
    const { error: insertError } = await supabase.from('workforce_roles').insert({
      id: crypto.randomUUID(),
      org_id: orgId,
      name: newRoleName.trim(),
      active: true,
    });
    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add role: ${insertError.message}`);
      return;
    }
    toast.success(`Role added: ${newRoleName.trim()}`);
    setNewRoleName('');
    await fetchWorkforceSummary();
  }, [fetchWorkforceSummary, newRoleName, orgId]);

  const saveRoleEdit = useCallback(async () => {
    if (!supabase || !orgId || !editingRoleId || !editingRoleName.trim()) return;
    const { error: updateError } = await supabase
      .from('workforce_roles')
      .update({ name: editingRoleName.trim() })
      .eq('id', editingRoleId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update role: ${updateError.message}`);
      return;
    }
    toast.success(`Role updated: ${editingRoleName.trim()}`);
    setEditingRoleId(null);
    setEditingRoleName('');
    await fetchWorkforceSummary();
  }, [editingRoleId, editingRoleName, fetchWorkforceSummary, orgId]);

  const deactivateRole = useCallback(async (roleId: string, roleName: string) => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm(`Deactivate role "${roleName}"?`);
    if (!confirmed) return;
    const { error: updateError } = await supabase
      .from('workforce_roles')
      .update({ active: false })
      .eq('id', roleId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to deactivate role: ${updateError.message}`);
      return;
    }
    toast.success(`Role deactivated: ${roleName}`);
    await fetchWorkforceSummary();
  }, [fetchWorkforceSummary, orgId]);

  if (!orgId || loading) return <PageSkeleton />;
  if (error) return <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchWorkforceSummary()} />;

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Departments</h3>
        {departments.length === 0 ? <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>No active departments yet.</p> : null}
        {departments.map((department) => (
          <div key={department.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {editingDepartmentId === department.id ? (
              <>
                <input value={editingDepartmentName} onChange={(event) => setEditingDepartmentName(event.target.value)} />
                <button onClick={() => void saveDepartmentEdit()} style={{ color: '#166534' }}>Save</button>
                <button onClick={() => { setEditingDepartmentId(null); setEditingDepartmentName(''); }}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1 }}>{department.name}</span>
                <button onClick={() => { setEditingDepartmentId(department.id); setEditingDepartmentName(department.name); }}>Edit</button>
                <button onClick={() => void deactivateDepartment(department.id, department.name)} style={{ color: '#dc2626' }}>Delete</button>
              </>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={newDepartmentName} onChange={(event) => setNewDepartmentName(event.target.value)} placeholder="Add department" />
          <button onClick={() => void addDepartment()} style={{ border: 'none', borderRadius: '8px', color: '#fff', background: '#166534', padding: '8px 14px', cursor: 'pointer' }}>Add</button>
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Roles</h3>
        {roles.length === 0 ? <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>No active roles yet.</p> : null}
        {roles.map((role) => (
          <div key={role.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {editingRoleId === role.id ? (
              <>
                <input value={editingRoleName} onChange={(event) => setEditingRoleName(event.target.value)} />
                <button onClick={() => void saveRoleEdit()} style={{ color: '#166534' }}>Save</button>
                <button onClick={() => { setEditingRoleId(null); setEditingRoleName(''); }}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1 }}>{role.name}</span>
                <button onClick={() => { setEditingRoleId(role.id); setEditingRoleName(role.name); }}>Edit</button>
                <button onClick={() => void deactivateRole(role.id, role.name)} style={{ color: '#dc2626' }}>Delete</button>
              </>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="Add role" />
          <button onClick={() => void addRole()} style={{ border: 'none', borderRadius: '8px', color: '#fff', background: '#166534', padding: '8px 14px', cursor: 'pointer' }}>Add</button>
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>To change employee roles, go to the Employees page.</p>
      </div>
    </div>
  );
}

function WeatherTab({ orgId }: { orgId: string | null }) {
  const [locations, setLocations] = useState<WeatherLocationItem[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [prefs, setPrefs] = useState<{ show_hourly: boolean; show_forecast: boolean; show_rainfall: boolean }>({
    show_hourly: true,
    show_forecast: true,
    show_rainfall: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [stationName, setStationName] = useState('');
  const [stationArea, setStationArea] = useState('Main Course');
  const [stationPropertyId, setStationPropertyId] = useState('');
  const [locationMethod, setLocationMethod] = useState<'zip' | 'coords' | 'geo'>('zip');
  const [zipCode, setZipCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [zipLookupLoading, setZipLookupLoading] = useState(false);

  const areaOptions = ['Main Course', 'Practice Range', 'Maintenance Yard', 'North Fields', 'South Fields', 'Custom'] as const;

  const resetForm = () => {
    setEditingLocationId(null);
    setStationName('');
    setStationArea('Main Course');
    setStationPropertyId(properties[0]?.id ?? '');
    setLocationMethod('zip');
    setZipCode('');
    setLatitude('');
    setLongitude('');
  };

  const fetchWeatherSettings = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);
    setError(null);
    const [{ data: locationData, error: locationError }, { data: prefsData, error: prefsError }, { data: propertyData, error: propertyError }] = await Promise.all([
      supabase
        .from('weather_locations')
        .select('id, name, property, area, latitude, longitude, org_id, is_active')
        .eq('org_id', orgId)
        .order('name', { ascending: true }),
      supabase
        .from('weather_display_prefs')
        .select('id, org_id, enabled_widgets')
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('properties')
        .select('id, name')
        .eq('org_id', orgId)
        .order('name', { ascending: true }),
    ]);

    if (locationError || prefsError || propertyError) {
      setError(locationError?.message ?? prefsError?.message ?? propertyError?.message ?? 'Unable to load weather settings');
      setLoading(false);
      return;
    }

    setLocations((locationData ?? []) as WeatherLocationItem[]);
    setProperties(((propertyData ?? []) as Array<{ id: string; name: string }>));
    const enabledWidgets = ((prefsData as WeatherDisplayPrefsRow | null)?.enabled_widgets ?? []) as string[];
    const hasWidgets = enabledWidgets.length > 0;
    setPrefs({
      show_hourly: hasWidgets ? enabledWidgets.includes('hourly-forecast') || enabledWidgets.includes('hourly_forecast') : true,
      show_forecast: hasWidgets ? enabledWidgets.includes('daily-forecast') || enabledWidgets.includes('7day_forecast') : true,
      show_rainfall: hasWidgets ? enabledWidgets.includes('rain') || enabledWidgets.includes('precipitation') : true,
    });
    if (!stationPropertyId && propertyData && propertyData.length > 0) {
      setStationPropertyId(String(propertyData[0].id));
    }
    setLoading(false);
  }, [orgId, stationPropertyId]);

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
      toast.error(`Failed to save weather display preferences: ${upsertError.message}`);
      return;
    }
    toast.success('Weather display preferences saved');
  }, [orgId]);

  const updatePref = (key: 'show_hourly' | 'show_forecast' | 'show_rainfall', checked: boolean) => {
    const next = { ...prefs, [key]: checked };
    setPrefs(next);
    void savePrefs(next);
  };

  const toggleActive = async (locationId: string, nextActive: boolean) => {
    if (!supabase || !orgId) return;
    const { error: updateError } = await supabase
      .from('weather_locations')
      .update({ is_active: nextActive })
      .eq('id', locationId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update station status: ${updateError.message}`);
      return;
    }
    setLocations((current) => current.map((location) => (location.id === locationId ? { ...location, is_active: nextActive } : location)));
    toast.success(`Station ${nextActive ? 'activated' : 'deactivated'}`);
  };

  const beginEdit = (location: WeatherLocationItem) => {
    setEditingLocationId(location.id);
    setStationName(location.name ?? '');
    setStationArea(location.area ?? 'Main Course');
    setStationPropertyId((location as WeatherLocationItem & { property?: string }).property ?? '');
    setLatitude(location.latitude != null ? String(location.latitude) : '');
    setLongitude(location.longitude != null ? String(location.longitude) : '');
    setLocationMethod('coords');
  };

  const deleteLocation = async (locationId: string) => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm('Delete this weather station?');
    if (!confirmed) return;
    const { error: deleteError } = await supabase.from('weather_locations').delete().eq('id', locationId).eq('org_id', orgId);
    if (deleteError) {
      setError(deleteError.message);
      toast.error(`Failed to delete station: ${deleteError.message}`);
      return;
    }
    setLocations((current) => current.filter((location) => location.id !== locationId));
    toast.success('Weather station deleted');
  };

  const fillCoordinatesFromZip = async () => {
    if (!zipCode.trim()) return;
    setZipLookupLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zipCode.trim())}&country=US&format=json`);
      const payload = (await response.json()) as Array<{ lat: string; lon: string }>;
      const first = payload[0];
      if (!first) {
        toast.error('No coordinates found for that zip code.');
        setZipLookupLoading(false);
        return;
      }
      setLatitude(String(Number(first.lat).toFixed(4)));
      setLongitude(String(Number(first.lon).toFixed(4)));
      toast.success(`Coordinates loaded for ZIP ${zipCode.trim()}`);
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : 'Lookup failed';
      toast.error(`ZIP lookup failed: ${message}`);
    } finally {
      setZipLookupLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not available on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(4));
        setLongitude(position.coords.longitude.toFixed(4));
        toast.success('Current location loaded');
      },
      (geoError) => toast.error(`Unable to get location: ${geoError.message}`),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const saveStation = async () => {
    if (!supabase || !orgId || !stationName.trim()) return;
    if (!stationPropertyId) {
      toast.error('Select a property.');
      return;
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error('Enter valid latitude and longitude.');
      return;
    }

    setSavingLocation(true);
    setError(null);
    if (editingLocationId) {
      const { error: updateError } = await supabase
        .from('weather_locations')
        .update({
          name: stationName.trim(),
          area: stationArea,
          latitude: lat,
          longitude: lng,
          property: stationPropertyId,
        })
        .eq('id', editingLocationId)
        .eq('org_id', orgId);
      setSavingLocation(false);
      if (updateError) {
        setError(updateError.message);
        toast.error(`Failed to update weather station: ${updateError.message}`);
        return;
      }
      toast.success(`Weather station updated: ${stationName.trim()}`);
      await fetchWeatherSettings();
      resetForm();
      return;
    }

    const newId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const { error: insertError } = await supabase.from('weather_locations').insert({
      id: newId,
      name: stationName.trim(),
      area: stationArea,
      latitude: lat,
      longitude: lng,
      property: stationPropertyId,
      org_id: orgId,
      is_active: true,
    });
    setSavingLocation(false);
    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add weather station: ${insertError.message}`);
      return;
    }
    toast.success(`Weather station added: ${stationName.trim()}`);
    await fetchWeatherSettings();
    resetForm();
  };

  if (!orgId || loading) return <PageSkeleton />;

  if (error) {
    return (
      <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchWeatherSettings()} />
    );
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Weather Stations</h3>
        {locations.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>No weather stations configured yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {locations.map((location) => (
              <div key={location.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px', display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{location.name}</p>
                    <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '12px' }}>
                      {(location as WeatherLocationItem & { property?: string }).property ?? 'No property'} · {location.area ?? 'General'}
                    </p>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(location.is_active)}
                      onChange={(event) => void toggleActive(location.id, event.target.checked)}
                    />
                    {location.is_active ? 'Active' : 'Inactive'}
                  </label>
                </div>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '12px' }}>
                  Coordinates: {location.latitude ?? '—'}, {location.longitude ?? '—'}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => beginEdit(location)}
                    style={{ border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#374151', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void deleteLocation(location.id)}
                    style={{ border: '1px solid #fecaca', borderRadius: '8px', background: '#fff', color: '#b91c1c', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{editingLocationId ? 'Edit Station' : 'Add Station'}</h3>
        <div className="grid gap-[10px] md:grid-cols-2">
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#374151' }}>
            Station name
            <input value={stationName} onChange={(event) => setStationName(event.target.value)} placeholder="Sarasota Polo Club" />
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#374151' }}>
            Area
            <select value={stationArea} onChange={(event) => setStationArea(event.target.value)}>
              {areaOptions.map((area) => (
                <option key={`area-option-${area}`} value={area}>{area}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#374151' }}>
            Property
            <select value={stationPropertyId} onChange={(event) => setStationPropertyId(event.target.value)}>
              <option value="">Select property</option>
              {properties.map((property) => (
                <option key={`weather-property-${property.id}`} value={property.id}>{property.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: '#374151' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="radio" checked={locationMethod === 'zip'} onChange={() => setLocationMethod('zip')} />
            Enter zip code
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="radio" checked={locationMethod === 'coords'} onChange={() => setLocationMethod('coords')} />
            Enter coordinates
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="radio" checked={locationMethod === 'geo'} onChange={() => setLocationMethod('geo')} />
            Use my location
          </label>
        </div>

        {locationMethod === 'zip' ? (
          <div className="grid gap-[10px] md:grid-cols-[1fr_auto]">
            <input value={zipCode} onChange={(event) => setZipCode(event.target.value)} onBlur={() => void fillCoordinatesFromZip()} placeholder="ZIP code" />
            <button
              onClick={() => void fillCoordinatesFromZip()}
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#374151', padding: '8px 12px', cursor: 'pointer' }}
              disabled={zipLookupLoading}
            >
              {zipLookupLoading ? 'Looking up...' : 'Lookup'}
            </button>
          </div>
        ) : null}

        {locationMethod === 'geo' ? (
          <button
            onClick={useCurrentLocation}
            style={{ width: 'fit-content', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#374151', padding: '8px 12px', cursor: 'pointer' }}
          >
            Use My Location
          </button>
        ) : null}

        <div className="grid gap-[10px] md:grid-cols-2">
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#374151' }}>
            Latitude
            <input type="number" step="0.0001" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#374151' }}>
            Longitude
            <input type="number" step="0.0001" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => void saveStation()}
            style={{ border: 'none', borderRadius: '8px', color: '#fff', background: '#166534', padding: '8px 14px', cursor: 'pointer' }}
            disabled={savingLocation || !stationName.trim()}
          >
            {savingLocation ? 'Saving...' : editingLocationId ? 'Save Changes' : 'Save Station'}
          </button>
          {editingLocationId ? (
            <button
              onClick={resetForm}
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', color: '#374151', background: '#fff', padding: '8px 14px', cursor: 'pointer' }}
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
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
  employeeName,
}: {
  userEmail: string;
  userRole: string | null;
  orgId: string | null;
  employeeName: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [organizationName, setOrganizationName] = useState<string>('');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Manager' | 'Field Staff'>('Manager');
  const [systemInfo, setSystemInfo] = useState({
    propertyCount: 0,
    employeeCount: 0,
    taskCount: 0,
    scheduleEntriesThisWeek: 0,
    assignmentsToday: 0,
    equipmentUnits: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizationName = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);
    setError(null);
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const monday = new Date(now);
    const dayOfWeek = monday.getDay();
    const offsetToMonday = (dayOfWeek + 6) % 7;
    monday.setDate(monday.getDate() - offsetToMonday);
    monday.setHours(0, 0, 0, 0);
    const weekStartKey = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekEndKey = sunday.toISOString().slice(0, 10);

    const [
      orgResult,
      propertiesCountResult,
      employeesCountResult,
      tasksCountResult,
      scheduleCountResult,
      assignmentsCountResult,
      equipmentCountResult,
    ] = await Promise.all([
      supabase
        .from('organizations')
        .select('name, subscription_status, stripe_customer_id, stripe_subscription_id')
        .eq('id', orgId)
        .single(),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase
        .from('schedule_entries')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('date', weekStartKey)
        .lte('date', weekEndKey),
      supabase
        .from('assignments')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('date', todayKey),
      supabase.from('equipment_units').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    ]);

    const fetchError =
      orgResult.error ??
      propertiesCountResult.error ??
      employeesCountResult.error ??
      tasksCountResult.error ??
      scheduleCountResult.error ??
      assignmentsCountResult.error ??
      equipmentCountResult.error;

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setOrganizationName(String(orgResult.data?.name ?? ''));
    setSubscriptionStatus(orgResult.data?.subscription_status ? String(orgResult.data.subscription_status) : null);
    setSystemInfo({
      propertyCount: propertiesCountResult.count ?? 0,
      employeeCount: employeesCountResult.count ?? 0,
      taskCount: tasksCountResult.count ?? 0,
      scheduleEntriesThisWeek: scheduleCountResult.count ?? 0,
      assignmentsToday: assignmentsCountResult.count ?? 0,
      equipmentUnits: equipmentCountResult.count ?? 0,
    });
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    void fetchOrganizationName();
  }, [fetchOrganizationName, orgId]);

  const handleSignOut = async () => {
    try {
      queryClient.clear();
      window.localStorage.removeItem('ground-crew-query-cache');
      Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith('ground-crew') || key.startsWith('workflow') || key.startsWith('field-cache')) {
          window.localStorage.removeItem(key);
        }
      });
      await supabase.auth.signOut();
      window.location.assign('/');
    } catch (err) {
      console.error('Sign out failed:', err);
      window.location.assign('/');
    }
  };

  const handleClearAppCache = () => {
    queryClient.clear();
    window.localStorage.removeItem('ground-crew-query-cache');
    window.location.reload();
  };

  const maskedOrgId = orgId ? `${orgId.slice(0, 8)}...` : 'Not available';
  const browserInfo = typeof navigator !== 'undefined'
    ? `${navigator.userAgent.slice(0, 50)}${navigator.userAgent.length > 50 ? '...' : ''}`
    : 'Not available';

  const handleCopySystemInfo = async () => {
    const lines = [
      'Ground Crew HQ — System Info',
      `App Version: ${APP_VERSION}`,
      `Org ID: ${maskedOrgId}`,
      `Property Count: ${systemInfo.propertyCount}`,
      `Employee Count: ${systemInfo.employeeCount}`,
      `Task Count: ${systemInfo.taskCount}`,
      `Schedule Entries (this week): ${systemInfo.scheduleEntriesThisWeek}`,
      `Assignments (today): ${systemInfo.assignmentsToday}`,
      `Equipment Units: ${systemInfo.equipmentUnits}`,
      `Browser: ${browserInfo}`,
      'Supabase Project: fjqeekwisnbpxgebrnpl',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('System info copied to clipboard');
    } catch (copyError) {
      const message = copyError instanceof Error ? copyError.message : 'Clipboard unavailable';
      toast.error(`Failed to copy system info: ${message}`);
    }
  };

  const handleUpgradeToPro = () => {
    const placeholderCheckoutUrl = 'https://checkout.stripe.com/pay/placeholder';
    toast.info("Stripe integration coming soon. You're on the free beta plan.");
    window.location.href = placeholderCheckoutUrl;
  };

  const handleManageBilling = () => {
    const placeholderPortalUrl = 'https://billing.stripe.com/p/login/placeholder';
    toast.info('Billing portal integration coming soon.');
    window.open(placeholderPortalUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCancelSubscription = () => {
    const confirmed = window.confirm('Cancel Pro subscription?');
    if (!confirmed) return;
    toast.info('Contact support@groundcrewhq.com to cancel');
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteRole('Manager');
  };

  const handleSendInvite = () => {
    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      toast.error('Enter a valid email address.');
      return;
    }
    const inviterName = employeeName || userEmail || 'A teammate';
    const orgName = organizationName || 'your organization';
    const subject = "You've been invited to Ground Crew HQ";
    const body = `Hi,

${inviterName} has invited you to join ${orgName} on Ground Crew HQ,
the operations platform for grounds and facilities teams.

Sign up here: https://ground-crew-hq.vercel.app

Your organization: ${orgName}
Your role: ${inviteRole}

— Ground Crew HQ`;
    window.location.href = `mailto:${encodeURIComponent(trimmedEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success('Invite email opened in your mail app.');
    closeInviteModal();
  };

  if (!orgId || loading) return <PageSkeleton />;

  if (error) {
    return (
      <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchOrganizationName()} />
    );
  }

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Your Account</h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Email:</strong> {userEmail || 'Not available'}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Role:</strong> {userRole ?? 'Not available'}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Employee:</strong> {employeeName || 'Not available'}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Organization:</strong> {organizationName || 'Not available'}</p>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Session Management</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => void handleSignOut()}
            style={{ border: 'none', borderRadius: '8px', color: '#fff', background: '#166534', padding: '8px 14px', cursor: 'pointer' }}
          >
            Sign Out
          </button>
          <button
            onClick={handleClearAppCache}
            style={{ border: '1px solid #d1d5db', borderRadius: '8px', color: '#374151', background: '#fff', padding: '8px 14px', cursor: 'pointer' }}
          >
            Clear App Cache
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Team Invitations</h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
          Invite managers and crew members by email link.
        </p>
        <button
          onClick={() => setShowInviteModal(true)}
          style={{ width: 'fit-content', border: 'none', borderRadius: '8px', color: '#fff', background: '#166534', padding: '8px 14px', cursor: 'pointer' }}
        >
          Invite Team
        </button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Upgrade to Pro</h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
          <strong>Current plan:</strong> {isPro(subscriptionStatus) ? 'Pro' : 'Free (Beta)'}
        </p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
          Pro plan: $49/month — Unlimited properties, employees, advanced reports
        </p>
        <button
          onClick={handleUpgradeToPro}
          style={{ width: 'fit-content', border: 'none', borderRadius: '8px', color: '#fff', background: '#166534', padding: '8px 14px', cursor: 'pointer' }}
        >
          Upgrade to Pro →
        </button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Billing</h3>
        {isPro(subscriptionStatus) ? (
          <>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Plan:</strong> Pro ($49/month)</p>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Status:</strong> Active</p>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Next billing date:</strong> Coming soon</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleManageBilling}
                style={{ border: '1px solid #d1d5db', borderRadius: '8px', color: '#374151', background: '#fff', padding: '8px 14px', cursor: 'pointer' }}
              >
                Manage Billing
              </button>
              <button
                onClick={handleCancelSubscription}
                style={{ border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', background: '#fff', padding: '8px 14px', cursor: 'pointer' }}
              >
                Cancel Subscription
              </button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
            You're on the free beta plan. No payment method required.
          </p>
        )}
      </div>

      <div style={{ border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', background: '#fef2f2' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: '#b91c1c' }}>Danger Zone</h3>
        <p style={{ margin: 0, color: '#7f1d1d', fontSize: '13px' }}>
          To delete your account or change your email, contact support at support@groundcrewhq.com.
        </p>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>System</h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>App Version:</strong> {APP_VERSION}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Org ID:</strong> {maskedOrgId}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Property Count:</strong> {systemInfo.propertyCount}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Employee Count:</strong> {systemInfo.employeeCount}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Task Count:</strong> {systemInfo.taskCount}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Schedule Entries (this week):</strong> {systemInfo.scheduleEntriesThisWeek}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Assignments (today):</strong> {systemInfo.assignmentsToday}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Equipment Units:</strong> {systemInfo.equipmentUnits}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Browser:</strong> {browserInfo}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}><strong>Supabase Project:</strong> fjqeekwisnbpxgebrnpl</p>
        <button
          onClick={() => void handleCopySystemInfo()}
          style={{ width: 'fit-content', border: '1px solid #d1d5db', borderRadius: '8px', color: '#374151', background: '#fff', padding: '8px 14px', cursor: 'pointer' }}
        >
          Copy System Info
        </button>
      </div>

      {showInviteModal ? (
        <div
          onClick={closeInviteModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 60,
            display: 'grid',
            placeItems: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              background: '#fff',
              padding: '16px',
              display: 'grid',
              gap: '12px',
              zIndex: 70,
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Invite a team member</h3>
            <label style={{ display: 'grid', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Email</span>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@company.com"
              />
            </label>
            <label style={{ display: 'grid', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Role</span>
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'Manager' | 'Field Staff')}>
                <option value="Manager">Manager</option>
                <option value="Field Staff">Field Staff</option>
              </select>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={closeInviteModal}
                style={{ border: '1px solid #d1d5db', borderRadius: '8px', color: '#374151', background: '#fff', padding: '8px 14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvite}
                style={{ border: 'none', borderRadius: '8px', color: '#fff', background: '#166534', padding: '8px 14px', cursor: 'pointer' }}
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HelpTab() {
  return <PlaceholderCard text="Need help? Contact support at support@groundcrewhq.com or visit our documentation at docs.groundcrewhq.com." />;
}

function TasksTab({ orgId, propertyId }: { orgId: string | null; propertyId: string | null }) {
  const taskCategoryOptions = [
    'Mowing',
    'Irrigation',
    'Chemical Application',
    'Trimming',
    'Bunker Maintenance',
    'Aeration',
    'Fertilization',
    'General Maintenance',
    'Equipment Maintenance',
    'Other',
  ] as const;
  const [tasks, setTasks] = useState<TaskLibraryItem[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string; status: string | null }>>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringTaskRule[]>([]);
  const [recurringDrafts, setRecurringDrafts] = useState<Record<string, { enabled: boolean; days: string[]; assignMode: 'all' | 'specific'; employeeId: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('General Maintenance');
  const [newPriority, setNewPriority] = useState<'1' | '2' | '3'>('2');
  const [newEstimatedHours, setNewEstimatedHours] = useState('1');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    category: '',
    priority: 2,
    estimated_hours: 0,
  });
  const [savingRecurringTaskId, setSavingRecurringTaskId] = useState<string | null>(null);

  const dayOptions = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
    { key: 'sat', label: 'Sat' },
    { key: 'sun', label: 'Sun' },
  ] as const;

  const fetchTasks = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    if (!orgId) return;

    setLoading(true);
    setError(null);
    const [tasksResult, recurringResult, employeesResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, org_id, property_id, name, category, priority, estimated_hours')
        .eq('org_id', orgId)
        .order('priority', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('recurring_task_rules')
        .select('id, org_id, property_id, task_id, employee_id, days_of_week, active')
        .eq('org_id', orgId)
        .eq('active', true),
      supabase
        .from('employees')
        .select('id, first_name, last_name, status')
        .eq('org_id', orgId)
        .eq('active', true)
        .order('last_name', { ascending: true }),
    ]);

    if (tasksResult.error || recurringResult.error || employeesResult.error) {
      setError(tasksResult.error?.message ?? recurringResult.error?.message ?? employeesResult.error?.message ?? 'Failed to load task settings');
      setLoading(false);
      return;
    }
    const nextTasks = (tasksResult.data as TaskLibraryItem[]) ?? [];
    const nextRules = (recurringResult.data as RecurringTaskRule[]) ?? [];
    const nextEmployees = (employeesResult.data as Array<{ id: string; first_name: string; last_name: string; status: string | null }>) ?? [];
    setTasks(nextTasks);
    setRecurringRules(nextRules);
    setEmployees(nextEmployees);
    setRecurringDrafts(() => {
      const byTask = new Map<string, RecurringTaskRule>();
      for (const rule of nextRules) {
        if (!byTask.has(rule.task_id)) byTask.set(rule.task_id, rule);
      }
      return nextTasks.reduce<Record<string, { enabled: boolean; days: string[]; assignMode: 'all' | 'specific'; employeeId: string }>>((acc, task) => {
        const rule = byTask.get(task.id);
        acc[task.id] = {
          enabled: Boolean(rule),
          days: rule?.days_of_week?.length ? rule.days_of_week : ['mon', 'tue', 'wed', 'thu', 'fri'],
          assignMode: rule?.employee_id ? 'specific' : 'all',
          employeeId: rule?.employee_id ?? '',
        };
        return acc;
      }, {});
    });
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
        category: newCategory.trim() || 'General Maintenance',
        priority: Number(newPriority),
        estimated_hours: Number(newEstimatedHours || '0'),
        status: 'active',
      })
      .select('id, org_id, property_id, name, category, priority, estimated_hours')
      .single();

    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add task: ${insertError.message}`);
      return;
    }
    setTasks((current) =>
      [...current, data as TaskLibraryItem].sort(
        (a, b) => (a.priority ?? 99) - (b.priority ?? 99) || a.name.localeCompare(b.name),
      ),
    );
    setNewName('');
    setNewCategory('General Maintenance');
    setNewPriority('2');
    setNewEstimatedHours('1');
    toast.success(`Task added: ${newName.trim()}`);
  };

  const removeTask = async (taskId: string) => {
    if (!supabase || !orgId) return;
    const confirmed = window.confirm('Delete this task from the library?');
    if (!confirmed) return;
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', taskId).eq('org_id', orgId);
    if (deleteError) {
      setError(deleteError.message);
      toast.error(`Failed to delete task: ${deleteError.message}`);
      return;
    }
    const deletedTaskName = tasks.find((task) => task.id === taskId)?.name ?? 'Task';
    setTasks((current) => current.filter((task) => task.id !== taskId));
    toast.success(`Task deleted: ${deletedTaskName}`);
  };

  const startEditTask = (task: TaskLibraryItem) => {
    setEditingTaskId(task.id);
    setEditDraft({
      name: task.name,
      category: task.category ?? 'General Maintenance',
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
        category: editDraft.category.trim() || 'General Maintenance',
        priority: editDraft.priority,
        estimated_hours: editDraft.estimated_hours,
      })
      .eq('id', taskId)
      .eq('org_id', orgId);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update task: ${updateError.message}`);
      return;
    }
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              name: editDraft.name.trim(),
              category: editDraft.category.trim() || 'General Maintenance',
              priority: editDraft.priority,
              estimated_hours: editDraft.estimated_hours,
            }
          : task,
      ),
    );
    toast.success(`Task updated: ${editDraft.name.trim()}`);
    cancelEditTask();
  };

  const setRecurringEnabled = (taskId: string, enabled: boolean) => {
    setRecurringDrafts((current) => ({
      ...current,
      [taskId]: {
        enabled,
        days: current[taskId]?.days?.length ? current[taskId].days : ['mon', 'tue', 'wed', 'thu', 'fri'],
        assignMode: current[taskId]?.assignMode ?? 'all',
        employeeId: current[taskId]?.employeeId ?? '',
      },
    }));
  };

  const toggleRecurringDay = (taskId: string, day: string) => {
    setRecurringDrafts((current) => {
      const draft = current[taskId] ?? { enabled: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'], assignMode: 'all' as const, employeeId: '' };
      const has = draft.days.includes(day);
      const nextDays = has ? draft.days.filter((entry) => entry !== day) : [...draft.days, day];
      return {
        ...current,
        [taskId]: { ...draft, days: nextDays },
      };
    });
  };

  const saveRecurringRule = async (taskId: string) => {
    if (!supabase || !orgId) return;
    const draft = recurringDrafts[taskId];
    if (!draft) return;
    setSavingRecurringTaskId(taskId);

    const existingRuleIds = recurringRules.filter((rule) => rule.task_id === taskId && rule.active).map((rule) => rule.id);
    if (existingRuleIds.length > 0) {
      const { error: deactivateError } = await supabase
        .from('recurring_task_rules')
        .update({ active: false })
        .in('id', existingRuleIds)
        .eq('org_id', orgId);
      if (deactivateError) {
        setSavingRecurringTaskId(null);
        toast.error(`Failed to update recurring rule: ${deactivateError.message}`);
        return;
      }
    }

    if (!draft.enabled) {
      setSavingRecurringTaskId(null);
      toast.success('Recurring rule disabled');
      await fetchTasks();
      return;
    }

    if (!draft.days.length) {
      setSavingRecurringTaskId(null);
      toast.error('Select at least one day for recurring task.');
      return;
    }

    if (draft.assignMode === 'specific' && !draft.employeeId) {
      setSavingRecurringTaskId(null);
      toast.error('Select an employee for specific recurring assignment.');
      return;
    }

    const { error: insertError } = await supabase.from('recurring_task_rules').insert({
      org_id: orgId,
      property_id: propertyId,
      task_id: taskId,
      employee_id: draft.assignMode === 'specific' ? draft.employeeId : null,
      days_of_week: draft.days,
      active: true,
    });

    setSavingRecurringTaskId(null);
    if (insertError) {
      toast.error(`Failed to save recurring rule: ${insertError.message}`);
      return;
    }
    toast.success('Recurring rule saved');
    await fetchTasks();
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>Task Library</h3>
        <p style={{ margin: '0 0 14px', color: '#6b7280', fontSize: '13px' }}>Reusable tasks for daily workflow planning.</p>

        {!orgId || loading ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchTasks()} />
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
                  <th style={{ padding: '8px' }}>Recurring</th>
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
                    <td style={{ padding: '8px', minWidth: '260px' }}>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(recurringDrafts[task.id]?.enabled)}
                            onChange={(event) => setRecurringEnabled(task.id, event.target.checked)}
                          />
                          <span>{recurringDrafts[task.id]?.enabled ? 'Enabled' : 'Off'}</span>
                        </label>
                        {recurringDrafts[task.id]?.enabled ? (
                          <>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {dayOptions.map((day) => (
                                <label key={`${task.id}-${day.key}`} style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '12px' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(recurringDrafts[task.id]?.days.includes(day.key))}
                                    onChange={() => toggleRecurringDay(task.id, day.key)}
                                  />
                                  {day.label}
                                </label>
                              ))}
                            </div>
                            <select
                              value={recurringDrafts[task.id]?.assignMode ?? 'all'}
                              onChange={(event) =>
                                setRecurringDrafts((current) => ({
                                  ...current,
                                  [task.id]: {
                                    ...(current[task.id] ?? { enabled: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'], employeeId: '' }),
                                    assignMode: event.target.value as 'all' | 'specific',
                                  },
                                }))
                              }
                            >
                              <option value="all">All scheduled crew</option>
                              <option value="specific">Specific employee</option>
                            </select>
                            {recurringDrafts[task.id]?.assignMode === 'specific' ? (
                              <select
                                value={recurringDrafts[task.id]?.employeeId ?? ''}
                                onChange={(event) =>
                                  setRecurringDrafts((current) => ({
                                    ...current,
                                    [task.id]: {
                                      ...(current[task.id] ?? { enabled: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'], assignMode: 'specific' }),
                                      employeeId: event.target.value,
                                    },
                                  }))
                                }
                              >
                                <option value="">Select employee</option>
                                {employees.map((employee) => (
                                  <option key={`${task.id}-${employee.id}`} value={employee.id}>
                                    {employee.first_name} {employee.last_name}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            <button
                              onClick={() => void saveRecurringRule(task.id)}
                              style={{ width: 'fit-content', borderRadius: '6px', border: '1px solid #d1d5db', padding: '4px 10px', background: '#fff' }}
                              disabled={savingRecurringTaskId === task.id}
                            >
                              {savingRecurringTaskId === task.id ? 'Saving...' : 'Save recurring'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => void saveRecurringRule(task.id)}
                            style={{ width: 'fit-content', borderRadius: '6px', border: '1px solid #d1d5db', padding: '4px 10px', background: '#fff' }}
                            disabled={savingRecurringTaskId === task.id}
                          >
                            {savingRecurringTaskId === task.id ? 'Saving...' : 'Apply'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px' }}>
                      {editingTaskId === task.id ? (
                        <select
                          value={editDraft.category}
                          onChange={(event) => setEditDraft((cur) => ({ ...cur, category: event.target.value }))}
                        >
                          {taskCategoryOptions.map((category) => (
                            <option key={`edit-task-category-${category}`} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      ) : (
                        task.category ?? 'General Maintenance'
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
          <select value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>
            {taskCategoryOptions.map((category) => (
              <option key={`new-task-category-${category}`} value={category}>
                {category}
              </option>
            ))}
          </select>
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

function SchedulerTab({ orgId }: { orgId: string | null }) {
  const [settings, setSettings] = useState<SchedulerSettings | null>(null);
  const [alertsConfig, setAlertsConfig] = useState<EscalationThresholds>(DEFAULT_ESCALATION_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [alertsSaving, setAlertsSaving] = useState(false);
  const [alertsSaved, setAlertsSaved] = useState(false);
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

  const normalizeAlertsConfig = (value: unknown): EscalationThresholds => {
    const raw = (value && typeof value === 'object' ? value : {}) as Partial<EscalationThresholds>;
    return {
      equipment_service_overdue_days: Number(raw.equipment_service_overdue_days ?? DEFAULT_ESCALATION_THRESHOLDS.equipment_service_overdue_days),
      shift_coverage_warning_pct: Number(raw.shift_coverage_warning_pct ?? DEFAULT_ESCALATION_THRESHOLDS.shift_coverage_warning_pct),
      wind_speed_spray_cutoff_mph: Number(raw.wind_speed_spray_cutoff_mph ?? DEFAULT_ESCALATION_THRESHOLDS.wind_speed_spray_cutoff_mph),
      rain_probability_spray_cutoff_pct: Number(raw.rain_probability_spray_cutoff_pct ?? DEFAULT_ESCALATION_THRESHOLDS.rain_probability_spray_cutoff_pct),
      heat_advisory_temp_f: Number(raw.heat_advisory_temp_f ?? DEFAULT_ESCALATION_THRESHOLDS.heat_advisory_temp_f),
    };
  };

  const fetchSettings = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    if (!orgId) {
      setLoading(false);
      setError(null);
      setSettings(null);
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
    const nextSettings = data as SchedulerSettings;
    setSettings(nextSettings);
    setAlertsConfig(normalizeAlertsConfig(nextSettings.escalation_config));
    setLoading(false);
  }, [orgId]);

  const fetchTemplates = useCallback(async () => {
    if (!supabase) {
      setTemplatesLoading(false);
      return;
    }
    if (!orgId) {
      setTemplatesLoading(false);
      setTemplatesError(null);
      setTemplates([]);
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

  if (!orgId) return <PageSkeleton />;

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
      toast.error(`Failed to save scheduler settings: ${saveError.message}`);
      return;
    }
    setSaved(true);
    toast.success('Scheduler settings saved');
    window.setTimeout(() => setSaved(false), 2000);
  };

  const saveAlertsConfig = async () => {
    if (!supabase || !orgId) return;
    setAlertsSaving(true);
    setError(null);
    const { error: saveError } = await supabase
      .from('scheduler_settings')
      .update({
        escalation_config: {
          equipment_service_overdue_days: Number(alertsConfig.equipment_service_overdue_days),
          shift_coverage_warning_pct: Number(alertsConfig.shift_coverage_warning_pct),
          wind_speed_spray_cutoff_mph: Number(alertsConfig.wind_speed_spray_cutoff_mph),
          rain_probability_spray_cutoff_pct: Number(alertsConfig.rain_probability_spray_cutoff_pct),
          heat_advisory_temp_f: Number(alertsConfig.heat_advisory_temp_f),
        },
      })
      .eq('org_id', orgId);
    setAlertsSaving(false);
    if (saveError) {
      setError(saveError.message);
      toast.error(`Failed to save alert thresholds: ${saveError.message}`);
      return;
    }
    setAlertsSaved(true);
    toast.success('Alert thresholds saved');
    window.setTimeout(() => setAlertsSaved(false), 2000);
  };

  const deleteTemplate = async (templateId: string) => {
    if (!supabase) return;
    const templateName = templates.find((template) => template.id === templateId)?.name ?? 'template';
    const { error: deleteError } = await supabase
      .from('shift_templates')
      .delete()
      .eq('id', templateId)
      .eq('org_id', currentUser?.orgId ?? '');
    if (deleteError) {
      setTemplatesError(deleteError.message);
      toast.error(`Failed to delete shift template: ${deleteError.message}`);
      return;
    }
    setTemplates((current) => current.filter((template) => template.id !== templateId));
    toast.success(`Shift template deleted: ${templateName}`);
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
      toast.error(`Failed to add shift template: ${insertError.message}`);
      return;
    }
    setTemplates((current) => [...current, data as ShiftTemplate]);
    toast.success(`Shift template added: ${newName.trim()}`);
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
          <PageSkeleton />
        ) : error ? (
          <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchSettings()} />
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
          <PageSkeleton />
        ) : templatesError ? (
          <ErrorRetry message={`Failed to load: ${templatesError}`} onRetry={() => void fetchTemplates()} />
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

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Alerts</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="Escalation settings help" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                <HelpCircle size={14} color="#6b7280" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Set thresholds for weather and equipment alerts on the workboard.</TooltipContent>
          </Tooltip>
        </div>
        <p style={{ margin: '0 0 14px', color: '#6b7280', fontSize: '13px' }}>
          Configure escalation thresholds used by the Workboard escalation center.
        </p>
        <div style={{ display: 'grid', gap: '12px' }}>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Alert when equipment not serviced for X days</span>
            <input
              type="number"
              min={1}
              value={alertsConfig.equipment_service_overdue_days}
              onChange={(event) =>
                setAlertsConfig((current) => ({
                  ...current,
                  equipment_service_overdue_days: Number(event.target.value || '0'),
                }))
              }
            />
          </label>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Warn when crew coverage drops below X%</span>
            <input
              type="number"
              min={1}
              max={100}
              value={alertsConfig.shift_coverage_warning_pct}
              onChange={(event) =>
                setAlertsConfig((current) => ({
                  ...current,
                  shift_coverage_warning_pct: Number(event.target.value || '0'),
                }))
              }
            />
          </label>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Flag spray tasks when wind exceeds X mph</span>
            <input
              type="number"
              min={1}
              value={alertsConfig.wind_speed_spray_cutoff_mph}
              onChange={(event) =>
                setAlertsConfig((current) => ({
                  ...current,
                  wind_speed_spray_cutoff_mph: Number(event.target.value || '0'),
                }))
              }
            />
          </label>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Flag spray tasks when rain chance exceeds X%</span>
            <input
              type="number"
              min={1}
              max={100}
              value={alertsConfig.rain_probability_spray_cutoff_pct}
              onChange={(event) =>
                setAlertsConfig((current) => ({
                  ...current,
                  rain_probability_spray_cutoff_pct: Number(event.target.value || '0'),
                }))
              }
            />
          </label>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Show heat advisory above X°F</span>
            <input
              type="number"
              min={1}
              value={alertsConfig.heat_advisory_temp_f}
              onChange={(event) =>
                setAlertsConfig((current) => ({
                  ...current,
                  heat_advisory_temp_f: Number(event.target.value || '0'),
                }))
              }
            />
          </label>
          <button
            onClick={() => void saveAlertsConfig()}
            style={{
              width: 'fit-content',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              background: alertsSaved ? '#15803d' : '#166534',
              padding: '8px 14px',
              cursor: 'pointer',
            }}
          >
            {alertsSaving ? 'Saving...' : alertsSaved ? 'Saved ✓' : 'Save alerts'}
          </button>
        </div>
      </div>
    </div>
  );
}

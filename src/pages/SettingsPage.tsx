import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTasks } from '@/lib/supabase-queries';
import { formatTime } from '@/utils/formatTime';
import { APP_VERSION } from '@/constants/version';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CalendarDays,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  GripVertical,
  HelpCircle,
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react';
import { SOPSettings } from '@/components/settings/SOPSettings';
import { RecurringTasksSection } from '@/components/settings/RecurringTasksSection';
import { useAppStore } from '@/store/appStore';
import { type ThemeMode, useTheme } from '@/hooks/useTheme';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';

const TABS = ['Operations', 'Tasks', 'Equipment', 'Workforce', 'SOPs', 'Account', 'Help'] as const;
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

interface AppUserRow {
  id: string;
  employee_id: string;
  role: string;
  status: string;
}

interface OrganizationInfo {
  name: string;
  plan: string | null;
  subscription_status?: string | null;
  created_at?: string | null;
}

interface PropertyItem {
  id: string;
  name: string;
  org_id: string;
  short_name: string | null;
  logo_initials: string | null;
  color: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  acreage: number | null;
  status: string | null;
  weather_location_label: string | null;
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

interface StandardOperatingProcedure {
  id: string;
  title: string;
  category: 'Mowing' | 'Irrigation' | 'Chemical Application' | 'Bunker' | 'Equipment' | 'General' | 'Other';
  items: string[];
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
    <div className="rounded-xl border border-surface-border bg-surface-card p-4">
      <p className="text-sm text-text-muted">{text}</p>
    </div>
  );
}

const settingsInputClass =
  'w-full rounded-lg border border-surface-border bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';
const DEFAULT_PROPERTY_COLOR = '#166534';

function SettingsCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SortableShiftTemplateRow({
  template,
  onDelete,
}: {
  template: ShiftTemplate;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: template.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 border-b border-surface-border px-4 py-3 last:border-0 ${
        isDragging ? 'bg-surface-hover' : 'hover:bg-surface-hover'
      }`}
    >
      <button
        type="button"
        className="flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated hover:text-text-primary active:cursor-grabbing"
        aria-label={`Reorder ${template.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{template.name}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          {formatTime(template.start)}-{formatTime(template.end)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {(template.days ?? []).map((day) => (
            <span key={`${template.id}-${day}`} className="rounded-full bg-brand-ghost px-2 py-0.5 text-xs text-brand">
              {day.slice(0, 3).toUpperCase()}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(template.id)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-status-warning/10 hover:text-status-warning"
        aria-label={`Delete ${template.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function SortableTaskRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border border-surface-border bg-surface-card p-4 transition-opacity ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          className="flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated active:cursor-grabbing"
          aria-label="Reorder task"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

function SortableTaskRowCompact({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex min-h-[44px] items-center gap-2 border-b border-surface-border last:border-0 transition-opacity ${
        isDragging ? 'opacity-50 bg-surface-hover' : ''
      }`}
    >
      <button
        type="button"
        className="flex min-h-[44px] min-w-8 cursor-grab items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated active:cursor-grabbing"
        aria-label="Reorder task"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { orgId, user, userRole, currentUser, currentPropertyId } = useAuth();
  const isReadOnly = String(userRole ?? '') === 'viewer';
  const location = useLocation();
  const [tab, setTab] = useState<Tab>('Operations');
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
    <div className="settings-theme mx-auto max-w-6xl space-y-4 bg-surface-base p-4 text-text-primary md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Operations Control Center</h1>
        <p className="mt-1 text-sm text-text-muted">{user?.email}</p>
      </div>

      <div className="mb-4 md:hidden">
        <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Section</label>
        <select
          value={tab}
          onChange={(event) => setTab(event.target.value as Tab)}
          className="h-10 w-full rounded-lg border border-surface-border bg-surface-card px-3 text-sm text-text-primary"
        >
          {TABS.map((t) => (
            <option key={`mobile-tab-${t}`} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="sticky top-0 z-10 mb-4 hidden flex-wrap items-center gap-2 border-b border-surface-border bg-surface-base/95 pb-1 backdrop-blur md:flex">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-9 rounded-lg px-3 text-sm transition-colors ${
              tab === t
                ? 'border-b-2 border-brand bg-surface-hover font-medium text-brand'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isReadOnly ? (
        <div className="mb-4 rounded-lg border border-status-complete/30 bg-status-complete/10 px-3 py-2 text-xs text-status-complete">
          Demo Mode — Viewing sample data (read-only)
        </div>
      ) : null}

      <fieldset disabled={isReadOnly} style={{ border: 'none', margin: 0, padding: 0 }}>
        {tab === 'Operations' && (
          <OperationsTab
            key="operations"
            orgId={orgId}
            userRole={userRole}
            currentPropertyId={currentPropertyId}
          />
        )}
        {tab === 'Workforce' && <WorkforceTab key="workforce" orgId={orgId} />}
        {tab === 'Tasks' && <TasksTab key="tasks" orgId={orgId} propertyId={taskPropertyId} />}
        {tab === 'Equipment' && <EquipmentTab key="equipment" orgId={orgId} />}
        {tab === 'SOPs' && <SOPSettings key="sops" orgId={orgId} propertyId={taskPropertyId} />}
      </fieldset>
      {tab === 'Account' && (
        <AccessTab
          key="account"
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

function OperationsTab({
  orgId,
  userRole,
  currentPropertyId,
}: {
  orgId: string | null;
  userRole: string | null;
  currentPropertyId: string;
}) {
  return (
    <div className="space-y-8">
      <WorkspaceTab orgId={orgId} userRole={userRole} currentPropertyId={currentPropertyId} />
      <div className="border-t border-dashed border-surface-border pt-6">
        <SchedulerTab orgId={orgId} />
      </div>
    </div>
  );
}

function EquipmentTab({ orgId }: { orgId: string | null }) {
  const isHydrated = useAppStore((state) => state.isHydrated);
  const [equipmentTypes, setEquipmentTypes] = useState<Array<{ id: string; name: string; category: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const categoryOptions = ['Mowing', 'Transport', 'Chemical', 'Trimming', 'Maintenance', 'General'] as const;

  const fetchTypes = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('equipment_types')
      .select('id, name, category')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('name', { ascending: true });
    if (fetchError) { setError(fetchError.message); setLoading(false); return; }
    setEquipmentTypes((data ?? []) as Array<{ id: string; name: string; category: string | null }>);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (!isHydrated) return;
    void fetchTypes();
  }, [fetchTypes, isHydrated]);

  const addType = async () => {
    if (!supabase || !orgId || !newName.trim()) return;
    const { error: insertError } = await supabase.from('equipment_types').insert({
      org_id: orgId, name: newName.trim(), category: newCategory, active: true,
    });
    if (insertError) { toast.error(`Failed to add: ${insertError.message}`); return; }
    setNewName('');
    toast.success('Equipment type added');
    void fetchTypes();
  };

  const saveEdit = async (id: string) => {
    if (!supabase || !orgId || !editingName.trim()) return;
    const { error: updateError } = await supabase
      .from('equipment_types').update({ name: editingName.trim() }).eq('id', id).eq('org_id', orgId);
    if (updateError) { toast.error(`Failed to update: ${updateError.message}`); return; }
    setEditingId(null); setEditingName('');
    toast.success('Updated');
    void fetchTypes();
  };

  const deactivate = async (id: string, name: string) => {
    if (!supabase || !orgId) return;
    const { error: updateError } = await supabase
      .from('equipment_types').update({ active: false }).eq('id', id).eq('org_id', orgId);
    if (updateError) { toast.error(`Failed to remove: ${updateError.message}`); return; }
    toast.success(`Removed ${name}`);
    void fetchTypes();
  };

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-surface-elevated" />;
  if (error) return <ErrorRetry message={error} onRetry={() => void fetchTypes()} />;

  return (
    <div className="space-y-4">
      <SettingsCard title="Equipment Types" subtitle="Define the types of equipment your crew uses.">
        <div className="overflow-hidden rounded-xl border border-surface-border">
          {equipmentTypes.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">No equipment types yet.</p>
          ) : (
            equipmentTypes.map((type) => (
              <div key={type.id} className="flex items-center gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover">
                {editingId === type.id ? (
                  <>
                    <input className={`${settingsInputClass} flex-1`} value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                    <button className="text-sm font-medium text-brand" onClick={() => void saveEdit(type.id)}>Save</button>
                    <button className="text-sm text-text-muted" onClick={() => { setEditingId(null); setEditingName(''); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-text-primary">{type.name}</span>
                    <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-xs text-text-muted">{type.category ?? 'General'}</span>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary" onClick={() => { setEditingId(type.id); setEditingName(type.name); }} aria-label={`Edit ${type.name}`}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning" onClick={() => void deactivate(type.id, type.name)} aria-label={`Remove ${type.name}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input className={`${settingsInputClass} flex-1`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Type name" />
          <select className={`${settingsInputClass} w-40`} value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
            {categoryOptions.map((c) => <option key={`eq-cat-${c}`} value={c}>{c}</option>)}
          </select>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={() => void addType()}>Add</button>
        </div>
      </SettingsCard>
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
  const isHydrated = useAppStore((state) => state.isHydrated);
  const storeOrg = useAppStore((state) => state.org);
  const storeProperties = useAppStore((state) => state.properties);
  const storeEmployees = useAppStore((state) => state.employees);
  const storeDepartments = useAppStore((state) => state.departments);
  const hydrateStore = useAppStore((state) => state.hydrate);
  const refreshProperties = useAppStore((state) => state.refreshProperties);
  const { theme, setTheme } = useTheme();
  const SOP_STORAGE_KEY = 'ground-crew-sops';
  const sopCategoryOptions: StandardOperatingProcedure['category'][] = ['Mowing', 'Irrigation', 'Chemical Application', 'Bunker', 'Equipment', 'General', 'Other'];
  const defaultSops: StandardOperatingProcedure[] = [
    {
      id: 'sop-mowing-greens',
      title: 'Mowing Greens',
      category: 'Mowing',
      items: ['Verify height', 'Check fuel', 'Alternate direction', 'Clean after', 'Report damage'],
    },
    {
      id: 'sop-spray-application',
      title: 'Spray Application',
      category: 'Chemical Application',
      items: ['Check wind', 'Verify label', 'Calibrate', 'Wear PPE', 'Log in Chemical Logs', 'Record weather'],
    },
    {
      id: 'sop-irrigation-check',
      title: 'Irrigation Check',
      category: 'Irrigation',
      items: ['Walk zones', 'Check leaks', 'Verify run times', 'Adjust for rain', 'Report issues'],
    },
    {
      id: 'sop-bunker-maintenance',
      title: 'Bunker Maintenance',
      category: 'Bunker',
      items: ['Rake all', 'Check drainage', 'Repair washouts', 'Edge lips', 'Report sand levels'],
    },
  ];

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [orgNameDraft, setOrgNameDraft] = useState('');
  const properties = useMemo(() => storeProperties as PropertyItem[], [storeProperties]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Manager' | 'Field Staff'>('Manager');
  const [savingOrg, setSavingOrg] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyShortName, setNewPropertyShortName] = useState('');
  const [newPropertyLogoInitials, setNewPropertyLogoInitials] = useState('GC');
  const [newPropertyColor, setNewPropertyColor] = useState(DEFAULT_PROPERTY_COLOR);
  const [newPropertyCity, setNewPropertyCity] = useState('');
  const [newPropertyState, setNewPropertyState] = useState('');
  const [newPropertyAcreage, setNewPropertyAcreage] = useState('0');
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingPropertyName, setEditingPropertyName] = useState('');
  const [equipmentTypes, setEquipmentTypes] = useState<Array<{ id: string; name: string; category: string | null }>>([]);
  const [newEquipmentTypeName, setNewEquipmentTypeName] = useState('');
  const [newEquipmentTypeCategory, setNewEquipmentTypeCategory] = useState('General');
  const [editingEquipmentTypeId, setEditingEquipmentTypeId] = useState<string | null>(null);
  const [editingEquipmentTypeName, setEditingEquipmentTypeName] = useState('');
  const [loadingDemoData, setLoadingDemoData] = useState(false);
  const [sops, setSops] = useState<StandardOperatingProcedure[]>([]);
  const [newSopTitle, setNewSopTitle] = useState('');
  const [newSopCategory, setNewSopCategory] = useState<StandardOperatingProcedure['category']>('General');
  const [newSopChecklist, setNewSopChecklist] = useState('');
  const [showSopForm, setShowSopForm] = useState(false);
  const [editingSopId, setEditingSopId] = useState<string | null>(null);
  const [editingSopTitle, setEditingSopTitle] = useState('');
  const [editingSopCategory, setEditingSopCategory] = useState<StandardOperatingProcedure['category']>('General');
  const [editingSopChecklist, setEditingSopChecklist] = useState('');
  const [usageStats, setUsageStats] = useState<UsageStats>({
    properties: 0,
    employees: 0,
    tasks: 0,
    scheduleEntriesThisMonth: 0,
    weatherLocations: 0,
    departments: 0,
    shiftTemplates: 0,
  });
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
      { count: tasksCount, error: tasksError },
      { count: scheduleCount, error: scheduleError },
      { count: weatherCount, error: weatherError },
      { count: shiftTemplatesCount, error: shiftTemplatesError },
      { data: equipmentTypesData, error: equipmentTypesError },
    ] = await Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase
        .from('schedule_entries')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('date', monthStartKey)
        .lte('date', monthEndKey),
      supabase.from('weather_locations').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true),
      supabase.from('shift_templates').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
      supabase.from('equipment_types').select('id, name, category').eq('org_id', orgId).eq('active', true).order('name', { ascending: true }),
    ]);

    if (tasksError || scheduleError || weatherError || shiftTemplatesError || equipmentTypesError) {
      setError(
        tasksError?.message ??
          scheduleError?.message ??
          weatherError?.message ??
          shiftTemplatesError?.message ??
          equipmentTypesError?.message ??
          'Unable to load workspace settings',
      );
      setLoading(false);
      return;
    }

    const nextOrgInfo = storeOrg
      ? ({
          name: storeOrg.name,
          plan: storeOrg.plan,
          subscription_status: storeOrg.subscription_status,
          created_at: '',
        } satisfies OrganizationInfo)
      : null;
    setOrgInfo(nextOrgInfo);
    setOrgNameDraft(String(nextOrgInfo?.name ?? ''));
    setEquipmentTypes((equipmentTypesData ?? []) as Array<{ id: string; name: string; category: string | null }>);
    setUsageStats({
      properties: storeProperties.length,
      employees: storeEmployees.length,
      tasks: tasksCount ?? 0,
      scheduleEntriesThisMonth: scheduleCount ?? 0,
      weatherLocations: weatherCount ?? 0,
      departments: storeDepartments.filter((department) => department.active).length,
      shiftTemplates: shiftTemplatesCount ?? 0,
    });
    setLoading(false);
  }, [orgId, storeDepartments, storeEmployees.length, storeOrg, storeProperties.length]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!orgId) return;
    void fetchWorkspaceData();
  }, [fetchWorkspaceData, isHydrated, orgId]);

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
    await hydrateStore(orgId);
    setOrgInfo((current) => (current ? { ...current, name: orgNameDraft.trim() } : current));
    toast.success('Organization updated');
  };

  const addProperty = async () => {
    const storeOrgId = storeOrg?.id;
    const name = newPropertyName.trim();
    const shortName = newPropertyShortName.trim();
    if (!name || !shortName) {
      toast.error('Property name and short name are required.');
      return;
    }
    if (!supabase || !storeOrgId) {
      toast.error('Organization context is unavailable.');
      return;
    }
    const acreage = Number(newPropertyAcreage || '0');
    if (!Number.isFinite(acreage) || acreage < 0) {
      toast.error('Acreage must be 0 or greater.');
      return;
    }
    setError(null);
    const { error: insertError } = await supabase
      .from('properties')
      .insert({
        name,
        short_name: shortName,
        logo_initials: newPropertyLogoInitials.trim().slice(0, 3).toUpperCase() || 'GC',
        color: newPropertyColor || DEFAULT_PROPERTY_COLOR,
        city: newPropertyCity.trim(),
        state: newPropertyState.trim().slice(0, 2).toUpperCase(),
        acreage,
        status: 'active',
        org_id: storeOrgId,
      });
    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add property: ${insertError.message}`);
      return;
    }
    toast.success(`Property added: ${name}`);
    await refreshProperties(storeOrgId);
    setNewPropertyName('');
    setNewPropertyShortName('');
    setNewPropertyLogoInitials('GC');
    setNewPropertyColor(DEFAULT_PROPERTY_COLOR);
    setNewPropertyCity('');
    setNewPropertyState('');
    setNewPropertyAcreage('0');
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
    setEditingPropertyId(null);
    setEditingPropertyName('');
    toast.success(`Property renamed to ${editingPropertyName.trim()}`);
    await refreshProperties(orgId);
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
    toast.success('Property deleted');
    await refreshProperties(orgId);
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

    const [{ count: taskCount }, { count: equipmentTypeCount }, { count: equipmentCount }] = await Promise.all([
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

    if (storeEmployees.length < 3) {
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
      const { error: employeeError } = await supabase
        .from('employees')
        .insert(employeeRows);
      if (employeeError) {
        setLoadingDemoData(false);
        setError(employeeError.message);
        toast.error(`Failed to seed demo employees: ${employeeError.message}`);
        return;
      }
      demoEmployees = employeeRows.map(({ id, first_name, last_name }) => ({
        id,
        first_name,
        last_name,
      }));
    } else {
      demoEmployees = storeEmployees
        .filter((employee) => employee.active && employee.status === 'active')
        .sort((left, right) => left.last_name.localeCompare(right.last_name))
        .slice(0, 4)
        .map(({ id, first_name, last_name }) => ({ id, first_name, last_name }));
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
      href: '/app/settings?tab=Operations',
    },
    { label: 'Add property', done: usageStats.properties > 0, href: '/app/settings?tab=Operations' },
    { label: 'Configure weather', done: usageStats.weatherLocations > 0, href: '/app/settings?tab=Operations' },
    { label: 'Add departments', done: usageStats.departments > 0, href: '/app/settings?tab=Workforce' },
    { label: 'Add employees', done: usageStats.employees > 0, href: '/app/employees' },
    { label: 'Create shift templates', done: usageStats.shiftTemplates > 0, href: '/app/scheduler' },
    { label: 'Build task library', done: usageStats.tasks > 0, href: '/app/settings?tab=Tasks' },
  ];
  const setupComplete = setupChecklist.every((item) => item.done);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(SOP_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(SOP_STORAGE_KEY, JSON.stringify(defaultSops));
      setSops(defaultSops);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StandardOperatingProcedure[];
      if (!Array.isArray(parsed)) {
        window.localStorage.setItem(SOP_STORAGE_KEY, JSON.stringify(defaultSops));
        setSops(defaultSops);
        return;
      }
      setSops(parsed);
    } catch {
      window.localStorage.setItem(SOP_STORAGE_KEY, JSON.stringify(defaultSops));
      setSops(defaultSops);
    }
  }, []);

  const persistSops = (nextSops: StandardOperatingProcedure[]) => {
    setSops(nextSops);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SOP_STORAGE_KEY, JSON.stringify(nextSops));
    }
  };

  const addSop = () => {
    const title = newSopTitle.trim();
    const items = newSopChecklist
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!title || items.length === 0) {
      toast.error('Enter a title and at least one checklist item.');
      return;
    }
    const nextSops = [
      ...sops,
      {
        id: crypto.randomUUID(),
        title,
        category: newSopCategory,
        items,
      },
    ];
    persistSops(nextSops);
    setNewSopTitle('');
    setNewSopCategory('General');
    setNewSopChecklist('');
    setShowSopForm(false);
    toast.success(`SOP added: ${title}`);
  };

  const startSopEdit = (sop: StandardOperatingProcedure) => {
    setEditingSopId(sop.id);
    setEditingSopTitle(sop.title);
    setEditingSopCategory(sop.category);
    setEditingSopChecklist(sop.items.join('\n'));
  };

  const saveSopEdit = (sopId: string) => {
    const title = editingSopTitle.trim();
    const items = editingSopChecklist
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!title || items.length === 0) {
      toast.error('Enter a title and at least one checklist item.');
      return;
    }
    const nextSops = sops.map((sop) =>
      sop.id === sopId
        ? { ...sop, title, category: editingSopCategory, items }
        : sop,
    );
    persistSops(nextSops);
    setEditingSopId(null);
    setEditingSopTitle('');
    setEditingSopChecklist('');
    toast.success(`SOP updated: ${title}`);
  };

  const deleteSop = (sopId: string, title: string) => {
    const confirmed = window.confirm(`Delete SOP "${title}"?`);
    if (!confirmed) return;
    const nextSops = sops.filter((sop) => sop.id !== sopId);
    persistSops(nextSops);
    toast.success(`SOP deleted: ${title}`);
  };

  if (!orgId || loading) return <PageSkeleton />;

  if (error) {
    return (
      <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchWorkspaceData()} />
    );
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Setup Checklist"
        action={
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="Setup checklist help" className="rounded p-0.5 text-text-muted hover:text-text-secondary">
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Complete these steps to fully configure your operation.</TooltipContent>
          </Tooltip>
        }
      >
        {setupComplete ? (
          <p className="text-sm font-semibold text-brand">Setup complete ✓</p>
        ) : (
          <div className="grid gap-2">
            {setupChecklist.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.href)}
                className={`flex items-center gap-3 rounded-lg border border-surface-border bg-surface-elevated px-4 py-3 text-left text-sm transition-colors hover:bg-surface-hover ${
                  item.done ? 'text-brand' : 'text-text-primary'
                }`}
              >
                <span>{item.done ? '☑' : '☐'}</span>
                <span className="flex-1">{item.label}</span>
                {!item.done ? <ChevronRight className="h-4 w-4 text-text-muted" /> : null}
              </button>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Organization Info">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-widest text-text-muted">Organization name</label>
            <input className={settingsInputClass} value={orgNameDraft} onChange={(event) => setOrgNameDraft(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-widest text-text-muted">Plan</label>
            <span className="w-fit rounded-full border border-surface-border px-3 py-1 text-xs text-text-secondary">
              {(orgInfo?.plan ?? 'starter').toString()}
            </span>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-widest text-text-muted">Created</label>
            <span className="text-xs text-text-secondary">
              {orgInfo?.created_at ? new Date(orgInfo.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => void saveOrganization()}
            disabled={savingOrg}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright disabled:opacity-60"
          >
            {savingOrg ? 'Saving...' : 'Save'}
          </button>
          {userRole === 'admin' ? (
            <button
              onClick={() => void loadDemoData()}
              disabled={loadingDemoData}
              className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-60"
            >
              {loadingDemoData ? 'Loading Demo Data...' : 'Load Demo Data'}
            </button>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard title="Usage">
        <div className="grid gap-4">
          {usageRows.map((row) => {
            const ratio = row.limit ? Math.min(1, row.value / row.limit) : 0;
            const barColorClass = ratio >= 0.9 ? 'bg-status-warning' : ratio >= 0.75 ? 'bg-status-pending' : 'bg-status-active';
            const limitLabel = row.limit == null ? 'Unlimited' : row.limit;
            return (
              <div key={`usage-${row.key}`} className="grid gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-primary">{row.label}</span>
                  <span className="text-text-muted">{row.value} / {limitLabel}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-border">
                  <div
                    className={`h-full transition-all ${barColorClass}`}
                    style={{ width: row.limit == null ? '20%' : `${Math.min(100, Math.max(2, ratio * 100))}%` }}
                  />
                </div>
              </div>
            );
          })}
          {usageAtLimit && !isProPlan ? (
            <button
              type="button"
              onClick={() => navigate('/app/settings?tab=Account')}
              className="w-fit text-sm text-brand underline hover:text-brand-bright"
            >
              Usage limit reached. Review workspace access settings.
            </button>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard title={`Properties (${properties.length})`}>
        {properties.length === 0 ? (
          <p className="text-sm text-text-muted">No properties yet. Add your first property below.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            {properties.map((property) => (
              <div key={property.id} className="flex items-center gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover">
                {editingPropertyId === property.id ? (
                  <>
                    <input className={`${settingsInputClass} flex-1`} value={editingPropertyName} onChange={(event) => setEditingPropertyName(event.target.value)} />
                    <button className="text-sm font-medium text-brand" onClick={() => void savePropertyEdit(property.id)}>Save</button>
                    <button className="text-sm text-text-muted" onClick={cancelPropertyEdit}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-text-primary">{property.name}</span>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary" onClick={() => startPropertyEdit(property)} aria-label={`Edit ${property.name}`}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning" onClick={() => void deleteProperty(property.id)} aria-label={`Delete ${property.name}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 grid max-w-lg gap-3">
          <label className="text-xs font-medium uppercase tracking-widest text-text-muted">Add property</label>
          <label className="grid gap-1.5 text-xs font-medium text-text-muted">
            Property name *
            <input className={settingsInputClass} placeholder="Springfield Park Course" value={newPropertyName} onChange={(event) => setNewPropertyName(event.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium text-text-muted">
              Short name *
              <input className={settingsInputClass} placeholder="SPC" value={newPropertyShortName} onChange={(event) => setNewPropertyShortName(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-text-muted">
              Logo initials *
              <input
                className={settingsInputClass}
                maxLength={3}
                placeholder="GC"
                value={newPropertyLogoInitials}
                onChange={(event) => setNewPropertyLogoInitials(event.target.value.toUpperCase())}
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-xs font-medium text-text-muted">
            Brand color *
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-10 w-14 cursor-pointer rounded-lg border border-surface-border bg-surface-base p-1"
                value={newPropertyColor}
                onChange={(event) => setNewPropertyColor(event.target.value)}
                aria-label="Property brand color"
              />
              <span className="text-sm uppercase text-text-secondary">{newPropertyColor}</span>
            </div>
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
            <label className="grid gap-1.5 text-xs font-medium text-text-muted">
              City
              <input className={settingsInputClass} placeholder="Springfield" value={newPropertyCity} onChange={(event) => setNewPropertyCity(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-text-muted">
              State
              <input
                className={settingsInputClass}
                maxLength={2}
                placeholder="OH"
                value={newPropertyState}
                onChange={(event) => setNewPropertyState(event.target.value.toUpperCase())}
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-xs font-medium text-text-muted">
            Acreage
            <input
              className={settingsInputClass}
              type="number"
              min={0}
              step="0.1"
              value={newPropertyAcreage}
              onChange={(event) => setNewPropertyAcreage(event.target.value)}
            />
          </label>
          <button
            onClick={() => void addProperty()}
            className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright"
          >
            Add Property
          </button>
        </div>
      </SettingsCard>


      <SettingsCard
        title="Standard Operating Procedures"
        action={
          !showSopForm ? (
            <button
              onClick={() => setShowSopForm(true)}
              className="rounded-lg border border-surface-border bg-surface-card px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover"
            >
              + Add SOP
            </button>
          ) : null
        }
      >
        {sops.length === 0 && !showSopForm ? (
          <p className="text-sm text-text-muted">No SOPs yet. Add your first SOP above.</p>
        ) : (
          <div className="grid gap-3">
            {sops.map((sop) => (
              <div key={sop.id} className="rounded-xl border border-surface-border bg-surface-elevated p-4">
                {editingSopId === sop.id ? (
                  <div className="grid gap-3">
                    <input className={settingsInputClass} value={editingSopTitle} onChange={(event) => setEditingSopTitle(event.target.value)} placeholder="SOP title" />
                    <select className={settingsInputClass} value={editingSopCategory} onChange={(event) => setEditingSopCategory(event.target.value as StandardOperatingProcedure['category'])}>
                      {sopCategoryOptions.map((category) => (
                        <option key={`sop-edit-category-${category}`} value={category}>{category}</option>
                      ))}
                    </select>
                    <textarea className={settingsInputClass} value={editingSopChecklist} onChange={(event) => setEditingSopChecklist(event.target.value)} rows={5} placeholder="One checklist item per line" />
                    <div className="flex gap-2">
                      <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={() => saveSopEdit(sop.id)}>Save</button>
                      <button className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover" onClick={() => { setEditingSopId(null); setEditingSopTitle(''); setEditingSopChecklist(''); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{sop.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{sop.category} · {sop.items.length} item{sop.items.length === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex gap-1">
                      <button className="rounded-lg p-2 text-text-muted hover:bg-surface-card hover:text-text-primary" onClick={() => startSopEdit(sop)} aria-label={`Edit ${sop.title}`}><Pencil className="h-4 w-4" /></button>
                      <button className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning" onClick={() => deleteSop(sop.id, sop.title)} aria-label={`Delete ${sop.title}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {showSopForm ? (
          <div className="mt-4 grid gap-3 border-t border-surface-border pt-4">
            <p className="text-sm font-medium text-text-primary">Add SOP</p>
            <input className={settingsInputClass} value={newSopTitle} onChange={(event) => setNewSopTitle(event.target.value)} placeholder="SOP title" />
            <select className={settingsInputClass} value={newSopCategory} onChange={(event) => setNewSopCategory(event.target.value as StandardOperatingProcedure['category'])}>
              {sopCategoryOptions.map((category) => (
                <option key={`sop-category-${category}`} value={category}>{category}</option>
              ))}
            </select>
            <textarea className={settingsInputClass} value={newSopChecklist} onChange={(event) => setNewSopChecklist(event.target.value)} rows={5} placeholder="Checklist items (one per line)" />
            <div className="flex gap-2">
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={addSop}>Save</button>
              <button className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover" onClick={() => { setShowSopForm(false); setNewSopTitle(''); setNewSopCategory('General'); setNewSopChecklist(''); }}>Cancel</button>
            </div>
          </div>
        ) : null}
      </SettingsCard>

      {/* ── Appearance ── */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Appearance</h3>
          <p className="mt-0.5 text-xs text-text-muted">Choose how Ground Crew HQ looks on this device.</p>
        </div>
        <div className="flex gap-2">
          {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => void setTheme(mode)}
              className={`min-h-[36px] rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition-colors duration-150 ${
                theme === mode
                  ? 'border-brand bg-brand text-text-inverse'
                  : 'border-surface-border bg-surface-elevated text-text-secondary hover:border-brand/40 hover:text-text-primary'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkforceTab({ orgId }: { orgId: string | null }) {
  const isHydrated = useAppStore((state) => state.isHydrated);
  const storeDepartments = useAppStore((state) => state.departments);
  const storeWorkforceRoles = useAppStore((state) => state.workforceRoles);
  const storeWorkerTypes = useAppStore((state) => state.workerTypes);
  const refreshDepartments = useAppStore((state) => state.refreshDepartments);
  const refreshWorkforceRoles = useAppStore((state) => state.refreshWorkforceRoles);
  const refreshWorkerTypes = useAppStore((state) => state.refreshWorkerTypes);
  const departments = useMemo(
    () =>
      storeDepartments
        .filter((department) => department.active)
        .map(({ id, name }) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [storeDepartments],
  );
  const roles = useMemo(
    () =>
      storeWorkforceRoles
        .filter((role) => role.active && role.name.trim())
        .map(({ id, name }) => ({ id, name })),
    [storeWorkforceRoles],
  );
  const workerTypes = useMemo(
    () =>
      storeWorkerTypes
        .filter((workerType) => workerType.active && workerType.name.trim())
        .map(({ id, name }) => ({ id, name })),
    [storeWorkerTypes],
  );
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newWorkerTypeName, setNewWorkerTypeName] = useState('');
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingDepartmentName, setEditingDepartmentName] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState('');
  const [editingWorkerTypeId, setEditingWorkerTypeId] = useState<string | null>(null);
  const [editingWorkerTypeName, setEditingWorkerTypeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkforceSummary = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    await Promise.all([
      refreshWorkforceRoles(orgId),
      refreshWorkerTypes(orgId),
    ]);
    setLoading(false);
  }, [orgId, refreshWorkerTypes, refreshWorkforceRoles]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!orgId) return;
    void fetchWorkforceSummary();
  }, [fetchWorkforceSummary, isHydrated, orgId]);

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
    await refreshDepartments(orgId);
  }, [newDepartmentName, orgId, refreshDepartments]);

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
    await refreshDepartments(orgId);
  }, [editingDepartmentId, editingDepartmentName, orgId, refreshDepartments]);

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
    await refreshDepartments(orgId);
  }, [orgId, refreshDepartments]);

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
    await refreshWorkforceRoles(orgId);
  }, [newRoleName, orgId, refreshWorkforceRoles]);

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
    await refreshWorkforceRoles(orgId);
  }, [editingRoleId, editingRoleName, orgId, refreshWorkforceRoles]);

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
    await refreshWorkforceRoles(orgId);
  }, [orgId, refreshWorkforceRoles]);

  const addWorkerType = useCallback(async () => {
    if (!supabase || !orgId || !newWorkerTypeName.trim()) return;
    const { error: insertError } = await supabase.from('worker_types').insert({
      org_id: orgId,
      name: newWorkerTypeName.trim(),
      active: true,
    });
    if (insertError) {
      toast.error(`Failed to add worker type: ${insertError.message}`);
      return;
    }
    setNewWorkerTypeName('');
    toast.success('Worker type added');
    await refreshWorkerTypes(orgId);
  }, [newWorkerTypeName, orgId, refreshWorkerTypes]);

  const saveWorkerTypeEdit = useCallback(async () => {
    if (!supabase || !orgId || !editingWorkerTypeId || !editingWorkerTypeName.trim()) return;
    const { error: updateError } = await supabase
      .from('worker_types')
      .update({ name: editingWorkerTypeName.trim() })
      .eq('id', editingWorkerTypeId)
      .eq('org_id', orgId);
    if (updateError) {
      toast.error(`Failed to update worker type: ${updateError.message}`);
      return;
    }
    setEditingWorkerTypeId(null);
    setEditingWorkerTypeName('');
    toast.success('Worker type updated');
    await refreshWorkerTypes(orgId);
  }, [editingWorkerTypeId, editingWorkerTypeName, orgId, refreshWorkerTypes]);

  const deactivateWorkerType = useCallback(async (workerTypeId: string, workerTypeName: string) => {
    if (!supabase || !orgId) return;
    if (!window.confirm(`Deactivate worker type "${workerTypeName}"?`)) return;
    const { error: updateError } = await supabase
      .from('worker_types')
      .update({ active: false })
      .eq('id', workerTypeId)
      .eq('org_id', orgId);
    if (updateError) {
      toast.error(`Failed to deactivate worker type: ${updateError.message}`);
      return;
    }
    toast.success('Worker type deactivated');
    await refreshWorkerTypes(orgId);
  }, [orgId, refreshWorkerTypes]);

  if (!orgId || loading) return <PageSkeleton />;
  if (error) return <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchWorkforceSummary()} />;

  return (
    <div className="space-y-4">
      <SettingsCard title="Departments" subtitle="Organize your crew by department for scheduling and reporting.">
        <div className="overflow-hidden rounded-xl border border-surface-border">
          {departments.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">No active departments yet.</p>
          ) : (
            departments.map((department) => (
              <div key={department.id} className="flex items-center gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover">
                {editingDepartmentId === department.id ? (
                  <>
                    <input className={`${settingsInputClass} flex-1`} value={editingDepartmentName} onChange={(event) => setEditingDepartmentName(event.target.value)} />
                    <button className="text-sm font-medium text-brand" onClick={() => void saveDepartmentEdit()}>Save</button>
                    <button className="text-sm text-text-muted" onClick={() => { setEditingDepartmentId(null); setEditingDepartmentName(''); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-text-primary">{department.name}</span>
                    <span className="rounded-full bg-status-active/10 px-2.5 py-1 text-xs text-status-active">Active</span>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary" onClick={() => { setEditingDepartmentId(department.id); setEditingDepartmentName(department.name); }} aria-label={`Edit ${department.name}`}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning" onClick={() => void deactivateDepartment(department.id, department.name)} aria-label={`Deactivate ${department.name}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input className={settingsInputClass} value={newDepartmentName} onChange={(event) => setNewDepartmentName(event.target.value)} placeholder="Add department" />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={() => void addDepartment()}>Add</button>
        </div>
      </SettingsCard>

      <SettingsCard title="Roles" subtitle="Define position labels used across the platform.">
        <div className="overflow-hidden rounded-xl border border-surface-border">
          {roles.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">No active roles yet.</p>
          ) : (
            roles.map((role) => (
              <div key={role.id} className="flex items-center gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover">
                {editingRoleId === role.id ? (
                  <>
                    <input className={`${settingsInputClass} flex-1`} value={editingRoleName} onChange={(event) => setEditingRoleName(event.target.value)} />
                    <button className="text-sm font-medium text-brand" onClick={() => void saveRoleEdit()}>Save</button>
                    <button className="text-sm text-text-muted" onClick={() => { setEditingRoleId(null); setEditingRoleName(''); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-text-primary">{role.name}</span>
                    <span className="rounded-full bg-status-active/10 px-2.5 py-1 text-xs text-status-active">Active</span>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary" onClick={() => { setEditingRoleId(role.id); setEditingRoleName(role.name); }} aria-label={`Edit ${role.name}`}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning" onClick={() => void deactivateRole(role.id, role.name)} aria-label={`Deactivate ${role.name}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input className={settingsInputClass} value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="Add role" />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={() => void addRole()}>Add</button>
        </div>
      </SettingsCard>

      <SettingsCard title="Worker Types" subtitle="Classify team members for scheduling and reporting.">
        <div className="overflow-hidden rounded-xl border border-surface-border">
          {workerTypes.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">No active worker types yet.</p>
          ) : (
            workerTypes.map((workerType) => (
              <div key={workerType.id} className="flex items-center gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover">
                {editingWorkerTypeId === workerType.id ? (
                  <>
                    <input className={settingsInputClass} value={editingWorkerTypeName} onChange={(event) => setEditingWorkerTypeName(event.target.value)} />
                    <button className="text-sm font-medium text-brand" onClick={() => void saveWorkerTypeEdit()}>Save</button>
                    <button className="text-sm text-text-muted" onClick={() => setEditingWorkerTypeId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-text-primary">{workerType.name}</span>
                    <span className="rounded-full bg-status-active/10 px-2.5 py-1 text-xs text-status-active">Active</span>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary" onClick={() => { setEditingWorkerTypeId(workerType.id); setEditingWorkerTypeName(workerType.name); }} aria-label={`Edit ${workerType.name}`}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning" onClick={() => void deactivateWorkerType(workerType.id, workerType.name)} aria-label={`Delete ${workerType.name}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input className={settingsInputClass} value={newWorkerTypeName} onChange={(event) => setNewWorkerTypeName(event.target.value)} placeholder="Add worker type" />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright" onClick={() => void addWorkerType()}>Add</button>
        </div>
      </SettingsCard>

      <div className="rounded-xl border border-surface-border bg-surface-card px-4 py-3">
        <p className="text-sm text-text-muted">To change employee roles, go to the <span className="text-brand">Employees</span> page.</p>
      </div>
    </div>
  );
}

function WeatherTab({ orgId }: { orgId: string | null }) {
  const isHydrated = useAppStore((state) => state.isHydrated);
  const storeProperties = useAppStore((state) => state.properties);
  const [locations, setLocations] = useState<WeatherLocationItem[]>([]);
  const properties = useMemo(
    () =>
      storeProperties
        .map(({ id, name }) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [storeProperties],
  );
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
    const [{ data: locationData, error: locationError }, { data: prefsData, error: prefsError }] = await Promise.all([
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
    ]);

    if (locationError || prefsError) {
      setError(locationError?.message ?? prefsError?.message ?? 'Unable to load weather settings');
      setLoading(false);
      return;
    }

    setLocations((locationData ?? []) as WeatherLocationItem[]);
    const enabledWidgets = ((prefsData as WeatherDisplayPrefsRow | null)?.enabled_widgets ?? []) as string[];
    const hasWidgets = enabledWidgets.length > 0;
    setPrefs({
      show_hourly: hasWidgets ? enabledWidgets.includes('hourly-forecast') || enabledWidgets.includes('hourly_forecast') : true,
      show_forecast: hasWidgets ? enabledWidgets.includes('daily-forecast') || enabledWidgets.includes('7day_forecast') : true,
      show_rainfall: hasWidgets ? enabledWidgets.includes('rain') || enabledWidgets.includes('precipitation') : true,
    });
    if (!stationPropertyId && properties.length > 0) {
      setStationPropertyId(properties[0].id);
    }
    setLoading(false);
  }, [orgId, properties, stationPropertyId]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!orgId) return;
    void fetchWeatherSettings();
  }, [fetchWeatherSettings, isHydrated, orgId]);

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
    <div className="space-y-4">
      <SettingsCard title="Weather Stations">
        {locations.length === 0 ? (
          <p className="text-sm text-text-muted">No weather stations configured yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            {locations.map((location) => (
              <div key={location.id} className="flex items-start justify-between gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{location.name}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {(location as WeatherLocationItem & { property?: string }).property ?? 'No property'} · {location.area ?? 'General'}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {location.latitude ?? '—'}, {location.longitude ?? '—'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={Boolean(location.is_active)}
                      onChange={(event) => void toggleActive(location.id, event.target.checked)}
                      className="rounded"
                    />
                    {location.is_active ? 'Active' : 'Inactive'}
                  </label>
                  <button
                    onClick={() => beginEdit(location)}
                    className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
                    aria-label={`Edit ${location.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void deleteLocation(location.id)}
                    className="rounded-lg p-2 text-text-muted hover:bg-status-warning/10 hover:text-status-warning"
                    aria-label={`Delete ${location.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title={editingLocationId ? 'Edit Station' : 'Add Station'}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Station name</span>
            <input className={settingsInputClass} value={stationName} onChange={(event) => setStationName(event.target.value)} placeholder="Sarasota Polo Club" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Area</span>
            <select className={settingsInputClass} value={stationArea} onChange={(event) => setStationArea(event.target.value)}>
              {areaOptions.map((area) => (
                <option key={`area-option-${area}`} value={area}>{area}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Property</span>
            <select className={settingsInputClass} value={stationPropertyId} onChange={(event) => setStationPropertyId(event.target.value)}>
              <option value="">Select property</option>
              {properties.map((property) => (
                <option key={`weather-property-${property.id}`} value={property.id}>{property.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-4">
          {(['zip', 'coords', 'geo'] as const).map((method) => (
            <label key={method} className="flex cursor-pointer items-center gap-1.5 text-sm text-text-secondary">
              <input type="radio" checked={locationMethod === method} onChange={() => setLocationMethod(method)} />
              {method === 'zip' ? 'Enter zip code' : method === 'coords' ? 'Enter coordinates' : 'Use my location'}
            </label>
          ))}
        </div>

        {locationMethod === 'zip' ? (
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <input className={settingsInputClass} value={zipCode} onChange={(event) => setZipCode(event.target.value)} onBlur={() => void fillCoordinatesFromZip()} placeholder="ZIP code" />
            <button
              onClick={() => void fillCoordinatesFromZip()}
              className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-60"
              disabled={zipLookupLoading}
            >
              {zipLookupLoading ? 'Looking up...' : 'Lookup'}
            </button>
          </div>
        ) : null}

        {locationMethod === 'geo' ? (
          <button
            onClick={useCurrentLocation}
            className="mt-3 w-fit rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover"
          >
            Use My Location
          </button>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Latitude</span>
            <input className={settingsInputClass} type="number" step="0.0001" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Longitude</span>
            <input className={settingsInputClass} type="number" step="0.0001" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => void saveStation()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright disabled:opacity-60"
            disabled={savingLocation || !stationName.trim()}
          >
            {savingLocation ? 'Saving...' : editingLocationId ? 'Save Changes' : 'Save Station'}
          </button>
          {editingLocationId ? (
            <button
              onClick={resetForm}
              className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard title={`Display Preferences${savingPrefs ? ' · Saving…' : ''}`}>
        <div className="space-y-3">
          {([
            { key: 'show_hourly' as const, label: 'Show hourly forecast' },
            { key: 'show_forecast' as const, label: 'Show 7-day forecast' },
            { key: 'show_rainfall' as const, label: 'Show rainfall data' },
          ]).map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-3 text-sm text-text-secondary">
              <input type="checkbox" checked={prefs[key]} onChange={(event) => updatePref(key, event.target.checked)} className="rounded" />
              {label}
            </label>
          ))}
        </div>
      </SettingsCard>
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
  const isHydrated = useAppStore((state) => state.isHydrated);
  const storeOrg = useAppStore((state) => state.org);
  const storeProperties = useAppStore((state) => state.properties);
  const storeEmployees = useAppStore((state) => state.employees);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organizationName = storeOrg?.name ?? '';
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
  const [appUsers, setAppUsers] = useState<AppUserRow[]>([]);
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

    const [tasksCountResult, scheduleCountResult, assignmentsCountResult, equipmentCountResult, appUsersResult] = await Promise.all([
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
      supabase
        .from('app_users')
        .select('id, employee_id, role, status')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
    ]);

    const fetchError =
      tasksCountResult.error ??
      scheduleCountResult.error ??
      assignmentsCountResult.error ??
      equipmentCountResult.error ??
      appUsersResult.error;

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setSystemInfo({
      propertyCount: storeProperties.length,
      employeeCount: storeEmployees.length,
      taskCount: tasksCountResult.count ?? 0,
      scheduleEntriesThisWeek: scheduleCountResult.count ?? 0,
      assignmentsToday: assignmentsCountResult.count ?? 0,
      equipmentUnits: equipmentCountResult.count ?? 0,
    });
    setAppUsers((appUsersResult.data as AppUserRow[]) ?? []);
    setLoading(false);
  }, [orgId, storeEmployees.length, storeProperties.length]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!orgId) return;
    void fetchOrganizationName();
  }, [fetchOrganizationName, isHydrated, orgId]);

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

  const updateUserRole = async (userId: string, role: string) => {
    if (!orgId) return;
    const { error: updateError } = await supabase
      .from('app_users')
      .update({ role })
      .eq('id', userId)
      .eq('org_id', orgId);
    if (updateError) {
      toast.error(`Unable to update role: ${updateError.message}`);
      return;
    }
    setAppUsers((current) => current.map((user) => (user.id === userId ? { ...user, role } : user)));
    toast.success('User role updated');
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
    <div className="space-y-4">
      <SettingsCard title="User Access" subtitle="Manage workspace roles without leaving Settings.">
        {appUsers.length === 0 ? (
          <p className="text-sm text-text-muted">No application users found for this organization.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            {appUsers.map((appUser) => {
              const employee = storeEmployees.find((item) => item.id === appUser.employee_id);
              const roleClass =
                appUser.role.toLowerCase() === 'admin'
                  ? 'bg-brand-ghost text-brand'
                  : appUser.role.toLowerCase() === 'manager'
                    ? 'bg-status-complete/10 text-status-complete'
                    : 'bg-surface-elevated text-text-muted';
              return (
                <div
                  key={appUser.id}
                  className="grid gap-3 border-b border-surface-border px-4 py-3 last:border-0 hover:bg-surface-hover sm:grid-cols-[1fr_auto_auto_180px] sm:items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown employee'}
                    </p>
                    <p className="text-xs text-text-muted">{employee?.email ?? 'No email available'}</p>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${roleClass}`}>
                    {appUser.role}
                  </span>
                  <span className="w-fit rounded-full bg-status-active/10 px-2.5 py-1 text-xs font-medium text-status-active">
                    {appUser.status}
                  </span>
                  <select
                    className={settingsInputClass}
                    value={appUser.role}
                    onChange={(event) => void updateUserRole(appUser.id, event.target.value)}
                    aria-label={`Change role for ${employee?.first_name ?? 'user'}`}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Field Staff">Field Staff</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Your Account">
        <div className="space-y-2">
          {[
            { label: 'Email', value: userEmail || 'Not available' },
            { label: 'Role', value: userRole ?? 'Not available' },
            { label: 'Employee', value: employeeName || 'Not available' },
            { label: 'Organization', value: organizationName || 'Not available' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 text-text-muted">{label}</span>
              <span className="text-text-primary">{value}</span>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Session Management">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void handleSignOut()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright"
          >
            Sign Out
          </button>
          <button
            onClick={handleClearAppCache}
            className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover"
          >
            Clear App Cache
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Team Invitations" subtitle="Invite managers and crew members by email link.">
        <button
          onClick={() => setShowInviteModal(true)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright"
        >
          <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Invite Team</span>
        </button>
      </SettingsCard>

      <SettingsCard title="Workspace Status">
        <div className="space-y-2 text-sm">
          <p className="text-text-muted"><span className="font-medium text-text-primary">Current workspace:</span> Ground Crew HQ</p>
          <p className="text-text-muted"><span className="font-medium text-text-primary">Plan/status:</span> Active workspace</p>
          <p className="text-text-muted">Billing controls appear when workspace billing is enabled.</p>
        </div>
      </SettingsCard>

      <SettingsCard title="Billing">
        <p className="text-sm text-text-muted">Billing management is currently unavailable in-product.</p>
      </SettingsCard>

      <section className="rounded-xl border border-status-warning/30 bg-surface-elevated p-5">
        <h2 className="mb-2 text-base font-semibold text-status-warning">Danger Zone</h2>
        <p className="text-sm text-status-warning/80">
          To delete your account or change your email, contact support at support@groundcrewhq.com.
        </p>
      </section>

      <SettingsCard title="System">
        <div className="grid gap-1.5 text-sm">
          {[
            ['App Version', APP_VERSION],
            ['Org ID', maskedOrgId],
            ['Properties', String(systemInfo.propertyCount)],
            ['Employees', String(systemInfo.employeeCount)],
            ['Tasks', String(systemInfo.taskCount)],
            ['Schedule entries (this week)', String(systemInfo.scheduleEntriesThisWeek)],
            ['Assignments (today)', String(systemInfo.assignmentsToday)],
            ['Equipment units', String(systemInfo.equipmentUnits)],
            ['Browser', browserInfo],
            ['Supabase project', 'fjqeekwisnbpxgebrnpl'],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="w-44 shrink-0 text-text-muted">{label}</span>
              <span className="truncate text-text-primary">{value}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => void handleCopySystemInfo()}
          className="mt-4 rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover"
        >
          Copy System Info
        </button>
      </SettingsCard>

      {showInviteModal ? (
        <div
          onClick={closeInviteModal}
          className="fixed inset-0 z-60 grid place-items-center bg-surface-base/80 p-4"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="z-70 grid w-full max-w-md gap-4 rounded-xl border border-surface-border bg-surface-card p-5"
          >
            <h3 className="text-base font-semibold text-text-primary">Invite a team member</h3>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Email</span>
              <input className={settingsInputClass} type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@company.com" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Role</span>
              <select className={settingsInputClass} value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'Manager' | 'Field Staff')}>
                <option value="Manager">Manager</option>
                <option value="Field Staff">Field Staff</option>
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={closeInviteModal} className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover">Cancel</button>
              <button onClick={handleSendInvite} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright">Send Invite</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HelpTab() {
  const helpCards = [
    {
      icon: CircleHelp,
      title: 'Documentation',
      description: 'Review setup guidance and operating workflows for every Ground Crew HQ module.',
      action: 'Open docs',
      href: 'https://docs.groundcrewhq.com',
    },
    {
      icon: Mail,
      title: 'Support',
      description: 'Send the support team a concise description of the issue and the affected workspace.',
      action: 'Email support',
      href: 'mailto:support@groundcrewhq.com',
    },
    {
      icon: Wrench,
      title: 'Keyboard Shortcuts',
      description: 'Use Tab to move between controls, Enter to activate actions, and Escape to close panels.',
      action: null,
      href: null,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {helpCards.map(({ icon: Icon, title, description, action, href }) => (
        <section key={title} className="rounded-xl border border-surface-border bg-surface-card p-5">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-ghost text-brand">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <p className="mt-2 text-sm text-text-muted">{description}</p>
          {action && href ? (
            <a className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-bright" href={href}>
              {action}
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function TasksTab({ orgId, propertyId }: { orgId: string | null; propertyId: string | null }) {
  const isHydrated = useAppStore((state) => state.isHydrated);
  const storeEmployees = useAppStore((state) => state.employees);
  const { refetch: refetchTasks } = useTasks(
    propertyId ?? undefined,
    orgId ?? undefined,
  );
  const taskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
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
  const employees = useMemo(
    () =>
      storeEmployees
        .filter((employee) => employee.active)
        .map(({ id, first_name, last_name, status }) => ({ id, first_name, last_name, status }))
        .sort((left, right) => left.last_name.localeCompare(right.last_name)),
    [storeEmployees],
  );
  const [recurringRules, setRecurringRules] = useState<RecurringTaskRule[]>([]);
  const [recurringDrafts, setRecurringDrafts] = useState<Record<string, { enabled: boolean; days: string[]; assignMode: 'all' | 'specific'; employeeId: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('General Maintenance');
  const [newPriority, setNewPriority] = useState<'1' | '2' | '3'>('2');
  const [newEstimatedHours, setNewEstimatedHours] = useState('1');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [editDraft, setEditDraft] = useState({
    name: '',
    category: '',
    priority: 2,
    estimated_hours: 0,
  });
  const [savingRecurringTaskId, setSavingRecurringTaskId] = useState<string | null>(null);
  const signalTaskLibraryUpdate = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ground-crew-task-library-updated-at', String(Date.now()));
  };

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
    const [tasksResult, recurringResult] = await Promise.all([
      refetchTasks(),
      supabase
        .from('recurring_task_rules')
        .select('id, org_id, property_id, task_id, employee_id, days_of_week, active')
        .eq('org_id', orgId)
        .eq('active', true),
    ]);

    if (tasksResult.error || recurringResult.error) {
      setError(tasksResult.error?.message ?? recurringResult.error?.message ?? 'Failed to load task settings');
      setLoading(false);
      return;
    }
    const nextTasks = (tasksResult.data ?? []).map<TaskLibraryItem>((task) => ({
      id: task.id,
      org_id: orgId,
      property_id: propertyId,
      name: task.name,
      category: task.category,
      priority: task.priority ?? null,
      estimated_hours: task.duration / 60,
    }));
    const nextRules = (recurringResult.data as RecurringTaskRule[]) ?? [];
    setTasks(nextTasks);
    setRecurringRules(nextRules);
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
  }, [orgId, propertyId, refetchTasks]);

  useEffect(() => {
    if (!isHydrated) return;
    void fetchTasks();
  }, [fetchTasks, isHydrated]);

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
    setTaskPanelOpen(false);
    signalTaskLibraryUpdate();
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
    signalTaskLibraryUpdate();
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
    setTaskPanelOpen(true);
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditDraft({ name: '', category: '', priority: 2, estimated_hours: 0 });
    setTaskPanelOpen(false);
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
    signalTaskLibraryUpdate();
    toast.success(`Task updated: ${editDraft.name.trim()}`);
    cancelEditTask();
  };

  const handleTaskDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!supabase || !orgId || !over || active.id === over.id) return;
    const oldIndex = tasks.findIndex((task) => task.id === active.id);
    const newIndex = tasks.findIndex((task) => task.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(tasks, oldIndex, newIndex).map((task, index) => ({
      ...task,
      priority: index + 1,
    }));
    setTasks(reordered);
    const results = await Promise.all(
      reordered.map((task) =>
        supabase
          .from('tasks')
          .update({ priority: task.priority })
          .eq('id', task.id)
          .eq('org_id', orgId),
      ),
    );
    const updateError = results.find((result) => result.error)?.error;
    if (updateError) {
      toast.error(`Unable to save task order: ${updateError.message}`);
      await fetchTasks();
      return;
    }
    signalTaskLibraryUpdate();
    toast.success('Task priority order saved');
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
    <div className="space-y-4">
      <SettingsCard
        title="Task Library"
        subtitle="Reusable tasks for daily workflow planning. Drag to reorder priority."
      >
        {!orgId || loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-surface-elevated" />
        ) : error ? (
          <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchTasks()} />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-surface-border">
              {tasks.length === 0 ? (
                <p className="px-4 py-3 text-sm text-text-muted">No tasks yet. Add one below.</p>
              ) : (
                <DndContext sensors={taskSensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
                  <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map((task) => (
                      <SortableTaskRowCompact key={task.id} id={task.id}>
                        <span className="flex-1 truncate pr-1 text-sm font-medium text-text-primary">{task.name}</span>
                        <span className="shrink-0 rounded-full bg-brand-ghost px-2 py-0.5 text-xs text-brand">
                          {task.category ?? 'General'}
                        </span>
                        <span className="shrink-0 text-xs text-text-muted">
                          {Number(task.estimated_hours ?? 0).toFixed(1)}h
                        </span>
                        {recurringDrafts[task.id]?.enabled ? (
                          <span className="shrink-0 rounded-full bg-status-active/10 px-1.5 py-0.5 text-xs text-status-active">Rec</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => startEditTask(task)}
                          className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
                          aria-label={`Edit ${task.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeTask(task.id)}
                          className="mr-2 shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-status-warning/10 hover:text-status-warning"
                          aria-label={`Delete ${task.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </SortableTaskRowCompact>
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-dashed border-surface-border pt-3">
              <input
                className={`${settingsInputClass} min-w-[140px] flex-1`}
                placeholder="New task name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) void addTask(); }}
              />
              <select
                className={`${settingsInputClass} w-44`}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {taskCategoryOptions.map((c) => <option key={`inline-cat-${c}`} value={c}>{c}</option>)}
              </select>
              <input
                type="number"
                step="0.25"
                min="0.25"
                className={`${settingsInputClass} w-20`}
                placeholder="hrs"
                value={newEstimatedHours}
                onChange={(e) => setNewEstimatedHours(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void addTask()}
                disabled={!newName.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </>
        )}
      </SettingsCard>

      <Sheet open={taskPanelOpen} onOpenChange={(open) => (open ? setTaskPanelOpen(true) : cancelEditTask())}>
        <SheetContent className="overflow-y-auto border-surface-border bg-surface-elevated text-text-primary sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-text-primary">{editingTaskId ? 'Edit Task' : 'Add Task'}</SheetTitle>
            <SheetDescription className="text-text-muted">
              {editingTaskId ? 'Update task details and recurring schedule.' : 'Create a reusable task for workboard planning.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Task name</span>
              <input
                className={settingsInputClass}
                placeholder="Task name"
                value={editingTaskId ? editDraft.name : newName}
                onChange={(event) => editingTaskId
                  ? setEditDraft((current) => ({ ...current, name: event.target.value }))
                  : setNewName(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Category</span>
              <select
                className={settingsInputClass}
                value={editingTaskId ? editDraft.category : newCategory}
                onChange={(event) => editingTaskId
                  ? setEditDraft((current) => ({ ...current, category: event.target.value }))
                  : setNewCategory(event.target.value)}
              >
                {taskCategoryOptions.map((category) => (
                  <option key={`new-task-category-${category}`} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Priority</span>
              <select
                className={settingsInputClass}
                value={editingTaskId ? String(editDraft.priority) : newPriority}
                onChange={(event) => editingTaskId
                  ? setEditDraft((current) => ({ ...current, priority: Number(event.target.value) }))
                  : setNewPriority(event.target.value as '1' | '2' | '3')}
              >
                <option value="1">1 (High)</option>
                <option value="2">2 (Med)</option>
                <option value="3">3 (Low)</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Est. hours</span>
              <input
                className={settingsInputClass}
                type="number"
                step="0.25"
                placeholder="Est. hours"
                value={editingTaskId ? String(editDraft.estimated_hours) : newEstimatedHours}
                onChange={(event) => editingTaskId
                  ? setEditDraft((current) => ({ ...current, estimated_hours: Number(event.target.value || '0') }))
                  : setNewEstimatedHours(event.target.value)}
              />
            </label>

            {editingTaskId ? (
              <div className="rounded-xl border border-surface-border bg-surface-base p-4">
                <p className="mb-3 text-sm font-medium text-text-primary">Recurring Schedule</p>
                <label className="flex cursor-pointer items-center gap-3 text-sm text-text-secondary">
                  <Switch
                    checked={Boolean(recurringDrafts[editingTaskId]?.enabled)}
                    onCheckedChange={(checked) => setRecurringEnabled(editingTaskId, checked)}
                  />
                  <span>{recurringDrafts[editingTaskId]?.enabled ? 'Enabled' : 'Disabled'}</span>
                </label>
                {recurringDrafts[editingTaskId]?.enabled ? (
                  <div className="mt-3 grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      {dayOptions.map((day) => (
                        <label key={`${editingTaskId}-${day.key}`} className="flex cursor-pointer items-center gap-1 text-xs text-text-secondary">
                          <input
                            type="checkbox"
                            checked={Boolean(recurringDrafts[editingTaskId]?.days.includes(day.key))}
                            onChange={() => toggleRecurringDay(editingTaskId, day.key)}
                            className="rounded"
                          />
                          {day.label}
                        </label>
                      ))}
                    </div>
                    <select
                      className={settingsInputClass}
                      value={recurringDrafts[editingTaskId]?.assignMode ?? 'all'}
                      onChange={(event) =>
                        setRecurringDrafts((current) => ({
                          ...current,
                          [editingTaskId]: {
                            ...(current[editingTaskId] ?? { enabled: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'], employeeId: '' }),
                            assignMode: event.target.value as 'all' | 'specific',
                          },
                        }))
                      }
                    >
                      <option value="all">All scheduled crew</option>
                      <option value="specific">Specific employee</option>
                    </select>
                    {recurringDrafts[editingTaskId]?.assignMode === 'specific' ? (
                      <select
                        className={settingsInputClass}
                        value={recurringDrafts[editingTaskId]?.employeeId ?? ''}
                        onChange={(event) =>
                          setRecurringDrafts((current) => ({
                            ...current,
                            [editingTaskId]: {
                              ...(current[editingTaskId] ?? { enabled: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'], assignMode: 'specific' }),
                              employeeId: event.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">Select employee</option>
                        {employees.map((employee) => (
                          <option key={`${editingTaskId}-${employee.id}`} value={employee.id}>
                            {employee.first_name} {employee.last_name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      onClick={() => void saveRecurringRule(editingTaskId)}
                      className="w-fit rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-60"
                      disabled={savingRecurringTaskId === editingTaskId}
                    >
                      {savingRecurringTaskId === editingTaskId ? 'Saving...' : 'Apply schedule'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              onClick={() => editingTaskId ? void saveEditTask(editingTaskId) : void addTask()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright"
            >
              {editingTaskId ? 'Save Changes' : 'Save Task'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SchedulerTab({ orgId }: { orgId: string | null }) {
  const isHydrated = useAppStore((state) => state.isHydrated);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
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
    if (!isHydrated) return;
    void fetchSettings();
  }, [fetchSettings, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    void fetchTemplates();
  }, [fetchTemplates, isHydrated]);

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
    if (!supabase || !orgId) return;
    const templateName = templates.find((template) => template.id === templateId)?.name ?? 'template';
    const { error: deleteError } = await supabase
      .from('shift_templates')
      .delete()
      .eq('id', templateId)
      .eq('org_id', orgId);
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

  const handleTemplateDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setTemplates((current) => {
      const oldIndex = current.findIndex((template) => template.id === active.id);
      const newIndex = current.findIndex((template) => template.id === over.id);
      return oldIndex >= 0 && newIndex >= 0 ? arrayMove(current, oldIndex, newIndex) : current;
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="text-base font-semibold text-text-primary">Operational Day</h3>
        <p className="mb-4 mt-1 text-sm text-text-muted">Define the standard operating window and active work days.</p>

        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorRetry message={`Failed to load: ${error}`} onRetry={() => void fetchSettings()} />
        ) : settings ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium uppercase tracking-widest text-text-muted">
                Operations Start
                <input
                  type="time"
                  value={settings.operational_day_start.slice(0, 5)}
                  onChange={(event) => setSettings((cur) => (cur ? { ...cur, operational_day_start: `${event.target.value}:00` } : cur))}
                  className={`${settingsInputClass} mt-1.5`}
                />
              </label>
              <label className="text-xs font-medium uppercase tracking-widest text-text-muted">
                Operations End
                <input
                  type="time"
                  value={settings.operational_day_end.slice(0, 5)}
                  onChange={(event) => setSettings((cur) => (cur ? { ...cur, operational_day_end: `${event.target.value}:00` } : cur))}
                  className={`${settingsInputClass} mt-1.5`}
                />
              </label>
            </div>
            <div className="text-xs text-text-muted">
              Display window: {formatTime(settings.operational_day_start)}–{formatTime(settings.operational_day_end)}
            </div>

            <div>
              <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-text-muted">Active Days</span>
              <div className="flex flex-wrap gap-2">
                {dayOptions.map((day) => {
                  const active = settings.operational_days.includes(day.key);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() =>
                        setSettings((cur) => (cur ? { ...cur, operational_days: toggleDayValue(cur.operational_days ?? [], day.key) } : cur))
                      }
                      className={`min-h-11 min-w-11 rounded-lg border px-3 text-sm font-medium transition-colors ${
                        active
                          ? 'border-brand bg-brand-ghost text-brand'
                          : 'border-surface-border bg-surface-elevated text-text-muted hover:bg-surface-hover hover:text-text-primary'
                      }`}
                      aria-pressed={active}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-xs font-medium uppercase tracking-widest text-text-muted">
                Min Shift Hours
                <input className={`${settingsInputClass} mt-1.5`} type="number" value={settings.min_shift_hours} onChange={(event) => setSettings((cur) => (cur ? { ...cur, min_shift_hours: Number(event.target.value) } : cur))} />
              </label>
              <label className="text-xs font-medium uppercase tracking-widest text-text-muted">
                Max Shift Hours
                <input className={`${settingsInputClass} mt-1.5`} type="number" value={settings.max_shift_hours} onChange={(event) => setSettings((cur) => (cur ? { ...cur, max_shift_hours: Number(event.target.value) } : cur))} />
              </label>
              <label className="text-xs font-medium uppercase tracking-widest text-text-muted">
                Overtime Threshold
                <input className={`${settingsInputClass} mt-1.5`} type="number" value={settings.overtime_threshold_hours} onChange={(event) => setSettings((cur) => (cur ? { ...cur, overtime_threshold_hours: Number(event.target.value) } : cur))} />
              </label>
            </div>

            <button
              onClick={() => void saveSettings()}
              disabled={saving}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-bright disabled:opacity-60"
            >
              {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="text-base font-semibold text-text-primary">Shift Templates</h3>
        <p className="mb-4 mt-1 text-sm text-text-muted">Drag templates to arrange the order shown to schedulers.</p>
        {templatesLoading ? (
          <PageSkeleton />
        ) : templatesError ? (
          <ErrorRetry message={`Failed to load: ${templatesError}`} onRetry={() => void fetchTemplates()} />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTemplateDragEnd}>
            <SortableContext items={templates.map((template) => template.id)} strategy={verticalListSortingStrategy}>
              <div className="overflow-hidden rounded-xl border border-surface-border">
                {templates.map((template) => (
                  <SortableShiftTemplateRow
                    key={template.id}
                    template={template}
                    onDelete={(id) => void deleteTemplate(id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="mt-4 grid gap-3 border-t border-dashed border-surface-border pt-4">
          <p className="text-sm font-medium text-text-primary">Add template</p>
          <input className={settingsInputClass} placeholder="Template name" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className={settingsInputClass} type="time" value={newStart} onChange={(event) => setNewStart(event.target.value)} />
            <input className={settingsInputClass} type="time" value={newEnd} onChange={(event) => setNewEnd(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {dayOptions.map((day) => (
              <label key={`new-${day.key}`} className="flex cursor-pointer items-center gap-1.5 text-sm text-text-secondary">
                <input type="checkbox" checked={newDays.includes(day.key)} onChange={() => setNewDays((cur) => toggleDayValue(cur, day.key))} className="rounded" />
                {day.label}
              </label>
            ))}
          </div>
          <button
            onClick={() => void addTemplate()}
            className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-bright"
          >
            Save template
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-base font-semibold text-text-primary">Alerts</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="Escalation settings help" className="rounded p-0.5 text-text-muted hover:text-text-secondary">
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Set thresholds for weather and equipment alerts on the workboard.</TooltipContent>
          </Tooltip>
        </div>
        <p className="mb-4 mt-1 text-sm text-text-muted">Configure escalation thresholds used by the Workboard escalation center.</p>
        <div className="grid gap-4">
          {[
            { field: 'equipment_service_overdue_days' as const, label: 'Alert when equipment not serviced for X days', min: 1, max: undefined },
            { field: 'shift_coverage_warning_pct' as const, label: 'Warn when crew coverage drops below X%', min: 1, max: 100 },
            { field: 'wind_speed_spray_cutoff_mph' as const, label: 'Flag spray tasks when wind exceeds X mph', min: 1, max: undefined },
            { field: 'rain_probability_spray_cutoff_pct' as const, label: 'Flag spray tasks when rain chance exceeds X%', min: 1, max: 100 },
            { field: 'heat_advisory_temp_f' as const, label: 'Show heat advisory above X°F', min: 1, max: undefined },
          ].map(({ field, label, min, max }) => (
            <label key={field} className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted">{label}</span>
              <input
                className={settingsInputClass}
                type="number"
                min={min}
                max={max}
                value={alertsConfig[field]}
                onChange={(event) => setAlertsConfig((current) => ({ ...current, [field]: Number(event.target.value || '0') }))}
              />
            </label>
          ))}
          <button
            onClick={() => void saveAlertsConfig()}
            className={`w-fit rounded-lg px-4 py-2 text-sm font-medium text-text-inverse transition-colors ${alertsSaved ? 'bg-status-active' : 'bg-brand hover:bg-brand-bright'}`}
          >
            {alertsSaving ? 'Saving...' : alertsSaved ? 'Saved ✓' : 'Save alerts'}
          </button>
        </div>
      </section>
    </div>
  );
}

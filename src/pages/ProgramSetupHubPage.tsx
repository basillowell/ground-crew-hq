import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Clock,
  Cpu,
  FolderTree,
  KeyRound,
  Palette,
  Settings,
  Sparkles,
} from 'lucide-react';
import { ProgramSetupHubPanels } from '@/pages/ProgramSetupHubPanels';
import { toast } from '@/components/ui/sonner';
import type { AppUser, DepartmentOption, Employee, GroupOption, ProgramSettings, Property, PropertyClassOption, ShiftTemplate, WorkLocation } from '@/data/seedData';
import {
  useAppUsers,
  useApplicationAreas,
  useAssignments,
  useDepartmentOptions,
  useEmployees,
  useGroupOptions,
  useJobDescriptions,
  useLanguageOptions,
  useOvertimeRules,
  useProgramSettings,
  useProperties,
  usePropertyClassOptions,
  useRoleOptions,
  useScheduleEntries,
  useShiftTemplates,
  useTasks,
  useWeatherLocations,
  useWorkerTypes,
  useWageCategories,
  useWorkLocations,
  useEmploymentStatuses,
} from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'react-router-dom';

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const themePresets = [
  { id: 'club-emerald', name: 'Club Emerald', primaryColor: '#2f855a', accentColor: '#d7f5e5', sidebarColor: '#203127' },
  { id: 'coastal-blue', name: 'Coastal Blue', primaryColor: '#1d4ed8', accentColor: '#dbeafe', sidebarColor: '#172554' },
  { id: 'heritage-gold', name: 'Heritage Gold', primaryColor: '#b7791f', accentColor: '#fef3c7', sidebarColor: '#3b2f1a' },
  { id: 'fairway-slate', name: 'Fairway Slate', primaryColor: '#0f766e', accentColor: '#ccfbf1', sidebarColor: '#1f2937' },
];
const typographyPresets = [
  { id: 'modern-sans', name: 'Modern Sans' },
  { id: 'editorial-serif', name: 'Editorial Serif' },
  { id: 'classic-club', name: 'Classic Club' },
  { id: 'compact-ops', name: 'Compact Ops' },
];

const DEFAULT_ENABLED_MODULES = [
  'command-center',
  'workboard',
  'scheduler',
  'mobile-field',
  'breakroom',
  'weather',
  'applications',
  'equipment',
  'safety',
  'messaging',
] as const;
const DEFAULT_WEATHER_ENABLED_PANELS = [
  'current-conditions',
  'hourly-forecast',
  'daily-forecast',
  'wind',
  'rain',
  'alerts',
  'turf-risk-notes',
] as const;

const PLAN_LIMITS = { properties: 10, employees: 50, portalUsers: 25 };
const CURRENT_PLAN_NAME = 'Pro';
export type ActivePage =
  | 'brand'
  | 'properties'
  | 'people'
  | 'access'
  | 'operations'
  | 'agentSkills'
  | 'shifts'
  ;

const NAV_GROUPS: { label: string; items: { id: ActivePage; label: string; icon: typeof Settings }[] }[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'brand', label: 'Brand & Identity', icon: Palette },
      { id: 'properties', label: 'Properties & Locations', icon: Building2 },
    ],
  },
  {
    label: 'People',
    items: [
      { id: 'people', label: 'Departments • Groups • Roles • Worker Types', icon: FolderTree },
      { id: 'shifts', label: 'Shift Templates', icon: Clock },
    ],
  },
  {
    label: 'Access',
    items: [{ id: 'access', label: 'Portal Users • Permissions', icon: KeyRound }],
  },
  {
    label: 'Operations',
    items: [{ id: 'operations', label: 'Weather Defaults • Task Groups • Equipment Categories', icon: Cpu }],
  },
  {
    label: 'Agent Skills',
    items: [{ id: 'agentSkills', label: 'Skills References & Prompt Helper', icon: Sparkles }],
  },
];

function makeId(prefix: string) {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugifyClubId(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `club-${slug}` : 'club-1';
}

function withBrandDefaults(settings: ProgramSettings): ProgramSettings {
  return {
    ...settings,
    appName: settings.appName || 'Ground Crew HQ',
    navigationTitle: settings.navigationTitle || settings.appName || settings.organizationName || 'Ground Crew HQ',
    navigationSubtitle: settings.navigationSubtitle || 'Operations platform',
    clientLabel: settings.clientLabel || settings.organizationName || 'Client profile',
    logoInitials: settings.logoInitials || (settings.organizationName || 'WF').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'WF',
    logoUrl: settings.logoUrl || '',
    uiThemePreset: settings.uiThemePreset || 'club-emerald',
    themeNotes: settings.themeNotes || '',
    fontThemePreset: settings.fontThemePreset || 'modern-sans',
    shellImageUrl: settings.shellImageUrl || '',
    primaryColor: settings.primaryColor || '#2f855a',
    accentColor: settings.accentColor || '#d7f5e5',
    sidebarColor: settings.sidebarColor || '#203127',
    enabledModules:
      settings.enabledModules && settings.enabledModules.length > 0 ? settings.enabledModules : [...DEFAULT_ENABLED_MODULES],
    pushNotifications: settings.pushNotifications ?? false,
    weatherDefaultLocationName: settings.weatherDefaultLocationName || 'Sarasota Polo Club',
    weatherDefaultAddress: settings.weatherDefaultAddress || '8201 Polo Club Lane, Sarasota, FL 34240',
    weatherDefaultLatitude: settings.weatherDefaultLatitude ?? 27.316,
    weatherDefaultLongitude: settings.weatherDefaultLongitude ?? -82.402,
    weatherPreferredProvider: settings.weatherPreferredProvider || 'open-meteo',
    weatherEnabledPanels:
      settings.weatherEnabledPanels && settings.weatherEnabledPanels.length > 0
        ? settings.weatherEnabledPanels
        : [...DEFAULT_WEATHER_ENABLED_PANELS],
  };
}

function applyThemePreset(settings: ProgramSettings, presetId: string): ProgramSettings {
  const preset = themePresets.find((entry) => entry.id === presetId);
  if (!preset) return settings;
  return {
    ...settings,
    uiThemePreset: preset.id,
    primaryColor: preset.primaryColor,
    accentColor: preset.accentColor,
    sidebarColor: preset.sidebarColor,
  };
}

function buildDefaultProgramSetting(orgName?: string): ProgramSettings {
  const normalizedOrgName = orgName?.trim() || 'Ground Crew HQ';
  return withBrandDefaults({
    id: makeId('ps'),
    organizationName: normalizedOrgName,
    appName: 'Ground Crew HQ',
    navigationTitle: 'Ground Crew HQ',
    navigationSubtitle: 'Operations platform',
    clientLabel: normalizedOrgName,
    logoInitials: normalizedOrgName.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'WF',
    logoUrl: '',
    uiThemePreset: 'club-emerald',
    themeNotes: '',
    fontThemePreset: 'modern-sans',
    shellImageUrl: '',
    primaryColor: '#2f855a',
    accentColor: '#d7f5e5',
    sidebarColor: '#203127',
    defaultDepartment: 'Maintenance',
    timeZone: 'Eastern Time (ET)',
    fiscalYearStart: 'January',
    enableMobileApp: true,
    overtimeTracking: true,
    equipmentQrCodes: true,
    enabledModules: [...DEFAULT_ENABLED_MODULES],
    pushNotifications: false,
    weatherDefaultLocationName: 'Sarasota Polo Club',
    weatherDefaultAddress: '8201 Polo Club Lane, Sarasota, FL 34240',
    weatherDefaultLatitude: 27.316,
    weatherDefaultLongitude: -82.402,
    weatherPreferredProvider: 'open-meteo',
    weatherEnabledPanels: [...DEFAULT_WEATHER_ENABLED_PANELS],
  });
}

export default function ProgramSetupHubPage() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const todayDate = new Date().toISOString().slice(0, 10);

  const programSettingQuery = useProgramSettings(currentUser?.orgId);
  const programSettingData = programSettingQuery.data ?? null;
  const departmentOptionsQuery = useDepartmentOptions(currentUser?.orgId);
  const departmentOptionsData = departmentOptionsQuery.data ?? [];
  const groupOptionsQuery = useGroupOptions(currentUser?.orgId);
  const groupOptionsData = groupOptionsQuery.data ?? [];
  const roleOptionsQuery = useRoleOptions(currentUser?.orgId);
  const roleOptionsData = roleOptionsQuery.data ?? [];
  const workerTypesQuery = useWorkerTypes(currentUser?.orgId);
  const workerTypesData = workerTypesQuery.data ?? [];
  const jobDescriptionsQuery = useJobDescriptions(currentUser?.orgId);
  const jobDescriptionsData = jobDescriptionsQuery.data ?? [];
  const employmentStatusesQuery = useEmploymentStatuses(currentUser?.orgId);
  const employmentStatusesData = employmentStatusesQuery.data ?? [];
  const wageCategoriesQuery = useWageCategories(currentUser?.orgId);
  const wageCategoriesData = wageCategoriesQuery.data ?? [];
  const overtimeRulesQuery = useOvertimeRules(currentUser?.orgId);
  const overtimeRulesData = overtimeRulesQuery.data ?? [];
  const languageOptionsQuery = useLanguageOptions();
  const languageOptionsData = languageOptionsQuery.data ?? [];
  const propertiesQuery = useProperties(currentUser?.orgId);
  const propertiesData = propertiesQuery.data ?? [];
  const workLocationsQuery = useWorkLocations(undefined, currentUser?.orgId);
  const workLocationsData = workLocationsQuery.data ?? [];
  const shiftTemplatesQuery = useShiftTemplates(currentUser?.orgId);
  const shiftTemplatesData = shiftTemplatesQuery.data ?? [];
  const appUsersQuery = useAppUsers(currentUser?.orgId);
  const appUsersData = appUsersQuery.data ?? [];
  const propertyClassesQuery = usePropertyClassOptions();
  const propertyClassesData = propertyClassesQuery.data ?? [];
  const employeesQuery = useEmployees(undefined, currentUser?.orgId);
  const employeesData = employeesQuery.data ?? [];
  const tasksQuery = useTasks(undefined, currentUser?.orgId);
  const tasksData = tasksQuery.data ?? [];
  const schedulesQuery = useScheduleEntries(todayDate, undefined, currentUser?.orgId);
  const schedulesData = schedulesQuery.data ?? [];
  const assignmentsQuery = useAssignments(todayDate, undefined, currentUser?.orgId);
  const assignmentsData = assignmentsQuery.data ?? [];
  const weatherLocationsQuery = useWeatherLocations();
  const weatherLocationsData = weatherLocationsQuery.data ?? [];
  const applicationAreasQuery = useApplicationAreas();
  const applicationAreasData = applicationAreasQuery.data ?? [];

  const [programSetting, setProgramSetting] = useState<ProgramSettings | null>(null);
  const [activePage, setActivePage] = useState<ActivePage>('brand');
  const [propertySheetId, setPropertySheetId] = useState<string | null>(null);
  const [shiftSheetId, setShiftSheetId] = useState<string | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<{ id: string; name: string }[]>([]);
  const [workerTypes, setWorkerTypes] = useState<{ id: string; name: string }[]>([]);
  const [jobDescriptions, setJobDescriptions] = useState<{ id: string; name: string }[]>([]);
  const [employmentStatuses, setEmploymentStatuses] = useState<{ id: string; name: string }[]>([]);
  const [wageCategories, setWageCategories] = useState<{ id: string; name: string }[]>([]);
  const [overtimeRules, setOvertimeRules] = useState<{ id: string; name: string }[]>([]);
  const [languageOptions, setLanguageOptions] = useState<{ id: string; name: string }[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyClasses, setPropertyClasses] = useState<PropertyClassOption[]>([]);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    const section = searchParams.get('section');
    if (section === 'properties') setActivePage('properties');
    if (section === 'people') setActivePage('people');
    if (section === 'access') setActivePage('access');
    if (section === 'operations') setActivePage('operations');
    if (section === 'skills') setActivePage('agentSkills');
  }, [searchParams]);

  useEffect(() => {
    if (programSetting || programSettingQuery.isLoading) return;
    if (programSettingData) {
      setProgramSetting(withBrandDefaults(programSettingData));
      return;
    }
    setProgramSetting(buildDefaultProgramSetting(currentUser?.email));
  }, [currentUser?.email, programSetting, programSettingData, programSettingQuery.isLoading]);

  useEffect(() => setDepartmentOptions(departmentOptionsData), [departmentOptionsData]);
  useEffect(() => setGroupOptions(groupOptionsData), [groupOptionsData]);
  useEffect(() => setRoleOptions(roleOptionsData), [roleOptionsData]);
  useEffect(() => setWorkerTypes(workerTypesData), [workerTypesData]);
  useEffect(() => setJobDescriptions(jobDescriptionsData), [jobDescriptionsData]);
  useEffect(() => setEmploymentStatuses(employmentStatusesData), [employmentStatusesData]);
  useEffect(() => setWageCategories(wageCategoriesData), [wageCategoriesData]);
  useEffect(() => setOvertimeRules(overtimeRulesData), [overtimeRulesData]);
  useEffect(() => setLanguageOptions(languageOptionsData), [languageOptionsData]);
  useEffect(() => setProperties(propertiesData), [propertiesData]);
  useEffect(() => setPropertyClasses(propertyClassesData), [propertyClassesData]);
  useEffect(() => setWorkLocations(workLocationsData), [workLocationsData]);
  useEffect(() => setShiftTemplates(shiftTemplatesData), [shiftTemplatesData]);
  useEffect(() => setAppUsers(appUsersData), [appUsersData]);
  useEffect(() => setEmployees(employeesData), [employeesData]);

  const liveCounts = useMemo(() => {
    return {
      employees: employees.length,
      activeEmployees: employees.filter((employee) => employee.status === 'active').length,
      appUsers: appUsers.length,
      activeAppUsers: appUsers.filter((entry) => entry.status === 'active').length,
      tasks: tasksData.length,
      activeTasks: tasksData.filter((task) => (task.status ?? 'active') === 'active').length,
      schedules: schedulesData.length,
      assignments: assignmentsData.length,
      weatherAreas: weatherLocationsData.length,
      applicationAreas: applicationAreasData.length,
      properties: properties.length,
      propertyClasses: propertyClasses.length,
    };
  }, [appUsers, assignmentsData, applicationAreasData, employees, properties, propertyClasses, schedulesData, tasksData, weatherLocationsData]);

  const navGroups = useMemo(() => {
    if (currentUser?.role === 'admin') return NAV_GROUPS;
    return NAV_GROUPS.filter((group) => group.label !== 'Agent Skills');
  }, [currentUser?.role]);

  useEffect(() => {
    if (activePage !== 'agentSkills') return;
    if (currentUser?.role === 'admin') return;
    setActivePage('brand');
  }, [activePage, currentUser?.role]);

  async function saveGeneralSettings() {
    if (!programSetting) return;
    const nextSetting = withBrandDefaults(programSetting);
    const nextClubLabel = nextSetting.clientLabel || nextSetting.organizationName || 'Client profile';
    const nextClubId = slugifyClubId(nextClubLabel);
    const nextUsers = appUsers.map((user) => ({
      ...user,
      clubId: nextClubId,
      clubLabel: nextClubLabel,
    }));
    setProgramSetting(nextSetting);
    setAppUsers(nextUsers);
    await supabase.from('program_settings').upsert({
      ...nextSetting,
      org_id: currentUser?.orgId,
    });
    for (const user of nextUsers) {
      await supabase.from('app_users').upsert({
        ...user,
        org_id: currentUser?.orgId,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['program-settings'] });
    await queryClient.invalidateQueries({ queryKey: ['app-users'] });
    toast('Program setup saved', {
      description: `${nextSetting.organizationName} now drives the active club and brand profile.`,
    });
  }

  async function saveStructures() {
    for (const dept of departmentOptions) {
      await supabase.from('departments').upsert({
        id: dept.id,
        name: dept.name,
        org_id: currentUser?.orgId,
        active: true,
      });
    }
    for (const group of groupOptions) {
      await supabase.from('employee_groups').upsert({
        id: group.id,
        name: group.name,
        org_id: currentUser?.orgId,
        active: true,
      });
    }
    for (const role of roleOptions) {
      await supabase.from('workforce_roles').upsert({
        ...role,
        org_id: currentUser?.orgId,
        active: true,
      });
    }
    for (const workerType of workerTypes) {
      await supabase.from('worker_types').upsert({
        ...workerType,
        org_id: currentUser?.orgId,
        active: true,
      });
    }
    for (const jobDescription of jobDescriptions) {
      await supabase.from('job_descriptions').upsert({
        ...jobDescription,
        org_id: currentUser?.orgId,
        active: true,
      });
    }
    for (const employmentStatus of employmentStatuses) {
      await supabase.from('employment_statuses').upsert({
        ...employmentStatus,
        org_id: currentUser?.orgId,
        active: true,
      });
    }
    for (const wageCategory of wageCategories) {
      await supabase.from('wage_categories').upsert({
        ...wageCategory,
        org_id: currentUser?.orgId,
        active: true,
      });
    }
    for (const overtimeRule of overtimeRules) {
      await supabase.from('overtime_rules').upsert({
        ...overtimeRule,
        org_id: currentUser?.orgId,
        active: true,
      });
    }
    for (const lang of languageOptions) {
      await supabase.from('language_options').upsert({
        ...lang,
        org_id: currentUser?.orgId,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['department-options'] });
    await queryClient.invalidateQueries({ queryKey: ['group-options'] });
    await queryClient.invalidateQueries({ queryKey: ['role-options'] });
    await queryClient.invalidateQueries({ queryKey: ['worker-types'] });
    await queryClient.invalidateQueries({ queryKey: ['job-descriptions'] });
    await queryClient.invalidateQueries({ queryKey: ['employment-statuses'] });
    await queryClient.invalidateQueries({ queryKey: ['wage-categories'] });
    await queryClient.invalidateQueries({ queryKey: ['overtime-rules'] });
    await queryClient.invalidateQueries({ queryKey: ['language-options'] });
    toast('Workforce structure saved', {
      description: 'Workforce framework is now aligned across Employees, Scheduler, Workboard, and Reports.',
    });
  }

  async function saveLocations() {
    for (const loc of workLocations) {
      await supabase.from('work_locations').upsert({
        ...loc,
        org_id: currentUser?.orgId,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['work-locations'] });
    toast('Locations saved', {
      description: `${workLocations.length} operational locations now feed routing, weather, and application setup.`,
    });
  }

  async function savePropertiesTab() {
    try {
      for (const prop of properties) {
        await supabase.from('properties').upsert({
          id: prop.id,
          org_id: currentUser?.orgId,
          name: prop.name,
          short_name: prop.shortName ?? prop.name,
          logo_initials: prop.logoInitials ?? 'WF',
          color: prop.color ?? '#2f855a',
          city: prop.city ?? '',
          state: prop.state ?? '',
          latitude: prop.latitude ?? null,
          longitude: prop.longitude ?? null,
          acreage: prop.acreage ?? 0,
          status: prop.status ?? 'active',
        });
      }
      for (const employee of employees) {
        await supabase.from('employees').upsert({
          id: employee.id,
          org_id: currentUser?.orgId,
          property_id: employee.propertyId,
          first_name: employee.firstName,
          last_name: employee.lastName,
          role: employee.role,
          department: employee.department,
          status: employee.status,
          phone: employee.phone || null,
          email: employee.email || null,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast('Properties saved', {
        description: `${properties.length} properties and ${employees.length} employee property assignments are now aligned across the app.`,
      });
    } catch {
      toast('Could not save properties', {
        description: 'Please verify your schema is current and try again.',
      });
    }
  }

  async function savePropertyClassesTab() {
    try {
      for (const propertyClass of propertyClasses) {
        await supabase.from('property_class_options').upsert({
          id: propertyClass.id,
          name: propertyClass.name,
          description: propertyClass.description ?? null,
          enabledModules: propertyClass.enabledModules ?? [],
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['property-class-options'] });
      toast('Property classes saved', {
        description: `${propertyClasses.length} master property classes now control which modules each club is set up to use.`,
      });
    } catch {
      toast('Could not save property classes', {
        description: 'Please verify your schema is current and try again.',
      });
    }
  }

  async function saveShiftPlans() {
    for (const shift of shiftTemplates) {
      await supabase.from('shift_templates').upsert({
        id: shift.id,
        name: shift.name,
        start_time: shift.start,
        end_time: shift.end,
        start: shift.start,
        end: shift.end,
        days: shift.days,
        active: true,
        org_id: currentUser?.orgId,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['shift-templates'] });
    toast('Shift templates saved', {
      description: `${shiftTemplates.length} reusable shift plans are ready for scheduling.`,
    });
  }

  async function savePortalUsers() {
    if (!programSetting) return;
    const nextClubLabel = programSetting.clientLabel || programSetting.organizationName || 'Client profile';
    const nextClubId = slugifyClubId(nextClubLabel);
    const nextUsers = appUsers.map((user) => ({
      ...user,
      fullName: user.fullName.trim() || 'New User',
      email: user.email.trim(),
      title: user.title.trim() || 'Team Member',
      department: user.department || programSetting.defaultDepartment || departmentOptions[0]?.name || 'Maintenance',
      avatarInitials:
        user.avatarInitials.trim().toUpperCase().slice(0, 3) ||
        user.fullName
          .split(' ')
          .map((part) => part[0] || '')
          .join('')
          .slice(0, 2)
          .toUpperCase() ||
        'WF',
      clubId: nextClubId,
      clubLabel: nextClubLabel,
    }));
    setAppUsers(nextUsers);
    for (const user of nextUsers) {
      await supabase.from('app_users').upsert({
        ...user,
        org_id: currentUser?.orgId,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['app-users'] });
    toast('Portal users saved', {
      description: `${nextUsers.length} client portal profiles are now available from launch and the top bar.`,
    });
  }

  function handleLogoUpload(file?: File | null) {
    if (!file || !programSetting) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setProgramSetting((current) => (current ? { ...current, logoUrl: result } : current));
      toast('Logo uploaded', {
        description: 'The uploaded logo is now attached to this client profile and will save with Program Setup.',
      });
    };
    reader.readAsDataURL(file);
  }

  function toggleEnabledModule(moduleId: string, enabled: boolean) {
    setProgramSetting((current) => {
      if (!current) return current;
      const set = new Set(current.enabledModules ?? [...DEFAULT_ENABLED_MODULES]);
      if (enabled) set.add(moduleId);
      else set.delete(moduleId);
      return { ...current, enabledModules: [...set] };
    });
  }

  function moduleEnabled(id: string) {
    return (programSetting?.enabledModules ?? [...DEFAULT_ENABLED_MODULES]).includes(id);
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Define your facility framework here. These options power Employees, Scheduler, Workboard, Equipment, Weather, and Reports.
            </p>
          </div>
          <Badge variant="secondary" className="h-fit">
            {programSetting?.organizationName ?? 'Club profile'}
          </Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Properties</div>
            <div className="mt-1 text-lg font-semibold">{liveCounts.properties}</div>
          </div>
          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Portal Users</div>
            <div className="mt-1 text-lg font-semibold">{liveCounts.activeAppUsers}</div>
          </div>
          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Active Crew</div>
            <div className="mt-1 text-lg font-semibold">{liveCounts.activeEmployees}</div>
          </div>
        </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Admin Control Center</Badge>
      </div>
      </div>
      <ProgramSetupHubPanels
        activePage={activePage}
        setActivePage={setActivePage}
        propertySheetId={propertySheetId}
        setPropertySheetId={setPropertySheetId}
        shiftSheetId={shiftSheetId}
        setShiftSheetId={setShiftSheetId}
        programSetting={programSetting}
        setProgramSetting={setProgramSetting}
        departmentOptions={departmentOptions}
        setDepartmentOptions={setDepartmentOptions}
        groupOptions={groupOptions}
        setGroupOptions={setGroupOptions}
        roleOptions={roleOptions}
        setRoleOptions={setRoleOptions}
        workerTypes={workerTypes}
        setWorkerTypes={setWorkerTypes}
        jobDescriptions={jobDescriptions}
        setJobDescriptions={setJobDescriptions}
        employmentStatuses={employmentStatuses}
        setEmploymentStatuses={setEmploymentStatuses}
        wageCategories={wageCategories}
        setWageCategories={setWageCategories}
        overtimeRules={overtimeRules}
        setOvertimeRules={setOvertimeRules}
        languageOptions={languageOptions}
        setLanguageOptions={setLanguageOptions}
        properties={properties}
        setProperties={setProperties}
        propertyClasses={propertyClasses}
        setPropertyClasses={setPropertyClasses}
        workLocations={workLocations}
        setWorkLocations={setWorkLocations}
        shiftTemplates={shiftTemplates}
        setShiftTemplates={setShiftTemplates}
        appUsers={appUsers}
        setAppUsers={setAppUsers}
        employees={employees}
        setEmployees={setEmployees}
        weatherLocations={weatherLocationsData}
        liveCounts={{
          employees: liveCounts.employees,
          activeAppUsers: liveCounts.activeAppUsers,
          properties: liveCounts.properties,
        }}
        saveGeneralSettings={saveGeneralSettings}
        saveStructures={saveStructures}
        saveLocations={saveLocations}
        savePropertiesTab={savePropertiesTab}
        savePropertyClassesTab={savePropertyClassesTab}
        saveShiftPlans={saveShiftPlans}
        savePortalUsers={savePortalUsers}
        handleLogoUpload={handleLogoUpload}
        toggleEnabledModule={toggleEnabledModule}
        moduleEnabled={moduleEnabled}
        themePresets={themePresets}
        typographyPresets={typographyPresets}
        weekDays={weekDays}
        makeId={makeId}
        applyThemePreset={applyThemePreset}
        slugifyClubId={slugifyClubId}
        navGroups={navGroups}
        planLimits={PLAN_LIMITS}
        currentPlanName={CURRENT_PLAN_NAME}
      />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Building2,
  Clock,
  CreditCard,
  GitBranch,
  ListChecks,
  MapPin,
  Palette,
  Plug,
  Puzzle,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  UsersRound,
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
  useLanguageOptions,
  useProgramSettings,
  useProperties,
  usePropertyClassOptions,
  useRoleOptions,
  useScheduleEntries,
  useShiftTemplates,
  useTasks,
  useWeatherLocations,
  useWorkLocations,
} from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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

const PLAN_LIMITS = { properties: 10, employees: 50, portalUsers: 25 };
const CURRENT_PLAN_NAME = 'Pro';

export type ActivePage =
  | 'brand'
  | 'modules'
  | 'properties'
  | 'users'
  | 'workforce'
  | 'shifts'
  | 'billing'
  | 'integrations';

const NAV_GROUPS: { label: string; items: { id: ActivePage; label: string; icon: typeof Settings }[] }[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'brand', label: 'Brand & Identity', icon: Palette },
      { id: 'modules', label: 'Modules & Features', icon: Puzzle },
      { id: 'properties', label: 'Properties', icon: Building2 },
    ],
  },
  {
    label: 'People',
    items: [
      { id: 'users', label: 'Users & Access', icon: UsersRound },
      { id: 'workforce', label: 'Workforce Structure', icon: UserCog },
      { id: 'shifts', label: 'Shift Templates', icon: Clock },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
      { id: 'integrations', label: 'Integrations', icon: Plug },
    ],
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
    appName: settings.appName || 'WorkForce App',
    navigationTitle: settings.navigationTitle || settings.appName || settings.organizationName || 'WorkForce App',
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

function FlowCard({
  title,
  description,
  metric,
  accent,
}: {
  title: string;
  description: string;
  metric: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border bg-card/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="whitespace-nowrap">
          {metric}
        </Badge>
      </div>
      <div className="mt-4 h-2 rounded-full" style={{ background: accent }} />
    </div>
  );
}

export default function ProgramSetupHubPage() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const todayDate = new Date().toISOString().slice(0, 10);

  const programSettingQuery = useProgramSettings(currentUser?.orgId);
  const programSettingData = programSettingQuery.data ?? null;
  const departmentOptionsQuery = useDepartmentOptions();
  const departmentOptionsData = departmentOptionsQuery.data ?? [];
  const groupOptionsQuery = useGroupOptions();
  const groupOptionsData = groupOptionsQuery.data ?? [];
  const roleOptionsQuery = useRoleOptions();
  const roleOptionsData = roleOptionsQuery.data ?? [];
  const languageOptionsQuery = useLanguageOptions();
  const languageOptionsData = languageOptionsQuery.data ?? [];
  const propertiesQuery = useProperties(currentUser?.orgId);
  const propertiesData = propertiesQuery.data ?? [];
  const workLocationsQuery = useWorkLocations();
  const workLocationsData = workLocationsQuery.data ?? [];
  const shiftTemplatesQuery = useShiftTemplates();
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
  const [languageOptions, setLanguageOptions] = useState<{ id: string; name: string }[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyClasses, setPropertyClasses] = useState<PropertyClassOption[]>([]);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    if (programSettingData && !programSetting) {
      setProgramSetting(withBrandDefaults(programSettingData));
    }
  }, [programSettingData, programSetting]);

  useEffect(() => setDepartmentOptions(departmentOptionsData), [departmentOptionsData]);
  useEffect(() => setGroupOptions(groupOptionsData), [groupOptionsData]);
  useEffect(() => setRoleOptions(roleOptionsData), [roleOptionsData]);
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

  const overviewStats = [
    {
      label: 'Active Crew',
      value: liveCounts.activeEmployees,
      helper: 'Employees available for scheduling and workflow assignment.',
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: 'Active Tasks',
      value: liveCounts.activeTasks,
      helper: 'Operational tasks currently feeding daily assignment.',
      icon: <ListChecks className="h-5 w-5" />,
    },
    {
      label: 'Locations',
      value: workLocations.length,
      helper: 'Work areas that roll into weather, applications, and planning.',
      icon: <MapPin className="h-5 w-5" />,
    },
    {
      label: 'Shift Templates',
      value: shiftTemplates.length,
      helper: 'Reusable labor templates the scheduler can build from.',
      icon: <Clock className="h-5 w-5" />,
    },
    {
      label: 'Portal Users',
      value: liveCounts.activeAppUsers,
      helper: 'Client admins, managers, and supervisors who can enter this workspace.',
      icon: <ShieldCheck className="h-5 w-5" />,
    },
    {
      label: 'Property Classes',
      value: liveCounts.propertyClasses,
      helper: 'Reusable property blueprints that define which modules and workflows each site uses.',
      icon: <Building2 className="h-5 w-5" />,
    },
  ];

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
      await supabase.from('department_options').upsert({
        ...dept,
        org_id: currentUser?.orgId,
      });
    }
    for (const group of groupOptions) {
      await supabase.from('group_options').upsert({
        ...group,
        org_id: currentUser?.orgId,
      });
    }
    for (const role of roleOptions) {
      await supabase.from('role_options').upsert({
        ...role,
        org_id: currentUser?.orgId,
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
    await queryClient.invalidateQueries({ queryKey: ['language-options'] });
    toast('Workforce structure saved', {
      description: 'Departments, crew groups, roles, and languages are now aligned across the app.',
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
        ...shift,
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
              Configure your CrewHQ workspace branding, people structure, properties, and account controls.
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
      </div>
      {/*

        
            metric={`${groupOptions.length} groups • ${roleOptions.length} roles`}
          />
          <FlowCard
            title="Locations + Weather"
            description="Locations become weather areas, application areas, and routing anchors for the whole property."
            metric={`${liveCounts.weatherAreas} weather areas`}
            accent="linear-gradient(90deg, rgba(6,182,212,0.65), rgba(6,182,212,0.15))"
          />
          <FlowCard
            title="Scheduling"
            description="Shift templates reduce repetitive setup and keep the scheduler aligned with each club’s labor patterns."
            metric={`${liveCounts.schedules} live shifts`}
            accent="linear-gradient(90deg, rgba(124,58,237,0.65), rgba(124,58,237,0.15))"
          />
        </div>
      </Card>

      */}
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
        navGroups={NAV_GROUPS}
        planLimits={PLAN_LIMITS}
        currentPlanName={CURRENT_PLAN_NAME}
      />
    </div>
  );
}

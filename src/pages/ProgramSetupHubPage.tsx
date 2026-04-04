import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared';
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
  loadLanguageOptions,
  loadApplicationAreas,
  loadAppUsers,
  loadAssignments,
  loadDepartmentOptions,
  loadEmployees,
  loadGroupOptions,
  loadProperties,
  loadPropertyClassOptions,
  loadProgramSettings,
  loadRoleOptions,
  loadScheduleEntries,
  loadShiftTemplates,
  loadTasks,
  loadWeatherLocations,
  loadWorkLocations,
  saveAppUsers,
  saveLanguageOptions,
  saveDepartmentOptions,
  saveEmployees,
  saveGroupOptions,
  saveProperties,
  savePropertyClassOptions,
  saveProgramSettings,
  saveRoleOptions,
  saveShiftTemplates,
  saveWorkLocations,
} from '@/lib/dataStore';

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

function announceProgramSetupUpdate() {
  window.dispatchEvent(new CustomEvent('program-setup-updated'));
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
        <Badge variant="outline" className="whitespace-nowrap">{metric}</Badge>
      </div>
      <div className="mt-4 h-2 rounded-full" style={{ background: accent }} />
    </div>
  );
}

export default function ProgramSetupHubPage() {
  const [activePage, setActivePage] = useState<ActivePage>('brand');
  const [propertySheetId, setPropertySheetId] = useState<string | null>(null);
  const [shiftSheetId, setShiftSheetId] = useState<string | null>(null);
  const [programSetting, setProgramSetting] = useState<ProgramSettings | null>(null);
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
    const loadedSettings = loadProgramSettings()[0];
    setProgramSetting(loadedSettings ? withBrandDefaults(loadedSettings) : null);
    setDepartmentOptions(loadDepartmentOptions());
    setGroupOptions(loadGroupOptions());
    setRoleOptions(loadRoleOptions());
    setLanguageOptions(loadLanguageOptions());
    setProperties(loadProperties());
    setPropertyClasses(loadPropertyClassOptions());
    setWorkLocations(loadWorkLocations());
    setShiftTemplates(loadShiftTemplates());
    setAppUsers(loadAppUsers());
    setEmployees(loadEmployees());
  }, []);

  const liveCounts = useMemo(() => {
    const tasks = loadTasks();
    const schedules = loadScheduleEntries();
    const assignments = loadAssignments();
    const weatherAreas = loadWeatherLocations();
    const applicationAreas = loadApplicationAreas();

    return {
      employees: employees.length,
      activeEmployees: employees.filter((employee) => employee.status === 'active').length,
      appUsers: appUsers.length,
      activeAppUsers: appUsers.filter((entry) => entry.status === 'active').length,
      tasks: tasks.length,
      activeTasks: tasks.filter((task) => (task.status ?? 'active') === 'active').length,
      schedules: schedules.length,
      assignments: assignments.length,
      weatherAreas: weatherAreas.length,
      applicationAreas: applicationAreas.length,
      properties: properties.length,
      propertyClasses: propertyClasses.length,
    };
  }, [appUsers, employees, properties, propertyClasses]);

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

  function saveGeneralSettings() {
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
    saveProgramSettings([nextSetting]);
    saveAppUsers(nextUsers);
    announceProgramSetupUpdate();
    toast('Program setup saved', {
      description: `${nextSetting.organizationName} now drives the active club and brand profile.`,
    });
  }

  function saveStructures() {
    saveDepartmentOptions(departmentOptions);
    saveGroupOptions(groupOptions);
    saveRoleOptions(roleOptions);
    saveLanguageOptions(languageOptions);
    announceProgramSetupUpdate();
    toast('Workforce structure saved', {
      description: 'Departments, crew groups, roles, and languages are now aligned across the app.',
    });
  }

  function saveLocations() {
    saveWorkLocations(workLocations);
    toast('Locations saved', {
      description: `${workLocations.length} operational locations now feed routing, weather, and application setup.`,
    });
  }

  function savePropertiesTab() {
    saveProperties(properties);
    saveEmployees(employees);
    announceProgramSetupUpdate();
    toast('Properties saved', {
      description: `${properties.length} properties and ${employees.length} employee property assignments are now aligned across the app.`,
    });
  }

  function savePropertyClassesTab() {
    savePropertyClassOptions(propertyClasses);
    announceProgramSetupUpdate();
    toast('Property classes saved', {
      description: `${propertyClasses.length} master property classes now control which modules each club is set up to use.`,
    });
  }

  function saveShiftPlans() {
    saveShiftTemplates(shiftTemplates);
    toast('Shift templates saved', {
      description: `${shiftTemplates.length} reusable shift plans are ready for scheduling.`,
    });
  }

  function savePortalUsers() {
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
    saveAppUsers(nextUsers);
    announceProgramSetupUpdate();
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
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      <PageHeader
        title="Program Setup"
        subtitle="Set up the client brand, workforce structure, properties, and labor patterns that feed the rest of the platform."
        badge={<Badge variant="secondary">{programSetting?.organizationName ?? 'Club profile'}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewStats.slice(0, 4).map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</div>
                <div className="mt-2 text-3xl font-semibold">{stat.value}</div>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-3 text-primary">{stat.icon}</div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{stat.helper}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">How Program Setup Feeds the System</h3>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <FlowCard
            title="Club Profile"
            description="Sets the organization identity, default department, and operational rules used across the shell."
            metric={`${departmentOptions.length} departments`}
            accent="linear-gradient(90deg, rgba(22,163,74,0.65), rgba(34,197,94,0.15))"
          />
          <FlowCard
            title="Employees + Groups"
            description="Crew groups, roles, and languages shape the employee roster, reporting, and assignment context."
            metric={`${groupOptions.length} groups • ${roleOptions.length} roles`}
            accent="linear-gradient(90deg, rgba(59,130,246,0.65), rgba(59,130,246,0.15))"
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

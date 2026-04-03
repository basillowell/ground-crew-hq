import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared';
import {
  Building2,
  Clock,
  GitBranch,
  GripVertical,
  ListChecks,
  MapPin,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  Waves,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { AppUser, DepartmentOption, GroupOption, ProgramSettings, Property, PropertyClassOption, ShiftTemplate, WorkLocation } from '@/data/seedData';
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

function StatCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number | string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-semibold">{value}</div>
        </div>
        <div className="rounded-2xl border bg-muted/30 p-3 text-primary">{icon}</div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{helper}</p>
    </Card>
  );
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
  }, []);

  const liveCounts = useMemo(() => {
    const employees = loadEmployees();
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
  }, [appUsers, departmentOptions, groupOptions, properties, propertyClasses, shiftTemplates, workLocations, programSetting]);

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
    announceProgramSetupUpdate();
    toast('Properties saved', {
      description: `${properties.length} properties now feed Command Center and property-specific workflow routing.`,
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

  function handleShellImageUpload(file?: File | null) {
    if (!file || !programSetting) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setProgramSetting((current) => (current ? { ...current, shellImageUrl: result } : current));
      toast('Shell image uploaded', {
        description: 'The client shell background is now attached to this profile and will save with Program Setup.',
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <PageHeader
        title="Program Setup"
        subtitle="Build the club profile, workforce structure, locations, and reusable labor patterns that power the rest of the platform."
        badge={<Badge variant="secondary">{programSetting?.organizationName ?? 'Club profile'}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Active Crew"
          value={liveCounts.activeEmployees}
          helper="Employees available for scheduling and workflow assignment."
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Active Tasks"
          value={liveCounts.activeTasks}
          helper="Operational tasks currently feeding daily assignment."
          icon={<ListChecks className="h-5 w-5" />}
        />
        <StatCard
          label="Locations"
          value={workLocations.length}
          helper="Work areas that roll into weather, applications, and planning."
          icon={<MapPin className="h-5 w-5" />}
        />
        <StatCard
          label="Shift Templates"
          value={shiftTemplates.length}
          helper="Reusable labor templates the scheduler can build from."
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="Portal Users"
          value={liveCounts.activeAppUsers}
          helper="Client admins, managers, and supervisors who can enter this workspace."
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Property Classes"
          value={liveCounts.propertyClasses}
          helper="Reusable property blueprints that define which modules and workflows each site uses."
          icon={<Building2 className="h-5 w-5" />}
        />
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

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 h-auto flex-wrap gap-2 bg-transparent p-0">
          <TabsTrigger value="overview" className="text-xs gap-1 border bg-card px-3 py-2"><Building2 className="h-3 w-3" /> Overview</TabsTrigger>
          <TabsTrigger value="general" className="text-xs gap-1 border bg-card px-3 py-2"><Settings className="h-3 w-3" /> Brand + Club Profile</TabsTrigger>
          <TabsTrigger value="structure" className="text-xs gap-1 border bg-card px-3 py-2"><Users className="h-3 w-3" /> Workforce Structure</TabsTrigger>
          <TabsTrigger value="users" className="text-xs gap-1 border bg-card px-3 py-2"><ShieldCheck className="h-3 w-3" /> Users + Access</TabsTrigger>
          <TabsTrigger value="property-classes" className="text-xs gap-1 border bg-card px-3 py-2"><Waves className="h-3 w-3" /> Property Classes</TabsTrigger>
          <TabsTrigger value="properties" className="text-xs gap-1 border bg-card px-3 py-2"><Building2 className="h-3 w-3" /> Properties</TabsTrigger>
          <TabsTrigger value="locations" className="text-xs gap-1 border bg-card px-3 py-2"><MapPin className="h-3 w-3" /> Locations</TabsTrigger>
          <TabsTrigger value="shifts" className="text-xs gap-1 border bg-card px-3 py-2"><Clock className="h-3 w-3" /> Shift Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card className="p-6">
              <h3 className="font-semibold">What This Page Controls</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4 text-primary" /> Employee Management</div>
                  <p className="mt-2 text-sm text-muted-foreground">Departments and crew groups created here feed the roster structure and cleaner filtering on the employee page.</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium"><ListChecks className="h-4 w-4 text-primary" /> Task Management</div>
                  <p className="mt-2 text-sm text-muted-foreground">Tasks stay in their own module, but the setup hub shows the live catalog count so you know when operations data is healthy.</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium"><Waves className="h-4 w-4 text-primary" /> Weather + Applications</div>
                  <p className="mt-2 text-sm text-muted-foreground">Locations defined here become anchors for weather areas and chemical application zones.</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4 text-primary" /> Scheduler + Workflow</div>
                  <p className="mt-2 text-sm text-muted-foreground">Shift templates and default department choices reduce repetitive setup and keep labor planning consistent.</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold">Live Operational Snapshot</h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Assignments in Workflow</div>
                  <div className="mt-2 text-3xl font-semibold">{liveCounts.assignments}</div>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Application Areas</div>
                  <div className="mt-2 text-3xl font-semibold">{liveCounts.applicationAreas}</div>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total Employees</div>
                  <div className="mt-2 text-3xl font-semibold">{liveCounts.employees}</div>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Portal Users</div>
                  <div className="mt-2 text-3xl font-semibold">{liveCounts.activeAppUsers}</div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="general">
          <Card className="p-6 space-y-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="font-semibold">Brand System</div>
              <p className="mt-1 text-sm text-muted-foreground">
                These values now drive the browser title, sidebar identity, top-bar client label, and the global UI color direction for each club or client.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="text-sm font-medium">Organization Name</label>
                <Input
                  value={programSetting?.organizationName ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, organizationName: event.target.value } : current)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Client App Name</label>
                <Input
                  value={programSetting?.appName ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, appName: event.target.value } : current)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">Use the product name each club should see in the browser tab and shell.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Client / Club Label</label>
                <Input
                  value={programSetting?.clientLabel ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, clientLabel: event.target.value } : current)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Navigation Title</label>
                <Input
                  value={programSetting?.navigationTitle ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, navigationTitle: event.target.value } : current)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Navigation Subtitle</label>
                <Input
                  value={programSetting?.navigationSubtitle ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, navigationSubtitle: event.target.value } : current)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="text-sm font-medium">UI Theme Scheme</label>
                <select
                  value={programSetting?.uiThemePreset ?? 'club-emerald'}
                  onChange={(event) =>
                    setProgramSetting((current) =>
                      current ? applyThemePreset(current, event.target.value) : current,
                    )
                  }
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {themePresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">Choose a fast client theme, then fine-tune colors if needed.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Typography Scheme</label>
                <select
                  value={programSetting?.fontThemePreset ?? 'modern-sans'}
                  onChange={(event) =>
                    setProgramSetting((current) =>
                      current ? { ...current, fontThemePreset: event.target.value } : current,
                    )
                  }
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {typographyPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">Choose how headings and body text should feel across the app shell.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Logo Initials</label>
                <Input
                  value={programSetting?.logoInitials ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, logoInitials: event.target.value.toUpperCase().slice(0, 3) } : current)}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2 xl:col-span-2">
                <label className="text-sm font-medium">Logo Image URL</label>
                <Input
                  value={programSetting?.logoUrl ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, logoUrl: event.target.value } : current)}
                  placeholder="https://your-club.com/logo.png"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use a square PNG or SVG URL. If blank, the app falls back to logo initials.
                </p>
              </div>
              <div className="xl:col-span-2">
                <label className="text-sm font-medium">Upload Logo File</label>
                <Input
                  type="file"
                  accept="image/*"
                  className="mt-1"
                  onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)}
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setProgramSetting((current) => current ? { ...current, logoUrl: '' } : current)}
                  >
                    Clear Logo
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <label className="text-sm font-medium">Shell Background Image URL</label>
                <Input
                  value={programSetting?.shellImageUrl ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, shellImageUrl: event.target.value } : current)}
                  placeholder="https://your-club.com/clubhouse-hero.jpg"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This creates the branded hero ribbon across the app shell. Use a wide landscape image for best results.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Upload Shell Image</label>
                <Input
                  type="file"
                  accept="image/*"
                  className="mt-1"
                  onChange={(event) => handleShellImageUpload(event.target.files?.[0] ?? null)}
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setProgramSetting((current) => current ? { ...current, shellImageUrl: '' } : current)}
                  >
                    Clear Shell Image
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Primary Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={programSetting?.primaryColor ?? '#2f855a'}
                    onChange={(event) => setProgramSetting((current) => current ? { ...current, primaryColor: event.target.value } : current)}
                    className="h-10 w-12 rounded border bg-transparent"
                  />
                  <Input
                    value={programSetting?.primaryColor ?? ''}
                    onChange={(event) => setProgramSetting((current) => current ? { ...current, primaryColor: event.target.value } : current)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Accent Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={programSetting?.accentColor ?? '#d7f5e5'}
                    onChange={(event) => setProgramSetting((current) => current ? { ...current, accentColor: event.target.value } : current)}
                    className="h-10 w-12 rounded border bg-transparent"
                  />
                  <Input
                    value={programSetting?.accentColor ?? ''}
                    onChange={(event) => setProgramSetting((current) => current ? { ...current, accentColor: event.target.value } : current)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Sidebar Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={programSetting?.sidebarColor ?? '#203127'}
                    onChange={(event) => setProgramSetting((current) => current ? { ...current, sidebarColor: event.target.value } : current)}
                    className="h-10 w-12 rounded border bg-transparent"
                  />
                  <Input
                    value={programSetting?.sidebarColor ?? ''}
                    onChange={(event) => setProgramSetting((current) => current ? { ...current, sidebarColor: event.target.value } : current)}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="text-sm font-medium">Default Department</label>
                <select
                  value={programSetting?.defaultDepartment ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, defaultDepartment: event.target.value } : current)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {departmentOptions.map((department) => (
                    <option key={department.id} value={department.name}>{department.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Time Zone</label>
                <Input
                  value={programSetting?.timeZone ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, timeZone: event.target.value } : current)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Fiscal Year Start</label>
                <Input
                  value={programSetting?.fiscalYearStart ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, fiscalYearStart: event.target.value } : current)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border bg-card/90 p-4 shadow-sm">
                <div className="text-sm font-semibold">Brand Preview</div>
                <div className="mt-4 rounded-3xl p-4 text-white" style={{ backgroundColor: programSetting?.sidebarColor || '#203127' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 font-semibold shadow-sm" style={{ backgroundColor: programSetting?.primaryColor || '#2f855a' }}>
                      {programSetting?.logoUrl ? (
                        <img
                          src={programSetting.logoUrl}
                          alt={`${programSetting.organizationName || 'Client'} logo`}
                          className="h-12 w-12 rounded-xl object-contain"
                        />
                      ) : (
                        (programSetting?.logoInitials || 'WF').slice(0, 2)
                      )}
                    </div>
                    <div>
                      <div className="text-base font-semibold">{programSetting?.navigationTitle || programSetting?.appName || 'WorkForce App'}</div>
                      <div className="text-xs text-white/75">{programSetting?.navigationSubtitle || programSetting?.organizationName || 'Operations platform'}</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl px-3 py-2 text-sm font-medium shadow-sm" style={{ backgroundColor: programSetting?.primaryColor || '#2f855a' }}>
                    {programSetting?.clientLabel || programSetting?.organizationName || 'Client label'}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="font-semibold">What Changes Live</div>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <p>App name updates the browser tab and top-level product identity.</p>
                  <p>Navigation title and subtitle control the sidebar shell seen by crews and managers every day.</p>
                  <p>Logo uploads are stored with the client profile so admins can switch brands without touching code or external assets.</p>
                  <p>Typography and shell imagery help the product feel tailored to the club, not just recolored.</p>
                  <p>Theme presets give each club a fast, polished look before any manual color tuning.</p>
                  <p>Primary, accent, and sidebar colors set the tone for the interface so each club feels client-specific instead of generic.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="font-semibold">Client Theme Direction</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Capture the client’s own input here so the branding can evolve beyond presets and stay tied to the club’s real visual expectations.
              </p>
              <textarea
                value={programSetting?.themeNotes ?? ''}
                onChange={(event) => setProgramSetting((current) => current ? { ...current, themeNotes: event.target.value } : current)}
                className="mt-3 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Example: We want a more premium coastal-club feel, larger crest treatment, calmer neutrals, and less dashboard green."
              />
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
                <div>
                  <div className="text-sm font-medium">Enable Mobile App</div>
                  <div className="text-xs text-muted-foreground">Allow field crews to access via mobile.</div>
                </div>
                <Switch
                  checked={programSetting?.enableMobileApp ?? false}
                  onCheckedChange={(checked) => setProgramSetting((current) => current ? { ...current, enableMobileApp: checked } : current)}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
                <div>
                  <div className="text-sm font-medium">Overtime Tracking</div>
                  <div className="text-xs text-muted-foreground">Track weekly overtime hours automatically.</div>
                </div>
                <Switch
                  checked={programSetting?.overtimeTracking ?? false}
                  onCheckedChange={(checked) => setProgramSetting((current) => current ? { ...current, overtimeTracking: checked } : current)}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
                <div>
                  <div className="text-sm font-medium">Equipment QR Codes</div>
                  <div className="text-xs text-muted-foreground">Enable QR scanning for equipment check-in.</div>
                </div>
                <Switch
                  checked={programSetting?.equipmentQrCodes ?? false}
                  onCheckedChange={(checked) => setProgramSetting((current) => current ? { ...current, equipmentQrCodes: checked } : current)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveGeneralSettings}>Save Club Profile</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="structure">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Departments</div>
                  <p className="text-xs text-muted-foreground">Feeds the top bar, employee roster, and scheduling context.</p>
                </div>
                <Button size="sm" className="gap-1 text-xs" onClick={() => setDepartmentOptions((current) => [...current, { id: makeId('dep'), name: `Department ${current.length + 1}` }])}>
                  <Plus className="h-3 w-3" /> Add Department
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {departmentOptions.map((department) => (
                  <div key={department.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <Input
                      value={department.name}
                      onChange={(event) => setDepartmentOptions((current) => current.map((entry) => entry.id === department.id ? { ...entry, name: event.target.value } : entry))}
                      className="h-8 flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDepartmentOptions((current) => current.filter((entry) => entry.id !== department.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Crew Groups</div>
                  <p className="text-xs text-muted-foreground">Helps employees, workflow routing, and breakroom organization stay consistent.</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setGroupOptions((current) => [...current, { id: makeId('grp'), name: `Group ${current.length + 1}`, color: '#2f855a' }])}
                >
                  <Plus className="h-3 w-3" /> Add Group
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {groupOptions.map((group) => (
                  <div key={group.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <input
                      type="color"
                      value={group.color}
                      onChange={(event) => setGroupOptions((current) => current.map((entry) => entry.id === group.id ? { ...entry, color: event.target.value } : entry))}
                      className="h-8 w-10 rounded border bg-transparent"
                    />
                    <Input
                      value={group.name}
                      onChange={(event) => setGroupOptions((current) => current.map((entry) => entry.id === group.id ? { ...entry, name: event.target.value } : entry))}
                      className="h-8 flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setGroupOptions((current) => current.filter((entry) => entry.id !== group.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Role Options</div>
                  <p className="text-xs text-muted-foreground">Employee roles should be selected from setup instead of typed differently across the roster.</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setRoleOptions((current) => [...current, { id: makeId('role'), name: `Role ${current.length + 1}` }])}
                >
                  <Plus className="h-3 w-3" /> Add Role
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {roleOptions.map((role) => (
                  <div key={role.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <Input
                      value={role.name}
                      onChange={(event) => setRoleOptions((current) => current.map((entry) => entry.id === role.id ? { ...entry, name: event.target.value } : entry))}
                      className="h-8 flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setRoleOptions((current) => current.filter((entry) => entry.id !== role.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Language Options</div>
                  <p className="text-xs text-muted-foreground">Use shared language choices so employee communication settings stay consistent in scheduling and breakroom views.</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setLanguageOptions((current) => [...current, { id: makeId('lang'), name: `Language ${current.length + 1}` }])}
                >
                  <Plus className="h-3 w-3" /> Add Language
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {languageOptions.map((language) => (
                  <div key={language.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <Input
                      value={language.name}
                      onChange={(event) => setLanguageOptions((current) => current.map((entry) => entry.id === language.id ? { ...entry, name: event.target.value } : entry))}
                      className="h-8 flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setLanguageOptions((current) => current.filter((entry) => entry.id !== language.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={saveStructures}>Save Workforce Structure</Button>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Client Portal Users</div>
                  <p className="text-xs text-muted-foreground">These are the people who enter the app from the launch screen and appear in the top-right profile switcher.</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() =>
                    setAppUsers((current) => [
                      ...current,
                      {
                        id: makeId('user'),
                        fullName: `New User ${current.length + 1}`,
                        email: '',
                        role: 'manager',
                        title: 'Operations Manager',
                        department: programSetting?.defaultDepartment || departmentOptions[0]?.name || 'Maintenance',
                        clubId: slugifyClubId(programSetting?.clientLabel || programSetting?.organizationName || 'Client profile'),
                        clubLabel: programSetting?.clientLabel || programSetting?.organizationName || 'Client profile',
                        avatarInitials: 'NU',
                        status: 'active',
                      },
                    ])
                  }
                >
                  <Plus className="h-3 w-3" /> Add User
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {appUsers.map((user) => (
                  <div key={user.id} className="rounded-2xl border p-4">
                    <div className="grid gap-3 lg:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.9fr_auto]">
                      <Input
                        value={user.fullName}
                        onChange={(event) =>
                          setAppUsers((current) =>
                            current.map((entry) => (entry.id === user.id ? { ...entry, fullName: event.target.value } : entry)),
                          )
                        }
                        placeholder="Full name"
                        className="h-9"
                      />
                      <Input
                        value={user.email}
                        onChange={(event) =>
                          setAppUsers((current) =>
                            current.map((entry) => (entry.id === user.id ? { ...entry, email: event.target.value } : entry)),
                          )
                        }
                        placeholder="Email"
                        className="h-9"
                      />
                      <select
                        value={user.role}
                        onChange={(event) =>
                          setAppUsers((current) =>
                            current.map((entry) =>
                              entry.id === user.id
                                ? { ...entry, role: event.target.value as AppUser['role'] }
                                : entry,
                            ),
                          )
                        }
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="crew">Crew</option>
                      </select>
                      <select
                        value={user.department}
                        onChange={(event) =>
                          setAppUsers((current) =>
                            current.map((entry) => (entry.id === user.id ? { ...entry, department: event.target.value } : entry)),
                          )
                        }
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {departmentOptions.map((department) => (
                          <option key={department.id} value={department.name}>{department.name}</option>
                        ))}
                      </select>
                      <select
                        value={user.status}
                        onChange={(event) =>
                          setAppUsers((current) =>
                            current.map((entry) =>
                              entry.id === user.id
                                ? { ...entry, status: event.target.value as AppUser['status'] }
                                : entry,
                            ),
                          )
                        }
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => setAppUsers((current) => current.filter((entry) => entry.id !== user.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.6fr_1fr]">
                      <Input
                        value={user.title}
                        onChange={(event) =>
                          setAppUsers((current) =>
                            current.map((entry) => (entry.id === user.id ? { ...entry, title: event.target.value } : entry)),
                          )
                        }
                        placeholder="Title"
                        className="h-9"
                      />
                      <Input
                        value={user.avatarInitials}
                        onChange={(event) =>
                          setAppUsers((current) =>
                            current.map((entry) =>
                              entry.id === user.id
                                ? { ...entry, avatarInitials: event.target.value.toUpperCase().slice(0, 3) }
                                : entry,
                            ),
                          )
                        }
                        placeholder="Initials"
                        className="h-9"
                      />
                      <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground">{user.clubLabel || programSetting?.clientLabel || 'Client profile'}</div>
                        <div className="mt-1">Launch, notifications, and top-bar switching all use this client user list.</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={savePortalUsers}>Save Portal Users</Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="font-semibold">How This Scales Per Client</div>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>Portal users are separate from employees. Employees do the work; portal users manage the work.</p>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="font-medium text-foreground">Launch Screen</div>
                  <p className="mt-1 text-xs">Only active users appear when someone enters the client workspace.</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="font-medium text-foreground">Top-Right Profile Menu</div>
                  <p className="mt-1 text-xs">Managers can switch between admin, manager, and supervisor views without changing the client brand profile.</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="font-medium text-foreground">Notifications</div>
                  <p className="mt-1 text-xs">Role-aware alerts become more useful once each club maintains its real operational users here.</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="property-classes">
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Property Class Master Options</div>
                  <p className="text-xs text-muted-foreground">Define reusable property blueprints so each club can show only the modules it actually needs.</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() =>
                    setPropertyClasses((current) => [
                      ...current,
                      {
                        id: makeId('pclass'),
                        name: `Property Class ${current.length + 1}`,
                        description: '',
                        enabledModules: ['command-center', 'workflow', 'breakroom', 'reports'],
                      },
                    ])
                  }
                >
                  <Plus className="h-3 w-3" /> Add Class
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {propertyClasses.map((propertyClass) => (
                  <div key={propertyClass.id} className="rounded-2xl border p-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                      <Input
                        value={propertyClass.name}
                        onChange={(event) => setPropertyClasses((current) => current.map((entry) => entry.id === propertyClass.id ? { ...entry, name: event.target.value } : entry))}
                        className="h-9"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => setPropertyClasses((current) => current.filter((entry) => entry.id !== propertyClass.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      value={propertyClass.description}
                      onChange={(event) => setPropertyClasses((current) => current.map((entry) => entry.id === propertyClass.id ? { ...entry, description: event.target.value } : entry))}
                      placeholder="Describe when this property class should be used"
                      className="mt-3 h-9"
                    />
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {['command-center', 'workflow', 'breakroom', 'weather', 'applications', 'reports', 'field', 'equipment'].map((moduleId) => {
                        const enabled = propertyClass.enabledModules.includes(moduleId);
                        return (
                          <label key={moduleId} className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2 text-sm">
                            <span className="capitalize">{moduleId.replace('-', ' ')}</span>
                            <Switch
                              checked={enabled}
                              onCheckedChange={(checked) =>
                                setPropertyClasses((current) =>
                                  current.map((entry) =>
                                    entry.id === propertyClass.id
                                      ? {
                                          ...entry,
                                          enabledModules: checked
                                            ? [...entry.enabledModules, moduleId]
                                            : entry.enabledModules.filter((value) => value !== moduleId),
                                        }
                                      : entry,
                                  ),
                                )
                              }
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={savePropertyClassesTab}>Save Property Classes</Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="font-semibold">Why This Matters</div>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>Property classes become your master blueprint for how different clubs and sites use the platform.</p>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="font-medium text-foreground">Golf Course vs Resort</div>
                  <p className="mt-1 text-xs">A golf property may need weather and chemical applications, while a resort may focus more on workflow, breakroom, and guest-area reporting.</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="font-medium text-foreground">Scalable Client Setup</div>
                  <p className="mt-1 text-xs">Once a property is tied to a class, the app can later hide or prioritize modules based on that saved blueprint instead of making every client see the same stack.</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="properties">
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Managed Properties</div>
                  <p className="text-xs text-muted-foreground">These are the properties shown in Command Center and used to scope Workflow routing.</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() =>
                    setProperties((current) => [
                      ...current,
                      {
                        id: makeId('prop'),
                        name: `Property ${current.length + 1}`,
                        shortName: `P${current.length + 1}`,
                        type: 'golf-course',
                        address: '',
                        city: '',
                        state: '',
                        acreage: 18,
                        logoInitials: 'PR',
                        color: '#2f855a',
                        status: 'active',
                      },
                    ])
                  }
                >
                  <Plus className="h-3 w-3" /> Add Property
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {properties.map((property) => (
                  <div key={property.id} className="rounded-2xl border p-4">
                    <div className="grid gap-3 lg:grid-cols-[1.2fr_0.7fr_0.8fr_auto]">
                      <Input value={property.name} onChange={(event) => setProperties((current) => current.map((entry) => entry.id === property.id ? { ...entry, name: event.target.value } : entry))} className="h-9" />
                      <Input value={property.shortName} onChange={(event) => setProperties((current) => current.map((entry) => entry.id === property.id ? { ...entry, shortName: event.target.value } : entry))} className="h-9" />
                      <div>
                        <Input
                          list={`property-type-options-${property.id}`}
                          value={property.type}
                          onChange={(event) =>
                            setProperties((current) =>
                              current.map((entry) => (entry.id === property.id ? { ...entry, type: event.target.value } : entry)),
                            )
                          }
                          className="h-9"
                          placeholder="Property type label"
                        />
                        <datalist id={`property-type-options-${property.id}`}>
                          <option value="Golf Course" />
                          <option value="Polo Club" />
                          <option value="Athletic Field" />
                          <option value="Resort" />
                          <option value="Estate" />
                          <option value="Municipal Grounds" />
                        </datalist>
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => {
                        const confirmed = window.confirm(`Delete ${property.name}? This only removes the property record. Reassign linked employees and locations first.`);
                        if (!confirmed) return;
                        setProperties((current) => current.filter((entry) => entry.id !== property.id));
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.4fr_0.5fr_0.6fr_0.5fr]">
                      <Input value={property.address} onChange={(event) => setProperties((current) => current.map((entry) => entry.id === property.id ? { ...entry, address: event.target.value } : entry))} placeholder="Address" className="h-9" />
                      <Input value={property.city} onChange={(event) => setProperties((current) => current.map((entry) => entry.id === property.id ? { ...entry, city: event.target.value } : entry))} placeholder="City" className="h-9" />
                      <Input value={property.state} onChange={(event) => setProperties((current) => current.map((entry) => entry.id === property.id ? { ...entry, state: event.target.value } : entry))} placeholder="ST" className="h-9" />
                      <Input value={String(property.acreage)} onChange={(event) => setProperties((current) => current.map((entry) => entry.id === property.id ? { ...entry, acreage: Number(event.target.value || 0) } : entry))} placeholder="Acres" className="h-9" />
                      <Input value={property.logoInitials} onChange={(event) => setProperties((current) => current.map((entry) => entry.id === property.id ? { ...entry, logoInitials: event.target.value.toUpperCase().slice(0, 3) } : entry))} placeholder="Logo" className="h-9" />
                      <select value={property.status} onChange={(event) => setProperties((current) => current.map((entry) => entry.id === property.id ? { ...entry, status: event.target.value as Property['status'] } : entry))} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="active">Active</option>
                        <option value="onboarding">Onboarding</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
                      <select
                        value={property.propertyClassId || ''}
                        onChange={(event) => setProperties((current) => current.map((entry) => entry.id === property.id ? { ...entry, propertyClassId: event.target.value || undefined } : entry))}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">No property class</option>
                        {propertyClasses.map((propertyClass) => (
                          <option key={propertyClass.id} value={propertyClass.id}>{propertyClass.name}</option>
                        ))}
                      </select>
                      <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        {(propertyClasses.find((entry) => entry.id === property.propertyClassId)?.enabledModules || []).join(' · ') || 'Assign a property class to define which modules this property should emphasize.'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={savePropertiesTab}>Save Properties</Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="font-semibold">How Properties Flow Through the App</div>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>Command Center reads these saved properties, not a separate demo list.</p>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="font-medium text-foreground">Workflow Routing</div>
                  <p className="mt-1 text-xs">Clicking a property in Command Center now sets the active property before routing into Workflow.</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="font-medium text-foreground">Employee Assignment</div>
                  <p className="mt-1 text-xs">Employees and locations can now be tied to a property so task planning stays scoped correctly.</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="locations">
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Operational Locations</div>
                  <p className="text-xs text-muted-foreground">These locations ripple into weather setup, application areas, notes, and planning views.</p>
                </div>
                <Button size="sm" className="gap-1 text-xs" onClick={() => setWorkLocations((current) => [...current, { id: makeId('loc'), name: `Location ${current.length + 1}`, propertyId: properties[0]?.id, propertyName: properties[0]?.name }])}>
                  <Plus className="h-3 w-3" /> Add Location
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {workLocations.map((location) => (
                  <div key={location.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={location.name}
                      onChange={(event) => setWorkLocations((current) => current.map((entry) => entry.id === location.id ? { ...entry, name: event.target.value } : entry))}
                      className="h-8 flex-1"
                    />
                    <select
                      value={location.propertyId || ''}
                      onChange={(event) => {
                        const property = properties.find((entry) => entry.id === event.target.value);
                        setWorkLocations((current) => current.map((entry) => entry.id === location.id ? { ...entry, propertyId: event.target.value, propertyName: property?.name } : entry));
                      }}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">No property</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>{property.name}</option>
                      ))}
                    </select>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setWorkLocations((current) => current.filter((entry) => entry.id !== location.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={saveLocations}>Save Locations</Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="font-semibold">Why Locations Matter</div>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>Locations created here become the clean source for property areas across the system.</p>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="font-medium text-foreground">Weather</div>
                  <p className="mt-1 text-xs">Weather areas can be built from these saved locations so realtime and manual logs map to the same property structure.</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="font-medium text-foreground">Applications</div>
                  <p className="mt-1 text-xs">Chemical application areas stay more consistent when they inherit the same club geography.</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="font-medium text-foreground">Operations</div>
                  <p className="mt-1 text-xs">Routing, notes, and breakroom communication get less cluttered when the same location names are reused everywhere.</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="shifts">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Shift Templates</div>
                <p className="text-xs text-muted-foreground">Reusable labor patterns that the scheduler can apply without rebuilding each week from scratch.</p>
              </div>
              <Button
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setShiftTemplates((current) => [...current, { id: makeId('shift'), name: `Shift ${current.length + 1}`, start: '06:00', end: '14:30', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }])}
              >
                <Plus className="h-3 w-3" /> Add Shift
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {shiftTemplates.map((shift) => (
                <div key={shift.id} className="rounded-xl border p-4">
                  <div className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.7fr]">
                    <Input
                      value={shift.name}
                      onChange={(event) => setShiftTemplates((current) => current.map((entry) => entry.id === shift.id ? { ...entry, name: event.target.value } : entry))}
                      className="h-9"
                    />
                    <Input
                      value={shift.start}
                      onChange={(event) => setShiftTemplates((current) => current.map((entry) => entry.id === shift.id ? { ...entry, start: event.target.value } : entry))}
                      className="h-9"
                    />
                    <Input
                      value={shift.end}
                      onChange={(event) => setShiftTemplates((current) => current.map((entry) => entry.id === shift.id ? { ...entry, end: event.target.value } : entry))}
                      className="h-9"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {weekDays.map((day) => (
                      <button
                        key={day}
                        type="button"
                        className={`rounded-full border px-2 py-1 text-[10px] ${shift.days.includes(day) ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}
                        onClick={() =>
                          setShiftTemplates((current) =>
                            current.map((entry) => {
                              if (entry.id !== shift.id) return entry;
                              return {
                                ...entry,
                                days: entry.days.includes(day)
                                  ? entry.days.filter((value) => value !== day)
                                  : [...entry.days, day],
                              };
                            }),
                          )
                        }
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveShiftPlans}>Save Shift Templates</Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

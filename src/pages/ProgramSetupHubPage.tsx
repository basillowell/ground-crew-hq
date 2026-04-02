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
  Trash2,
  Users,
  Waves,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { DepartmentOption, GroupOption, ProgramSettings, ShiftTemplate, WorkLocation } from '@/data/seedData';
import {
  loadLanguageOptions,
  loadApplicationAreas,
  loadAssignments,
  loadDepartmentOptions,
  loadEmployees,
  loadGroupOptions,
  loadProgramSettings,
  loadRoleOptions,
  loadScheduleEntries,
  loadShiftTemplates,
  loadTasks,
  loadWeatherLocations,
  loadWorkLocations,
  saveLanguageOptions,
  saveDepartmentOptions,
  saveGroupOptions,
  saveProgramSettings,
  saveRoleOptions,
  saveShiftTemplates,
  saveWorkLocations,
} from '@/lib/dataStore';

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function makeId(prefix: string) {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function announceProgramSetupUpdate() {
  window.dispatchEvent(new CustomEvent('program-setup-updated'));
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
    primaryColor: settings.primaryColor || '#2f855a',
    accentColor: settings.accentColor || '#d7f5e5',
    sidebarColor: settings.sidebarColor || '#203127',
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
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);

  useEffect(() => {
    const loadedSettings = loadProgramSettings()[0];
    setProgramSetting(loadedSettings ? withBrandDefaults(loadedSettings) : null);
    setDepartmentOptions(loadDepartmentOptions());
    setGroupOptions(loadGroupOptions());
    setRoleOptions(loadRoleOptions());
    setLanguageOptions(loadLanguageOptions());
    setWorkLocations(loadWorkLocations());
    setShiftTemplates(loadShiftTemplates());
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
      tasks: tasks.length,
      activeTasks: tasks.filter((task) => (task.status ?? 'active') === 'active').length,
      schedules: schedules.length,
      assignments: assignments.length,
      weatherAreas: weatherAreas.length,
      applicationAreas: applicationAreas.length,
    };
  }, [departmentOptions, groupOptions, shiftTemplates, workLocations, programSetting]);

  function saveGeneralSettings() {
    if (!programSetting) return;
    const nextSetting = withBrandDefaults(programSetting);
    setProgramSetting(nextSetting);
    saveProgramSettings([nextSetting]);
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

  function saveShiftPlans() {
    saveShiftTemplates(shiftTemplates);
    toast('Shift templates saved', {
      description: `${shiftTemplates.length} reusable shift plans are ready for scheduling.`,
    });
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
          helper="Employees available for scheduling and workboard assignment."
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
                  <div className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4 text-primary" /> Scheduler + Workboard</div>
                  <p className="mt-2 text-sm text-muted-foreground">Shift templates and default department choices reduce repetitive setup and keep labor planning consistent.</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold">Live Operational Snapshot</h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Assignments in Workboard</div>
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
                <label className="text-sm font-medium">App Name</label>
                <Input
                  value={programSetting?.appName ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, appName: event.target.value } : current)}
                  className="mt-1"
                />
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
                <label className="text-sm font-medium">Logo Initials</label>
                <Input
                  value={programSetting?.logoInitials ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, logoInitials: event.target.value.toUpperCase().slice(0, 3) } : current)}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl font-semibold" style={{ backgroundColor: programSetting?.primaryColor || '#2f855a' }}>
                      {programSetting?.logoUrl ? (
                        <img
                          src={programSetting.logoUrl}
                          alt={`${programSetting.organizationName || 'Client'} logo`}
                          className="h-8 w-8 rounded-lg object-contain"
                        />
                      ) : (
                        (programSetting?.logoInitials || 'WF').slice(0, 2)
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{programSetting?.navigationTitle || programSetting?.appName || 'WorkForce App'}</div>
                      <div className="text-xs text-white/75">{programSetting?.navigationSubtitle || programSetting?.organizationName || 'Operations platform'}</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl px-3 py-2 text-sm font-medium" style={{ backgroundColor: programSetting?.primaryColor || '#2f855a' }}>
                    {programSetting?.clientLabel || programSetting?.organizationName || 'Client label'}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="font-semibold">What Changes Live</div>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <p>App name updates the browser tab and top-level product identity.</p>
                  <p>Navigation title and subtitle control the sidebar shell seen by crews and managers every day.</p>
                  <p>Logo image URLs let each club bring its own visual mark into the shell without waiting on a code change.</p>
                  <p>Primary, accent, and sidebar colors set the tone for the interface so each club feels client-specific instead of generic.</p>
                </div>
              </div>
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
                  <p className="text-xs text-muted-foreground">Helps employees, workboard routing, and breakroom organization stay consistent.</p>
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

        <TabsContent value="locations">
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Operational Locations</div>
                  <p className="text-xs text-muted-foreground">These locations ripple into weather setup, application areas, notes, and planning views.</p>
                </div>
                <Button size="sm" className="gap-1 text-xs" onClick={() => setWorkLocations((current) => [...current, { id: makeId('loc'), name: `Location ${current.length + 1}` }])}>
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

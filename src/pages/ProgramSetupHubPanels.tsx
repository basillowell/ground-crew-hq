import type { Dispatch, SetStateAction } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { GripVertical, MapPin, MoreHorizontal, Plus, Settings, Trash2 } from 'lucide-react';
import type { AppUser, DepartmentOption, Employee, GroupOption, ProgramSettings, Property, PropertyClassOption, ShiftTemplate, WorkLocation } from '@/data/seedData';
import type { ActivePage } from './ProgramSetupHubPage';

type PanelsProps = {
  activePage: ActivePage;
  setActivePage: (p: ActivePage) => void;
  propertySheetId: string | null;
  setPropertySheetId: (id: string | null) => void;
  shiftSheetId: string | null;
  setShiftSheetId: (id: string | null) => void;
  programSetting: ProgramSettings | null;
  setProgramSetting: Dispatch<SetStateAction<ProgramSettings | null>>;
  departmentOptions: DepartmentOption[];
  setDepartmentOptions: Dispatch<SetStateAction<DepartmentOption[]>>;
  groupOptions: GroupOption[];
  setGroupOptions: Dispatch<SetStateAction<GroupOption[]>>;
  roleOptions: { id: string; name: string }[];
  setRoleOptions: Dispatch<SetStateAction<{ id: string; name: string }[]>>;
  languageOptions: { id: string; name: string }[];
  setLanguageOptions: Dispatch<SetStateAction<{ id: string; name: string }[]>>;
  properties: Property[];
  setProperties: Dispatch<SetStateAction<Property[]>>;
  propertyClasses: PropertyClassOption[];
  setPropertyClasses: Dispatch<SetStateAction<PropertyClassOption[]>>;
  workLocations: WorkLocation[];
  setWorkLocations: Dispatch<SetStateAction<WorkLocation[]>>;
  shiftTemplates: ShiftTemplate[];
  setShiftTemplates: Dispatch<SetStateAction<ShiftTemplate[]>>;
  appUsers: AppUser[];
  setAppUsers: Dispatch<SetStateAction<AppUser[]>>;
  employees: Employee[];
  setEmployees: Dispatch<SetStateAction<Employee[]>>;
  liveCounts: { employees: number; activeAppUsers: number; properties: number };
  saveGeneralSettings: () => void;
  saveStructures: () => void;
  saveLocations: () => void;
  savePropertiesTab: () => void;
  savePropertyClassesTab: () => void;
  saveShiftPlans: () => void;
  savePortalUsers: () => void;
  handleLogoUpload: (file?: File | null) => void;
  toggleEnabledModule: (id: string, on: boolean) => void;
  moduleEnabled: (id: string) => boolean;
  themePresets: { id: string; name: string; primaryColor: string; accentColor: string; sidebarColor: string }[];
  typographyPresets: { id: string; name: string }[];
  weekDays: string[];
  makeId: (prefix: string) => string;
  applyThemePreset: (s: ProgramSettings, id: string) => ProgramSettings;
  slugifyClubId: (v: string) => string;
  navGroups: { label: string; items: { id: ActivePage; label: string; icon: typeof Settings }[] }[];
  planLimits: { properties: number; employees: number; portalUsers: number };
  currentPlanName: string;
};

const MODULE_ROWS: {
  group: string;
  id: string;
  title: string;
  description: string;
}[] = [
  { group: 'Core modules', id: 'command-center', title: 'Command Center', description: 'Operational dashboard and property switching.' },
  { group: 'Core modules', id: 'workboard', title: 'Workboard', description: 'Daily task assignments and crew workflow.' },
  { group: 'Core modules', id: 'scheduler', title: 'Scheduler', description: 'Shifts and labor planning.' },
  { group: 'Core modules', id: 'mobile-field', title: 'Mobile Field', description: 'Field crew mobile workspace.' },
  { group: 'Core modules', id: 'breakroom', title: 'Breakroom', description: 'Announcements and team feed.' },
  { group: 'Operational', id: 'weather', title: 'Weather', description: 'Stations, logs, and agronomic context.' },
  { group: 'Operational', id: 'applications', title: 'Applications', description: 'Chemical application records and compliance.' },
  { group: 'Operational', id: 'equipment', title: 'Equipment', description: 'Fleet and work orders.' },
  { group: 'Operational', id: 'safety', title: 'Safety', description: 'Safety programs and tracking.' },
  { group: 'Operational', id: 'messaging', title: 'Messaging', description: 'Team messaging between users.' },
];

function roleBadgeClass(role: AppUser['role']) {
  if (role === 'admin') return 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  if (role === 'manager') return 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200';
  if (role === 'crew') return 'border-border bg-muted text-muted-foreground';
  return 'border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200';
}

export function ProgramSetupHubPanels(props: PanelsProps) {
  const {
    activePage,
    setActivePage,
    propertySheetId,
    setPropertySheetId,
    shiftSheetId,
    setShiftSheetId,
    programSetting,
    setProgramSetting,
    departmentOptions,
    setDepartmentOptions,
    groupOptions,
    setGroupOptions,
    roleOptions,
    setRoleOptions,
    languageOptions,
    setLanguageOptions,
    properties,
    setProperties,
    propertyClasses,
    setPropertyClasses,
    workLocations,
    setWorkLocations,
    shiftTemplates,
    setShiftTemplates,
    appUsers,
    setAppUsers,
    employees,
    setEmployees,
    liveCounts,
    saveGeneralSettings,
    saveStructures,
    saveLocations,
    savePropertiesTab,
    savePropertyClassesTab,
    saveShiftPlans,
    savePortalUsers,
    handleLogoUpload,
    toggleEnabledModule,
    moduleEnabled,
    themePresets,
    typographyPresets,
    weekDays,
    makeId,
    applyThemePreset,
    slugifyClubId,
    navGroups,
    planLimits,
    currentPlanName,
  } = props;

  const editingProperty = propertySheetId ? properties.find((p) => p.id === propertySheetId) : undefined;
  const editingShift = shiftSheetId ? shiftTemplates.find((s) => s.id === shiftSheetId) : undefined;

  return (
    <div className="flex min-h-[640px] overflow-hidden rounded-xl border bg-card">
      <aside className="flex w-[220px] shrink-0 flex-col border-r bg-muted/30">
        <div className="flex-1 space-y-6 overflow-y-auto p-3">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{group.label}</div>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActivePage(item.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
        <div className="border-t p-3">
          <div className="rounded-lg border bg-background/80 p-3 text-xs shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary" className="font-medium">
                {currentPlanName}
              </Badge>
              <span className="text-muted-foreground">{liveCounts.properties} properties</span>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('billing')}
              className="mt-2 w-full text-left text-[11px] font-medium text-primary underline-offset-2 hover:underline"
            >
              Manage plan
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {activePage === 'brand' && programSetting && (
          <div className="mx-auto max-w-4xl space-y-8">
            <div>
              <h2 className="text-lg font-semibold">Brand &amp; Identity</h2>
              <p className="text-sm text-muted-foreground">Organization name, navigation labels, theme, and logo preview.</p>
            </div>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Organization identity</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Organization name</label>
                  <Input
                    value={programSetting.organizationName}
                    onChange={(e) => setProgramSetting((c) => (c ? { ...c, organizationName: e.target.value } : c))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Navigation title</label>
                  <Input
                    value={programSetting.navigationTitle}
                    onChange={(e) => setProgramSetting((c) => (c ? { ...c, navigationTitle: e.target.value } : c))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Client label</label>
                  <Input
                    value={programSetting.clientLabel}
                    onChange={(e) => setProgramSetting((c) => (c ? { ...c, clientLabel: e.target.value } : c))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Navigation subtitle</label>
                  <Input
                    value={programSetting.navigationSubtitle}
                    onChange={(e) => setProgramSetting((c) => (c ? { ...c, navigationSubtitle: e.target.value } : c))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Client app name</label>
                  <Input
                    value={programSetting.appName}
                    onChange={(e) => setProgramSetting((c) => (c ? { ...c, appName: e.target.value } : c))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Default department</label>
                  <select
                    value={programSetting.defaultDepartment}
                    onChange={(e) => setProgramSetting((c) => (c ? { ...c, defaultDepartment: e.target.value } : c))}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {departmentOptions.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Time zone</label>
                  <Input
                    value={programSetting.timeZone}
                    onChange={(e) => setProgramSetting((c) => (c ? { ...c, timeZone: e.target.value } : c))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Fiscal year start</label>
                  <Input
                    value={programSetting.fiscalYearStart}
                    onChange={(e) => setProgramSetting((c) => (c ? { ...c, fiscalYearStart: e.target.value } : c))}
                    className="mt-1"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Theme</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {themePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setProgramSetting((c) => (c ? applyThemePreset(c, preset.id) : c))}
                    className={cn(
                      'rounded-xl border p-3 text-left text-xs transition-all',
                      programSetting.uiThemePreset === preset.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-muted-foreground/30',
                    )}
                  >
                    <div className="font-medium">{preset.name}</div>
                    <div className="mt-2 flex gap-1">
                      <span className="h-6 flex-1 rounded-md" style={{ background: preset.primaryColor }} />
                      <span className="h-6 flex-1 rounded-md" style={{ background: preset.accentColor }} />
                      <span className="h-6 flex-1 rounded-md" style={{ background: preset.sidebarColor }} />
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium">Typography</label>
                <select
                  value={programSetting.fontThemePreset ?? 'modern-sans'}
                  onChange={(e) => setProgramSetting((c) => (c ? { ...c, fontThemePreset: e.target.value } : c))}
                  className="mt-1 h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
                >
                  {typographyPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {(['primaryColor', 'accentColor', 'sidebarColor'] as const).map((key) => (
                  <div key={key}>
                    <label className="text-sm font-medium capitalize">{key.replace('Color', ' color')}</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        value={programSetting[key]}
                        onChange={(e) => setProgramSetting((c) => (c ? { ...c, [key]: e.target.value } : c))}
                        className="h-10 w-12 cursor-pointer rounded border bg-transparent"
                      />
                      <Input
                        value={programSetting[key]}
                        onChange={(e) => setProgramSetting((c) => (c ? { ...c, [key]: e.target.value } : c))}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium">Theme notes</label>
                <textarea
                  value={programSetting.themeNotes ?? ''}
                  onChange={(e) => setProgramSetting((c) => (c ? { ...c, themeNotes: e.target.value } : c))}
                  className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Logo &amp; assets</h3>
                <div>
                  <label className="text-sm font-medium">Logo initials</label>
                  <Input
                    value={programSetting.logoInitials}
                    onChange={(e) =>
                      setProgramSetting((c) => (c ? { ...c, logoInitials: e.target.value.toUpperCase().slice(0, 3) } : c))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Logo image URL</label>
                  <Input
                    value={programSetting.logoUrl ?? ''}
                    onChange={(e) => setProgramSetting((c) => (c ? { ...c, logoUrl: e.target.value } : c))}
                    className="mt-1"
                    placeholder="https://"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Upload logo</label>
                  <Input type="file" accept="image/*" className="mt-1" onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)} />
                  <Button type="button" variant="outline" size="sm" className="mt-2 text-xs" onClick={() => setProgramSetting((c) => (c ? { ...c, logoUrl: '' } : c))}>
                    Clear logo
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
                  <div>
                    <div className="text-sm font-medium">Mobile app</div>
                    <p className="text-xs text-muted-foreground">Allow field crews to access via mobile.</p>
                  </div>
                  <Switch
                    checked={programSetting.enableMobileApp}
                    onCheckedChange={(checked) => setProgramSetting((c) => (c ? { ...c, enableMobileApp: checked } : c))}
                  />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold">Live sidebar preview</h3>
                <div className="rounded-2xl border p-4 text-white shadow-inner" style={{ backgroundColor: programSetting.sidebarColor }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 text-sm font-semibold shadow-sm"
                      style={{ backgroundColor: programSetting.primaryColor }}
                    >
                      {programSetting.logoUrl ? (
                        <img src={programSetting.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
                      ) : (
                        (programSetting.logoInitials || 'WF').slice(0, 2)
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{programSetting.navigationTitle || programSetting.appName}</div>
                      <div className="text-xs text-white/70">{programSetting.navigationSubtitle}</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg px-3 py-2 text-xs font-medium" style={{ backgroundColor: programSetting.primaryColor }}>
                    {programSetting.clientLabel}
                  </div>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <Button onClick={saveGeneralSettings}>Save changes</Button>
            </div>
          </div>
        )}

        {activePage === 'modules' && programSetting && (
          <div className="mx-auto max-w-3xl space-y-8">
            <div>
              <h2 className="text-lg font-semibold">Modules &amp; Features</h2>
              <p className="text-sm text-muted-foreground">Toggle modules and operational controls for this workspace.</p>
            </div>
            {['Core modules', 'Operational'].map((g) => (
              <div key={g}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{g}</h3>
                <div className="divide-y rounded-xl border">
                  {MODULE_ROWS.filter((r) => r.group === g).map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <div className="text-sm font-medium">{row.title}</div>
                        <p className="text-xs text-muted-foreground">{row.description}</p>
                      </div>
                      <Switch checked={moduleEnabled(row.id)} onCheckedChange={(on) => toggleEnabledModule(row.id, on)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Controls</h3>
              <div className="divide-y rounded-xl border">
                <div className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div className="text-sm font-medium">Overtime tracking</div>
                    <p className="text-xs text-muted-foreground">Track weekly overtime hours automatically.</p>
                  </div>
                  <Switch
                    checked={programSetting.overtimeTracking}
                    onCheckedChange={(checked) => setProgramSetting((c) => (c ? { ...c, overtimeTracking: checked } : c))}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div className="text-sm font-medium">Equipment QR codes</div>
                    <p className="text-xs text-muted-foreground">Enable QR scanning for equipment check-in.</p>
                  </div>
                  <Switch
                    checked={programSetting.equipmentQrCodes}
                    onCheckedChange={(checked) => setProgramSetting((c) => (c ? { ...c, equipmentQrCodes: checked } : c))}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div className="text-sm font-medium">Push notifications</div>
                    <p className="text-xs text-muted-foreground">Browser and mobile push for alerts (stub).</p>
                  </div>
                  <Switch
                    checked={programSetting.pushNotifications ?? false}
                    onCheckedChange={(checked) => setProgramSetting((c) => (c ? { ...c, pushNotifications: checked } : c))}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveGeneralSettings}>Save modules</Button>
            </div>
          </div>
        )}

        {activePage === 'properties' && (
          <div className="mx-auto max-w-5xl space-y-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Properties</h2>
                <p className="text-sm text-muted-foreground">Sites, classes, work locations, and employee assignment.</p>
              </div>
              <Button
                size="sm"
                className="gap-1"
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
                      latitude: undefined,
                      longitude: undefined,
                      acreage: 18,
                      logoInitials: 'PR',
                      color: '#2f855a',
                      status: 'active',
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add property
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => (
                <Card key={property.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: property.color }}
                      >
                        {property.logoInitials.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold leading-tight">{property.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {property.city}
                          {property.city && property.state ? ', ' : ''}
                          {property.state} · {property.type} · {property.acreage} ac
                        </div>
                      </div>
                    </div>
                    <Badge variant={property.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                      {property.status}
                    </Badge>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPropertySheetId(property.id)}>
                      Edit
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Property class master</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
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
                  <Plus className="h-3 w-3" /> Add class
                </Button>
              </div>
              <div className="space-y-3">
                {propertyClasses.map((propertyClass) => (
                  <Card key={propertyClass.id} className="p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <Input
                        value={propertyClass.name}
                        onChange={(e) => setPropertyClasses((cur) => cur.map((x) => (x.id === propertyClass.id ? { ...x, name: e.target.value } : x)))}
                        className="max-w-xs"
                      />
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setPropertyClasses((cur) => cur.filter((x) => x.id !== propertyClass.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      value={propertyClass.description}
                      onChange={(e) => setPropertyClasses((cur) => cur.map((x) => (x.id === propertyClass.id ? { ...x, description: e.target.value } : x)))}
                      placeholder="Description"
                      className="mt-2"
                    />
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {['command-center', 'workflow', 'breakroom', 'weather', 'applications', 'reports', 'field', 'equipment'].map((moduleId) => {
                        const enabled = propertyClass.enabledModules.includes(moduleId);
                        return (
                          <label key={moduleId} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                            <span className="capitalize">{moduleId.replace('-', ' ')}</span>
                            <Switch
                              checked={enabled}
                              onCheckedChange={(checked) =>
                                setPropertyClasses((cur) =>
                                  cur.map((entry) =>
                                    entry.id === propertyClass.id
                                      ? {
                                          ...entry,
                                          enabledModules: checked ? [...entry.enabledModules, moduleId] : entry.enabledModules.filter((v) => v !== moduleId),
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
                  </Card>
                ))}
              </div>
              <div className="flex justify-end">
                <Button variant="secondary" onClick={savePropertyClassesTab}>
                  Save property classes
                </Button>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Work locations</h3>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setWorkLocations((cur) => [...cur, { id: makeId('loc'), name: `Location ${cur.length + 1}`, propertyId: properties[0]?.id, propertyName: properties[0]?.name }])}>
                  <Plus className="h-3 w-3" /> Add location
                </Button>
              </div>
              <div className="space-y-2">
                {workLocations.map((location) => (
                  <div key={location.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={location.name}
                      onChange={(e) => setWorkLocations((cur) => cur.map((x) => (x.id === location.id ? { ...x, name: e.target.value } : x)))}
                      className="h-8 max-w-[200px] flex-1"
                    />
                    <select
                      value={location.propertyId || ''}
                      onChange={(e) => {
                        const prop = properties.find((p) => p.id === e.target.value);
                        setWorkLocations((cur) => cur.map((x) => (x.id === location.id ? { ...x, propertyId: e.target.value, propertyName: prop?.name } : x)));
                      }}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">No property</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <Button variant="ghost" size="icon" className="ml-auto text-destructive" onClick={() => setWorkLocations((cur) => cur.filter((x) => x.id !== location.id))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button variant="secondary" onClick={saveLocations}>
                  Save locations
                </Button>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold">Employee property assignment</h3>
              <Card className="p-4">
                <div className="space-y-2">
                  {employees.map((employee) => (
                    <div key={employee.id} className="grid gap-2 rounded-lg border bg-muted/10 p-3 md:grid-cols-[1fr_auto]">
                      <div>
                        <div className="text-sm font-medium">
                          {employee.firstName} {employee.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {employee.department} · {employee.role}
                        </div>
                      </div>
                      <select
                        value={employee.propertyId || ''}
                        onChange={(e) => setEmployees((cur) => cur.map((x) => (x.id === employee.id ? { ...x, propertyId: e.target.value || undefined } : x)))}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">No property</option>
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold">Usage</h3>
              <UsageBar label="Properties" current={liveCounts.properties} max={planLimits.properties} />
              <UsageBar label="Employees" current={liveCounts.employees} max={planLimits.employees} />
              <UsageBar label="Portal users" current={liveCounts.activeAppUsers} max={planLimits.portalUsers} />
            </section>

            <div className="flex justify-end">
              <Button onClick={savePropertiesTab}>Save properties</Button>
            </div>
          </div>
        )}

        {activePage === 'users' && programSetting && (
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Users &amp; Access</h2>
                <p className="text-sm text-muted-foreground">Portal accounts for admins, managers, and crew.</p>
              </div>
              <Button
                size="sm"
                className="gap-1"
                onClick={() =>
                  setAppUsers((cur) => [
                    ...cur,
                    {
                      id: makeId('user'),
                      fullName: `New User ${cur.length + 1}`,
                      email: '',
                      role: 'manager',
                      title: 'Operations Manager',
                      department: programSetting.defaultDepartment || departmentOptions[0]?.name || 'Maintenance',
                      clubId: slugifyClubId(programSetting.clientLabel || programSetting.organizationName || 'Client profile'),
                      clubLabel: programSetting.clientLabel || programSetting.organizationName || 'Client profile',
                      avatarInitials: 'NU',
                      status: 'active',
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add user
              </Button>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[72px]">User</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Dept</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-[72px]">Status</TableHead>
                    <TableHead className="w-[56px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs">{user.avatarInitials.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={user.fullName}
                          onChange={(e) => setAppUsers((cur) => cur.map((x) => (x.id === user.id ? { ...x, fullName: e.target.value } : x)))}
                          className="h-8 max-w-[160px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={user.email}
                          onChange={(e) => setAppUsers((cur) => cur.map((x) => (x.id === user.id ? { ...x, email: e.target.value } : x)))}
                          className="h-8 max-w-[200px] text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={user.title}
                          onChange={(e) => setAppUsers((cur) => cur.map((x) => (x.id === user.id ? { ...x, title: e.target.value } : x)))}
                          className="h-8 max-w-[180px]"
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          value={user.department}
                          onChange={(e) => setAppUsers((cur) => cur.map((x) => (x.id === user.id ? { ...x, department: e.target.value } : x)))}
                          className="h-8 max-w-[140px] rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {departmentOptions.map((d) => (
                            <option key={d.id} value={d.name}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select
                          value={user.role}
                          onChange={(e) => setAppUsers((cur) => cur.map((x) => (x.id === user.id ? { ...x, role: e.target.value as AppUser['role'] } : x)))}
                          className={cn('h-8 rounded-full border px-2 text-xs font-medium', roleBadgeClass(user.role))}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="crew">Crew</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex h-2 w-2 rounded-full', user.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/50')} title={user.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setAppUsers((cur) => cur.map((x) => (x.id === user.id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x)))}
                            >
                              Toggle status
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setAppUsers((cur) => cur.filter((x) => x.id !== user.id))}>
                              Remove user
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</div>
                <p className="mt-2 text-sm text-muted-foreground">Full workspace configuration, users, and billing access.</p>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manager</div>
                <p className="mt-2 text-sm text-muted-foreground">Operational control for assigned properties without org-wide admin.</p>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Crew / Supervisor</div>
                <p className="mt-2 text-sm text-muted-foreground">Day-to-day tools, scheduling, and limited settings.</p>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={savePortalUsers}>Save users</Button>
            </div>
          </div>
        )}

        {activePage === 'workforce' && (
          <div className="mx-auto max-w-4xl space-y-8">
            <div>
              <h2 className="text-lg font-semibold">Workforce structure</h2>
              <p className="text-sm text-muted-foreground">Departments, groups, roles, and languages.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">Departments</span>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setDepartmentOptions((c) => [...c, { id: makeId('dep'), name: `Department ${c.length + 1}` }])}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {departmentOptions.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                      <Input value={d.name} onChange={(e) => setDepartmentOptions((c) => c.map((x) => (x.id === d.id ? { ...x, name: e.target.value } : x)))} className="h-8 flex-1 border-0 bg-transparent" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => setDepartmentOptions((c) => c.filter((x) => x.id !== d.id))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">Crew groups</span>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setGroupOptions((c) => [...c, { id: makeId('grp'), name: `Group ${c.length + 1}`, color: '#2f855a' }])}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {groupOptions.map((g) => (
                    <div key={g.id} className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
                      <input type="color" value={g.color} onChange={(e) => setGroupOptions((c) => c.map((x) => (x.id === g.id ? { ...x, color: e.target.value } : x)))} className="h-8 w-9 rounded border" />
                      <Input value={g.name} onChange={(e) => setGroupOptions((c) => c.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))} className="h-8 flex-1 border-0 bg-transparent" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setGroupOptions((c) => c.filter((x) => x.id !== g.id))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Roles</span>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setRoleOptions((c) => [...c, { id: makeId('role'), name: `Role ${c.length + 1}` }])}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((r) => (
                  <Badge key={r.id} variant="secondary" className="gap-1 pr-1 font-normal">
                    <Input
                      value={r.name}
                      onChange={(e) => setRoleOptions((c) => c.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))}
                      className="h-6 w-28 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                    />
                    <button type="button" className="rounded p-0.5 hover:bg-destructive/20" onClick={() => setRoleOptions((c) => c.filter((x) => x.id !== r.id))}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Languages</span>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setLanguageOptions((c) => [...c, { id: makeId('lang'), name: `Language ${c.length + 1}` }])}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {languageOptions.map((lang) => (
                  <Badge key={lang.id} variant="outline" className="gap-1 pr-1 font-normal">
                    <Input
                      value={lang.name}
                      onChange={(e) => setLanguageOptions((c) => c.map((x) => (x.id === lang.id ? { ...x, name: e.target.value } : x)))}
                      className="h-6 w-28 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                    />
                    <button type="button" className="rounded p-0.5 hover:bg-destructive/20" onClick={() => setLanguageOptions((c) => c.filter((x) => x.id !== lang.id))}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </Card>
            <div className="flex justify-end">
              <Button onClick={saveStructures}>Save workforce structure</Button>
            </div>
          </div>
        )}

        {activePage === 'shifts' && (
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Shift templates</h2>
                <p className="text-sm text-muted-foreground">Reusable patterns for the scheduler.</p>
              </div>
              <Button size="sm" className="gap-1" onClick={() => setShiftTemplates((c) => [...c, { id: makeId('shift'), name: `Shift ${c.length + 1}`, start: '06:00', end: '14:30', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }])}>
                <Plus className="h-3.5 w-3.5" /> Add template
              </Button>
            </div>
            <div className="divide-y rounded-xl border">
              {shiftTemplates.map((shift) => (
                <div key={shift.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-[140px] font-medium">{shift.name}</div>
                  <code className="rounded-md bg-muted px-2 py-1 text-xs">
                    {shift.start} – {shift.end}
                  </code>
                  <div className="flex flex-1 flex-wrap gap-1">
                    {weekDays.map((day) => (
                      <span
                        key={day}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          shift.days.includes(day) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground line-through opacity-60',
                        )}
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShiftSheetId(shift.id)}>
                    Edit
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={saveShiftPlans}>Save shift templates</Button>
            </div>
          </div>
        )}

        {activePage === 'billing' && (
          <div className="mx-auto max-w-4xl space-y-8">
            <div>
              <h2 className="text-lg font-semibold">Billing &amp; plan</h2>
              <p className="text-sm text-muted-foreground">Subscription and usage (UI preview — no payment processing yet).</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-primary p-6 shadow-sm ring-1 ring-primary/20">
                <Badge className="mb-2">Current</Badge>
                <div className="text-xl font-bold">Pro</div>
                <p className="mt-1 text-sm text-muted-foreground">Full ops stack for growing clubs.</p>
                <Separator className="my-4" />
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>· Up to {planLimits.properties} properties</li>
                  <li>· {planLimits.employees} employees</li>
                  <li>· {planLimits.portalUsers} portal seats</li>
                </ul>
              </Card>
              <Card className="p-6">
                <Badge variant="secondary" className="mb-2">
                  Next tier
                </Badge>
                <div className="text-xl font-bold">Enterprise</div>
                <p className="mt-1 text-sm text-muted-foreground">SSO, SLA, and dedicated support.</p>
                <Separator className="my-4" />
                <Button variant="outline" className="w-full" disabled>
                  Contact sales
                </Button>
              </Card>
            </div>
            <Card className="p-4">
              <h3 className="text-sm font-semibold">Usage</h3>
              <div className="mt-4 space-y-3">
                <UsageBar label="Properties" current={liveCounts.properties} max={planLimits.properties} />
                <UsageBar label="Employees" current={liveCounts.employees} max={planLimits.employees} />
                <UsageBar label="Portal users" current={liveCounts.activeAppUsers} max={planLimits.portalUsers} />
              </div>
            </Card>
            <Card className="border-destructive/40 p-4">
              <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
              <p className="mt-1 text-xs text-muted-foreground">Canceling stops renewal at period end (stub).</p>
              <Button variant="destructive" className="mt-4" disabled>
                Cancel subscription
              </Button>
            </Card>
          </div>
        )}

        {activePage === 'integrations' && (
          <div className="mx-auto max-w-4xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Integrations</h2>
              <p className="text-sm text-muted-foreground">Connected services and data sources.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <IntegrationCard title="Open-Meteo Weather" status="connected" description="Forecast and station-linked weather data." />
              <IntegrationCard title="Twilio SMS" status="disconnected" description="SMS alerts to crew phones." />
              <IntegrationCard title="Calendar export (.ics)" status="built-in" description="Subscribe to shifts from external calendars." />
              <IntegrationCard title="Stripe Billing" status="active" description="Plan and payment method on file." />
            </div>
          </div>
        )}
      </div>

      <Sheet open={!!propertySheetId} onOpenChange={(open) => !open && setPropertySheetId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit property</SheetTitle>
            <SheetDescription>Update site details and class assignment.</SheetDescription>
          </SheetHeader>
          {editingProperty && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium">Name</label>
                  <Input value={editingProperty.name} onChange={(e) => setProperties((c) => c.map((x) => (x.id === editingProperty.id ? { ...x, name: e.target.value } : x)))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium">Short name</label>
                  <Input value={editingProperty.shortName} onChange={(e) => setProperties((c) => c.map((x) => (x.id === editingProperty.id ? { ...x, shortName: e.target.value } : x)))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium">Type</label>
                  <Input
                    list={`pt-${editingProperty.id}`}
                    value={editingProperty.type}
                    onChange={(e) => setProperties((c) => c.map((x) => (x.id === editingProperty.id ? { ...x, type: e.target.value } : x)))}
                    className="mt-1"
                  />
                  <datalist id={`pt-${editingProperty.id}`}>
                    <option value="Golf Course" />
                    <option value="Polo Club" />
                    <option value="Resort" />
                  </datalist>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium">Address</label>
                  <Input value={editingProperty.address} onChange={(e) => setProperties((c) => c.map((x) => (x.id === editingProperty.id ? { ...x, address: e.target.value } : x)))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium">City</label>
                  <Input value={editingProperty.city} onChange={(e) => setProperties((c) => c.map((x) => (x.id === editingProperty.id ? { ...x, city: e.target.value } : x)))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium">State</label>
                  <Input value={editingProperty.state} onChange={(e) => setProperties((c) => c.map((x) => (x.id === editingProperty.id ? { ...x, state: e.target.value } : x)))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium">Acreage</label>
                  <Input
                    value={String(editingProperty.acreage)}
                    onChange={(e) => setProperties((c) => c.map((x) => (x.id === editingProperty.id ? { ...x, acreage: Number(e.target.value || 0) } : x)))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Logo initials</label>
                  <Input
                    value={editingProperty.logoInitials}
                    onChange={(e) => setProperties((c) => c.map((x) => (x.id === editingProperty.id ? { ...x, logoInitials: e.target.value.toUpperCase().slice(0, 3) } : x)))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Brand color</label>
                  <Input
                    type="color"
                    value={editingProperty.color}
                    onChange={(e) => setProperties((c) => c.map((x) => (x.id === editingProperty.id ? { ...x, color: e.target.value } : x)))}
                    className="mt-1 h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Status</label>
                  <select
                    value={editingProperty.status}
                    onChange={(e) => setProperties((c) => c.map((x) => (x.id === editingProperty.id ? { ...x, status: e.target.value as Property['status'] } : x)))}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium">Property class</label>
                  <select
                    value={editingProperty.propertyClassId || ''}
                    onChange={(e) => setProperties((c) => c.map((x) => (x.id === editingProperty.id ? { ...x, propertyClassId: e.target.value || undefined } : x)))}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">None</option>
                    {propertyClasses.map((pc) => (
                      <option key={pc.id} value={pc.id}>
                        {pc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Latitude</label>
                  <Input
                    value={editingProperty.latitude ?? ''}
                    onChange={(e) =>
                      setProperties((c) =>
                        c.map((x) => (x.id === editingProperty.id ? { ...x, latitude: e.target.value ? Number(e.target.value) : undefined } : x)),
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Longitude</label>
                  <Input
                    value={editingProperty.longitude ?? ''}
                    onChange={(e) =>
                      setProperties((c) =>
                        c.map((x) => (x.id === editingProperty.id ? { ...x, longitude: e.target.value ? Number(e.target.value) : undefined } : x)),
                      )
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}
          <SheetFooter className="mt-8">
            <Button variant="outline" onClick={() => setPropertySheetId(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                savePropertiesTab();
                setPropertySheetId(null);
              }}
            >
              Save property
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={!!shiftSheetId} onOpenChange={(open) => !open && setShiftSheetId(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit shift template</SheetTitle>
            <SheetDescription>Adjust name, times, and active days.</SheetDescription>
          </SheetHeader>
          {editingShift && (
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-medium">Name</label>
                <Input value={editingShift.name} onChange={(e) => setShiftTemplates((c) => c.map((x) => (x.id === editingShift.id ? { ...x, name: e.target.value } : x)))} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Start</label>
                  <Input value={editingShift.start} onChange={(e) => setShiftTemplates((c) => c.map((x) => (x.id === editingShift.id ? { ...x, start: e.target.value } : x)))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium">End</label>
                  <Input value={editingShift.end} onChange={(e) => setShiftTemplates((c) => c.map((x) => (x.id === editingShift.id ? { ...x, end: e.target.value } : x)))} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Days</label>
                <div className="mt-2 flex flex-wrap gap-1">
                  {weekDays.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={cn(
                        'rounded-full border px-2 py-1 text-[10px]',
                        editingShift.days.includes(day) ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
                      )}
                      onClick={() =>
                        setShiftTemplates((c) =>
                          c.map((entry) => {
                            if (entry.id !== editingShift.id) return entry;
                            return {
                              ...entry,
                              days: entry.days.includes(day) ? entry.days.filter((v) => v !== day) : [...entry.days, day],
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
            </div>
          )}
          <SheetFooter className="mt-8">
            <Button variant="outline" onClick={() => setShiftSheetId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                saveShiftPlans();
                setShiftSheetId(null);
              }}
            >
              Save template
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function UsageBar({ label, current, max }: { label: string; current: number; max: number }) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {current} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function IntegrationCard({ title, description, status }: { title: string; description: string; status: 'connected' | 'disconnected' | 'active' | 'built-in' }) {
  const dot =
    status === 'connected' || status === 'active' || status === 'built-in' ? 'bg-emerald-500' : 'bg-muted-foreground/40';
  const label =
    status === 'connected' ? 'Connected' : status === 'disconnected' ? 'Not connected' : status === 'built-in' ? 'Built-in' : 'Active';
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <span className={cn('h-2 w-2 rounded-full', dot)} />
          {label}
        </span>
      </div>
      <Button variant="outline" size="sm" className="mt-4 w-full" disabled>
        Configure
      </Button>
    </Card>
  );
}

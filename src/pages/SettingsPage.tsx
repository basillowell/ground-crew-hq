import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared';
import { Settings, Users, ListChecks, MapPin, Clock, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { DepartmentOption, GroupOption, ProgramSettings, ShiftTemplate, WorkLocation } from '@/data/seedData';
import {
  loadDepartmentOptions,
  loadGroupOptions,
  loadProgramSettings,
  loadShiftTemplates,
  loadWorkLocations,
  saveDepartmentOptions,
  saveGroupOptions,
  saveProgramSettings,
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

export default function SettingsPage() {
  const [programSetting, setProgramSetting] = useState<ProgramSettings | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);

  useEffect(() => {
    setProgramSetting(loadProgramSettings()[0] ?? null);
    setDepartmentOptions(loadDepartmentOptions());
    setGroupOptions(loadGroupOptions());
    setWorkLocations(loadWorkLocations());
    setShiftTemplates(loadShiftTemplates());
  }, []);

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    groupOptions.forEach((group, index) => counts.set(group.name, index + 1));
    return counts;
  }, [groupOptions]);

  function saveGeneralSettings() {
    if (!programSetting) return;
    saveProgramSettings([programSetting]);
    announceProgramSetupUpdate();
    toast('Program setup saved', {
      description: `${programSetting.organizationName} is now the active club profile.`,
    });
  }

  function saveStructures() {
    saveDepartmentOptions(departmentOptions);
    saveGroupOptions(groupOptions);
    announceProgramSetupUpdate();
    toast('Groups and departments saved', {
      description: 'The top bar and workforce setup now use your updated club structure.',
    });
  }

  function saveLocations() {
    saveWorkLocations(workLocations);
    toast('Locations saved', {
      description: `${workLocations.length} work locations are now stored for this club.`,
    });
  }

  function saveShiftPlans() {
    saveShiftTemplates(shiftTemplates);
    toast('Shift templates saved', {
      description: `${shiftTemplates.length} reusable shift patterns are ready for scheduling.`,
    });
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <PageHeader
        title="Program Setup"
        subtitle="Customize the club profile, workforce structure, operational locations, and reusable shift plans for each property."
        badge={<Badge variant="secondary">{programSetting?.organizationName ?? 'Club profile'}</Badge>}
      />

      <Tabs defaultValue="general">
        <TabsList className="h-8 mb-4 flex-wrap">
          <TabsTrigger value="general" className="text-xs gap-1"><Settings className="h-3 w-3" /> General</TabsTrigger>
          <TabsTrigger value="groups" className="text-xs gap-1"><Users className="h-3 w-3" /> Groups</TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs gap-1"><ListChecks className="h-3 w-3" /> Setup Notes</TabsTrigger>
          <TabsTrigger value="locations" className="text-xs gap-1"><MapPin className="h-3 w-3" /> Locations</TabsTrigger>
          <TabsTrigger value="shifts" className="text-xs gap-1"><Clock className="h-3 w-3" /> Shifts</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Organization Name</label>
                <Input
                  value={programSetting?.organizationName ?? ''}
                  onChange={(event) => setProgramSetting((current) => current ? { ...current, organizationName: event.target.value } : current)}
                  className="mt-1"
                />
              </div>
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
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-sm font-medium">Enable Mobile App</div>
                  <div className="text-xs text-muted-foreground">Allow field crews to access via mobile</div>
                </div>
                <Switch
                  checked={programSetting?.enableMobileApp ?? false}
                  onCheckedChange={(checked) => setProgramSetting((current) => current ? { ...current, enableMobileApp: checked } : current)}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-sm font-medium">Overtime Tracking</div>
                  <div className="text-xs text-muted-foreground">Track weekly overtime hours automatically</div>
                </div>
                <Switch
                  checked={programSetting?.overtimeTracking ?? false}
                  onCheckedChange={(checked) => setProgramSetting((current) => current ? { ...current, overtimeTracking: checked } : current)}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-sm font-medium">Equipment QR Codes</div>
                  <div className="text-xs text-muted-foreground">Enable QR scanning for equipment check-in</div>
                </div>
                <Switch
                  checked={programSetting?.equipmentQrCodes ?? false}
                  onCheckedChange={(checked) => setProgramSetting((current) => current ? { ...current, equipmentQrCodes: checked } : current)}
                />
              </div>
            </div>
            <Button onClick={saveGeneralSettings}>Save Changes</Button>
          </Card>
        </TabsContent>

        <TabsContent value="groups">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium">Departments</p>
                  <p className="text-xs text-muted-foreground">Controls the top-bar selector and roster structure.</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setDepartmentOptions((current) => [...current, { id: makeId('dep'), name: `Department ${current.length + 1}` }])}
                >
                  <Plus className="h-3 w-3" /> Add Department
                </Button>
              </div>
              <div className="space-y-2">
                {departmentOptions.map((department) => (
                  <div key={department.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <Input
                      value={department.name}
                      onChange={(event) =>
                        setDepartmentOptions((current) =>
                          current.map((entry) => entry.id === department.id ? { ...entry, name: event.target.value } : entry),
                        )
                      }
                      className="h-8 flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDepartmentOptions((current) => current.filter((entry) => entry.id !== department.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium">Employee Groups</p>
                  <p className="text-xs text-muted-foreground">Use crew groups that match each club’s routing and specialties.</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() =>
                    setGroupOptions((current) => [
                      ...current,
                      { id: makeId('grp'), name: `Group ${current.length + 1}`, color: '#2f855a' },
                    ])
                  }
                >
                  <Plus className="h-3 w-3" /> Add Group
                </Button>
              </div>
              <div className="space-y-2">
                {groupOptions.map((group) => (
                  <div key={group.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <input
                      type="color"
                      value={group.color}
                      onChange={(event) =>
                        setGroupOptions((current) =>
                          current.map((entry) => entry.id === group.id ? { ...entry, color: event.target.value } : entry),
                        )
                      }
                      className="h-8 w-10 rounded border bg-transparent"
                    />
                    <Input
                      value={group.name}
                      onChange={(event) =>
                        setGroupOptions((current) =>
                          current.map((entry) => entry.id === group.id ? { ...entry, name: event.target.value } : entry),
                        )
                      }
                      className="h-8 flex-1"
                    />
                    <Badge variant="outline" className="text-xs">
                      Crew {groupCounts.get(group.name) ?? 0}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setGroupOptions((current) => current.filter((entry) => entry.id !== group.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="mt-4">
            <Button onClick={saveStructures}>Save Groups and Departments</Button>
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <Card className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Task defaults are now driven from the live task catalog. Use Program Setup for club-wide profile rules, then manage operational tasks from the Tasks module.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Club Profile</p>
                <p className="mt-2 text-lg font-semibold">{programSetting?.organizationName ?? 'Club profile'}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Departments</p>
                <p className="mt-2 text-lg font-semibold">{departmentOptions.length}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Shift Templates</p>
                <p className="mt-2 text-lg font-semibold">{shiftTemplates.length}</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="locations">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium">Work Locations</p>
                <p className="text-xs text-muted-foreground">Define the operational places this club needs for routing, notes, weather area setup, and application context.</p>
              </div>
              <Button
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setWorkLocations((current) => [...current, { id: makeId('loc'), name: `Location ${current.length + 1}` }])}
              >
                <Plus className="h-3 w-3" /> Add Location
              </Button>
            </div>
            <div className="space-y-2">
              {workLocations.map((location) => (
                <div key={location.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={location.name}
                    onChange={(event) =>
                      setWorkLocations((current) =>
                        current.map((entry) => entry.id === location.id ? { ...entry, name: event.target.value } : entry),
                      )
                    }
                    className="h-8 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setWorkLocations((current) => current.filter((entry) => entry.id !== location.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button onClick={saveLocations}>Save Locations</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="shifts">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium">Shift Templates</p>
                <p className="text-xs text-muted-foreground">Store reusable labor patterns for each club without hardcoding them in the scheduler.</p>
              </div>
              <Button
                size="sm"
                className="gap-1 text-xs"
                onClick={() =>
                  setShiftTemplates((current) => [
                    ...current,
                    { id: makeId('shift'), name: `Shift ${current.length + 1}`, start: '06:00', end: '14:30', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
                  ])
                }
              >
                <Plus className="h-3 w-3" /> Add Shift
              </Button>
            </div>
            <div className="space-y-3">
              {shiftTemplates.map((shift) => (
                <div key={shift.id} className="p-3 rounded-lg border">
                  <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_0.7fr_auto] md:items-center">
                    <Input
                      value={shift.name}
                      onChange={(event) =>
                        setShiftTemplates((current) =>
                          current.map((entry) => entry.id === shift.id ? { ...entry, name: event.target.value } : entry),
                        )
                      }
                      className="h-8"
                    />
                    <span className="text-xs font-mono text-muted-foreground">{shift.start} – {shift.end}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
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
                                days: shift.days.includes(day)
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
            <div className="mt-4">
              <Button onClick={saveShiftPlans}>Save Shift Templates</Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

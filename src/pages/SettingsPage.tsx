import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared';
import { Settings, Users, ListChecks, MapPin, Clock, Plus, Trash2, GripVertical } from 'lucide-react';
import { groups, departments } from '@/data/seedData';

const locations = [
  'Greens 1-9', 'Greens 10-18', 'Fairways 1-9', 'Fairways 10-18',
  'Practice Range', 'Clubhouse', 'Cart Paths', 'Bunkers', 'Irrigation Pump House',
];

const shiftTemplates = [
  { name: 'Morning Crew', start: '05:00', end: '13:30', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { name: 'Day Crew', start: '06:00', end: '14:30', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { name: 'Weekend Crew', start: '06:00', end: '12:00', days: ['Sat', 'Sun'] },
  { name: 'Late Shift', start: '10:00', end: '18:00', days: ['Mon', 'Wed', 'Fri'] },
];

export default function SettingsPage() {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <PageHeader title="Program Setup" />

      <Tabs defaultValue="general">
        <TabsList className="h-8 mb-4 flex-wrap">
          <TabsTrigger value="general" className="text-xs gap-1"><Settings className="h-3 w-3" /> General</TabsTrigger>
          <TabsTrigger value="groups" className="text-xs gap-1"><Users className="h-3 w-3" /> Groups</TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs gap-1"><ListChecks className="h-3 w-3" /> Task Settings</TabsTrigger>
          <TabsTrigger value="locations" className="text-xs gap-1"><MapPin className="h-3 w-3" /> Locations</TabsTrigger>
          <TabsTrigger value="shifts" className="text-xs gap-1"><Clock className="h-3 w-3" /> Shifts</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Organization Name</label>
                <Input defaultValue="Pine Valley Golf Club" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Default Department</label>
                <Input defaultValue="Maintenance" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Time Zone</label>
                <Input defaultValue="Eastern Time (ET)" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Fiscal Year Start</label>
                <Input defaultValue="January" className="mt-1" />
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-sm font-medium">Enable Mobile App</div>
                  <div className="text-xs text-muted-foreground">Allow field crews to access via mobile</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-sm font-medium">Overtime Tracking</div>
                  <div className="text-xs text-muted-foreground">Track weekly overtime hours automatically</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-sm font-medium">Equipment QR Codes</div>
                  <div className="text-xs text-muted-foreground">Enable QR scanning for equipment check-in</div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            <Button>Save Changes</Button>
          </Card>
        </TabsContent>

        <TabsContent value="groups">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">Manage employee groups and departments</p>
              <Button size="sm" className="gap-1 text-xs"><Plus className="h-3 w-3" /> Add Group</Button>
            </div>
            <div className="space-y-2">
              {groups.map((g, i) => (
                <div key={g} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/20 transition-colors">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
                  <div className="w-3 h-3 rounded-full bg-primary" style={{ opacity: 1 - i * 0.1 }} />
                  <Input defaultValue={g} className="h-8 flex-1" />
                  <Badge variant="outline" className="text-xs">
                    {Math.floor(Math.random() * 5) + 1} employees
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Configure default task settings</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Default Task Duration</label>
                <Input defaultValue="60" type="number" className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Minutes</p>
              </div>
              <div>
                <label className="text-sm font-medium">Max Tasks Per Employee</label>
                <Input defaultValue="6" type="number" className="mt-1" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-sm font-medium">Allow Task Overlap</div>
                  <div className="text-xs text-muted-foreground">Let employees have overlapping task times</div>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-sm font-medium">Auto-assign Equipment</div>
                  <div className="text-xs text-muted-foreground">Suggest equipment based on task type</div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            <Button>Save Changes</Button>
          </Card>
        </TabsContent>

        <TabsContent value="locations">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">Define course areas and work locations</p>
              <Button size="sm" className="gap-1 text-xs"><Plus className="h-3 w-3" /> Add Location</Button>
            </div>
            <div className="space-y-2">
              {locations.map(loc => (
                <div key={loc} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/20 transition-colors">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input defaultValue={loc} className="h-8 flex-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="shifts">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">Configure shift templates for scheduling</p>
              <Button size="sm" className="gap-1 text-xs"><Plus className="h-3 w-3" /> Add Shift</Button>
            </div>
            <div className="space-y-3">
              {shiftTemplates.map(shift => (
                <div key={shift.name} className="p-3 rounded-lg border hover:border-primary/20 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{shift.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{shift.start} – {shift.end}</span>
                  </div>
                  <div className="flex gap-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <Badge
                        key={day}
                        variant={shift.days.includes(day) ? 'default' : 'outline'}
                        className="text-[10px] px-1.5"
                      >
                        {day}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

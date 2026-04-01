import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, ListChecks, MapPin, Clock } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-lg font-semibold mb-4">Program Setup</h2>

      <Tabs defaultValue="general">
        <TabsList className="h-8 mb-4">
          <TabsTrigger value="general" className="text-xs gap-1"><Settings className="h-3 w-3" /> General</TabsTrigger>
          <TabsTrigger value="groups" className="text-xs gap-1"><Users className="h-3 w-3" /> Groups</TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs gap-1"><ListChecks className="h-3 w-3" /> Task Settings</TabsTrigger>
          <TabsTrigger value="locations" className="text-xs gap-1"><MapPin className="h-3 w-3" /> Locations</TabsTrigger>
          <TabsTrigger value="shifts" className="text-xs gap-1"><Clock className="h-3 w-3" /> Shifts</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="p-6 space-y-4">
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
            <Button>Save Changes</Button>
          </Card>
        </TabsContent>

        {['groups', 'tasks', 'locations', 'shifts'].map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card className="p-8 text-center text-muted-foreground">
              <p className="text-sm">Configure {tab} settings here</p>
              <Button variant="outline" className="mt-3">Set Up {tab}</Button>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

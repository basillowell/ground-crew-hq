import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useChemicalSettings } from '@/hooks/useChemicalSettings';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { toast } from '@/components/ui/sonner';
import ProductManager from '@/components/chemicals/ProductManager';
import { useEmployees, useProperties } from '@/lib/supabase-queries';

export default function ChemicalSettings() {
  const { currentUser } = useOrgProfile();
  const orgId = currentUser?.orgId;
  const { data: liveProperties = [], isLoading: propertiesLoading } = useProperties(orgId);
  const { data: liveEmployees = [], isLoading: employeesLoading } = useEmployees(undefined, orgId, 'all');
  const { settings, setSettings, isLoading, isSaving, error, saveSettings } = useChemicalSettings();
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');

  const properties = useMemo(
    () => liveProperties.map(({ id, name }) => ({ id, name })),
    [liveProperties],
  );
  const employees = useMemo(
    () =>
      liveEmployees.map(({ id, firstName, lastName }) => ({
        id,
        firstName,
        lastName,
      })),
    [liveEmployees],
  );

  const canSave = useMemo(() => Boolean(settings && orgId), [settings, orgId]);

  if (!orgId || isLoading || propertiesLoading || employeesLoading || !settings) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Loading chemical settings...</p>
      </Card>
    );
  }

  const update = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSaveState('idle');
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  async function handleSave() {
    if (!canSave || !settings) return;
    const result = await saveSettings({
      default_property_id: settings.default_property_id,
      default_applicator_id: settings.default_applicator_id,
      rei_notification_hours: settings.rei_notification_hours,
      require_supervisor: settings.require_supervisor,
      default_area_unit: settings.default_area_unit,
    });
    if (!result.ok) {
      toast.error(`Failed to save chemical settings: ${result.error}`);
      return;
    }
    setSaveState('saved');
    toast.success('Chemical settings saved');
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Default Property</h3>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={settings.default_property_id ?? ''}
          onChange={(event) => update('default_property_id', event.target.value || null)}
        >
          <option value="">Select property</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Default Applicator</h3>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={settings.default_applicator_id ?? ''}
          onChange={(event) => update('default_applicator_id', event.target.value || null)}
        >
          <option value="">Select applicator</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </option>
          ))}
        </select>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Operational Defaults</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Default Area Unit</label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={settings.default_area_unit}
              onChange={(event) => update('default_area_unit', event.target.value)}
            >
              <option value="acres">acres</option>
              <option value="sq_ft">sq_ft</option>
              <option value="hectares">hectares</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">REI Notification Hours</label>
            <Input
              className="mt-1"
              type="number"
              min="0"
              value={settings.rei_notification_hours}
              onChange={(event) => update('rei_notification_hours', Number(event.target.value || 0))}
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Compliance Toggles</h3>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.require_supervisor}
            onChange={(event) => update('require_supervisor', event.target.checked)}
          />
          Require supervisor name and license
        </label>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!canSave || isSaving}>
          {isSaving ? 'Saving...' : 'Save Chemical Settings'}
        </Button>
        {saveState === 'saved' ? <span className="text-sm text-emerald-600">Saved</span> : null}
      </div>

      <ProductManager />
    </div>
  );
}


import { ChevronDown, Settings2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  activeLocation: {
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    isActive: boolean;
  } | null;
  enabledPanels: string[];
  onTogglePanel: (panelId: string, checked: boolean) => void;
  onChangeLocation: (name: string, address: string) => Promise<boolean> | boolean;
  onRefreshLiveWeather: () => void;
  onAddManualRainEntry: () => void;
};

const PANEL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'current-conditions', label: 'Current Conditions' },
  { id: 'hourly-forecast', label: 'Hourly Forecast' },
  { id: 'daily-forecast', label: '7-Day Forecast' },
  { id: 'wind', label: 'Wind' },
  { id: 'rain', label: 'Rainfall' },
  { id: 'alerts', label: 'Weather Alerts' },
  { id: 'turf-risk-notes', label: 'Turf Risk Notes' },
];

function CollapsibleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
        {title}
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-3">{children}</div>
    </details>
  );
}

export function WeatherSettingsDrawer(props: Props) {
  const {
    open,
    onOpenChange,
    isAdmin,
    activeLocation,
    enabledPanels,
    onTogglePanel,
    onChangeLocation,
    onRefreshLiveWeather,
    onAddManualRainEntry,
  } = props;
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locationName, setLocationName] = useState(activeLocation?.name ?? '');
  const [locationAddress, setLocationAddress] = useState(activeLocation?.address ?? '');
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocationName(activeLocation?.name ?? '');
    setLocationAddress(activeLocation?.address ?? '');
    setShowLocationForm(false);
    setLocationError(null);
  }, [activeLocation?.address, activeLocation?.name, open]);

  async function handleSaveLocation() {
    const trimmedName = locationName.trim();
    if (!trimmedName) return;
    setLocationError(null);
    const saved = await onChangeLocation(trimmedName, locationAddress.trim());
    if (saved) {
      setShowLocationForm(false);
      onOpenChange(false);
      return;
    }
    setLocationError('Could not save location. Please try again.');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-[400px]">
        <SheetHeader className="px-4 pt-4">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Weather Settings
            </SheetTitle>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenChange(false)} aria-label="Close weather settings">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        <div className="mt-3">
          <section className="border-b p-4">
            <h3 className="text-sm font-semibold">Active Location</h3>
            <Card className="mt-3 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{activeLocation?.name ?? 'No location configured'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {typeof activeLocation?.latitude === 'number' && typeof activeLocation?.longitude === 'number'
                      ? `${activeLocation.latitude.toFixed(4)}, ${activeLocation.longitude.toFixed(4)}`
                      : 'Coordinates unavailable'}
                  </p>
                </div>
                <Badge variant={activeLocation?.isActive ? 'secondary' : 'outline'}>
                  {activeLocation?.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </Card>
            <Button className="mt-3 w-full" variant="outline" onClick={() => setShowLocationForm((current) => !current)}>
              Change location
            </Button>
            {showLocationForm ? (
              <div className="mt-3 space-y-2">
                <Input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Location name" />
                <Input value={locationAddress} onChange={(event) => setLocationAddress(event.target.value)} placeholder="Address" />
                <Button className="w-full" onClick={() => void handleSaveLocation()} disabled={!locationName.trim()}>
                  Save location
                </Button>
                {locationError ? (
                  <p className="text-xs text-destructive">{locationError}</p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="border-b p-4">
            <h3 className="text-sm font-semibold">Display Panels</h3>
            <p className="mt-1 text-xs text-muted-foreground">What to show on the weather page</p>
            <div className="mt-3 space-y-2">
              {PANEL_OPTIONS.map((panel) => (
                <label key={panel.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <span>{panel.label}</span>
                  <Checkbox checked={enabledPanels.includes(panel.id)} onCheckedChange={(checked) => onTogglePanel(panel.id, Boolean(checked))} />
                </label>
              ))}
            </div>
          </section>

          {isAdmin ? (
            <section className="p-4">
              <CollapsibleSection title="Advanced">
                <div className="space-y-2">
                  <Button className="w-full" variant="outline" onClick={onRefreshLiveWeather}>
                    Refresh Live Weather
                  </Button>
                  <Button className="w-full" variant="outline" onClick={onAddManualRainEntry}>
                    Add Manual Rain Entry
                  </Button>
                </div>
              </CollapsibleSection>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

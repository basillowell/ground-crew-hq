import { ChevronDown, GripVertical, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { WeatherWidgetId } from '@/components/weather/OperationsView';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  widgets: WeatherWidgetId[];
  enabledWidgets: WeatherWidgetId[];
  onToggleWidget: (widget: WeatherWidgetId, checked: boolean) => void;
  onMoveWidget: (widget: WeatherWidgetId, direction: 'up' | 'down') => void;
  locationOptions: Array<{ id: string; label: string }>;
  selectedLocationId: string;
  onSelectLocationId: (id: string) => void;
  adminStationAreaContent?: ReactNode;
  adminManualFallbackContent?: ReactNode;
  children?: ReactNode;
};

const LABELS: Record<WeatherWidgetId, string> = {
  current: 'Current conditions',
  hourly_forecast: 'Hourly forecast',
  wind: 'Wind',
  precipitation: 'Precipitation',
  humidity: 'Humidity',
  uv_index: 'UV index',
  feels_like: 'Feels like',
  '7day_forecast': '7-day forecast',
};

function CollapsibleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="group rounded-xl border bg-card">
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
    widgets,
    enabledWidgets,
    onToggleWidget,
    onMoveWidget,
    locationOptions,
    selectedLocationId,
    onSelectLocationId,
    adminStationAreaContent,
    adminManualFallbackContent,
    children,
  } = props;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Weather Settings
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <CollapsibleSection title="1. Widget preferences">
            <div className="space-y-2">
              {widgets.map((widget, index) => (
                <Card key={widget} className="flex items-center justify-between rounded-xl p-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Checkbox
                      checked={enabledWidgets.includes(widget)}
                      onCheckedChange={(checked) => onToggleWidget(widget, Boolean(checked))}
                    />
                    <span className="text-sm">{LABELS[widget]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" disabled={index === 0} onClick={() => onMoveWidget(widget, 'up')}>
                      Up
                    </Button>
                    <Button size="sm" variant="outline" disabled={index === widgets.length - 1} onClick={() => onMoveWidget(widget, 'down')}>
                      Down
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="2. Location filter">
            <div className="space-y-2">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedLocationId}
                onChange={(event) => onSelectLocationId(event.target.value)}
              >
                <option value="">Default location</option>
                {locationOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Choose which weather area feeds the operations widgets.</p>
            </div>
          </CollapsibleSection>

          {isAdmin ? (
            <>
              <CollapsibleSection title="3. Station & area setup">
                <div className="space-y-3">
                  {adminStationAreaContent}
                  {children}
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="4. Manual fallback">{adminManualFallbackContent}</CollapsibleSection>
            </>
          ) : (
            <Card className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
              <Badge variant="outline">Standard User</Badge>
              <p className="mt-2">Station, area, and manual fallback controls are visible to admins/managers only.</p>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

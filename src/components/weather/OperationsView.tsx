import { EyeOff, Gauge, Wind } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAndLogOpenMeteoWeather } from '@/lib/weather/fetchAndLog';

export type WeatherWidgetId =
  | 'current'
  | 'hourly_forecast'
  | 'wind'
  | 'precipitation'
  | 'humidity'
  | 'uv_index'
  | 'feels_like'
  | '7day_forecast';

export type WeatherWidgetLiveData = {
  source: string;
  locationLabel: string;
  lastUpdatedLabel: string;
  current: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    windGust: number;
    windDirection: number;
    precipitation: number;
    uvIndex: number;
  };
  hourly: Array<{
    time: string;
    temperature: number;
    windSpeed: number;
    precipitationProbability: number;
  }>;
  daily: Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    precipitationSum: number;
  }>;
};

type OperationsViewProps = {
  widgets: WeatherWidgetId[];
  data: WeatherWidgetLiveData | null;
  loading: boolean;
  errorMessage?: string;
  onDisableWidget: (widgetId: WeatherWidgetId) => void;
};

const WIDGET_LABEL: Record<WeatherWidgetId, string> = {
  current: 'Current Conditions',
  hourly_forecast: 'Hourly Forecast (24h)',
  wind: 'Wind',
  precipitation: 'Precipitation',
  humidity: 'Humidity',
  uv_index: 'UV Index',
  feels_like: 'Feels Like',
  '7day_forecast': '7-Day Forecast',
};

function WidgetShell({
  widgetId,
  onDisable,
  children,
}: {
  widgetId: WeatherWidgetId;
  onDisable: (widgetId: WeatherWidgetId) => void;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl border p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold">{WIDGET_LABEL[widgetId]}</h4>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => onDisable(widgetId)}
          aria-label={`Disable ${WIDGET_LABEL[widgetId]}`}
        >
          <EyeOff className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </Card>
  );
}

export function OperationsView({ widgets, data, loading, errorMessage, onDisableWidget }: OperationsViewProps) {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!data || loading || errorMessage || !currentUser?.orgId) return;
    void fetchAndLogOpenMeteoWeather({
      orgId: currentUser.orgId,
      data: {
        source: data.source,
        locationLabel: data.locationLabel,
        current: {
          temperature: data.current.temperature,
          humidity: data.current.humidity,
          windSpeed: data.current.windSpeed,
          precipitation: data.current.precipitation,
        },
        daily: data.daily.map((day) => ({
          date: day.date,
          tempMax: day.tempMax,
          tempMin: day.tempMin,
          precipitationSum: day.precipitationSum,
        })),
      },
    });
  }, [currentUser?.orgId, data, errorMessage, loading]);

  if (loading) {
    return (
      <Card className="rounded-2xl border p-4">
        <p className="text-sm text-muted-foreground">Loading weather widgets...</p>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card className="rounded-2xl border border-destructive/40 p-4">
        <p className="text-sm font-medium text-destructive">Weather widget data is unavailable.</p>
        <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>
      </Card>
    );
  }

  if (!widgets.length) {
    return (
      <Card className="rounded-2xl border border-dashed p-6 text-center">
        <p className="text-sm font-medium">No widgets enabled - open settings to add</p>
      </Card>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{data?.locationLabel ?? 'Sarasota Polo Club'}</Badge>
        <Badge variant="outline">{data?.source ?? 'Open-Meteo'}</Badge>
        <Badge variant="outline">{data?.lastUpdatedLabel ?? 'Live now'}</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {widgets.includes('current') && (
          <WidgetShell widgetId="current" onDisable={onDisableWidget}>
            <div className="text-2xl font-semibold">{Math.round(data?.current.temperature ?? 0)}°F</div>
            <p className="mt-1 text-xs text-muted-foreground">Current air temperature</p>
          </WidgetShell>
        )}
        {widgets.includes('hourly_forecast') && (
          <WidgetShell widgetId="hourly_forecast" onDisable={onDisableWidget}>
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {(data?.hourly ?? []).slice(0, 24).map((point) => (
                  <div key={point.time} className="w-[90px] rounded-xl border bg-muted/30 p-2 text-xs">
                    <div className="font-medium">{new Date(point.time).toLocaleTimeString([], { hour: 'numeric' })}</div>
                    <div>{Math.round(point.temperature)}°F</div>
                    <div className="text-muted-foreground">{Math.round(point.precipitationProbability)}% rain</div>
                  </div>
                ))}
              </div>
            </div>
          </WidgetShell>
        )}
        {widgets.includes('wind') && (
          <WidgetShell widgetId="wind" onDisable={onDisableWidget}>
            <div className="flex items-center gap-2 text-sm">
              <Wind className="h-4 w-4" />
              <span>{Math.round(data?.current.windSpeed ?? 0)} mph</span>
              <span className="text-muted-foreground">gust {Math.round(data?.current.windGust ?? 0)} mph</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Direction: {Math.round(data?.current.windDirection ?? 0)}°</p>
          </WidgetShell>
        )}
        {widgets.includes('precipitation') && (
          <WidgetShell widgetId="precipitation" onDisable={onDisableWidget}>
            <p className="text-sm font-medium">{Number(data?.current.precipitation ?? 0).toFixed(2)} in/hr</p>
            <p className="mt-1 text-xs text-muted-foreground">Current precipitation intensity</p>
          </WidgetShell>
        )}
        {widgets.includes('humidity') && (
          <WidgetShell widgetId="humidity" onDisable={onDisableWidget}>
            <p className="text-sm font-medium">{Math.round(data?.current.humidity ?? 0)}%</p>
            <p className="mt-1 text-xs text-muted-foreground">Relative humidity</p>
          </WidgetShell>
        )}
        {widgets.includes('uv_index') && (
          <WidgetShell widgetId="uv_index" onDisable={onDisableWidget}>
            <div className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4" />
              <span>UV {Number(data?.current.uvIndex ?? 0).toFixed(1)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Current UV exposure index</p>
          </WidgetShell>
        )}
        {widgets.includes('feels_like') && (
          <WidgetShell widgetId="feels_like" onDisable={onDisableWidget}>
            <p className="text-sm font-medium">{Math.round(data?.current.feelsLike ?? 0)}°F</p>
            <p className="mt-1 text-xs text-muted-foreground">Apparent temperature</p>
          </WidgetShell>
        )}
        {widgets.includes('7day_forecast') && (
          <WidgetShell widgetId="7day_forecast" onDisable={onDisableWidget}>
            <div className="space-y-1">
              {(data?.daily ?? []).slice(0, 7).map((day) => (
                <div key={day.date} className="flex items-center justify-between text-xs">
                  <span>{new Date(day.date).toLocaleDateString([], { weekday: 'short' })}</span>
                  <span>
                    {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
                  </span>
                  <span className="text-muted-foreground">{day.precipitationSum.toFixed(2)} in</span>
                </div>
              ))}
            </div>
          </WidgetShell>
        )}
      </div>
    </section>
  );
}

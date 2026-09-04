import { useState } from 'react';
import { AlertTriangle, CloudSun, Droplets, ShieldCheck, Thermometer, Wind, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type WorkboardWeatherSnapshot = {
  locationName: string;
  propertyName: string | null;
  area: string | null;
  currentConditions: string | null;
  forecast: string | null;
  temperatureF: number | null;
  windMph: number | null;
  rainfallIn: number | null;
  source: string | null;
};

type WorkboardWeatherSafetyStripProps = {
  weather: WorkboardWeatherSnapshot | null;
  isWeatherLoading: boolean;
  weatherErrorMessage?: string | null;
  propertyLabel: string;
};

function formatWeatherNumber(value: number | null, suffix: string) {
  if (value === null || Number.isNaN(value)) return 'No data';
  return `${Math.round(value * 10) / 10}${suffix}`;
}

export function WorkboardWeatherSafetyStrip({
  weather,
  isWeatherLoading,
  weatherErrorMessage,
  propertyLabel,
}: WorkboardWeatherSafetyStripProps) {
  const [showSafetyBanner, setShowSafetyBanner] = useState(true);
  const locationLabel = weather?.locationName || propertyLabel;
  const forecastText = weather?.forecast || weather?.currentConditions || null;

  return (
    <div className="border-b border-surface-border bg-surface-base px-3 py-2 md:px-5">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-stretch">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-xl border border-surface-border bg-surface-card px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <CloudSun className="h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-text-primary">
                {isWeatherLoading ? 'Loading forecast...' : `Forecast · ${locationLabel}`}
              </p>
              <p className="truncate text-3xs text-text-muted">
                {weatherErrorMessage
                  ? 'Weather unavailable'
                  : weather?.area || weather?.propertyName || 'Board weather location'}
              </p>
            </div>
          </div>

          {weatherErrorMessage ? (
            <Badge variant="warning" className="ml-auto">
              Forecast unavailable
            </Badge>
          ) : (
            <div className="ml-auto flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="gap-1 border-surface-border bg-surface-elevated text-text-secondary">
                <Thermometer className="h-3 w-3" />
                {formatWeatherNumber(weather?.temperatureF ?? null, ' F')}
              </Badge>
              <Badge variant="secondary" className="gap-1 border-surface-border bg-surface-elevated text-text-secondary">
                <Wind className="h-3 w-3" />
                {formatWeatherNumber(weather?.windMph ?? null, ' mph')}
              </Badge>
              <Badge variant="secondary" className="gap-1 border-surface-border bg-surface-elevated text-text-secondary">
                <Droplets className="h-3 w-3" />
                {formatWeatherNumber(weather?.rainfallIn ?? null, '"')}
              </Badge>
              {weather?.source ? (
                <Badge variant="pending" className="uppercase">
                  {weather.source}
                </Badge>
              ) : null}
            </div>
          )}

          {forecastText && !weatherErrorMessage ? (
            <p className="basis-full truncate text-xs text-text-secondary">{forecastText}</p>
          ) : null}
        </div>

        {showSafetyBanner ? (
          <div className="flex items-start gap-2 rounded-xl border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-status-warning xl:w-[360px]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">PPE check before dispatch</p>
              <p className="text-3xs text-status-warning">
                Confirm eye, hearing, hand, and chemical protection before crews leave the shop.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-status-warning hover:bg-status-warning/10 hover:text-status-warning"
              onClick={() => setShowSafetyBanner(false)}
              aria-label="Dismiss PPE reminder"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-xs text-text-muted xl:w-[360px]">
            <AlertTriangle className="h-4 w-4 text-status-warning" />
            PPE reminder dismissed for this board session.
          </div>
        )}
      </div>
    </div>
  );
}

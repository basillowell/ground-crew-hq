import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { WeatherDailyLog, WeatherLocation } from '@/data/seedData';

interface WeatherSnapshotCardProps {
  location: WeatherLocation;
  log?: WeatherDailyLog;
  compact?: boolean;
  title?: string;
}

export function WeatherSnapshotCard({ location, log, compact = false, title = 'Weather Snapshot' }: WeatherSnapshotCardProps) {
  return (
    <Card className={`border-primary/10 bg-gradient-to-br from-background to-accent/30 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
          <h3 className="mt-1 text-base font-semibold">{location.name}</h3>
          <p className="text-xs text-muted-foreground">{location.property} - {location.area}</p>
        </div>
        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
          {log?.source === 'manual-override' ? 'Manual Override' : 'Station Feed'}
        </Badge>
      </div>

      {log ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-background/70 px-3 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Conditions</div>
            <div className="mt-1 text-sm font-medium">{log.currentConditions}</div>
            <div className="text-xs text-muted-foreground">{log.forecast}</div>
          </div>
          <div className="rounded-xl bg-background/70 px-3 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Rain / ET</div>
            <div className="mt-1 text-sm font-medium">{log.rainfallTotal.toFixed(2)} in rain</div>
            <div className="text-xs text-muted-foreground">{log.et.toFixed(2)} ET</div>
          </div>
          <div className="rounded-xl bg-background/70 px-3 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Temp / Humidity</div>
            <div className="mt-1 text-sm font-medium">{log.temperature} F</div>
            <div className="text-xs text-muted-foreground">{log.humidity}% humidity</div>
          </div>
          <div className="rounded-xl bg-background/70 px-3 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Wind</div>
            <div className="mt-1 text-sm font-medium">{log.wind} mph</div>
            <div className="text-xs text-muted-foreground">{log.date}</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
          No weather reading available for this location yet.
        </div>
      )}
    </Card>
  );
}

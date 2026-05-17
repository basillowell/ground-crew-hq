import { useMemo } from 'react';
import { Card } from '@/components/ui/card';

type HourlyPoint = {
  time: string;
  precipitationProbability: number;
  weatherCode: number;
};

interface StormTrackTimelineProps {
  hourly: HourlyPoint[];
}

function getScore(point: HourlyPoint) {
  const weatherMultiplier = point.weatherCode >= 61 ? 2 : 1;
  return (point.precipitationProbability / 100) * weatherMultiplier;
}

function getSegmentClasses(score: number) {
  if (score >= 0.8) return 'bg-red-500/80';
  if (score >= 0.5) return 'bg-orange-400/80';
  if (score >= 0.2) return 'bg-yellow-300/90';
  return 'bg-green-400/70';
}

function formatHourLabel(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleTimeString([], { hour: 'numeric' });
}

export function StormTrackTimeline({ hourly }: StormTrackTimelineProps) {
  const points = useMemo(() => hourly.slice(0, 12), [hourly]);
  const now = new Date();

  const markerIndex = useMemo(() => {
    const nearest = points.findIndex((point) => new Date(point.time).getTime() >= now.getTime());
    return nearest >= 0 ? nearest : 0;
  }, [now, points]);

  const nextStormPoint = useMemo(
    () =>
      points.find(
        (point) =>
          Number(point.precipitationProbability ?? 0) > 60 &&
          Number(point.weatherCode ?? 0) >= 61,
      ),
    [points],
  );

  const thunderstormPoint = useMemo(
    () => points.find((point) => Number(point.weatherCode ?? 0) >= 95),
    [points],
  );

  const summary = useMemo(() => {
    if (thunderstormPoint) {
      const target = new Date(thunderstormPoint.time);
      const hours = Math.max(0, Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60)));
      return `⛈️ Thunderstorm expected in ~${hours} hour${hours === 1 ? '' : 's'} (${target.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}) — review outdoor operations`;
    }
    if (nextStormPoint) {
      const target = new Date(nextStormPoint.time);
      const hours = Math.max(0, Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60)));
      return `🌧️ Rain expected in ~${hours} hour${hours === 1 ? '' : 's'} (${target.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})`;
    }
    return '✅ Clear conditions expected for the next 12 hours';
  }, [nextStormPoint, now, thunderstormPoint]);

  return (
    <Card className="rounded-2xl border p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Storm Track Timeline</h3>
      <p className="mt-1 text-xs text-muted-foreground">{summary}</p>

      <div className="mt-4 overflow-x-auto">
        <div className="relative flex min-w-[720px] gap-2">
          {points.map((point, index) => {
            const score = getScore(point);
            return (
              <div key={`${point.time}-${index}`} className="relative w-14 shrink-0">
                <div className={`h-16 rounded-md ${getSegmentClasses(score)}`} />
                <div className="mt-1 text-center text-[10px] text-muted-foreground">{formatHourLabel(point.time)}</div>
                <div className="text-center text-[10px] font-medium">{Math.round(point.precipitationProbability)}%</div>
              </div>
            );
          })}
          <div
            className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-black/70"
            style={{ left: `${Math.max(0, markerIndex) * 64 + 24}px` }}
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-20 animate-pulse bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </div>
      </div>
    </Card>
  );
}

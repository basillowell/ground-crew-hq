import { useMemo } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import type { OpenMeteoHourlyPoint } from '@/lib/openMeteo';

type ForecastRange = '12h' | '24h' | '48h' | '10d';

type HourlyForecastChartProps = {
  hourly: OpenMeteoHourlyPoint[];
  range: ForecastRange;
  onRangeChange: (range: ForecastRange) => void;
  showTemp: boolean;
  showRain: boolean;
  showWind: boolean;
  onToggleTemp: () => void;
  onToggleRain: () => void;
  onToggleWind: () => void;
};

function directionArrow(deg: number) {
  if (!Number.isFinite(deg)) return '•';
  if (deg >= 337.5 || deg < 22.5) return '↑';
  if (deg < 67.5) return '↗';
  if (deg < 112.5) return '→';
  if (deg < 157.5) return '↘';
  if (deg < 202.5) return '↓';
  if (deg < 247.5) return '↙';
  if (deg < 292.5) return '←';
  return '↖';
}

export function HourlyForecastChart({
  hourly,
  range,
  onRangeChange,
  showTemp,
  showRain,
  showWind,
  onToggleTemp,
  onToggleRain,
  onToggleWind,
}: HourlyForecastChartProps) {
  if (!hourly || hourly.length === 0) {
    return <div className="rounded-2xl border bg-white p-4 text-sm text-muted-foreground">Loading forecast data...</div>;
  }

  const hours = range === '12h' ? 12 : range === '48h' ? 48 : 24;
  const safeData = useMemo(
    () =>
      hourly.slice(0, hours).map((point, index) => {
        const date = new Date(point.time);
        const safeTemp = typeof point.temperature === 'number' && !Number.isNaN(point.temperature) ? Math.round(point.temperature) : null;
        const safeRainProb =
          typeof point.precipitationProbability === 'number' && !Number.isNaN(point.precipitationProbability)
            ? Math.round(point.precipitationProbability)
            : 0;
        const safePrecip = typeof point.precipitation === 'number' && !Number.isNaN(point.precipitation) ? Number(point.precipitation) : 0;
        const safeWind = typeof point.windSpeed === 'number' && !Number.isNaN(point.windSpeed) ? Math.round(point.windSpeed) : null;
        const safeWindDir = typeof point.windDirection === 'number' && !Number.isNaN(point.windDirection) ? Number(point.windDirection) : 0;
        return {
          id: `${point.time}-${index}`,
          hourLabel: date.toLocaleTimeString([], { hour: 'numeric' }),
          dayLabel: date.toLocaleDateString([], { weekday: 'short', day: 'numeric' }),
          timeMs: date.getTime(),
          temperature: safeTemp,
          precipitationProbability: safeRainProb,
          precipitation: safePrecip,
          windSpeed: safeWind,
          windDirection: safeWindDir,
          showDayBoundary: index > 0 && new Date(hourly[index - 1]?.time ?? point.time).getDate() !== date.getDate(),
        };
      }),
    [hourly, hours],
  );

  const currentHourLabel = useMemo(() => {
    if (!safeData.length) return null;
    const now = Date.now();
    const closest = safeData.reduce((best, point) => {
      if (!best) return point;
      return Math.abs(point.timeMs - now) < Math.abs(best.timeMs - now) ? point : best;
    }, safeData[0]);
    return closest.hourLabel;
  }, [safeData]);

  if (!safeData.length) {
    return <div className="rounded-2xl border bg-white p-4 text-sm text-muted-foreground">Loading forecast data...</div>;
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#111827]">Next {hours} Hours</p>
        <div className="flex flex-wrap items-center gap-2">
          {(['12h', '24h', '48h', '10d'] as const).map((nextRange) => (
            <Button
              key={nextRange}
              size="sm"
              variant={range === nextRange ? 'default' : 'outline'}
              className={range === nextRange ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''}
              onClick={() => onRangeChange(nextRange)}
            >
              {nextRange}
            </Button>
          ))}
          <Button size="sm" variant={showTemp ? 'default' : 'outline'} className={showTemp ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''} onClick={onToggleTemp}>Temp</Button>
          <Button size="sm" variant={showRain ? 'default' : 'outline'} className={showRain ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''} onClick={onToggleRain}>Rain %</Button>
          <Button size="sm" variant={showWind ? 'default' : 'outline'} className={showWind ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''} onClick={onToggleWind}>Wind</Button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', width: '100%' }}>
        <div style={{ width: `${Math.max(1, safeData.length) * 60}px`, minWidth: '100%' }}>
          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart data={safeData} margin={{ top: 14, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" />
              <XAxis dataKey="hourLabel" tick={{ fontSize: 11 }} interval={0} />
              <YAxis yAxisId="temp" domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={34} tickFormatter={(value) => `${value}°`} />
              <YAxis yAxisId="conditions" domain={['auto', 'auto']} orientation="right" tick={{ fontSize: 11 }} width={34} tickFormatter={(value) => `${value}`} />
              <Tooltip
                formatter={(value: number, name) => {
                  if (name === 'Temperature') return [`${value}°F`, name];
                  if (name === 'Rain %') return [`${value}%`, name];
                  if (name === 'Rain') return [`${Number(value).toFixed(2)} in`, name];
                  if (name === 'Wind') return [`${value} mph`, name];
                  return [value, name];
                }}
                labelFormatter={(label, payload) => {
                  const first = payload?.[0]?.payload as { dayLabel?: string; hourLabel?: string } | undefined;
                  return `${first?.dayLabel ?? ''} ${label ?? first?.hourLabel ?? ''}`.trim();
                }}
              />
              {currentHourLabel ? <ReferenceLine x={currentHourLabel} stroke="#166534" strokeDasharray="4 4" yAxisId="temp" /> : null}
              {safeData
                .filter((point) => point.showDayBoundary)
                .map((point) => (
                  <ReferenceLine key={`${point.id}-boundary`} x={point.hourLabel} stroke="#e5e7eb" />
                ))}
              {showRain ? <Area yAxisId="conditions" type="monotone" dataKey="precipitationProbability" name="Rain %" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={1.5} /> : null}
              {showRain ? <Bar yAxisId="conditions" dataKey="precipitation" name="Rain" fill="#14b8a6" fillOpacity={0.35} barSize={12} radius={[4, 4, 0, 0]} /> : null}
              {showTemp ? <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temperature" stroke="#166534" strokeWidth={1.8} strokeDasharray="5 4" dot={false} /> : null}
              {showWind ? <Line yAxisId="conditions" type="monotone" dataKey="windSpeed" name="Wind" stroke="#6b7280" strokeWidth={1.4} dot={false} /> : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-2 overflow-x-auto">
        <div style={{ width: `${Math.max(1, safeData.length) * 60}px` }} className="flex text-[11px] text-[#6b7280]">
          {safeData.map((point) => (
            <div key={`${point.id}-wind`} className="w-[60px] text-center">
              {directionArrow(point.windDirection ?? 0)}
              {point.windSpeed ?? '--'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
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

type HourlyPoint = {
  time: string;
  temp: number | null;
  precip: number | null;
  wind: number | null;
  rawDate: Date;
  isMidnight: boolean;
  dayLabel: string;
};

const BAR_HEIGHT = 80;

function safe(value: number | null | undefined, fallback = 0) {
  return value != null && Number.isFinite(value) ? value : fallback;
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
  if (!hourly?.length) {
    return (
      <div style={{ padding: '1rem', color: '#6b7280', fontSize: '14px' }}>
        Loading forecast data...
      </div>
    );
  }

  const hours = range === '12h' ? 12 : range === '48h' ? 48 : 24;
  const chartData = useMemo<HourlyPoint[]>(() => {
    return hourly.slice(0, hours).map((point) => {
      const rawDate = new Date(point.time);
      const hour = rawDate.getHours();
      return {
        time: rawDate.toLocaleTimeString([], { hour: 'numeric' }),
        temp: Number.isFinite(point.temperature) ? Math.round(point.temperature) : null,
        precip: Number.isFinite(point.precipitationProbability) ? Math.round(point.precipitationProbability) : 0,
        wind: Number.isFinite(point.windSpeed) ? Math.round(point.windSpeed) : null,
        rawDate,
        isMidnight: hour === 0,
        dayLabel: rawDate.toLocaleDateString([], { weekday: 'short', day: 'numeric' }),
      };
    });
  }, [hourly, hours]);

  if (!chartData.length) {
    return (
      <div style={{ padding: '1rem', color: '#6b7280', fontSize: '14px' }}>
        Loading forecast data...
      </div>
    );
  }

  const now = new Date();
  const currentHourIndex = chartData.findIndex((point) => {
    return point.rawDate.getHours() === now.getHours() && point.rawDate.toDateString() === now.toDateString();
  });

  const next8Hours = chartData.slice(0, 8);
  const next8HourRainInches = next8Hours.reduce((sum, point) => sum + (safe(point.precip) / 100) * 0.1, 0);
  const next8HourAvgWind = next8Hours.length
    ? Math.round(next8Hours.reduce((sum, point) => sum + safe(point.wind), 0) / next8Hours.length)
    : 0;

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
          <Button
            size="sm"
            variant={showTemp ? 'default' : 'outline'}
            className={showTemp ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''}
            onClick={onToggleTemp}
          >
            Temp
          </Button>
          <Button
            size="sm"
            variant={showRain ? 'default' : 'outline'}
            className={showRain ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''}
            onClick={onToggleRain}
          >
            Rain %
          </Button>
          <Button
            size="sm"
            variant={showWind ? 'default' : 'outline'}
            className={showWind ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''}
            onClick={onToggleWind}
          >
            Wind
          </Button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', width: '100%' }}>
        <div style={{ display: 'flex', minWidth: `${hours * 72}px`, gap: '0' }}>
          {chartData.map((point, index) => {
            const precip = safe(point.precip);
            const wind = safe(point.wind, 0);
            const barHeight = precip > 0 ? Math.max((precip / 100) * BAR_HEIGHT, 3) : 0;
            return (
              <div
                key={`${point.rawDate.toISOString()}-${index}`}
                style={{
                  width: '72px',
                  padding: '0 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  borderLeft: currentHourIndex === index ? '2px solid #166534' : '2px solid transparent',
                }}
              >
                {showTemp ? (
                  <div style={{ minHeight: '18px', fontSize: '13px', fontWeight: 700, color: '#166534' }}>
                    {`${Math.round(safe(point.temp, 0))}°`}
                  </div>
                ) : null}

                {showRain ? (
                  <div
                    style={{
                      position: 'relative',
                      height: `${BAR_HEIGHT}px`,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      borderRadius: '6px',
                      background: '#f8fafc',
                      overflow: 'hidden',
                    }}
                  >
                    {barHeight > 0 ? (
                      <div
                        style={{
                          width: '100%',
                          height: `${barHeight}px`,
                          background: '#bfdbfe',
                          borderTopLeftRadius: '6px',
                          borderTopRightRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {precip > 5 ? <span style={{ fontSize: '10px', color: '#ffffff', fontWeight: 600 }}>{precip}%</span> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div
                  style={{
                    marginTop: '6px',
                    paddingTop: point.isMidnight ? '4px' : '0',
                    borderTop: point.isMidnight ? '1px solid #d1d5db' : 'none',
                    fontSize: '11px',
                    color: '#6b7280',
                    fontWeight: point.isMidnight ? 600 : 400,
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}
                >
                  <div>{point.time}</div>
                  {point.isMidnight ? <div>{point.dayLabel}</div> : null}
                </div>

                {showWind ? (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#9ca3af', minHeight: '16px' }}>
                    {`↗ ${Math.round(wind)}`}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#e5e7eb] px-2.5 py-1 text-xs text-[#6b7280]">8h Rain {next8HourRainInches.toFixed(2)} in</span>
        <span className="rounded-full border border-[#e5e7eb] px-2.5 py-1 text-xs text-[#6b7280]">8h Avg Wind {next8HourAvgWind} mph</span>
        <span className="rounded-full border border-[#e5e7eb] px-2.5 py-1 text-xs text-[#6b7280]">Open-Meteo</span>
      </div>
    </div>
  );
}

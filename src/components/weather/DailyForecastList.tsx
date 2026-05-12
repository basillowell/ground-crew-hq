import { useMemo, useState } from 'react';
import type { OpenMeteoDailyPoint, OpenMeteoHourlyPoint } from '@/lib/openMeteo';
import { Button } from '@/components/ui/button';

type ForecastRange = '12h' | '24h' | '48h' | '10d';

type DailyForecastListProps = {
  daily: OpenMeteoDailyPoint[];
  hourlyData: OpenMeteoHourlyPoint[];
  range: ForecastRange;
  onRangeChange: (range: ForecastRange) => void;
};

type MiniHourPoint = {
  label: string;
  temp: number | null;
  precip: number;
  wind: number | null;
};

const MINI_BAR_HEIGHT = 48;

const weatherCondition = (code: number): string => {
  if (code === 0) return 'Sunny';
  if (code <= 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  return 'Storms';
};

const weatherEmoji = (code: number): string => {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫';
  if (code <= 67) return '🌧';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦';
  return '⛈';
};

function dayLabel(date: string, index: number) {
  const parsed = new Date(`${date}T00:00:00`);
  if (index === 0) return 'Today';
  return parsed.toLocaleDateString([], { day: 'numeric', weekday: 'short' });
}

function rainBadgeLabel(amount: number, probability: number) {
  if (amount > 0 && amount < 0.1) return '<0.1 in';
  if (amount > 0) return `${amount.toFixed(2)} in`;
  if (probability > 0) return `${Math.round(probability)}%`;
  return '0%';
}

function safeNumber(value: number | null | undefined, fallback = 0) {
  return value != null && Number.isFinite(value) ? value : fallback;
}

export function DailyForecastList({ daily, hourlyData, range, onRangeChange }: DailyForecastListProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  if (!daily || !Array.isArray(daily) || daily.length === 0) {
    return <div style={{ padding: '1rem', color: '#6b7280' }}>Loading forecast...</div>;
  }

  const hourlyByDay = useMemo(() => {
    return daily.reduce<Record<string, MiniHourPoint[]>>((acc, day) => {
      const points = hourlyData
        .filter((point) => point.time.startsWith(day.date))
        .map((point) => {
          const parsed = new Date(point.time);
          return {
            label: parsed.toLocaleTimeString([], { hour: 'numeric' }),
            temp: Number.isFinite(point.temperature) ? Math.round(point.temperature) : null,
            precip: Number.isFinite(point.precipitationProbability) ? Math.round(point.precipitationProbability) : 0,
            wind: Number.isFinite(point.windSpeed) ? Math.round(point.windSpeed) : null,
          };
        });
      acc[day.date] = points;
      return acc;
    }, {});
  }, [daily, hourlyData]);

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#111827]">10-Day Forecast</p>
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
        </div>
      </div>

      <div className="divide-y rounded-xl border">
        {daily.map((day, index) => {
          const high = typeof day.tempMax === 'number' && !Number.isNaN(day.tempMax) ? Math.round(day.tempMax) : '--';
          const low = typeof day.tempMin === 'number' && !Number.isNaN(day.tempMin) ? Math.round(day.tempMin) : '--';
          const rain = typeof day.precipitationSum === 'number' && !Number.isNaN(day.precipitationSum) ? day.precipitationSum : 0;
          const rainProb =
            typeof day.precipitationProbabilityMax === 'number' && !Number.isNaN(day.precipitationProbabilityMax)
              ? day.precipitationProbabilityMax
              : 0;
          const code = typeof day.weatherCode === 'number' && !Number.isNaN(day.weatherCode) ? day.weatherCode : 0;
          const showRainBadge = rain > 0 || rainProb > 20;
          const isExpanded = expandedDay === day.date;
          const dayHours = hourlyByDay[day.date] ?? [];

          return (
            <div key={`${day.date}-${index}`} className={index === 0 ? 'bg-[#f0fdf4]' : 'bg-white'}>
              <button
                type="button"
                onClick={() => setExpandedDay((current) => (current === day.date ? null : day.date))}
                className="grid w-full grid-cols-[36px_1fr_auto_auto] items-center gap-3 px-3 py-3 text-left"
              >
                <div className="text-2xl leading-none">{weatherEmoji(code)}</div>
                <div>
                  <div className="text-sm font-semibold text-[#111827]">{dayLabel(day.date, index)}</div>
                  <div className="text-xs text-[#6b7280]">{weatherCondition(code)}</div>
                </div>
                <div className="text-sm font-semibold text-[#111827]">
                  {String(high)}° / {String(low)}°
                </div>
                <div>
                  {showRainBadge ? (
                    <span className="rounded-full bg-blue-500 px-2 py-1 text-xs font-medium text-white">
                      {rainBadgeLabel(rain, rainProb)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">0%</span>
                  )}
                </div>
              </button>

              {isExpanded ? (
                <div className="ml-4 border-l-2 border-[#166534] px-3 pb-3">
                  {dayHours.length ? (
                    <div style={{ overflowX: 'auto', width: '100%' }}>
                      <div style={{ display: 'flex', minWidth: `${dayHours.length * 56}px` }}>
                        {dayHours.map((hourPoint, hourIndex) => {
                          const precip = safeNumber(hourPoint.precip, 0);
                          const barHeight = precip > 0 ? Math.max((precip / 100) * MINI_BAR_HEIGHT, 2) : 0;
                          return (
                            <div
                              key={`${day.date}-${hourPoint.label}-${hourIndex}`}
                              style={{
                                width: '56px',
                                padding: '0 5px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                              }}
                            >
                              <div style={{ minHeight: '16px', fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                                {hourPoint.temp != null ? `${Math.round(hourPoint.temp)}°` : '--'}
                              </div>
                              <div
                                style={{
                                  position: 'relative',
                                  height: `${MINI_BAR_HEIGHT}px`,
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
                                    {precip > 5 ? <span style={{ fontSize: '9px', color: '#ffffff', fontWeight: 600 }}>{precip}%</span> : null}
                                  </div>
                                ) : null}
                              </div>
                              <div style={{ marginTop: '4px', fontSize: '10px', color: '#9ca3af', minHeight: '14px' }}>
                                {hourPoint.wind != null ? `↗ ${Math.round(hourPoint.wind)}` : '--'}
                              </div>
                              <div style={{ marginTop: '4px', fontSize: '10px', color: '#6b7280' }}>{hourPoint.label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="py-2 text-xs text-[#6b7280]">No hourly points available for this day yet.</p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

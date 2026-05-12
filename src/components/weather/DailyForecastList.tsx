import type { OpenMeteoDailyPoint } from '@/lib/openMeteo';
import { Button } from '@/components/ui/button';

type ForecastRange = '12h' | '24h' | '48h' | '10d';

type DailyForecastListProps = {
  daily: OpenMeteoDailyPoint[];
  range: ForecastRange;
  onRangeChange: (range: ForecastRange) => void;
};

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
  return parsed.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
}

function rainBadgeLabel(amount: number, probability: number) {
  if (amount > 0 && amount < 0.1) return '<0.1 in';
  if (amount > 0) return `${amount.toFixed(1)} in`;
  if (probability > 0) return `${Math.round(probability)}%`;
  return '0%';
}

export function DailyForecastList({ daily, range, onRangeChange }: DailyForecastListProps) {
  const rows = daily.slice(0, 10);

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
        {rows.map((day, index) => {
          const showRainBadge = day.precipitationSum > 0 || day.precipitationProbabilityMax > 20;
          return (
            <div
              key={`${day.date}-${index}`}
              className={`grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 px-3 py-3 ${
                index === 0 ? 'bg-[#f0fdf4]' : 'bg-white'
              }`}
            >
              <div className="text-xl">{weatherEmoji(day.weatherCode)}</div>
              <div>
                <div className="text-sm font-medium text-[#111827]">{dayLabel(day.date, index)}</div>
                <div className="text-xs text-[#6b7280]">{weatherCondition(day.weatherCode)}</div>
              </div>
              <div className="text-sm font-semibold text-[#111827]">
                {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
              </div>
              <div>
                {showRainBadge ? (
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                    {rainBadgeLabel(day.precipitationSum, day.precipitationProbabilityMax)}
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">0%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


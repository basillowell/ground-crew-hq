const TIME_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const TIME_MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));
const TIME_PERIODS = ['AM', 'PM'] as const;

function parseTimeSelectValue(value?: string) {
  const [rawHour, rawMinute] = String(value || '05:30').split(':');
  const hour24 = Number(rawHour);
  const minute = Number(rawMinute);
  const safeHour24 = Number.isFinite(hour24) && hour24 >= 0 && hour24 <= 23 ? hour24 : 5;
  const safeMinute = Number.isFinite(minute) && minute >= 0 && minute <= 59 ? Math.round(minute / 5) * 5 : 30;
  const period = safeHour24 >= 12 ? 'PM' : 'AM';
  const hour12 = safeHour24 % 12 === 0 ? 12 : safeHour24 % 12;
  return {
    hour: String(hour12),
    minute: String(safeMinute === 60 ? 55 : safeMinute).padStart(2, '0'),
    period,
  };
}

function composeTimeSelectValue(hour: string, minute: string, period: string) {
  const hourNumber = Number(hour);
  const safeHour = Number.isFinite(hourNumber) ? hourNumber : 5;
  const hour24 = period === 'PM'
    ? (safeHour === 12 ? 12 : safeHour + 12)
    : (safeHour === 12 ? 0 : safeHour);
  return `${String(hour24).padStart(2, '0')}:${minute}`;
}

export function TimeSelect({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const parts = parseTimeSelectValue(value);
  const updatePart = (next: Partial<typeof parts>) => {
    const merged = { ...parts, ...next };
    onChange(composeTimeSelectValue(merged.hour, merged.minute, merged.period));
  };

  return (
    <div className={`mt-1 grid grid-cols-[1fr_1fr_1.15fr] gap-1 ${className}`}>
      <select
        value={parts.hour}
        onChange={(event) => updatePart({ hour: event.target.value })}
        className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Hour"
      >
        {TIME_HOURS.map((hour) => (
          <option key={hour} value={hour}>{hour}</option>
        ))}
      </select>
      <select
        value={parts.minute}
        onChange={(event) => updatePart({ minute: event.target.value })}
        className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Minute"
      >
        {TIME_MINUTES.map((minute) => (
          <option key={minute} value={minute}>{minute}</option>
        ))}
      </select>
      <select
        value={parts.period}
        onChange={(event) => updatePart({ period: event.target.value })}
        className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="AM or PM"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

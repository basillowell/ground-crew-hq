/**
 * Workboard operational-time helpers:
 * - Source of truth is property timezone, not browser timezone.
 * - Persisted timestamps are stored as ISO/timestamptz.
 * - Display always converts with explicit property timezone.
 */

const DEFAULT_OPERATIONAL_TIMEZONE = 'America/New_York';

function isValidTimezone(candidate: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getTimePartsByTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(values.get('year'));
  const month = Number(values.get('month'));
  const day = Number(values.get('day'));
  const hour = Number(values.get('hour'));
  const minute = Number(values.get('minute'));
  const second = Number(values.get('second'));
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null;
  return { year, month, day, hour, minute, second };
}

function getTimezoneOffsetMs(date: Date, timezone: string) {
  const parts = getTimePartsByTimezone(date, timezone);
  if (!parts) return 0;
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function getOperationalTimezone(selectedProperty: unknown): string {
  const propertyRecord = selectedProperty && typeof selectedProperty === 'object'
    ? (selectedProperty as Record<string, unknown>)
    : {};
  const candidates = [
    propertyRecord.timezone,
    propertyRecord.timeZone,
    propertyRecord.timezone_id,
    propertyRecord.timezoneId,
    propertyRecord.time_zone,
  ];
  for (const value of candidates) {
    const timezone = typeof value === 'string' ? value.trim() : '';
    if (timezone && isValidTimezone(timezone)) return timezone;
  }
  // TODO: add per-property timezone configuration in Settings when schema supports it.
  return DEFAULT_OPERATIONAL_TIMEZONE;
}

export function wallClockToStoredIso(workflowDate: string, hhmm: string, timezone: string): string {
  const normalizedDate = String(workflowDate).trim();
  const normalizedTime = String(hhmm).trim();
  const [yearRaw, monthRaw, dayRaw] = normalizedDate.split('-').map(Number);
  const [hourRaw, minuteRaw] = normalizedTime.split(':').map(Number);
  if (![yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw].every(Number.isFinite)) return '';
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_OPERATIONAL_TIMEZONE;
  const wallClockUtcMs = Date.UTC(yearRaw, monthRaw - 1, dayRaw, hourRaw, minuteRaw, 0);
  let resolvedMs = wallClockUtcMs;
  for (let step = 0; step < 3; step += 1) {
    const offsetMs = getTimezoneOffsetMs(new Date(resolvedMs), tz);
    resolvedMs = wallClockUtcMs - offsetMs;
  }
  return new Date(resolvedMs).toISOString();
}

export function storedIsoToWallClock(iso: string, timezone: string): string {
  if (!iso) return '';
  const parsed = new Date(String(iso).trim().replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return '';
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_OPERATIONAL_TIMEZONE;
  const parts = getTimePartsByTimezone(parsed, tz);
  if (!parts) return '';
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function storedIsoToWallClockLabel(iso: string, timezone: string): string {
  const hhmm = storedIsoToWallClock(iso, timezone);
  if (!hhmm) return '';
  const [hourRaw, minuteRaw] = hhmm.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function getNowHHMMInTimezone(timezone: string): string {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_OPERATIONAL_TIMEZONE;
  const now = new Date();
  const parts = getTimePartsByTimezone(now, tz);
  if (!parts) {
    const fallbackHours = now.getHours();
    const fallbackMinutes = now.getMinutes();
    return `${String(fallbackHours).padStart(2, '0')}:${String(fallbackMinutes).padStart(2, '0')}`;
  }
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

// Backward-compatible wrappers for existing callers.
export function localDateAndTimeToIso(workflowDate: string, hhmm: string): string {
  return wallClockToStoredIso(workflowDate, hhmm, DEFAULT_OPERATIONAL_TIMEZONE);
}

export function isoToLocalHHMM(iso: string): string {
  return storedIsoToWallClock(iso, DEFAULT_OPERATIONAL_TIMEZONE);
}

export function isoToLocalTimeLabel(iso: string): string {
  return storedIsoToWallClockLabel(iso, DEFAULT_OPERATIONAL_TIMEZONE);
}

/**
 * Workflow time helpers:
 * - UI inputs are local operational times (HH:mm on workflow date).
 * - DB persistence may include UTC suffixes in timestamptz strings.
 * - Workboard actual-time display treats persisted HH:mm as wall-clock time.
 */

export function localDateAndTimeToIso(workflowDate: string, hhmm: string): string {
  const normalizedDate = String(workflowDate).trim();
  const normalizedTime = String(hhmm).trim();
  // Workboard actual times persist as wall-clock HH:mm in timestamp text.
  // Example roundtrip: 2026-05-20 + 07:30 -> 2026-05-20T07:30:00.000Z -> display 7:30 AM.
  return `${normalizedDate}T${normalizedTime}:00.000Z`;
}

export function isoToLocalHHMM(iso: string): string {
  if (!iso) return '';
  const normalized = String(iso).trim().replace(' ', 'T');
  const hasTimezoneSuffix = /(?:Z|[+\-]\d{2}:\d{2})$/i.test(normalized);
  if (hasTimezoneSuffix) {
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      // Persisted actual-time values are wall-clock times encoded in timestamp text.
      // Read UTC clock components so 07:30Z (or equivalent offset form) displays as 07:30.
      const hours = parsed.getUTCHours();
      const minutes = parsed.getUTCMinutes();
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }
  const timePart = normalized.includes('T') ? normalized.split('T')[1] ?? '' : normalized;
  const match = timePart.match(/^(\d{2}):(\d{2})/);
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function isoToLocalTimeLabel(iso: string): string {
  const hhmm = isoToLocalHHMM(iso);
  if (!hhmm) return '';
  const [hourRaw, minuteRaw] = hhmm.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

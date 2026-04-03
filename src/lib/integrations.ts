import { createEvents, type EventAttributes } from 'ics';
import type { Employee, ScheduleEntry } from '@/data/seedData';
import { supabase } from '@/lib/supabase';
import { fetchOpenMeteoWeather, type OpenMeteoWeatherPayload } from '@/lib/openMeteo';

export type IntegrationResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export type BrowserLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export const OPEN_STREET_MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const LEAFLET_ATTRIBUTION = '&copy; OpenStreetMap contributors';

export async function getBrowserLocation(): Promise<IntegrationResult<BrowserLocation>> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return { ok: false, error: 'Geolocation is not available in this browser.' };
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000 * 60 * 10,
      });
    });

    return {
      ok: true,
      data: {
        latitude: Number(position.coords.latitude.toFixed(5)),
        longitude: Number(position.coords.longitude.toFixed(5)),
        accuracy: Number(position.coords.accuracy.toFixed(0)),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to retrieve device location.',
    };
  }
}

export function buildOpenStreetMapEmbedUrl(latitude: number, longitude: number) {
  const offset = 0.01;
  const bbox = [longitude - offset, latitude - offset, longitude + offset, latitude + offset].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export async function getLiveWeatherForCoordinates(latitude: number, longitude: number): Promise<IntegrationResult<OpenMeteoWeatherPayload>> {
  try {
    const data = await fetchOpenMeteoWeather({ latitude, longitude });
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to fetch live weather data.',
    };
  }
}

function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toIcsDateParts(date: string, time: string): [number, number, number, number, number] {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return [year, month, day, hour, minute];
}

export function exportScheduleEntriesAsICS(input: {
  filename?: string;
  scheduleEntries: ScheduleEntry[];
  employees: Employee[];
  title?: string;
}): IntegrationResult<{ filename: string; eventCount: number }> {
  try {
    const events: EventAttributes[] = input.scheduleEntries
      .filter((entry) => entry.status === 'scheduled')
      .map((entry) => {
        const employee = input.employees.find((item) => item.id === entry.employeeId);
        const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Crew Member';
        return {
          title: `${employeeName} Shift`,
          description: `${employeeName} scheduled shift exported from Ground Crew HQ`,
          start: toIcsDateParts(entry.date, entry.shiftStart),
          end: toIcsDateParts(entry.date, entry.shiftEnd),
          status: 'CONFIRMED',
          organizer: { name: input.title || 'Ground Crew HQ', email: 'no-reply@groundcrewhq.local' },
        };
      });

    const { error, value } = createEvents(events);
    if (error || !value) {
      return { ok: false, error: 'ICS export could not be generated.' };
    }

    const filename = input.filename || `ground-crew-schedule-${new Date().toISOString().slice(0, 10)}.ics`;
    downloadTextFile(filename, value, 'text/calendar;charset=utf-8');
    return { ok: true, data: { filename, eventCount: events.length } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'ICS export failed.',
    };
  }
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported' as const;
  if (Notification.permission === 'granted') return 'granted' as const;
  if (Notification.permission === 'denied') return 'denied' as const;
  return Notification.requestPermission();
}

export function sendBrowserNotification(title: string, options?: NotificationOptions): IntegrationResult<Notification> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, error: 'Notifications are not supported in this browser.' };
  }

  if (Notification.permission !== 'granted') {
    return { ok: false, error: 'Notification permission has not been granted.' };
  }

  try {
    const notification = new Notification(title, options);
    return { ok: true, data: notification };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to display notification.',
    };
  }
}

export async function sendSmsNotification(payload: { to: string; message: string }): Promise<IntegrationResult<unknown>> {
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured for SMS delivery.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: payload,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'SMS delivery failed.',
    };
  }
}

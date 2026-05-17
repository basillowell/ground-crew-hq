export type NwsAlertSeverity = 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';

export interface NwsAlertItem {
  id: string;
  event: string;
  severity: NwsAlertSeverity;
  headline: string;
  description: string;
  onset?: string | null;
  expires?: string | null;
  instruction?: string | null;
}

function normalizeSeverity(value: string | null | undefined): NwsAlertSeverity {
  const trimmed = (value ?? '').trim();
  if (trimmed === 'Extreme' || trimmed === 'Severe' || trimmed === 'Moderate' || trimmed === 'Minor') {
    return trimmed;
  }
  return 'Unknown';
}

export async function fetchNwsAlerts(latitude: number, longitude: number): Promise<NwsAlertItem[]> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://api.weather.gov/alerts/active?point=${latitude},${longitude}`, {
      headers: {
        'User-Agent': 'GroundCrewHQ (support@groundcrewhq.com)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`NWS alerts unavailable (${response.status})`);
    }

    const payload = (await response.json()) as {
      features?: Array<{
        id?: string;
        properties?: {
          event?: string;
          severity?: string;
          headline?: string;
          description?: string;
          onset?: string | null;
          expires?: string | null;
          instruction?: string | null;
        };
      }>;
    };

    return (payload.features ?? []).map((feature, index) => ({
      id: String(feature.id ?? `${feature.properties?.event ?? 'alert'}-${index}`),
      event: String(feature.properties?.event ?? 'Weather Alert'),
      severity: normalizeSeverity(feature.properties?.severity),
      headline: String(feature.properties?.headline ?? 'No headline provided'),
      description: String(feature.properties?.description ?? ''),
      onset: feature.properties?.onset ?? null,
      expires: feature.properties?.expires ?? null,
      instruction: feature.properties?.instruction ?? null,
    }));
  } finally {
    window.clearTimeout(timeout);
  }
}

import { supabase } from '@/lib/supabase';

type WeatherWidgetLiveData = {
  source: string;
  locationLabel: string;
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    precipitation: number;
  };
  daily: Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    precipitationSum: number;
  }>;
};

type LogArgs = {
  orgId: string;
  data: WeatherWidgetLiveData;
};

function todayDateIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchAndLogOpenMeteoWeather(args: LogArgs): Promise<void> {
  const { orgId, data } = args;
  if (!supabase || !orgId || !data) return;

  const locationNameToken = data.locationLabel.split('·')[0]?.trim().toLowerCase();

  const { data: locations, error: locationError } = await supabase
    .from('weather_locations')
    .select('id, name, property, org_id')
    .eq('org_id', orgId);
  if (locationError || !locations?.length) return;

  const selectedLocation =
    locations.find((entry) => String(entry.name ?? '').trim().toLowerCase() === locationNameToken) ??
    locations.find((entry) => String(entry.property ?? '').trim().toLowerCase().includes(locationNameToken ?? '')) ??
    locations[0];
  if (!selectedLocation?.id) return;

  const { data: stationRows } = await supabase
    .from('weather_stations')
    .select('id, location_id, is_primary')
    .eq('org_id', orgId)
    .eq('location_id', selectedLocation.id)
    .order('is_primary', { ascending: false })
    .limit(1);
  const primaryStationId = stationRows?.[0]?.id ?? null;

  const date = data.daily[0]?.date ?? todayDateIso();
  const { data: existingRow } = await supabase
    .from('weather_daily_logs')
    .select('id, source')
    .eq('org_id', orgId)
    .eq('location_id', selectedLocation.id)
    .eq('date', date)
    .maybeSingle();

  // Log once per day per location; preserve existing non-manual rows.
  if (existingRow && String(existingRow.source ?? '') !== 'manual') {
    return;
  }

  const rainfallTotal = Number(data.daily[0]?.precipitationSum ?? data.current.precipitation ?? 0);
  const forecast = data.daily
    .slice(0, 3)
    .map((day) => `${day.date}: ${Math.round(day.tempMax)} / ${Math.round(day.tempMin)}F, rain ${day.precipitationSum.toFixed(2)}in`)
    .join(' | ');

  const upsertPayload = {
    org_id: orgId,
    location_id: selectedLocation.id,
    station_id: primaryStationId,
    date,
    current_conditions: 'Open-Meteo live weather',
    forecast,
    rainfall_total: rainfallTotal,
    temperature: Number(data.current.temperature ?? 0),
    humidity: Number(data.current.humidity ?? 0),
    wind: Number(data.current.windSpeed ?? 0),
    et: 0,
    source: 'open-meteo',
    notes: `Auto-logged from Open-Meteo (${data.source})`,
  };

  await supabase
    .from('weather_daily_logs')
    .upsert(upsertPayload, { onConflict: 'location_id,date' });
}

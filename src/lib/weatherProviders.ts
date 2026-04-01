import type { WeatherDailyLog, WeatherStation } from '@/data/seedData';

function weatherCodeToConditions(code: number) {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code)) return 'Mostly Clear';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Station Reading';
}

function weatherCodeToForecast(code: number) {
  if (code === 0) return 'Dry and stable';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy through the day';
  if ([45, 48].includes(code)) return 'Reduced visibility expected';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'Showers possible, monitor surface moisture';
  if ([95, 96, 99].includes(code)) return 'Storm risk, evaluate spray and labor timing';
  return 'Weather station forecast';
}

export async function fetchPrimaryStationSnapshot(
  locationId: string,
  station: WeatherStation,
): Promise<WeatherDailyLog | null> {
  if (station.providerType !== 'open-meteo') return null;
  if (typeof station.latitude !== 'number' || typeof station.longitude !== 'number') return null;

  const params = new URLSearchParams({
    latitude: String(station.latitude),
    longitude: String(station.longitude),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
    daily: 'precipitation_sum,et0_fao_evapotranspiration',
    timezone: station.timeZone || 'auto',
    forecast_days: '1',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Weather provider request failed with ${response.status}`);
  }

  const payload = await response.json();
  const temperature = Number(payload?.current?.temperature_2m ?? 0);
  const humidity = Number(payload?.current?.relative_humidity_2m ?? 0);
  const wind = Number(payload?.current?.wind_speed_10m ?? 0);
  const weatherCode = Number(payload?.current?.weather_code ?? -1);
  const rainfallTotal = Number(payload?.daily?.precipitation_sum?.[0] ?? 0);
  const et = Number(payload?.daily?.et0_fao_evapotranspiration?.[0] ?? 0);
  const date = String(payload?.daily?.time?.[0] ?? new Date().toISOString().slice(0, 10));

  return {
    id: `live-${station.id}-${date}`,
    locationId,
    stationId: station.id,
    date,
    currentConditions: weatherCodeToConditions(weatherCode),
    forecast: weatherCodeToForecast(weatherCode),
    rainfallTotal,
    temperature,
    humidity,
    wind,
    et,
    source: 'station',
    notes: `Live weather from ${station.provider}`,
  };
}

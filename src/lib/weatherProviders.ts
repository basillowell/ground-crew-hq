import type { WeatherDailyLog, WeatherStation, WeatherStationSuggestion } from '@/data/seedData';

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

function noaaTextValue(measurement: any) {
  if (!measurement) return null;
  const value = measurement?.value;
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
}

function celsiusToFahrenheit(value: number) {
  return (value * 9) / 5 + 32;
}

function metersPerSecondToMph(value: number) {
  return value * 2.23694;
}

export type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
};

export type WeatherHourlyPoint = {
  time: string;
  temperature: number;
  rain: number;
  wind: number;
  gust: number;
};

export type WeatherForecastDetail = {
  next24Rainfall: number;
  summary: string;
  hourly: WeatherHourlyPoint[];
};

async function fetchOpenMeteoPast24Rainfall(station: Pick<WeatherStation, 'latitude' | 'longitude' | 'timeZone'>) {
  if (typeof station.latitude !== 'number' || typeof station.longitude !== 'number') return 0;

  const params = new URLSearchParams({
    latitude: String(station.latitude),
    longitude: String(station.longitude),
    hourly: 'precipitation',
    timezone: station.timeZone || 'auto',
    past_hours: '24',
    forecast_hours: '1',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo rainfall request failed with ${response.status}`);
  }

  const payload = await response.json();
  const rain: number[] = Array.isArray(payload?.hourly?.precipitation) ? payload.hourly.precipitation : [];
  const last24 = rain.slice(0, 24);
  return Number(last24.reduce((sum, point) => sum + Number(point ?? 0), 0).toFixed(2));
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function geocodeAddressQuery(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Geocoding request failed with ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload.map((item: any) => ({
    label: item.display_name ?? query,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  }));
}

async function fetchNoaaStationSuggestions(latitude: number, longitude: number): Promise<WeatherStationSuggestion[]> {
  const pointsResponse = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`, {
    headers: { Accept: 'application/geo+json' },
  });
  if (!pointsResponse.ok) return [];
  const pointPayload = await pointsResponse.json();
  const stationsUrl = pointPayload?.properties?.observationStations;
  if (!stationsUrl) return [];

  const stationsResponse = await fetch(stationsUrl, {
    headers: { Accept: 'application/geo+json' },
  });
  if (!stationsResponse.ok) return [];
  const stationsPayload = await stationsResponse.json();
  const features = Array.isArray(stationsPayload?.features) ? stationsPayload.features : [];

  return features.slice(0, 5).map((feature: any) => {
    const stationLatitude = Number(feature?.geometry?.coordinates?.[1] ?? latitude);
    const stationLongitude = Number(feature?.geometry?.coordinates?.[0] ?? longitude);
    const stationCode = String(feature?.properties?.stationIdentifier ?? 'NOAA');
    const isAirportLike = /^[A-Z]{4}$/.test(stationCode);
    return {
      id: `noaa-${stationCode}`,
      name: feature?.properties?.name ?? `NOAA ${stationCode}`,
      provider: isAirportLike ? 'Airport / NOAA' : 'NOAA',
      providerType: isAirportLike ? 'airport' : 'noaa',
      stationCode,
      latitude: stationLatitude,
      longitude: stationLongitude,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto',
      stationCategory: isAirportLike ? 'airport' : 'regional-grid',
      distanceMiles: Number(haversineMiles(latitude, longitude, stationLatitude, stationLongitude).toFixed(1)),
      reason: isAirportLike ? 'Nearest airport/NOAA observation station' : 'Nearest NOAA observation station',
    } satisfies WeatherStationSuggestion;
  });
}

export async function fetchWeatherStationSuggestions(input: {
  query?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ anchor: GeocodeResult | null; suggestions: WeatherStationSuggestion[] }> {
  let anchor: GeocodeResult | null = null;

  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
    anchor = {
      label: 'Current selected coordinates',
      latitude: input.latitude,
      longitude: input.longitude,
    };
  } else if (input.query?.trim()) {
    const results = await geocodeAddressQuery(input.query);
    anchor = results[0] ?? null;
  }

  if (!anchor) {
    return { anchor: null, suggestions: [] };
  }

  const suggestions: WeatherStationSuggestion[] = [
    {
      id: `open-meteo-${anchor.latitude.toFixed(4)}-${anchor.longitude.toFixed(4)}`,
      name: 'Open-Meteo Grid Point',
      provider: 'Open-Meteo',
      providerType: 'open-meteo',
      stationCode: `OM-${anchor.latitude.toFixed(2)}-${anchor.longitude.toFixed(2)}`,
      latitude: anchor.latitude,
      longitude: anchor.longitude,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto',
      stationCategory: 'regional-grid',
      distanceMiles: 0,
      reason: 'Best default live grid source for the selected property location',
    },
    ...(await fetchNoaaStationSuggestions(anchor.latitude, anchor.longitude)),
  ];

  return {
    anchor,
    suggestions: suggestions.sort((left, right) => (left.distanceMiles ?? 0) - (right.distanceMiles ?? 0)),
  };
}

export async function fetchPrimaryStationSnapshot(
  locationId: string,
  station: WeatherStation,
): Promise<WeatherDailyLog | null> {
  if (station.providerType === 'open-meteo') {
    if (typeof station.latitude !== 'number' || typeof station.longitude !== 'number') return null;

    const params = new URLSearchParams({
      latitude: String(station.latitude),
      longitude: String(station.longitude),
      current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code',
      daily: 'et0_fao_evapotranspiration',
      hourly: 'precipitation',
      temperature_unit: 'fahrenheit',
      timezone: station.timeZone || 'auto',
      forecast_days: '1',
      past_hours: '24',
      forecast_hours: '1',
    });

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Weather provider request failed with ${response.status}`);
    }

    const payload = await response.json();
    const temperature = Number(payload?.current?.temperature_2m ?? 0);
    const humidity = Number(payload?.current?.relative_humidity_2m ?? 0);
    const wind = Number(payload?.current?.wind_speed_10m ?? 0);
    const windGust = Number(payload?.current?.wind_gusts_10m ?? 0);
    const weatherCode = Number(payload?.current?.weather_code ?? -1);
    const hourlyRain: number[] = Array.isArray(payload?.hourly?.precipitation) ? payload.hourly.precipitation : [];
    const rainfallTotal = Number(hourlyRain.slice(0, 24).reduce((sum, point) => sum + Number(point ?? 0), 0).toFixed(2));
    const et = Number(payload?.daily?.et0_fao_evapotranspiration?.[0] ?? 0);
    const date = new Date().toISOString().slice(0, 10);
    const alerts: string[] = [];
    if (rainfallTotal >= 0.25) alerts.push('Rainfall accumulation');
    if (windGust >= 20) alerts.push('High wind gusts');
    if ([95, 96, 99].includes(weatherCode)) alerts.push('Storm risk');

    return {
      id: `live-${station.id}-${date}`,
      locationId,
      stationId: station.id,
      date,
      capturedAt: new Date().toISOString(),
      currentConditions: weatherCodeToConditions(weatherCode),
      forecast: weatherCodeToForecast(weatherCode),
      rainfallTotal,
      temperature,
      humidity,
      wind,
      windGust,
      et,
      source: 'station',
      alerts,
      notes: `Live weather from ${station.provider}`,
    };
  }

  if (station.providerType === 'noaa' || station.providerType === 'airport') {
    const stationCode = station.stationCode.trim();
    if (!stationCode) return null;

    const response = await fetch(`https://api.weather.gov/stations/${stationCode}/observations/latest`, {
      headers: { Accept: 'application/geo+json' },
    });
    if (!response.ok) {
      throw new Error(`NOAA observation request failed with ${response.status}`);
    }

    const payload = await response.json();
    const properties = payload?.properties ?? {};
    const timestamp = String(properties?.timestamp ?? new Date().toISOString());
    const date = timestamp.slice(0, 10);
    const temperatureC = noaaTextValue(properties?.temperature);
    const humidityValue = noaaTextValue(properties?.relativeHumidity);
    const windMps = noaaTextValue(properties?.windSpeed);
    const gustMps = noaaTextValue(properties?.windGust);
    const gustMph = gustMps != null ? metersPerSecondToMph(gustMps) : 0;
    const windMph = windMps != null ? metersPerSecondToMph(windMps) : 0;
    const rainfallInches = await fetchOpenMeteoPast24Rainfall(station);
    const alerts: string[] = [];
    if (rainfallInches >= 0.25) alerts.push('Rainfall accumulation');
    if (gustMph >= 20) alerts.push('High wind gusts');
    if (String(properties?.textDescription ?? '').toLowerCase().includes('thunder')) alerts.push('Storm risk');

    return {
      id: `live-${station.id}-${date}`,
      locationId,
      stationId: station.id,
      date,
      capturedAt: timestamp,
      currentConditions: String(properties?.textDescription ?? (station.providerType === 'airport' ? 'Airport Observation' : 'NOAA Observation')),
      forecast: station.providerType === 'airport' ? 'Airport observation station selected for live weather' : 'NOAA observation station selected for live weather',
      rainfallTotal: rainfallInches,
      temperature: Number(((temperatureC != null ? celsiusToFahrenheit(temperatureC) : 0)).toFixed(1)),
      humidity: Number((humidityValue ?? 0).toFixed(0)),
      wind: Number((windMph).toFixed(1)),
      windGust: Number((gustMph).toFixed(1)),
      et: 0,
      source: 'station',
      alerts,
      notes: `Live observation from ${station.provider}`,
    };
  }

  return null;
}

export async function fetchStationForecastDetail(station: WeatherStation): Promise<WeatherForecastDetail | null> {
  if (typeof station.latitude !== 'number' || typeof station.longitude !== 'number') return null;

  const params = new URLSearchParams({
    latitude: String(station.latitude),
    longitude: String(station.longitude),
    hourly: 'temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code',
    temperature_unit: 'fahrenheit',
    timezone: station.timeZone || 'auto',
    forecast_days: '2',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Forecast provider request failed with ${response.status}`);
  }

  const payload = await response.json();
  const times: string[] = Array.isArray(payload?.hourly?.time) ? payload.hourly.time : [];
  const temps: number[] = Array.isArray(payload?.hourly?.temperature_2m) ? payload.hourly.temperature_2m : [];
  const rain: number[] = Array.isArray(payload?.hourly?.precipitation) ? payload.hourly.precipitation : [];
  const wind: number[] = Array.isArray(payload?.hourly?.wind_speed_10m) ? payload.hourly.wind_speed_10m : [];
  const gust: number[] = Array.isArray(payload?.hourly?.wind_gusts_10m) ? payload.hourly.wind_gusts_10m : [];
  const codes: number[] = Array.isArray(payload?.hourly?.weather_code) ? payload.hourly.weather_code : [];

  const now = Date.now();
  const next24 = times
    .map((time, index) => ({
      time,
      temperature: Number(temps[index] ?? 0),
      rain: Number(rain[index] ?? 0),
      wind: Number(wind[index] ?? 0),
      gust: Number(gust[index] ?? 0),
      code: Number(codes[index] ?? -1),
    }))
    .filter((point) => new Date(point.time).getTime() >= now)
    .slice(0, 24);

  const next24Rainfall = Number(next24.reduce((sum, point) => sum + point.rain, 0).toFixed(2));
  const maxGust = Math.max(...next24.map((point) => point.gust), 0);
  const wetHours = next24.filter((point) => point.rain > 0.01).length;

  let summary = 'Stable weather expected.';
  if (next24Rainfall >= 0.3) {
    summary = 'Meaningful rainfall is expected in the next 24 hours.';
  } else if (wetHours >= 4) {
    summary = 'Intermittent showers are expected through the next 24 hours.';
  } else if (maxGust >= 20) {
    summary = 'Wind gusts may affect spraying or event setup.';
  }

  return {
    next24Rainfall,
    summary,
    hourly: next24.map((point) => ({
      time: point.time,
      temperature: point.temperature,
      rain: point.rain,
      wind: point.wind,
      gust: point.gust,
    })),
  };
}

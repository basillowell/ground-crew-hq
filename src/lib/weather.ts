import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getWeatherConditionMeta } from '@/lib/openMeteo';

export type WeatherCurrent = {
  time: string;
  temperature: number;
  windSpeed: number;
  weatherCode: number;
};

export type WeatherHourlyPoint = {
  time: string;
  temperature: number;
  precipitationProbability: number;
  windSpeed: number;
  weatherCode: number;
};

export type PropertyWeather = {
  propertyId: string;
  latitude: number;
  longitude: number;
  current: WeatherCurrent;
  hourly: WeatherHourlyPoint[];
};

async function fetchOpenMeteoPayload(lat: number, lng: number) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current_weather: 'true',
    hourly: 'temperature_2m,precipitation_probability,windspeed_10m,weathercode',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
    forecast_days: '2',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchCurrentWeather(lat: number, lng: number): Promise<WeatherCurrent> {
  const payload = await fetchOpenMeteoPayload(lat, lng);
  const current = payload?.current_weather;
  return {
    time: String(current?.time ?? new Date().toISOString()),
    temperature: Number(current?.temperature ?? 0),
    windSpeed: Number(current?.windspeed ?? 0),
    weatherCode: Number(current?.weathercode ?? -1),
  };
}

export async function fetchHourlyForecast(lat: number, lng: number): Promise<WeatherHourlyPoint[]> {
  const payload = await fetchOpenMeteoPayload(lat, lng);
  const current = payload?.current_weather;
  const times: string[] = Array.isArray(payload?.hourly?.time) ? payload.hourly.time : [];
  const temperatures: number[] = Array.isArray(payload?.hourly?.temperature_2m) ? payload.hourly.temperature_2m : [];
  const precipitation: number[] = Array.isArray(payload?.hourly?.precipitation_probability)
    ? payload.hourly.precipitation_probability
    : [];
  const winds: number[] = Array.isArray(payload?.hourly?.windspeed_10m) ? payload.hourly.windspeed_10m : [];
  const codes: number[] = Array.isArray(payload?.hourly?.weathercode) ? payload.hourly.weathercode : [];

  const points = times.map((time, index) => ({
    time,
    temperature: Number(temperatures[index] ?? 0),
    precipitationProbability: Number(precipitation[index] ?? 0),
    windSpeed: Number(winds[index] ?? 0),
    weatherCode: Number(codes[index] ?? -1),
  }));

  const startIndex = current?.time
    ? Math.max(0, points.findIndex((entry) => entry.time >= current.time))
    : 0;

  return points.slice(startIndex, startIndex + 8);
}

async function fetchPropertyCoordinates(propertyId: string) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  const { data, error } = await supabase
    .from('properties')
    .select('id, latitude, longitude')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.latitude || !data?.longitude) {
    throw new Error('Property coordinates are not configured.');
  }

  return {
    propertyId: data.id as string,
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
  };
}

export function useWeather(propertyId?: string) {
  return useQuery({
    queryKey: ['weather', propertyId ?? 'none'],
    enabled: Boolean(propertyId),
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<PropertyWeather> => {
      if (!propertyId) {
        throw new Error('Property id is required.');
      }
      const coordinates = await fetchPropertyCoordinates(propertyId);
      const [current, hourly] = await Promise.all([
        fetchCurrentWeather(coordinates.latitude, coordinates.longitude),
        fetchHourlyForecast(coordinates.latitude, coordinates.longitude),
      ]);
      return {
        ...coordinates,
        current,
        hourly,
      };
    },
  });
}

export function getWeatherIconMeta(code?: number) {
  return getWeatherConditionMeta(code);
}

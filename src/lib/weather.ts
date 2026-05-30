import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchNwsWeather, isUSCoordinates } from '@/lib/weather/providers';
import { getWeatherConditionMeta } from '@/lib/weather/wmoUtils';

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
  locationLabel: string;
  source: 'property' | 'default';
  lastUpdated: string;
  current: WeatherCurrent;
  hourly: WeatherHourlyPoint[];
};

export const DEFAULT_WEATHER_LOCATION = {
  label: 'Sarasota Polo Club, Sarasota, FL',
  latitude: 27.3364,
  longitude: -82.5307,
} as const;

async function fetchPropertyCoordinates(propertyId: string) {
  if (!supabase) {
    return {
      propertyId,
      latitude: DEFAULT_WEATHER_LOCATION.latitude,
      longitude: DEFAULT_WEATHER_LOCATION.longitude,
      locationLabel: DEFAULT_WEATHER_LOCATION.label,
      source: 'default' as const,
    };
  }
  const { data, error } = await supabase
    .from('properties')
    .select('id, latitude, longitude')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    return {
      propertyId,
      latitude: DEFAULT_WEATHER_LOCATION.latitude,
      longitude: DEFAULT_WEATHER_LOCATION.longitude,
      locationLabel: DEFAULT_WEATHER_LOCATION.label,
      source: 'default' as const,
    };
  }

  const latitude = Number(data?.latitude);
  const longitude = Number(data?.longitude);
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
  if (!hasCoords) {
    return {
      propertyId,
      latitude: DEFAULT_WEATHER_LOCATION.latitude,
      longitude: DEFAULT_WEATHER_LOCATION.longitude,
      locationLabel: DEFAULT_WEATHER_LOCATION.label,
      source: 'default' as const,
    };
  }

  return {
    propertyId: data.id as string,
    latitude,
    longitude,
    locationLabel: 'Property coordinates',
    source: 'property' as const,
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

      if (!isUSCoordinates(coordinates.latitude, coordinates.longitude)) {
        const empty: PropertyWeather = {
          ...coordinates,
          lastUpdated: new Date().toISOString(),
          current: { time: new Date().toISOString(), temperature: 0, windSpeed: 0, weatherCode: -1 },
          hourly: [],
        };
        return empty;
      }

      const payload = await fetchNwsWeather({ latitude: coordinates.latitude, longitude: coordinates.longitude });

      return {
        ...coordinates,
        lastUpdated: new Date().toISOString(),
        current: {
          time: payload.current.time,
          temperature: payload.current.temperature,
          windSpeed: payload.current.windSpeed,
          weatherCode: payload.current.weatherCode,
        },
        hourly: payload.hourly.slice(0, 8).map((p) => ({
          time: p.time,
          temperature: p.temperature,
          precipitationProbability: p.precipitationProbability,
          windSpeed: p.windSpeed,
          weatherCode: p.weatherCode,
        })),
      };
    },
  });
}

export function getWeatherIconMeta(code?: number) {
  return getWeatherConditionMeta(code);
}

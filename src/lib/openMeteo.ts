import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Wind,
  type LucideIcon,
} from 'lucide-react';

export type WeatherCoordinates = {
  latitude: number;
  longitude: number;
  label?: string;
  timezone?: string;
};

export type OpenMeteoHourlyPoint = {
  time: string;
  temperature: number;
  precipitationProbability: number;
  windSpeed: number;
  weatherCode: number;
};

export type OpenMeteoWeatherPayload = {
  current: {
    time: string;
    temperature: number;
    windSpeed: number;
    weatherCode: number;
  };
  hourly: OpenMeteoHourlyPoint[];
};

export function getWeatherConditionMeta(code?: number): {
  label: string;
  icon: LucideIcon;
} {
  if (typeof code !== 'number') {
    return { label: 'Unavailable', icon: Cloud };
  }

  if (code === 0) return { label: 'Clear', icon: Sun };
  if ([1, 2].includes(code)) return { label: 'Partly cloudy', icon: CloudSun };
  if (code === 3) return { label: 'Overcast', icon: Cloud };
  if ([45, 48].includes(code)) return { label: 'Fog', icon: CloudFog };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Drizzle', icon: CloudDrizzle };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Rain', icon: CloudRain };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow', icon: CloudSnow };
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorm', icon: CloudLightning };

  return { label: 'Windy', icon: Wind };
}

export async function fetchOpenMeteoWeather({
  latitude,
  longitude,
  timezone = 'auto',
}: WeatherCoordinates): Promise<OpenMeteoWeatherPayload> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current_weather: 'true',
    hourly: 'temperature_2m,precipitation_probability,windspeed_10m,weathercode',
    timezone,
    forecast_days: '2',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const current = payload?.current_weather;
  const times: string[] = Array.isArray(payload?.hourly?.time) ? payload.hourly.time : [];
  const temperatures: number[] = Array.isArray(payload?.hourly?.temperature_2m) ? payload.hourly.temperature_2m : [];
  const precipitationProbabilities: number[] = Array.isArray(payload?.hourly?.precipitation_probability)
    ? payload.hourly.precipitation_probability
    : [];
  const windSpeeds: number[] = Array.isArray(payload?.hourly?.windspeed_10m) ? payload.hourly.windspeed_10m : [];
  const weatherCodes: number[] = Array.isArray(payload?.hourly?.weathercode) ? payload.hourly.weathercode : [];

  const allHourly = times.map((time, index) => ({
    time,
    temperature: Number(temperatures[index] ?? 0),
    precipitationProbability: Number(precipitationProbabilities[index] ?? 0),
    windSpeed: Number(windSpeeds[index] ?? 0),
    weatherCode: Number(weatherCodes[index] ?? -1),
  }));

  const startIndex = current?.time
    ? Math.max(
        0,
        allHourly.findIndex((entry) => entry.time >= current.time),
      )
    : 0;

  return {
    current: {
      time: String(current?.time ?? new Date().toISOString()),
      temperature: Number(current?.temperature ?? 0),
      windSpeed: Number(current?.windspeed ?? 0),
      weatherCode: Number(current?.weathercode ?? -1),
    },
    hourly: allHourly.slice(startIndex, startIndex + 8),
  };
}

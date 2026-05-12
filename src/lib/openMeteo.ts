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
  signal?: AbortSignal;
};

export type OpenMeteoHourlyPoint = {
  time: string;
  temperature: number;
  precipitationProbability: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
};

export type OpenMeteoDailyPoint = {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  windGustMax: number;
  weatherCode: number;
};

export type OpenMeteoWeatherPayload = {
  current: {
    time: string;
    temperature: number;
    windSpeed: number;
    windDirection: number;
    precipitation: number;
    weatherCode: number;
  };
  hourly: OpenMeteoHourlyPoint[];
  daily: OpenMeteoDailyPoint[];
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
  signal,
}: WeatherCoordinates): Promise<OpenMeteoWeatherPayload> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current_weather: 'true',
    hourly: 'temperature_2m,precipitation_probability,precipitation,windspeed_10m,winddirection_10m,weathercode',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode,windspeed_10m_max,windgusts_10m_max',
    temperature_unit: 'fahrenheit',
    windspeed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone,
    forecast_days: '10',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal });
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
  const precipitations: number[] = Array.isArray(payload?.hourly?.precipitation) ? payload.hourly.precipitation : [];
  const windSpeeds: number[] = Array.isArray(payload?.hourly?.windspeed_10m) ? payload.hourly.windspeed_10m : [];
  const windDirections: number[] = Array.isArray(payload?.hourly?.winddirection_10m) ? payload.hourly.winddirection_10m : [];
  const weatherCodes: number[] = Array.isArray(payload?.hourly?.weathercode) ? payload.hourly.weathercode : [];
  const dailyTimes: string[] = Array.isArray(payload?.daily?.time) ? payload.daily.time : [];
  const dailyTempMax: number[] = Array.isArray(payload?.daily?.temperature_2m_max) ? payload.daily.temperature_2m_max : [];
  const dailyTempMin: number[] = Array.isArray(payload?.daily?.temperature_2m_min) ? payload.daily.temperature_2m_min : [];
  const dailyPrecip: number[] = Array.isArray(payload?.daily?.precipitation_sum) ? payload.daily.precipitation_sum : [];
  const dailyPrecipProb: number[] = Array.isArray(payload?.daily?.precipitation_probability_max) ? payload.daily.precipitation_probability_max : [];
  const dailyWeatherCodes: number[] = Array.isArray(payload?.daily?.weathercode) ? payload.daily.weathercode : [];
  const dailyWindMax: number[] = Array.isArray(payload?.daily?.windspeed_10m_max) ? payload.daily.windspeed_10m_max : [];
  const dailyWindGustMax: number[] = Array.isArray(payload?.daily?.windgusts_10m_max) ? payload.daily.windgusts_10m_max : [];

  const allHourly = times.map((time, index) => ({
    time,
    temperature: Number(temperatures[index] ?? 0),
    precipitationProbability: Number(precipitationProbabilities[index] ?? 0),
    precipitation: Number(precipitations[index] ?? 0),
    windSpeed: Number(windSpeeds[index] ?? 0),
    windDirection: Number(windDirections[index] ?? 0),
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
      windDirection: Number(current?.winddirection ?? 0),
      precipitation: Number(payload?.current?.precipitation ?? 0),
      weatherCode: Number(current?.weathercode ?? -1),
    },
    hourly: allHourly.slice(startIndex, startIndex + 168),
    daily: dailyTimes.slice(0, 10).map((date, index) => ({
      date,
      tempMax: Number(dailyTempMax[index] ?? 0),
      tempMin: Number(dailyTempMin[index] ?? 0),
      precipitationSum: Number(dailyPrecip[index] ?? 0),
      precipitationProbabilityMax: Number(dailyPrecipProb[index] ?? 0),
      windSpeedMax: Number(dailyWindMax[index] ?? 0),
      windGustMax: Number(dailyWindGustMax[index] ?? 0),
      weatherCode: Number(dailyWeatherCodes[index] ?? -1),
    })),
  };
}

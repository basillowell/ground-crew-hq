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

export type ForecastHourlyPoint = {
  time: string;
  temperature: number;
  precipitationProbability: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
};

export type ForecastDailyPoint = {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  windGustMax: number;
  weatherCode: number;
};

export type ForecastPayload = {
  current: {
    time: string;
    temperature: number;
    windSpeed: number;
    windDirection: number;
    precipitation: number;
    weatherCode: number;
  };
  hourly: ForecastHourlyPoint[];
  daily: ForecastDailyPoint[];
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

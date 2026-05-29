export type ForecastProvider = "auto" | "open-meteo" | "noaa-nws";
export type RadarProvider = "auto" | "rainviewer";

export type OpenMeteoLikePayload = {
  current_weather?: {
    time: string;
    temperature: number;
    windspeed: number;
    weathercode: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weathercode: number[];
    windspeed_10m: number[];
    windgusts_10m: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weathercode: number[];
    windspeed_10m_max: number[];
  };
};

export type RainViewerFrame = {
  time: number;
  path: string;
};

export type OperationalWeatherLocation = {
  id: string;
  name: string;
  property: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  org_id: string | null;
  is_active: boolean | null;
  timezone: string | null;
  is_default: boolean | null;
  forecast_provider: ForecastProvider | null;
  radar_provider: RadarProvider | null;
};

type NwsPeriod = {
  startTime: string;
  temperature?: number;
  windSpeed?: string;
  probabilityOfPrecipitation?: { value?: number | null };
  shortForecast?: string;
};

export function isUSCoordinates(latitude: number, longitude: number): boolean {
  return latitude >= 24.396308 && latitude <= 49.384358 && longitude >= -124.848974 && longitude <= -66.885444;
}

export function getRadarTileUrl(frame: RainViewerFrame, size = 512): string {
  return `https://tilecache.rainviewer.com${frame.path}/${size}/{z}/{x}/{y}/2/1_1.png`;
}

export async function fetchRainViewerFrames(): Promise<RainViewerFrame[]> {
  const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
  if (!response.ok) {
    throw new Error(`RainViewer frames request failed (${response.status})`);
  }
  const payload = (await response.json()) as {
    radar?: { past?: RainViewerFrame[]; nowcast?: RainViewerFrame[] };
  };
  return [...(payload.radar?.past ?? []), ...(payload.radar?.nowcast ?? [])];
}

function parseWindMph(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function weatherCodeFromText(forecast: string | undefined): number {
  const text = (forecast ?? "").toLowerCase();
  if (text.includes("thunder")) return 95;
  if (text.includes("snow")) return 73;
  if (text.includes("rain") || text.includes("shower")) return 63;
  if (text.includes("cloud")) return 3;
  if (text.includes("fog")) return 45;
  return 0;
}

function toOpenMeteoLikeFromNws(periods: NwsPeriod[]): OpenMeteoLikePayload {
  const hourlyTimes = periods.map((period) => period.startTime);
  const hourlyTemps = periods.map((period) => Number(period.temperature ?? 0));
  const hourlyRain = periods.map((period) => Number(period.probabilityOfPrecipitation?.value ?? 0));
  const hourlyCodes = periods.map((period) => weatherCodeFromText(period.shortForecast));
  const hourlyWind = periods.map((period) => parseWindMph(period.windSpeed));
  const hourlyGusts = hourlyWind.map((speed) => speed + 3);

  const dayMap = new Map<string, { high: number; low: number; precip: number; code: number; wind: number }>();
  periods.forEach((period, index) => {
    const day = period.startTime.slice(0, 10);
    const temp = hourlyTemps[index] ?? 0;
    const precip = hourlyRain[index] ?? 0;
    const code = hourlyCodes[index] ?? 0;
    const wind = hourlyWind[index] ?? 0;
    const existing = dayMap.get(day);
    if (!existing) {
      dayMap.set(day, { high: temp, low: temp, precip, code, wind });
      return;
    }
    existing.high = Math.max(existing.high, temp);
    existing.low = Math.min(existing.low, temp);
    existing.precip = Math.max(existing.precip, precip);
    existing.code = Math.max(existing.code, code);
    existing.wind = Math.max(existing.wind, wind);
  });

  const dayKeys = Array.from(dayMap.keys()).sort();

  return {
    current_weather: {
      time: periods[0]?.startTime ?? new Date().toISOString(),
      temperature: hourlyTemps[0] ?? 0,
      windspeed: hourlyWind[0] ?? 0,
      weathercode: hourlyCodes[0] ?? 0,
    },
    hourly: {
      time: hourlyTimes,
      temperature_2m: hourlyTemps,
      precipitation_probability: hourlyRain,
      weathercode: hourlyCodes,
      windspeed_10m: hourlyWind,
      windgusts_10m: hourlyGusts,
    },
    daily: {
      time: dayKeys,
      temperature_2m_max: dayKeys.map((day) => dayMap.get(day)?.high ?? 0),
      temperature_2m_min: dayKeys.map((day) => dayMap.get(day)?.low ?? 0),
      precipitation_sum: dayKeys.map((day) => dayMap.get(day)?.precip ?? 0),
      weathercode: dayKeys.map((day) => dayMap.get(day)?.code ?? 0),
      windspeed_10m_max: dayKeys.map((day) => dayMap.get(day)?.wind ?? 0),
    },
  };
}

export async function fetchNwsForecast(latitude: number, longitude: number): Promise<OpenMeteoLikePayload> {
  const pointsResponse = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`, {
    headers: { "User-Agent": "GroundCrewHQ (support@groundcrewhq.com)" },
  });
  if (!pointsResponse.ok) {
    throw new Error(`NWS points request failed (${pointsResponse.status})`);
  }
  const pointsPayload = (await pointsResponse.json()) as { properties?: { forecastHourly?: string } };
  const forecastUrl = pointsPayload.properties?.forecastHourly;
  if (!forecastUrl) throw new Error("NWS forecast URL unavailable.");

  const forecastResponse = await fetch(forecastUrl, {
    headers: { "User-Agent": "GroundCrewHQ (support@groundcrewhq.com)" },
  });
  if (!forecastResponse.ok) {
    throw new Error(`NWS forecast request failed (${forecastResponse.status})`);
  }
  const forecastPayload = (await forecastResponse.json()) as { properties?: { periods?: NwsPeriod[] } };
  const periods = forecastPayload.properties?.periods ?? [];
  return toOpenMeteoLikeFromNws(periods);
}

export async function fetchOpenMeteoForecast(
  latitude: number,
  longitude: number,
  timezone: string,
): Promise<OpenMeteoLikePayload> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: "temperature_2m,precipitation_probability,weathercode,wind_speed_10m,wind_gusts_10m,apparent_temperature",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max",
    current_weather: "true",
    temperature_unit: "fahrenheit",
    windspeed_unit: "mph",
    timezone,
    forecast_days: "10",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed (${response.status})`);
  }
  const payload = (await response.json()) as {
    current_weather?: OpenMeteoLikePayload["current_weather"];
    daily?: OpenMeteoLikePayload["daily"];
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      precipitation_probability?: number[];
      weathercode?: number[];
      wind_speed_10m?: number[];
      wind_gusts_10m?: number[];
      windspeed_10m?: number[];
      windgusts_10m?: number[];
    };
  };

  return {
    current_weather: payload.current_weather,
    daily: payload.daily,
    hourly: {
      time: payload.hourly?.time ?? [],
      temperature_2m: payload.hourly?.temperature_2m ?? [],
      precipitation_probability: payload.hourly?.precipitation_probability ?? [],
      weathercode: payload.hourly?.weathercode ?? [],
      windspeed_10m: payload.hourly?.wind_speed_10m ?? payload.hourly?.windspeed_10m ?? [],
      windgusts_10m: payload.hourly?.wind_gusts_10m ?? payload.hourly?.windgusts_10m ?? [],
    },
  };
}

export async function fetchNwsAlerts(latitude: number, longitude: number) {
  const response = await fetch(`https://api.weather.gov/alerts/active?point=${latitude},${longitude}`, {
    headers: { "User-Agent": "GroundCrewHQ (support@groundcrewhq.com)" },
  });
  if (!response.ok) {
    throw new Error(`NWS alerts request failed (${response.status})`);
  }
  return (await response.json()) as { features?: Array<{ id: string; properties?: { event?: string; headline?: string } }> };
}

export function getDefaultWeatherLocation(
  locations: OperationalWeatherLocation[],
): OperationalWeatherLocation | null {
  if (!locations.length) return null;
  return locations.find((location) => location.is_default) ?? locations[0];
}

export function getOperationalWeatherLocationFromList(
  locations: OperationalWeatherLocation[],
): OperationalWeatherLocation | null {
  return getDefaultWeatherLocation(locations);
}

export async function getOperationalWeatherLocation(
  orgId: string,
): Promise<OperationalWeatherLocation | null> {
  const { data, error } = await supabase
    .from("weather_locations")
    .select("id, name, property, area, latitude, longitude, org_id, is_active, timezone, is_default, forecast_provider, radar_provider")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !data?.length) return null;
  return getDefaultWeatherLocation(data as OperationalWeatherLocation[]);
}

export async function getDefaultWeatherLocationForOrg(
  orgId: string,
): Promise<OperationalWeatherLocation | null> {
  return getOperationalWeatherLocation(orgId);
}
import { supabase } from "@/lib/supabase";

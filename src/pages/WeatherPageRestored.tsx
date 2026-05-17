import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CloudRain, Loader2, RefreshCcw, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { RadarEmbed } from "@/components/weather/RadarEmbed";

type WeatherStation = {
  id: string;
  name: string;
  property: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  org_id: string | null;
  is_active: boolean | null;
};

type OpenMeteoPayload = {
  current_weather?: {
    time: string;
    temperature: number;
    windspeed: number;
    weathercode: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
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

type NwsAlert = {
  id: string;
  properties?: {
    severity?: string;
    event?: string;
    headline?: string;
    description?: string;
    effective?: string;
    expires?: string;
  };
};

type HourRange = "12h" | "24h" | "48h" | "10d";
type DataLayer = "temp" | "rain" | "wind";
type RainRange = "day" | "week" | "month" | "year";

const weatherLabelByCode: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  95: "Thunderstorm",
};

function getWeatherLabel(code?: number) {
  if (code === undefined || code === null) return "Unknown";
  return weatherLabelByCode[code] ?? "Mixed conditions";
}

function SectionSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded bg-muted/70" />
    </div>
  );
}

export default function WeatherPage() {
  const navigate = useNavigate();
  const { orgId } = useAuth();

  const [stations, setStations] = useState<WeatherStation[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [stationsLoading, setStationsLoading] = useState(true);
  const [stationsError, setStationsError] = useState<string>("");

  const [weatherData, setWeatherData] = useState<OpenMeteoPayload | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string>("");

  const [alerts, setAlerts] = useState<NwsAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const [hourRange, setHourRange] = useState<HourRange>("24h");
  const [dataLayer, setDataLayer] = useState<DataLayer>("temp");
  const [rainRange, setRainRange] = useState<RainRange>("week");

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === selectedStationId) ?? null,
    [selectedStationId, stations],
  );

  const loadStations = useCallback(async () => {
    if (!orgId) return;
    setStationsLoading(true);
    setStationsError("");
    const { data, error } = await supabase
      .from("weather_locations")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      setStations([]);
      setStationsError(error.message);
      setStationsLoading(false);
      return;
    }

    const nextStations = (data ?? []) as WeatherStation[];
    setStations(nextStations);
    setSelectedStationId((prev) => prev || nextStations[0]?.id || "");
    setStationsLoading(false);
  }, [orgId]);

  const loadWeatherForStation = useCallback(async (station: WeatherStation) => {
    if (!station.latitude || !station.longitude) {
      setWeatherData(null);
      setWeatherError("Selected station is missing coordinates.");
      return;
    }

    setWeatherLoading(true);
    setWeatherError("");
    const params = new URLSearchParams({
      latitude: String(station.latitude),
      longitude: String(station.longitude),
      hourly:
        "temperature_2m,relative_humidity_2m,precipitation_probability,weathercode,windspeed_10m,windgusts_10m",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max",
      current_weather: "true",
      temperature_unit: "fahrenheit",
      windspeed_unit: "mph",
      timezone: "America/New_York",
      forecast_days: "10",
    });

    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Open-Meteo request failed (${response.status})`);
      }
      const payload = (await response.json()) as OpenMeteoPayload;
      setWeatherData(payload);
    } catch (error) {
      setWeatherData(null);
      setWeatherError(error instanceof Error ? error.message : "Unable to load weather data.");
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async (station: WeatherStation) => {
    if (!station.latitude || !station.longitude) {
      setAlerts([]);
      return;
    }

    setAlertsLoading(true);
    try {
      const response = await fetch(
        `https://api.weather.gov/alerts/active?point=${station.latitude},${station.longitude}`,
        { headers: { "User-Agent": "GroundCrewHQ (support@groundcrewhq.com)" } },
      );
      if (!response.ok) {
        setAlerts([]);
        return;
      }
      const payload = (await response.json()) as { features?: NwsAlert[] };
      setAlerts(payload.features ?? []);
    } catch {
      setAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStations();
  }, [loadStations]);

  useEffect(() => {
    if (!selectedStation) return;
    void loadWeatherForStation(selectedStation);
    void loadAlerts(selectedStation);
  }, [loadAlerts, loadWeatherForStation, selectedStation]);

  const hourlyRows = useMemo(() => {
    const hourly = weatherData?.hourly;
    if (!hourly) return [];
    return hourly.time.map((time, index) => ({
      time,
      temp: hourly.temperature_2m[index],
      rain: hourly.precipitation_probability[index],
      wind: hourly.windspeed_10m[index],
      code: hourly.weathercode[index],
    }));
  }, [weatherData]);

  const dailyRows = useMemo(() => {
    const daily = weatherData?.daily;
    if (!daily) return [];
    return daily.time.map((date, index) => ({
      date,
      high: daily.temperature_2m_max[index],
      low: daily.temperature_2m_min[index],
      rainTotal: daily.precipitation_sum[index],
      code: daily.weathercode[index],
      windMax: daily.windspeed_10m_max[index],
    }));
  }, [weatherData]);

  const visibleHourly = useMemo(() => {
    if (hourRange === "10d") return hourlyRows.slice(0, 240);
    if (hourRange === "48h") return hourlyRows.slice(0, 48);
    if (hourRange === "24h") return hourlyRows.slice(0, 24);
    return hourlyRows.slice(0, 12);
  }, [hourRange, hourlyRows]);

  const spraySafeWindows = useMemo(() => {
    const blocks = hourlyRows.slice(0, 24).map((row) => ({
      ...row,
      safe: row.wind < 10 && row.rain < 20 && row.temp >= 45 && row.temp <= 95,
    }));
    const safeSlots = blocks.filter((block) => block.safe);
    if (safeSlots.length === 0) return "No safe windows today";
    const start = new Date(safeSlots[0].time);
    const end = new Date(safeSlots[safeSlots.length - 1].time);
    return `Safe to spray: ${start.toLocaleTimeString([], { hour: "numeric" })} - ${end.toLocaleTimeString([], { hour: "numeric" })}`;
  }, [hourlyRows]);

  const stormSummary = useMemo(() => {
    const risky = hourlyRows.slice(0, 12).find((row) => row.rain >= 50);
    if (!risky) return "Clear for 12h";
    const hoursAway = Math.max(
      0,
      Math.round((new Date(risky.time).getTime() - Date.now()) / (1000 * 60 * 60)),
    );
    return `Storm arrives in ~${hoursAway}h`;
  }, [hourlyRows]);

  const rainfallSummary = useMemo(() => {
    const take = rainRange === "day" ? 1 : rainRange === "week" ? 7 : rainRange === "month" ? 30 : 365;
    return dailyRows.slice(0, Math.min(take, dailyRows.length)).reduce((sum, row) => sum + (row.rainTotal || 0), 0);
  }, [dailyRows, rainRange]);

  if (!orgId) {
    return <PageSkeleton />;
  }

  if (stationsLoading) {
    return <PageSkeleton />;
  }

  if (stationsError) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Weather</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-destructive">Failed to load weather stations: {stationsError}</p>
            <Button size="sm" variant="outline" onClick={() => void loadStations()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Weather is not configured.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Set up your weather station in Settings -&gt; Weather to get started.
              </p>
              <Button size="sm" onClick={() => navigate("/app/settings?tab=Weather")}>
                Open Settings -&gt; Weather
              </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Weather</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Operational forecast driven by your configured weather stations.</p>
      </div>

      {stations.length > 1 ? (
        <Card className="rounded-xl">
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <label className="text-sm text-muted-foreground" htmlFor="station-select">
              Viewing weather for:
            </label>
            <select
              id="station-select"
              className="h-9 min-w-[240px] rounded-md border bg-background px-3 text-sm"
              value={selectedStationId}
              onChange={(event) => setSelectedStationId(event.target.value)}
            >
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name} ({station.area})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      ) : null}

      {selectedStation ? (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Weather for {selectedStation.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {selectedStation.area} • {selectedStation.latitude}, {selectedStation.longitude}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Live Radar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedStation?.latitude && selectedStation.longitude ? (
            <RadarEmbed latitude={selectedStation.latitude} longitude={selectedStation.longitude} />
          ) : (
            <p className="text-sm text-muted-foreground">Station coordinates are required for radar.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Live Radar • RainViewer • Centered on {selectedStation?.name} ({selectedStation?.area})
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>NWS Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alertsLoading ? <SectionSkeleton /> : null}
          {!alertsLoading && alerts.length === 0 ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">No active alerts ✓</div>
          ) : null}
          {!alertsLoading &&
            alerts.map((alert) => (
              <div key={alert.id} className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <div className="text-sm font-medium">{alert.properties?.event ?? "Weather Alert"}</div>
                <div className="text-xs text-muted-foreground">{alert.properties?.headline ?? "Review alert details on weather.gov."}</div>
              </div>
            ))}
        </CardContent>
      </Card>

      {weatherLoading ? (
        <>
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
        </>
      ) : null}

      {!weatherLoading && weatherError ? (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Open-Meteo unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{weatherError}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (selectedStation) void loadWeatherForStation(selectedStation);
              }}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Retry weather fetch
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!weatherLoading && !weatherError && weatherData ? (
        <>
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Current Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-4xl font-semibold">{Math.round(weatherData.current_weather?.temperature ?? 0)}°F</div>
              <div className="text-sm text-muted-foreground">
                {getWeatherLabel(weatherData.current_weather?.weathercode)} • Wind {Math.round(weatherData.current_weather?.windspeed ?? 0)} mph
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedStation?.name} ({selectedStation?.area}) • Updated {weatherData.current_weather?.time ? new Date(weatherData.current_weather.time).toLocaleString() : "N/A"}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Storm Track (Next 12h)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-12 gap-1">
                {hourlyRows.slice(0, 12).map((row) => {
                  const color =
                    row.rain < 20 ? "bg-emerald-500" : row.rain < 40 ? "bg-yellow-500" : row.rain < 70 ? "bg-orange-500" : "bg-red-500";
                  return <div key={row.time} className={`h-5 rounded ${color}`} title={`${row.rain}%`} />;
                })}
              </div>
              <p className="text-sm text-muted-foreground">{stormSummary}</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Hourly Forecast</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["12h", "24h", "48h", "10d"] as HourRange[]).map((value) => (
                  <Button key={value} size="sm" variant={hourRange === value ? "default" : "outline"} onClick={() => setHourRange(value)}>
                    {value}
                  </Button>
                ))}
                {(["temp", "rain", "wind"] as DataLayer[]).map((value) => (
                  <Button key={value} size="sm" variant={dataLayer === value ? "default" : "outline"} onClick={() => setDataLayer(value)}>
                    {value === "temp" ? "Temp" : value === "rain" ? "Rain%" : "Wind"}
                  </Button>
                ))}
              </div>
              <div className="max-h-80 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">Time</th>
                      <th className="px-3 py-2 text-left">Value</th>
                      <th className="px-3 py-2 text-left">Condition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHourly.map((row) => (
                      <tr key={row.time} className="border-t">
                        <td className="px-3 py-2">{new Date(row.time).toLocaleString([], { weekday: "short", hour: "numeric" })}</td>
                        <td className="px-3 py-2">
                          {dataLayer === "temp" ? `${Math.round(row.temp)}°F` : dataLayer === "rain" ? `${Math.round(row.rain)}%` : `${Math.round(row.wind)} mph`}
                        </td>
                        <td className="px-3 py-2">{getWeatherLabel(row.code)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>7-Day Forecast</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {dailyRows.slice(0, 7).map((row) => (
                <div key={row.date} className="rounded-lg border p-3">
                  <div className="text-sm font-medium">{new Date(row.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</div>
                  <div className="text-xs text-muted-foreground">{getWeatherLabel(row.code)}</div>
                  <div className="mt-2 text-sm">{Math.round(row.high)}° / {Math.round(row.low)}°</div>
                  <div className="text-xs text-muted-foreground">Rain: {Math.round(row.rainTotal)}mm • Wind: {Math.round(row.windMax)}mph</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Spray Window</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">{spraySafeWindows}</p>
              <div className="grid grid-cols-12 gap-1">
                {hourlyRows.slice(0, 12).map((row) => {
                  const safe = row.wind < 10 && row.rain < 20 && row.temp >= 45 && row.temp <= 95;
                  return <div key={row.time} className={`h-4 rounded ${safe ? "bg-emerald-500" : "bg-red-400"}`} />;
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Rainfall Tracker</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["day", "week", "month", "year"] as RainRange[]).map((value) => (
                  <Button key={value} size="sm" variant={rainRange === value ? "default" : "outline"} onClick={() => setRainRange(value)}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Total rainfall for selected range: {rainfallSummary.toFixed(1)} mm</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Wind & Conditions Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs uppercase text-muted-foreground">Current wind</div>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                  <Wind className="h-4 w-4" />
                  {Math.round(weatherData.current_weather?.windspeed ?? 0)} mph
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs uppercase text-muted-foreground">Precipitation risk</div>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                  <CloudRain className="h-4 w-4" />
                  {Math.round(hourlyRows[0]?.rain ?? 0)}%
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs uppercase text-muted-foreground">Status</div>
                <div className="mt-1 text-lg font-semibold">{stormSummary.includes("Clear") ? "Stable" : "Watch conditions"}</div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {weatherLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading forecast...
        </div>
      ) : null}
    </div>
  );
}

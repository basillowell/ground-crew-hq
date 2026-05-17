import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronDown, CloudRain, Pencil, RefreshCcw, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { RadarEmbed } from "@/components/weather/RadarEmbed";
import { toast } from "@/components/ui/sonner";

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
    event?: string;
    headline?: string;
  };
};

type RainRange = "day" | "week" | "month" | "year";
type OverlayKey = "rain" | "wind" | "gusts" | "temp" | "alerts";
type WeatherDailyLogRow = {
  id: string;
  locationId: string;
  stationId: string | null;
  date: string;
  rainfallTotal: number;
  source: string;
};

const overlayLabels: Record<OverlayKey, string> = {
  rain: "Rain %",
  wind: "Wind",
  gusts: "Gusts",
  temp: "Temp",
  alerts: "Alerts",
};

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

function labelForWeatherCode(code?: number) {
  if (code === undefined || code === null) return "Mixed conditions";
  return weatherLabelByCode[code] ?? "Mixed conditions";
}

function toDateKey(input: string) {
  return new Date(input).toISOString().slice(0, 10);
}

export default function WeatherPage() {
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [stations, setStations] = useState<WeatherStation[]>([]);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [stationsLoading, setStationsLoading] = useState(true);
  const [stationsError, setStationsError] = useState("");

  const [weatherData, setWeatherData] = useState<OpenMeteoPayload | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  const [alerts, setAlerts] = useState<NwsAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayKey>>(new Set(["temp", "rain"]));
  const [expandedDayKey, setExpandedDayKey] = useState(todayKey);
  const [rainRange, setRainRange] = useState<RainRange>("week");

  const [manualLogs, setManualLogs] = useState<WeatherDailyLogRow[]>([]);
  const [editingRain, setEditingRain] = useState(false);
  const [rainEditDate, setRainEditDate] = useState(todayKey);
  const [rainEditAmount, setRainEditAmount] = useState("");
  const [savingRain, setSavingRain] = useState(false);

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === selectedStationId) ?? null,
    [selectedStationId, stations],
  );

  const hourlyRows = useMemo(() => {
    const hourly = weatherData?.hourly;
    if (!hourly) return [];
    return hourly.time.map((time, index) => ({
      time,
      dateKey: toDateKey(time),
      temp: hourly.temperature_2m[index] ?? 0,
      rain: hourly.precipitation_probability[index] ?? 0,
      wind: hourly.windspeed_10m[index] ?? 0,
      gusts: hourly.windgusts_10m[index] ?? 0,
      code: hourly.weathercode[index] ?? 0,
    }));
  }, [weatherData]);

  const dailyRows = useMemo(() => {
    const daily = weatherData?.daily;
    if (!daily) return [];
    return daily.time.map((date, index) => ({
      date,
      high: daily.temperature_2m_max[index] ?? 0,
      low: daily.temperature_2m_min[index] ?? 0,
      rainTotal: daily.precipitation_sum[index] ?? 0,
      code: daily.weathercode[index] ?? 0,
      windMax: daily.windspeed_10m_max[index] ?? 0,
    }));
  }, [weatherData]);

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

  const loadWeather = useCallback(async (station: WeatherStation) => {
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
      hourly: "temperature_2m,precipitation_probability,weathercode,windspeed_10m,windgusts_10m",
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
      if (payload.daily?.time?.[0]) {
        setExpandedDayKey((prev) => prev || payload.daily!.time[0]);
      }
    } catch (error) {
      setWeatherData(null);
      setWeatherError(error instanceof Error ? error.message : "Unable to load weather.");
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
      } else {
        const payload = (await response.json()) as { features?: NwsAlert[] };
        setAlerts(payload.features ?? []);
      }
    } catch {
      setAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const loadManualRainLogs = useCallback(async (station: WeatherStation) => {
    const { data, error } = await supabase
      .from("weather_daily_logs")
      .select("id, locationId, stationId, date, rainfallTotal, source")
      .eq("locationId", station.id)
      .eq("source", "manual")
      .order("date", { ascending: false });
    if (error) {
      setManualLogs([]);
      return;
    }
    setManualLogs((data ?? []) as WeatherDailyLogRow[]);
  }, []);

  useEffect(() => {
    void loadStations();
  }, [loadStations]);

  useEffect(() => {
    if (!selectedStation) return;
    void loadWeather(selectedStation);
    void loadAlerts(selectedStation);
    void loadManualRainLogs(selectedStation);
  }, [loadAlerts, loadManualRainLogs, loadWeather, selectedStation]);

  const rainfallTotalForRange = useMemo(() => {
    const days = rainRange === "day" ? 1 : rainRange === "week" ? 7 : rainRange === "month" ? 30 : 365;
    const auto = dailyRows.slice(0, Math.min(days, dailyRows.length)).reduce((sum, row) => sum + row.rainTotal, 0);
    const manualMap = new Map<string, number>();
    manualLogs.forEach((log) => manualMap.set(log.date, log.rainfallTotal));
    const merged = dailyRows
      .slice(0, Math.min(days, dailyRows.length))
      .reduce((sum, row) => sum + (manualMap.get(row.date) ?? row.rainTotal), 0);
    return merged || auto;
  }, [dailyRows, manualLogs, rainRange]);

  const todaySpraySummary = useMemo(() => {
    const todayHours = hourlyRows.filter((row) => row.dateKey === todayKey && new Date(row.time).getHours() >= 6 && new Date(row.time).getHours() <= 23);
    const safe = todayHours.filter((row) => row.wind < 10 && row.rain < 20 && row.temp >= 45 && row.temp <= 95);
    if (!safe.length) return "No safe windows today";
    const start = new Date(safe[0].time);
    const end = new Date(safe[safe.length - 1].time);
    return `Safe to spray: ${start.toLocaleTimeString([], { hour: "numeric" })} - ${end.toLocaleTimeString([], { hour: "numeric" })}`;
  }, [hourlyRows, todayKey]);

  const toggleOverlay = (key: OverlayKey) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveManualRain = async () => {
    if (!selectedStation || !rainEditDate || rainEditAmount.trim() === "") return;
    const amount = Number(rainEditAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid rainfall amount.");
      return;
    }

    setSavingRain(true);
    const existing = manualLogs.find((log) => log.date === rainEditDate);
    const payload = {
      id: existing?.id ?? crypto.randomUUID(),
      locationId: selectedStation.id,
      stationId: selectedStation.id,
      date: rainEditDate,
      rainfallTotal: amount,
      source: "manual",
      currentConditions: "",
      forecast: "",
      temperature: 0,
      humidity: 0,
      wind: 0,
      et: 0,
      notes: "",
    };

    const { error } = await supabase.from("weather_daily_logs").upsert(payload, { onConflict: "id" });
    if (error) {
      toast.error(`Failed to save rainfall: ${error.message}`);
      setSavingRain(false);
      return;
    }

    toast.success("Rainfall saved.");
    setEditingRain(false);
    setRainEditAmount("");
    await loadManualRainLogs(selectedStation);
    setSavingRain(false);
  };

  if (!orgId) return <PageSkeleton />;
  if (stationsLoading) return <PageSkeleton />;

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

  if (!stations.length) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Weather is not configured.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Set up your weather station in Settings -&gt; Weather to get started.</p>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Weather</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Weather for {selectedStation?.name} ({selectedStation?.area})</p>
        </div>
        {stations.length > 1 ? (
          <select
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
        ) : null}
      </div>

      <div className="grid gap-4 lg:h-[calc(100vh-11rem)] lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3 lg:overflow-y-auto lg:pr-1">
          {weatherLoading ? <PageSkeleton /> : null}
          {weatherError ? (
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Open-Meteo unavailable
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" onClick={() => selectedStation && void loadWeather(selectedStation)}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Retry
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
                    {labelForWeatherCode(weatherData.current_weather?.weathercode)} • Wind {Math.round(weatherData.current_weather?.windspeed ?? 0)} mph
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedStation?.latitude}, {selectedStation?.longitude} • Updated{" "}
                    {weatherData.current_weather?.time ? new Date(weatherData.current_weather.time).toLocaleString() : "N/A"}
                  </div>
                </CardContent>
              </Card>

              {activeOverlays.has("alerts") ? (
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle>NWS Alerts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {alertsLoading ? <div className="h-16 animate-pulse rounded bg-muted" /> : null}
                    {!alertsLoading && alerts.length === 0 ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">No active alerts ✓</div>
                    ) : null}
                    {!alertsLoading &&
                      alerts.map((alert) => (
                        <div key={alert.id} className="rounded-md border border-amber-300 bg-amber-50 p-3">
                          <div className="text-sm font-medium">{alert.properties?.event ?? "Weather Alert"}</div>
                          <div className="text-xs text-muted-foreground">{alert.properties?.headline ?? "Review on weather.gov."}</div>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              ) : null}

              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle>10-Day Forecast</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dailyRows.map((row) => {
                    const isExpanded = expandedDayKey === row.date;
                    const dayHours = hourlyRows
                      .filter((hour) => hour.dateKey === row.date)
                      .filter((hour) => {
                        const h = new Date(hour.time).getHours();
                        return h >= 6 && h <= 23;
                      });
                    const safeHours = dayHours.filter(
                      (hour) => hour.wind < 10 && hour.rain < 20 && hour.temp >= 45 && hour.temp <= 95,
                    );
                    const daySpraySummary = safeHours.length
                      ? `Safe ${new Date(safeHours[0].time).toLocaleTimeString([], { hour: "numeric" })}-${new Date(
                          safeHours[safeHours.length - 1].time,
                        ).toLocaleTimeString([], { hour: "numeric" })}`
                      : "No safe window";
                    const manualEntry = manualLogs.find((log) => log.date === row.date);
                    return (
                      <div key={row.date} className="rounded-lg border">
                        <button
                          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                          onClick={() => setExpandedDayKey((prev) => (prev === row.date ? "" : row.date))}
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {new Date(row.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} • {Math.round(row.high)}° /{" "}
                              {Math.round(row.low)}°
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {labelForWeatherCode(row.code)} • Wind {Math.round(row.windMax)} mph
                              {activeOverlays.has("rain") ? ` • ${row.rainTotal.toFixed(2)} in` : ""}
                              {manualEntry ? " • ✏️ manual rain" : ""}
                            </div>
                          </div>
                          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                        {isExpanded ? (
                          <div className="space-y-3 border-t px-4 py-3">
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {dayHours.map((hour) => (
                                <div key={hour.time} className="min-w-[104px] rounded-md border p-2 text-xs">
                                  <div className="font-medium">{new Date(hour.time).toLocaleTimeString([], { hour: "numeric" })}</div>
                                  {activeOverlays.has("temp") ? <div>{Math.round(hour.temp)}°F</div> : null}
                                  {activeOverlays.has("rain") ? <div>{Math.round(hour.rain)}%</div> : null}
                                  {activeOverlays.has("wind") ? <div>{Math.round(hour.wind)} mph</div> : null}
                                  {activeOverlays.has("gusts") ? <div>G {Math.round(hour.gusts)} mph</div> : null}
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">Spray: {daySpraySummary}</p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle>Spray Window</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm font-medium">{todaySpraySummary}</p>
                  <div className="grid grid-cols-12 gap-1">
                    {hourlyRows
                      .filter((row) => row.dateKey === todayKey)
                      .slice(0, 12)
                      .map((row) => {
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
                        {value[0].toUpperCase() + value.slice(1)}
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>Total rainfall: {rainfallTotalForRange.toFixed(1)} mm</span>
                    <Button size="sm" variant="outline" onClick={() => setEditingRain((prev) => !prev)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                  {editingRain ? (
                    <div className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_1fr_auto]">
                      <Input type="date" value={rainEditDate} onChange={(event) => setRainEditDate(event.target.value)} />
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={rainEditAmount}
                        onChange={(event) => setRainEditAmount(event.target.value)}
                        placeholder="Rainfall (mm)"
                      />
                      <Button size="sm" onClick={handleSaveManualRain} disabled={savingRain}>
                        Save
                      </Button>
                    </div>
                  ) : null}
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
                    <div className="text-xs uppercase text-muted-foreground">Rain probability</div>
                    <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                      <CloudRain className="h-4 w-4" />
                      {Math.round(hourlyRows[0]?.rain ?? 0)}%
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Conditions</div>
                    <div className="mt-1 text-lg font-semibold">{labelForWeatherCode(weatherData.current_weather?.weathercode)}</div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        <div className="order-first lg:order-none lg:col-span-2">
          <Card className="relative rounded-xl lg:h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Live Radar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 lg:h-[calc(100%-4.25rem)]">
              <div className="absolute left-4 right-4 top-14 z-10 flex flex-wrap gap-2 rounded-lg border bg-background/95 p-2 backdrop-blur">
                {(Object.keys(overlayLabels) as OverlayKey[]).map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={activeOverlays.has(key) ? "default" : "outline"}
                    className={activeOverlays.has(key) ? "bg-green-600 hover:bg-green-500" : ""}
                    onClick={() => toggleOverlay(key)}
                  >
                    {overlayLabels[key]}
                  </Button>
                ))}
              </div>
              <div className="pt-10 lg:h-full">
                {selectedStation?.latitude && selectedStation.longitude ? (
                  <div className="h-[300px] lg:h-full">
                    <RadarEmbed latitude={selectedStation.latitude} longitude={selectedStation.longitude} />
                  </div>
                ) : (
                  <div className="flex h-[300px] items-center justify-center rounded-xl border text-sm text-muted-foreground lg:h-full">
                    Station coordinates required for radar.
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Live Radar • RainViewer • Centered on {selectedStation?.name} ({selectedStation?.area})</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Pencil, RefreshCcw, Wind } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/shared";
import {
  fetchNwsAlerts,
  fetchNwsForecast,
  getDefaultWeatherLocation,
  isUSCoordinates,
} from "@/lib/weather/providers";

type WeatherStation = {
  id: string;
  name: string;
  property: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  is_default: boolean | null;
  forecast_provider: string | null;
  radar_provider: string | null;
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

type WeatherDailyLogRow = {
  id: string;
  locationId: string;
  date: string;
  rainfallTotal: number;
  source: string;
};

type OverlayKey = "rain" | "wind" | "gusts" | "temp" | "alerts";

const weatherCodeLabels: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

const weatherEmojiByCode: Record<number, string> = {
  0: "☀️",
  1: "🌤",
  2: "🌤",
  3: "☁️",
  45: "🌫",
  48: "🌫",
  51: "🌦",
  53: "🌦",
  55: "🌦",
  61: "🌧",
  63: "🌧",
  65: "🌧",
  66: "🌨",
  67: "🌨",
  71: "❄️",
  73: "❄️",
  75: "❄️",
  77: "❄️",
  80: "🌧",
  81: "🌧",
  82: "🌧",
  85: "🌨",
  86: "🌨",
  95: "⛈",
  96: "⛈",
  99: "⛈",
};

const overlayLabels: Record<OverlayKey, string> = {
  rain: "Rain %",
  wind: "Wind",
  gusts: "Gusts",
  temp: "Temp",
  alerts: "Alerts",
};

function labelForWeatherCode(code: number) {
  return weatherCodeLabels[code] ?? "Mixed conditions";
}

function iconForWeatherCode(code: number) {
  return weatherEmojiByCode[code] ?? "🌤";
}

function dateKeyFromIso(value: string) {
  return value.slice(0, 10);
}

function mmToInches(mm: number) {
  return mm / 25.4;
}

function inchesToMm(inches: number) {
  return inches * 25.4;
}

function tempClass(tempF: number) {
  if (tempF < 50) return "text-blue-600";
  if (tempF <= 75) return "text-emerald-600";
  if (tempF <= 90) return "text-amber-600";
  return "text-red-600";
}

function daySeverityBorder(code: number) {
  if (code === 0) return "border-l-4 border-emerald-400";
  if (code === 1 || code === 2) return "border-l-4 border-sky-400";
  if (code === 3 || code === 45 || code === 48) return "border-l-4 border-surface-border";
  if (code >= 51 && code <= 63) return "border-l-4 border-amber-400";
  if (code >= 65 || code >= 95) return "border-l-4 border-red-500";
  return "border-l-4 border-sky-400";
}

function precipBadge(precipInches: number) {
  if (precipInches <= 0) return null;
  if (precipInches <= 0.25) return { label: "light", cls: "bg-sky-100 text-sky-700" };
  if (precipInches <= 1) return { label: "moderate", cls: "bg-amber-100 text-amber-700" };
  return { label: "heavy", cls: "bg-red-100 text-red-700" };
}

export default function WeatherPage() {
  const navigate = useNavigate();
  const { orgId, currentUser } = useAuth();
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
  const [alertsError, setAlertsError] = useState("");

  const [expandedDayKey, setExpandedDayKey] = useState(todayKey);
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayKey>>(new Set(["temp", "rain"]));
  const [rainfallYear, setRainfallYear] = useState(new Date().getFullYear());
  const [isRainLogOpen, setIsRainLogOpen] = useState(false);

  useEffect(() => {
    document.title = 'Weather — Ground Crew HQ';
  }, []);

  const [rainfallLogs, setRainfallLogs] = useState<WeatherDailyLogRow[]>([]);
  const [isEditingRain, setIsEditingRain] = useState(false);
  const [rainEditDate, setRainEditDate] = useState(todayKey);
  const [rainEditAmount, setRainEditAmount] = useState("");
  const [savingRain, setSavingRain] = useState(false);

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === selectedStationId) ?? null,
    [stations, selectedStationId],
  );
  const selectedTimezone = selectedStation?.timezone || "America/New_York";

  const formatTimeForStation = useCallback((value: string | Date, includeMinutes = false) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: includeMinutes ? "2-digit" : undefined,
      timeZone: selectedTimezone,
    });
  }, [selectedTimezone]);

  const formatDateForStation = useCallback((value: string) => {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: selectedTimezone,
    });
  }, [selectedTimezone]);

  const loadStations = useCallback(async () => {
    if (!orgId) return;
    setStationsLoading(true);
    setStationsError("");

    const { data, error } = await supabase
      .from("weather_locations")
      .select("id, name, property, area, latitude, longitude, org_id, is_active, timezone, is_default, forecast_provider, radar_provider")
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
    const operationalDefault = getDefaultWeatherLocation(nextStations);
    setSelectedStationId((prev) => {
      if (prev && nextStations.some((station) => station.id === prev)) return prev;
      return operationalDefault?.id || "";
    });
    setStationsLoading(false);
  }, [orgId]);

  const loadWeather = useCallback(async (station: WeatherStation) => {
    if (station.latitude == null || station.longitude == null) {
      setWeatherData(null);
      setWeatherError("Selected station is missing coordinates.");
      return;
    }

    setWeatherLoading(true);
    setWeatherError("");
    try {
      if (!isUSCoordinates(station.latitude, station.longitude)) {
        setWeatherData(null);
        setWeatherError("Weather available for US locations only.");
        return;
      }
      const payload = await fetchNwsForecast(station.latitude, station.longitude);
      setWeatherData(payload);
      if (payload.daily?.time?.length) {
        const defaultExpanded = payload.daily.time.find((d) => d === todayKey) ?? payload.daily.time[0];
        setExpandedDayKey(defaultExpanded);
      }
    } catch (error) {
      setWeatherData(null);
      setWeatherError(error instanceof Error ? error.message : "Unable to load weather.");
    } finally {
      setWeatherLoading(false);
    }
  }, [todayKey]);

  const loadAlerts = useCallback(async (station: WeatherStation) => {
    if (station.latitude == null || station.longitude == null) {
      setAlerts([]);
      setAlertsError("");
      return;
    }
    setAlertsLoading(true);
    setAlertsError("");
    try {
      if (!isUSCoordinates(station.latitude, station.longitude)) {
        setAlerts([]);
        return;
      }
      const payload = await fetchNwsAlerts(station.latitude, station.longitude);
      setAlerts((payload.features ?? []) as NwsAlert[]);
    } catch (error) {
      setAlerts([]);
      setAlertsError(error instanceof Error ? error.message : "Unable to load alerts.");
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const loadRainLogs = useCallback(async (station: WeatherStation) => {
    try {
      const { data, error } = await supabase
        .from("weather_daily_logs")
        .select("id, location_id, date, rainfall_total, source")
        .eq("location_id", station.id)
        .order("date", { ascending: false });
      if (error) {
        setRainfallLogs([]);
        return;
      }
      setRainfallLogs(
        ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id ?? ''),
          locationId: String(row.location_id ?? ''),
          date: String(row.date ?? ''),
          rainfallTotal: Number(row.rainfall_total ?? 0),
          source: String(row.source ?? ''),
        })),
      );
    } catch {
      setRainfallLogs([]);
    }
  }, []);

  useEffect(() => {
    if (!orgId) return;
    void loadStations();
  }, [loadStations, orgId]);

  useEffect(() => {
    if (!orgId) return;
    if (!selectedStation) return;
    void loadWeather(selectedStation);
    void loadAlerts(selectedStation);
    void loadRainLogs(selectedStation);
  }, [loadAlerts, loadRainLogs, loadWeather, orgId, selectedStation]);

  const hourlyRows = useMemo(() => {
    const hourly = weatherData?.hourly;
    if (!hourly) return [];
    return hourly.time.map((time, index) => ({
      time,
      dateKey: dateKeyFromIso(time),
      hour: Number(
        new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: selectedTimezone }).format(
          new Date(time),
        ),
      ),
      temp: hourly.temperature_2m[index] ?? 0,
      rainPct: hourly.precipitation_probability[index] ?? 0,
      wind: hourly.windspeed_10m[index] ?? 0,
      gusts: hourly.windgusts_10m[index] ?? 0,
      code: hourly.weathercode[index] ?? 0,
    }));
  }, [selectedTimezone, weatherData]);

  const dailyRows = useMemo(() => {
    const daily = weatherData?.daily;
    if (!daily) return [];
    return daily.time.map((date, index) => ({
      date,
      high: daily.temperature_2m_max[index] ?? 0,
      low: daily.temperature_2m_min[index] ?? 0,
      precipMm: daily.precipitation_sum[index] ?? 0,
      precipInches: mmToInches(daily.precipitation_sum[index] ?? 0),
      code: daily.weathercode[index] ?? 0,
      windMax: daily.windspeed_10m_max[index] ?? 0,
    }));
  }, [weatherData]);

  const rainfallByDate = useMemo(() => {
    const map = new Map<string, { inches: number; source: string }>();
    rainfallLogs.forEach((log) => {
      const nextEntry = { inches: mmToInches(log.rainfallTotal), source: (log.source ?? "").toLowerCase() };
      const existing = map.get(log.date);
      if (!existing) {
        map.set(log.date, nextEntry);
        return;
      }
      if (existing.source !== "manual" && nextEntry.source === "manual") {
        map.set(log.date, nextEntry);
      }
    });
    return map;
  }, [rainfallLogs]);

  const annualRainGrid = useMemo(() => {
    const monthDayValues: number[][] = Array.from({ length: 12 }, () => Array.from({ length: 31 }, () => 0));
    const monthDayHasValue: boolean[][] = Array.from({ length: 12 }, () => Array.from({ length: 31 }, () => false));

    rainfallByDate.forEach((entry, dateKey) => {
      if (!dateKey.startsWith(`${rainfallYear}-`)) return;
      const date = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;
      const monthIndex = date.getMonth();
      const dayIndex = date.getDate() - 1;
      monthDayValues[monthIndex][dayIndex] = entry.inches;
      monthDayHasValue[monthIndex][dayIndex] = true;
    });

    const monthTotals = monthDayValues.map((days) => days.reduce((sum, value) => sum + value, 0));
    const runningTotals = monthTotals.map((_, monthIndex) =>
      monthTotals.slice(0, monthIndex + 1).reduce((sum, value) => sum + value, 0),
    );
    const yearlyTotal = monthTotals.reduce((sum, value) => sum + value, 0);

    return {
      monthDayValues,
      monthDayHasValue,
      monthTotals,
      runningTotals,
      yearlyTotal,
    };
  }, [rainfallByDate, rainfallYear]);

  const rainfallSummary = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    const weekStartKey = weekStart.toISOString().slice(0, 10);
    let today = 0;
    let week = 0;
    let monthToDate = 0;
    let yearToDate = 0;

    rainfallByDate.forEach((entry, dateKey) => {
      if (dateKey === todayKey) today += entry.inches;
      if (dateKey >= weekStartKey && dateKey <= todayKey) week += entry.inches;
      const d = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(d.getTime())) return;
      if (d.getFullYear() === year) {
        yearToDate += entry.inches;
        if (d.getMonth() === month && dateKey <= todayKey) monthToDate += entry.inches;
      }
    });

    return { today, week, monthToDate, yearToDate };
  }, [rainfallByDate, todayKey]);

  const todaySpraySegments = useMemo(() => {
    const source = hourlyRows
      .filter((h) => h.dateKey === todayKey)
      .filter((h) => h.hour >= 6 && h.hour <= 18);
    return source.map((hour) => {
      const safe = hour.wind < 8 && hour.rainPct < 15 && hour.temp >= 45 && hour.temp <= 95;
      const marginal = !safe && hour.wind <= 10 && hour.rainPct <= 20 && hour.temp >= 45 && hour.temp <= 95;
      return {
        ...hour,
        level: safe ? "safe" : marginal ? "marginal" : "unsafe",
      };
    });
  }, [hourlyRows, todayKey]);

  const spraySummary = useMemo(() => {
    if (!todaySpraySegments.length) return "No spray data available today";
    const safe = todaySpraySegments.filter((h) => h.level === "safe");
    if (!safe.length) return "No safe spray windows today";
    const ranges: Array<{ start: number; end: number }> = [];
    safe.forEach((entry) => {
      const last = ranges[ranges.length - 1];
      if (!last || entry.hour > last.end + 1) ranges.push({ start: entry.hour, end: entry.hour });
      else last.end = entry.hour;
    });
    const formatted = ranges
      .map((r) => `${formatTimeForStation(new Date(2000, 0, 1, r.start))} - ${formatTimeForStation(new Date(2000, 0, 1, r.end + 1))}`)
      .join(", ");
    return `Safe to spray: ${formatted}`;
  }, [formatTimeForStation, todaySpraySegments]);

  const nowHour = new Date().getHours();
  const nowIndex = todaySpraySegments.findIndex((s) => s.hour >= nowHour);

  const toggleOverlay = (key: OverlayKey) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const saveManualRain = async () => {
    if (!selectedStation || !rainEditDate || !rainEditAmount) return;
    const amountInches = Number(rainEditAmount);
    if (!Number.isFinite(amountInches) || amountInches < 0) {
      toast.error("Enter a valid rainfall amount in inches.");
      return;
    }
    const amountMm = inchesToMm(amountInches);
    setSavingRain(true);
    try {
      const existing = rainfallLogs.find((log) => log.date === rainEditDate && log.source === "manual")
        ?? rainfallLogs.find((log) => log.date === rainEditDate);
      const payload = {
        id: existing?.id ?? crypto.randomUUID(),
        location_id: selectedStation.id,
        station_id: selectedStation.id,
        date: rainEditDate,
        rainfall_total: amountMm,
        source: "manual",
        current_conditions: "",
        forecast: "",
        temperature: 0,
        humidity: 0,
        wind: 0,
        et: 0,
        notes: "",
        org_id: currentUser?.orgId ?? null,
      };
      const { error } = await supabase.from("weather_daily_logs").upsert(payload, { onConflict: "id" });
      if (error) {
        toast.error(`Failed to save rainfall: ${error.message}`);
        return;
      }

      try {
        await loadRainLogs(selectedStation);
      } catch (refreshError) {
        if (import.meta.env.DEV) {
          console.error("[rainfall-save] refresh failed", refreshError);
        }
        toast.warning("Saved, but refresh failed.");
        return;
      }
      toast.success("Manual rainfall saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save rainfall.");
    } finally {
      setSavingRain(false);
    }
  };

  const handleRainCellClick = (monthIndex: number, day: number) => {
    const dateValue = `${rainfallYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setRainEditDate(dateValue);
    const existing = rainfallByDate.get(dateValue);
    setRainEditAmount(typeof existing?.inches === "number" ? existing.inches.toFixed(2) : "");
    setIsEditingRain(true);
  };

  if (!orgId || stationsLoading) return <PageSkeleton />;

  if (stationsError) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Card className="rounded-xl">
          <CardContent className="space-y-3 p-6">
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
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-muted-foreground">Weather is not configured.</p>
            <p className="text-sm text-muted-foreground">Add a weather location in Settings.</p>
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
      <PageHeader
        title="Weather"
        subtitle={`Live operations forecast for ${selectedStation?.name ?? "selected station"} · NOAA/NWS · ${selectedTimezone}`}
      >
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
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pr-1">
          {weatherLoading ? <PageSkeleton /> : null}
          {weatherError ? (
            <Card className="rounded-xl">
              <CardContent className="space-y-3 p-6">
                <p className="text-sm text-destructive">{weatherError}</p>
                <Button size="sm" variant="outline" onClick={() => selectedStation && void loadWeather(selectedStation)}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Retry weather
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!weatherLoading && !weatherError && weatherData ? (
            <>
              <Card className="rounded-xl">
                <CardContent className="space-y-2 p-6">
                  <div className={`text-4xl font-bold ${tempClass(weatherData.current_weather?.temperature ?? 0)}`}>
                    {Math.round(weatherData.current_weather?.temperature ?? 0)}°F
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {labelForWeatherCode(weatherData.current_weather?.weathercode ?? 0)} • Wind {Math.round(weatherData.current_weather?.windspeed ?? 0)} mph
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedStation?.name} ({selectedStation?.area}) • {selectedStation?.latitude}, {selectedStation?.longitude}
                  </div>
                </CardContent>
              </Card>

              {activeOverlays.has("alerts") ? (
                <Card className="rounded-xl">
                  <CardContent className="space-y-2 p-6">
                    <div className="text-sm font-semibold">NWS Alerts</div>
                    {alertsLoading ? <div className="h-12 animate-pulse rounded bg-muted" /> : null}
                    {!alertsLoading && alertsError ? (
                      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                        Alerts unavailable. {alertsError}
                      </div>
                    ) : null}
                    {!alertsLoading && alerts.length === 0 ? (
                      <div className="rounded-md border border-status-active/20 bg-status-active/10 p-3 text-sm text-status-active">No active alerts ✓</div>
                    ) : null}
                    {!alertsLoading &&
                      alerts.map((alert) => (
                        <div key={alert.id} className="rounded-md border border-amber-300 bg-amber-50 p-3">
                          <div className="text-sm font-medium">{alert.properties?.event ?? "Weather Alert"}</div>
                          <div className="text-xs text-muted-foreground">{alert.properties?.headline ?? "Review weather.gov details."}</div>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              ) : null}

              <Card className="rounded-xl">
                <CardContent className="space-y-2 p-4">
                  <div className="px-2 text-sm font-semibold">10-Day Forecast</div>
                  {dailyRows.map((day) => {
                    const isExpanded = expandedDayKey === day.date;
                    const dailyBadge = precipBadge(day.precipInches);
                    const dayHours = hourlyRows
                      .filter((row) => row.dateKey === day.date)
                      .filter((row) => row.hour >= 6 && row.hour <= 23);

                    const safeHours = dayHours.filter((h) => h.wind < 10 && h.rainPct < 20 && h.temp >= 45 && h.temp <= 95);
                    const daySpray = safeHours.length
                      ? `Safe ${formatTimeForStation(new Date(2000, 0, 1, safeHours[0].hour))}-${formatTimeForStation(
                          new Date(2000, 0, 1, safeHours[safeHours.length - 1].hour + 1),
                        )}`
                      : "No safe window";

                    return (
                      <div
                        key={day.date}
                        className={`rounded-xl border bg-card transition-all duration-200 hover:bg-muted/30 ${daySeverityBorder(day.code)} ${
                          isExpanded ? "max-h-[500px]" : "max-h-[84px]"
                        } overflow-hidden`}
                      >
                        <button
                          className="w-full cursor-pointer px-4 py-3 text-left"
                          onClick={() => setExpandedDayKey((prev) => (prev === day.date ? "" : day.date))}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">
                                {formatDateForStation(day.date)}
                              </div>
                              <div className="text-xs text-muted-foreground">{labelForWeatherCode(day.code)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`text-lg font-bold ${tempClass(day.high)}`}>
                                {Math.round(day.high)}°/{Math.round(day.low)}°
                              </div>
                              {dailyBadge ? (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${dailyBadge.cls}`}>
                                  {day.precipInches.toFixed(2)} in {dailyBadge.label}
                                </span>
                              ) : null}
                              {activeOverlays.has("wind") ? (
                                <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] text-text-muted">{Math.round(day.windMax)} mph</span>
                              ) : null}
                              <ChevronDown className={`h-4 w-4 transition-all duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          </div>
                        </button>
                        {isExpanded ? (
                          <div className="space-y-2 border-t px-4 py-3 transition-all duration-200">
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {dayHours.map((hour) => {
                                const bg =
                                  hour.rainPct > 70 ? "bg-status-warning/10" : hour.rainPct > 40 ? "bg-status-pending/10" : hour.code === 0 ? "bg-sky-500/10" : "bg-surface-elevated";
                                return (
                                  <div key={hour.time} className={`min-w-[72px] rounded-lg border p-2 text-center ${bg}`}>
                                    <div className="text-xs font-medium">{formatTimeForStation(hour.time)}</div>
                                    <div className="text-lg">{iconForWeatherCode(hour.code)}</div>
                                    {activeOverlays.has("temp") ? (
                                      <div className={`text-sm font-bold ${tempClass(hour.temp)}`}>{Math.round(hour.temp)}°</div>
                                    ) : null}
                                    {activeOverlays.has("rain") ? (
                                      <div className="mt-1 space-y-1">
                                        <div className="h-1 rounded bg-surface-border">
                                          <div className="h-1 rounded bg-sky-500" style={{ width: `${Math.min(100, Math.max(0, hour.rainPct))}%` }} />
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">{Math.round(hour.rainPct)}%</div>
                                      </div>
                                    ) : null}
                                    {activeOverlays.has("wind") ? (
                                      <div className="text-[10px] text-muted-foreground">{Math.round(hour.wind)} mph</div>
                                    ) : null}
                                    {activeOverlays.has("gusts") ? (
                                      <div className="text-[10px] text-muted-foreground">G {Math.round(hour.gusts)}</div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">Spray: {daySpray}</div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardContent className="space-y-3 p-6">
                  <div className={`text-sm font-medium ${spraySummary.includes("No safe") ? "text-red-600" : "text-emerald-700"}`}>
                    {spraySummary.includes("No safe") ? "⚠️ No safe spray windows today" : spraySummary}
                  </div>
                  <div className="relative overflow-hidden rounded-xl border">
                    <div className="flex h-10">
                      {todaySpraySegments.map((segment) => (
                        <div
                          key={segment.time}
                          className={`flex-1 ${
                            segment.level === "safe" ? "bg-emerald-400" : segment.level === "marginal" ? "bg-amber-400" : "bg-red-400"
                          }`}
                        />
                      ))}
                    </div>
                    {nowIndex >= 0 ? (
                      <div className="absolute bottom-0 top-0 w-0.5 bg-text-primary" style={{ left: `${(nowIndex / Math.max(1, todaySpraySegments.length)) * 100}%` }}>
                        <span className="absolute -top-4 -translate-x-1/2 rounded bg-surface-elevated px-1 text-[10px] text-text-muted">Now</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>6AM</span>
                    <span>9AM</span>
                    <span>12PM</span>
                    <span>3PM</span>
                    <span>6PM</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Rainfall Summary</div>
                      <div className="text-xs text-muted-foreground">Rainfall (in)</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setIsRainLogOpen(true)}>
                      Open Rainfall Log
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs uppercase text-muted-foreground">Today</div>
                      <div className="mt-1 text-base font-semibold">{rainfallSummary.today.toFixed(2)} in</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs uppercase text-muted-foreground">Last 7 days</div>
                      <div className="mt-1 text-base font-semibold">{rainfallSummary.week.toFixed(2)} in</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs uppercase text-muted-foreground">Month-to-date</div>
                      <div className="mt-1 text-base font-semibold">{rainfallSummary.monthToDate.toFixed(2)} in</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs uppercase text-muted-foreground">Year-to-date</div>
                      <div className="mt-1 text-base font-semibold">{rainfallSummary.yearToDate.toFixed(2)} in</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Dialog open={isRainLogOpen} onOpenChange={setIsRainLogOpen}>
                <DialogContent aria-describedby="dialog-desc" className="max-h-[85vh] max-w-[1200px] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Rainfall Log</DialogTitle>
                    <DialogDescription id="dialog-desc" className="sr-only">
                      Review and edit annual rainfall entries for the selected weather location.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {rainfallYear} Total = {annualRainGrid.yearlyTotal.toFixed(2)} in
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                          value={rainfallYear}
                          onChange={(event) => setRainfallYear(Number(event.target.value))}
                        >
                          {Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - 3 + index).map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" variant="outline" onClick={() => setIsEditingRain((prev) => !prev)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          {isEditingRain ? "Hide Editor" : "Edit"}
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-md border border-surface-border">
                      <table className="min-w-[980px] border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-muted/40">
                            <th className="sticky left-0 z-10 border-b border-r border-surface-border bg-muted/50 px-2 py-1 text-left">Day</th>
                            {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map((month) => (
                              <th key={month} className="border-b border-r border-surface-border px-2 py-1 text-center font-semibold">
                                {month}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: 31 }, (_, dayIndex) => {
                            const day = dayIndex + 1;
                            return (
                              <tr key={`day-${day}`} className={dayIndex % 3 === 2 ? "bg-muted/15" : ""}>
                                <td className="sticky left-0 z-10 border-r border-surface-border bg-background px-2 py-0.5 font-medium">{day}</td>
                                {Array.from({ length: 12 }, (_, monthIndex) => {
                                  const daysInMonth = new Date(rainfallYear, monthIndex + 1, 0).getDate();
                                  if (day > daysInMonth) {
                                    return <td key={`${monthIndex}-${day}`} className="border-r border-surface-border bg-muted/20 px-2 py-0.5" />;
                                  }
                                  const hasValue = annualRainGrid.monthDayHasValue[monthIndex][dayIndex];
                                  const value = annualRainGrid.monthDayValues[monthIndex][dayIndex];
                                  return (
                                    <td key={`${monthIndex}-${day}`} className="border-r border-surface-border px-2 py-0.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleRainCellClick(monthIndex, day)}
                                        className="h-5 w-full rounded px-1 hover:bg-muted"
                                      >
                                        {hasValue ? value.toFixed(2) : ""}
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                          <tr className="sticky bottom-6 z-10 bg-muted/20 font-semibold">
                            <td className="sticky left-0 z-20 border-r border-t border-surface-border bg-muted/30 px-2 py-1">Monthly Total</td>
                            {annualRainGrid.monthTotals.map((total, monthIndex) => (
                              <td key={`total-${monthIndex}`} className="border-r border-t border-surface-border bg-muted/30 px-2 py-1 text-center">
                                {total > 0 ? total.toFixed(2) : "0.00"}
                              </td>
                            ))}
                          </tr>
                          <tr className="sticky bottom-0 z-10 bg-muted/30 font-semibold">
                            <td className="sticky left-0 z-20 border-r border-t border-surface-border bg-muted/40 px-2 py-1">Yearly Running Total</td>
                            {annualRainGrid.runningTotals.map((total, monthIndex) => (
                              <td key={`running-${monthIndex}`} className="border-r border-t border-surface-border bg-muted/40 px-2 py-1 text-center">
                                {total > 0 ? total.toFixed(2) : "0.00"}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {isEditingRain ? (
                      <div className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_1fr_auto]">
                        <Input type="date" value={rainEditDate} onChange={(event) => setRainEditDate(event.target.value)} />
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={rainEditAmount}
                          onChange={(event) => setRainEditAmount(event.target.value)}
                          placeholder="Rainfall (in)"
                        />
                        <Button size="sm" onClick={saveManualRain} disabled={savingRain}>
                          Save
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </DialogContent>
              </Dialog>

              <Card className="rounded-xl">
                <CardContent className="grid gap-3 p-6 md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Current wind</div>
                    <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                      <Wind className="h-4 w-4" />
                      {Math.round(weatherData.current_weather?.windspeed ?? 0)} mph
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Condition</div>
                    <div className="mt-1 text-lg font-semibold">{labelForWeatherCode(weatherData.current_weather?.weathercode ?? 0)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Rain chance now</div>
                    <div className="mt-1 text-lg font-semibold">{Math.round(hourlyRows[0]?.rainPct ?? 0)}%</div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-1">
                {(Object.keys(overlayLabels) as OverlayKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`rounded-md px-2 py-1 text-xs transition-all duration-200 ${
                      activeOverlays.has(key) ? "bg-status-active text-text-inverse" : "border bg-background text-muted-foreground"
                    }`}
                    onClick={() => toggleOverlay(key)}
                  >
                    {overlayLabels[key]}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="flex h-[380px] flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="text-4xl">🛰️</div>
              <div className="text-sm font-semibold">Radar — Coming Soon</div>
              <div className="max-w-xs text-xs text-muted-foreground">
                Live radar will appear here. NOAA/NWS radar integration is in development.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

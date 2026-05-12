import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AuthRole = 'admin' | 'manager' | 'employee';

type WeatherSettingsProps = {
  orgId: string;
  user: User;
  userRole: AuthRole | null;
};

type WeatherLocationRow = {
  id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean | null;
};

type WeatherPrefsRow = {
  id: string;
  enabled_widgets: string[] | null;
};

const PANEL_OPTIONS = [
  { id: 'current-conditions', label: 'Current Conditions' },
  { id: 'hourly-forecast', label: 'Hourly Forecast' },
  { id: 'daily-forecast', label: '7-Day Forecast' },
  { id: 'wind', label: 'Wind' },
  { id: 'rain', label: 'Rainfall' },
  { id: 'alerts', label: 'Weather Alerts' },
  { id: 'turf-risk-notes', label: 'Turf Risk Notes' },
] as const;

export function WeatherSettings({ orgId }: WeatherSettingsProps) {
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [enabledPanels, setEnabledPanels] = useState<string[]>([]);
  const [prefsId, setPrefsId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const locationQuery = useQuery({
    queryKey: ['settings-weather-location', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client is not configured.');
      const { data, error } = await supabase
        .from('weather_locations')
        .select('id, name, latitude, longitude, is_active')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as WeatherLocationRow | null) ?? null;
    },
  });

  const prefsQuery = useQuery({
    queryKey: ['settings-weather-prefs', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client is not configured.');
      const { data, error } = await supabase
        .from('weather_display_prefs')
        .select('id, enabled_widgets')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as WeatherPrefsRow | null) ?? null;
    },
  });

  useEffect(() => {
    setLocationName(locationQuery.data?.name ?? '');
    setLocationAddress('');
  }, [locationQuery.data?.name]);

  useEffect(() => {
    setEnabledPanels(prefsQuery.data?.enabled_widgets ?? PANEL_OPTIONS.map((panel) => panel.id));
    setPrefsId(prefsQuery.data?.id ?? null);
  }, [prefsQuery.data]);

  const loading = locationQuery.isLoading || prefsQuery.isLoading;
  const anyError = locationQuery.error || prefsQuery.error;

  const togglePanel = async (panelId: string, enabled: boolean) => {
    if (!supabase) return;
    setErrorMessage('');
    const next = enabled ? [...enabledPanels, panelId] : enabledPanels.filter((panel) => panel !== panelId);
    setEnabledPanels(next);
    const payload = {
      org_id: orgId,
      enabled_widgets: next,
      user_id: null,
      location_id: locationQuery.data?.id ?? null,
    };
    const query = prefsId
      ? supabase.from('weather_display_prefs').update(payload).eq('id', prefsId).eq('org_id', orgId)
      : supabase.from('weather_display_prefs').insert(payload);
    const { error } = await query;
    if (error) {
      setErrorMessage(error.message);
      setEnabledPanels(enabledPanels);
      return;
    }
    await prefsQuery.refetch();
  };

  const saveLocation = async () => {
    if (!supabase || !locationQuery.data) return;
    setErrorMessage('');
    const { error } = await supabase
      .from('weather_locations')
      .update({
        name: locationName.trim() || locationQuery.data.name,
        address: locationAddress.trim() || null,
      })
      .eq('id', locationQuery.data.id)
      .eq('org_id', orgId);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await locationQuery.refetch();
  };

  const activeLocation = useMemo(() => locationQuery.data, [locationQuery.data]);

  if (loading) {
    return <div className="h-32 animate-pulse rounded-xl border bg-muted/40" />;
  }

  if (anyError) {
    return (
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm text-destructive">Unable to load weather settings.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void locationQuery.refetch();
            void prefsQuery.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border p-4">
        <h3 className="text-base font-semibold">Active location</h3>
        {activeLocation ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{activeLocation.name ?? 'Weather location'}</p>
            <p className="text-muted-foreground">
              {activeLocation.latitude ?? '--'}, {activeLocation.longitude ?? '--'} ·{' '}
              {activeLocation.is_active ? 'Active' : 'Inactive'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active weather location found.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Location name" />
          <Input value={locationAddress} onChange={(event) => setLocationAddress(event.target.value)} placeholder="Address" />
        </div>
        <Button onClick={() => void saveLocation()} className="w-fit">
          Change location
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <h3 className="text-base font-semibold">What shows on the weather page</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {PANEL_OPTIONS.map((panel) => {
            const enabled = enabledPanels.includes(panel.id);
            return (
              <label key={panel.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{panel.label}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => {
                    void togglePanel(panel.id, event.target.checked);
                  }}
                />
              </label>
            );
          })}
        </div>
      </div>
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </div>
  );
}

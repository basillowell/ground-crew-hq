import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type ChemicalSettings = {
  org_id: string;
  default_property_id: string | null;
  default_applicator_id: string | null;
  rei_notification_hours: number;
  require_weather_log: boolean;
  require_supervisor: boolean;
  default_area_unit: string;
};

const defaultSettings = (orgId: string): ChemicalSettings => ({
  org_id: orgId,
  default_property_id: null,
  default_applicator_id: null,
  rei_notification_hours: 24,
  require_weather_log: true,
  require_supervisor: false,
  default_area_unit: 'acres',
});

export function useChemicalSettings() {
  const { currentUser } = useAuth();
  const orgId = currentUser?.orgId ?? '';
  const [settings, setSettings] = useState<ChemicalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .from('chemical_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setSettings(defaultSettings(orgId));
      setIsLoading(false);
      return;
    }

    if (!data) {
      setSettings(defaultSettings(orgId));
      setIsLoading(false);
      return;
    }

    const next = data as Partial<ChemicalSettings>;
    setSettings({
      org_id: orgId,
      default_property_id: next.default_property_id ?? null,
      default_applicator_id: next.default_applicator_id ?? null,
      rei_notification_hours: Number(next.rei_notification_hours ?? 24),
      require_weather_log: Boolean(next.require_weather_log ?? true),
      require_supervisor: Boolean(next.require_supervisor ?? false),
      default_area_unit: next.default_area_unit ?? 'acres',
    });
    setIsLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) {
      setIsLoading(true);
      return;
    }
    void loadSettings();
  }, [loadSettings, orgId]);

  const saveSettings = useCallback(
    async (nextSettings: Omit<ChemicalSettings, 'org_id'>) => {
      if (!orgId) return { ok: false as const, error: 'Missing organization context' };
      setIsSaving(true);
      setError('');
      const payload: ChemicalSettings = {
        org_id: orgId,
        default_property_id: nextSettings.default_property_id || null,
        default_applicator_id: nextSettings.default_applicator_id || null,
        rei_notification_hours: Number(nextSettings.rei_notification_hours ?? 24),
        require_weather_log: Boolean(nextSettings.require_weather_log),
        require_supervisor: Boolean(nextSettings.require_supervisor),
        default_area_unit: nextSettings.default_area_unit || 'acres',
      };

      const { error: upsertError } = await supabase
        .from('chemical_settings')
        .upsert(payload, { onConflict: 'org_id' });

      setIsSaving(false);

      if (upsertError) {
        setError(upsertError.message);
        return { ok: false as const, error: upsertError.message };
      }

      setSettings(payload);
      return { ok: true as const };
    },
    [orgId],
  );

  return {
    settings,
    isLoading,
    isSaving,
    error,
    setSettings,
    saveSettings,
    reload: loadSettings,
  };
}

import { supabase } from '@/lib/supabase';

type InitOrgSettingsArgs = {
  orgId: string;
};

const DEFAULT_WEATHER_LATITUDE = 27.3364;
const DEFAULT_WEATHER_LONGITUDE = -82.5307;

export async function initOrgSettings({ orgId }: InitOrgSettingsArgs): Promise<void> {
  if (!supabase || !orgId) return;

  const existing = await supabase
    .from('program_settings')
    .select('id')
    .eq('org_id', orgId)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }
  if (existing.data?.id) {
    return;
  }

  const insertResult = await supabase
    .from('program_settings')
    .upsert(
      {
        org_id: orgId,
        app_name: 'Ground Crew HQ',
        weather_default_latitude: DEFAULT_WEATHER_LATITUDE,
        weather_default_longitude: DEFAULT_WEATHER_LONGITUDE,
        weather_preferred_provider: 'open-meteo',
      },
      { onConflict: 'org_id', ignoreDuplicates: true },
    );

  if (insertResult.error) {
    throw insertResult.error;
  }
}

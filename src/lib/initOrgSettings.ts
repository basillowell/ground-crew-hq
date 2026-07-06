import { supabase } from '@/lib/supabase';

type InitOrgSettingsArgs = {
  orgId: string;
};


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
      },
      { onConflict: 'org_id', ignoreDuplicates: true },
    );

  if (insertResult.error) {
    throw insertResult.error;
  }
}

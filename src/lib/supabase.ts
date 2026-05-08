import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigError = hasSupabaseConfig
  ? ''
  : 'Missing Supabase environment variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY.';

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export async function refreshSessionWithRetry() {
  if (!supabase) return { data: null, error: new Error('Supabase client is not configured.') };

  let attempts = 0;
  let lastError: unknown = null;
  while (attempts < 2) {
    attempts += 1;
    const result = await supabase.auth.refreshSession();
    if (!result.error) return result;
    lastError = result.error;
  }
  return {
    data: null,
    error: lastError instanceof Error ? lastError : new Error('Session refresh failed.'),
  };
}

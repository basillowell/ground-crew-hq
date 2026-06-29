import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables missing');
}

// Bypasses Supabase's Web-Lock-based cross-tab auth coordination.
// That mechanism has a confirmed upstream bug (supabase/supabase-js#2013)
// where the lock can become permanently orphaned after extended tab
// backgrounding, causing every subsequent auth operation to hang
// indefinitely. This app is primarily used in a single active tab at
// a time, so the cross-tab coordination this replaces provides little
// benefit relative to the risk. Authorized exception to CODERULES
// Rule 4/21 - see ARCHITECTURE_ROADMAP.md.
const noOpLock = async <T>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<T>,
): Promise<T> => {
  return await fn();
};

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigError = hasSupabaseConfig
  ? ''
  : 'Missing Supabase environment variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY.';

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        lock: noOpLock,
      },
      realtime: { params: { eventsPerSecond: 2 } },
    })
  : null;

export async function refreshSessionWithRetry() {
  if (!supabase) return { data: null, error: new Error('Supabase client is not configured.') };
  return supabase.auth.refreshSession();
}

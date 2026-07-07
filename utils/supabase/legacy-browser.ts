import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables missing')
}

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)
export const supabaseConfigError = hasSupabaseConfig
  ? ''
  : 'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY.'

export const supabase = hasSupabaseConfig
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : null

export async function refreshSessionWithRetry() {
  if (!supabase) return { data: null, error: new Error('Supabase client is not configured.') }
  return supabase.auth.refreshSession()
}

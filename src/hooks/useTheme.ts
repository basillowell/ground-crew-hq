import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { supabase } from '@/lib/supabase';

export type ThemeMode = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'gchq-theme';

function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light' || v === 'system') return v;
  } catch { /* ignore */ }
  return 'dark';
}

function applyTheme(mode: ThemeMode) {
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('light', !isDark);
}

export function useTheme() {
  const programSettings = useAppStore((s) => s.programSettings);
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme);

  // Apply theme to DOM whenever state changes
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Sync from DB once programSettings loads (DB value wins over stale localStorage)
  useEffect(() => {
    if (!programSettings) return;
    const pref = (programSettings as { theme_preference?: string | null }).theme_preference;
    if (pref !== 'dark' && pref !== 'light' && pref !== 'system') return;
    const stored = readStoredTheme();
    if (pref !== stored) {
      try { localStorage.setItem(STORAGE_KEY, pref); } catch { /* ignore */ }
      setThemeState(pref as ThemeMode);
    }
  }, [programSettings]);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeState(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
    applyTheme(mode);

    // Persist to DB — silently fails until theme_preference column is added
    const orgId = programSettings?.org_id;
    if (!supabase || !orgId) return;
    try {
      await supabase
        .from('program_settings')
        .update({ theme_preference: mode })
        .eq('org_id', orgId);
    } catch { /* silently ignore until DB migration runs */ }
  }, [programSettings]);

  return { theme, setTheme };
}

// Standalone initializer — call once at app root to apply theme before any data loads
export function initThemeFromStorage() {
  applyTheme(readStoredTheme());
}

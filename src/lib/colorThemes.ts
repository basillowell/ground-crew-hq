export type ColorTheme = {
  id: string;
  label: string;
  /** Hue + chroma for every surface. Its lightness is NOT used — that comes
   *  from the active mode's ladder, because Dark/Light stays an independent
   *  axis in GCHQ (unlike Linear, where the theme *is* light or dark). */
  base: string;
  /** Interactive/brand tokens: primary buttons, links, active states, ring. */
  accent: string;
  /** 0-100. Sets how far surfaces spread and the WCAG ratio text must hit.
   *  50 reproduces the shipped design. Stored in the DB as `theme_darkness`
   *  pending the rename decision in Phase 4. */
  contrast?: number;
  fontThemePreset: string;
};

/**
 * NOTE (Phase 6 owes these a design pass): these triples were remapped
 * mechanically from the old four-colour presets — `base` from the old
 * `sidebarColor`, `accent` from the old `primaryColor` — so the build and the
 * engine can be exercised. They are NOT final.
 *
 * Two known consequences to resolve there:
 *  - Backgrounds shift. Fairway's surfaces used to tint toward the old
 *    primary (green); they now follow `base` (navy). That difference is the
 *    old "accent bleeds into the background" bug being corrected, but it does
 *    change each preset's character.
 *  - `sunset-polo` is wrong on purpose. Its old sidebarColor (#d94f04) is a
 *    saturated orange, not a surface colour, so as `base` it tints the whole
 *    app orange. It needs a real base chosen by eye.
 */
export const COLOR_THEMES: ColorTheme[] = [
  { id: 'fairway', label: 'Fairway', base: '#0f172a', accent: '#2FA866', fontThemePreset: 'modern-sans' },
  { id: 'midnight-turf', label: 'Midnight Turf', base: '#020617', accent: '#34d399', fontThemePreset: 'compact-ops' },
  { id: 'clay-court', label: 'Clay Court', base: '#1c1410', accent: '#c2703d', fontThemePreset: 'classic-club' },
  { id: 'sunset-polo', label: 'Sunset Polo', base: '#d94f04', accent: '#f2711f', fontThemePreset: 'editorial-serif' },
  { id: 'polo-green', label: 'Polo Green', base: '#0d2818', accent: '#145a32', fontThemePreset: 'classic-club' },
  { id: 'slate-citrus', label: 'Slate & Citrus', base: '#1e293b', accent: '#ea7c3c', fontThemePreset: 'modern-sans' },
];

export function getColorTheme(id: string) {
  return COLOR_THEMES.find((theme) => theme.id === id);
}

/** Shared so AppLayout and SettingsPage cannot drift. AppLayout previously
 *  hardcoded Segoe UI here and ignored the preset entirely, so fonts changed
 *  only after visiting Settings. */
export const FONT_THEMES: Record<string, { body: string; heading: string }> = {
  'modern-sans': { body: '"Inter", "Segoe UI", sans-serif', heading: '"Inter", "Segoe UI", sans-serif' },
  'editorial-serif': { body: '"Inter", "Segoe UI", sans-serif', heading: '"Georgia", "Times New Roman", serif' },
  'classic-club': { body: '"Trebuchet MS", "Segoe UI", sans-serif', heading: '"Palatino Linotype", "Book Antiqua", serif' },
  'compact-ops': { body: '"Segoe UI", "Arial", sans-serif', heading: '"Segoe UI", "Arial", sans-serif' },
};

export function applyFontTheme(root: HTMLElement, preset: string | undefined): void {
  const font = FONT_THEMES[preset ?? ''] ?? FONT_THEMES['modern-sans'];
  root.style.setProperty('--brand-body-font', font.body);
  root.style.setProperty('--brand-heading-font', font.heading);
}

export type CustomThemeColors = {
  base: string;
  accent: string;
  contrast?: number;
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Parses the 0-100 scalar stored in `theme_darkness` / `theme_darkness_override`. */
export function parseThemeDarkness(raw: unknown): number | null {
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

/**
 * Validates a value read back from `app_users.theme_custom_colors` (unconstrained
 * jsonb). Rows written in the old {primaryColor, accentColor, sidebarColor}
 * shape fail this check and return null, which falls back to the preset — the
 * intended behaviour, since no personal custom-colour records exist.
 */
export function parseCustomThemeColors(raw: unknown): CustomThemeColors | null {
  if (!raw || typeof raw !== 'object') return null;
  const { base, accent, contrast } = raw as Record<string, unknown>;
  const isHex = (v: unknown): v is string => typeof v === 'string' && HEX_COLOR_PATTERN.test(v);
  if (!isHex(base) || !isHex(accent)) return null;
  const parsedContrast = parseThemeDarkness(contrast);
  return {
    base,
    accent,
    ...(parsedContrast !== null ? { contrast: parsedContrast } : {}),
  };
}

/**
 * Resolves the effective ColorTheme for a user override. Returns undefined when
 * nothing overrides (preserving the existing fallback-to-programSetting contract).
 */
export function resolveEffectiveTheme(
  userOverridePresetId: string | null | undefined,
  personalCustomColors: CustomThemeColors | null | undefined,
  fallbackFontThemePreset?: string,
): ColorTheme | undefined {
  if (userOverridePresetId === 'custom' && personalCustomColors) {
    return {
      id: 'custom',
      label: 'Custom',
      ...personalCustomColors,
      fontThemePreset: fallbackFontThemePreset ?? 'modern-sans',
    };
  }
  return userOverridePresetId ? getColorTheme(userOverridePresetId) : undefined;
}

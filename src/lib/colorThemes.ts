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
 * `base` carries each preset's surface hue; it comes from the old four-colour
 * presets' `cardColor`, which is the field that actually described the surface
 * family. (The old `sidebarColor` only ever described the rail — using it here
 * is what turned Sunset Polo orange and Fairway navy.) Only base's hue and
 * chroma are used; its lightness is discarded in favour of the mode's ladder,
 * so these read as the intended colour in both light and dark.
 *
 * Under two inputs each preset gets one hue family, so Fairway is green rather
 * than navy-rail-over-green, and Polo Green's cream accent (#e8dcb5) gives way
 * to its primary, since accent now drives buttons.
 */
export const COLOR_THEMES: ColorTheme[] = [
  { id: 'fairway', label: 'Fairway', base: '#1e4633', accent: '#2FA866', fontThemePreset: 'modern-sans' },
  { id: 'midnight-turf', label: 'Midnight Turf', base: '#0f3b30', accent: '#34d399', fontThemePreset: 'compact-ops' },
  { id: 'clay-court', label: 'Clay Court', base: '#3d2a1e', accent: '#c2703d', fontThemePreset: 'classic-club' },
  { id: 'sunset-polo', label: 'Sunset Polo', base: '#40260f', accent: '#f2711f', fontThemePreset: 'editorial-serif' },
  { id: 'polo-green', label: 'Polo Green', base: '#123d26', accent: '#145a32', fontThemePreset: 'classic-club' },
  { id: 'slate-citrus', label: 'Slate & Citrus', base: '#2a323d', accent: '#ea7c3c', fontThemePreset: 'modern-sans' },
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

export type ColorTheme = {
  id: string;
  label: string;
  primaryColor: string;   // buttons / primary actions
  accentColor: string;    // selected-item state
  sidebarColor: string;   // navigation rail
  cardColor: string;      // card surface tint (mode-aware lightness applied at runtime)
  fontThemePreset: string;
};

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'fairway',
    label: 'Fairway',
    primaryColor: '#2FA866',
    accentColor: '#16a34a',
    sidebarColor: '#0f172a',
    cardColor: '#1e4633',
    fontThemePreset: 'modern-sans',
  },
  {
    id: 'midnight-turf',
    label: 'Midnight Turf',
    primaryColor: '#34d399',
    accentColor: '#059669',
    sidebarColor: '#020617',
    cardColor: '#0f3b30',
    fontThemePreset: 'compact-ops',
  },
  {
    id: 'clay-court',
    label: 'Clay Court',
    primaryColor: '#c2703d',
    accentColor: '#e08e57',
    sidebarColor: '#1c1410',
    cardColor: '#3d2a1e',
    fontThemePreset: 'classic-club',
  },
  {
    id: 'sunset-polo',
    label: 'Sunset Polo',
    primaryColor: '#f2711f',
    accentColor: '#ffb347',
    sidebarColor: '#d94f04',
    cardColor: '#40260f',
    fontThemePreset: 'editorial-serif',
  },
  {
    id: 'polo-green',
    label: 'Polo Green',
    primaryColor: '#145a32',
    accentColor: '#e8dcb5',
    sidebarColor: '#0d2818',
    cardColor: '#123d26',
    fontThemePreset: 'classic-club',
  },
  {
    id: 'slate-citrus',
    label: 'Slate & Citrus',
    primaryColor: '#ea7c3c',
    accentColor: '#64748b',
    sidebarColor: '#1e293b',
    cardColor: '#2a323d',
    fontThemePreset: 'modern-sans',
  },
];

export function getColorTheme(id: string) {
  return COLOR_THEMES.find((theme) => theme.id === id);
}

export type CustomThemeColors = {
  primaryColor: string;
  accentColor: string;
  sidebarColor: string;
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Validates a value read back from `app_users.theme_custom_colors` (unconstrained jsonb). */
export function parseCustomThemeColors(raw: unknown): CustomThemeColors | null {
  if (!raw || typeof raw !== 'object') return null;
  const { primaryColor, accentColor, sidebarColor } = raw as Record<string, unknown>;
  const isHex = (v: unknown): v is string => typeof v === 'string' && HEX_COLOR_PATTERN.test(v);
  if (!isHex(primaryColor) || !isHex(accentColor) || !isHex(sidebarColor)) return null;
  return { primaryColor, accentColor, sidebarColor };
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
      // Custom picks 3 roles; card tint is derived from the primary hue.
      cardColor: personalCustomColors.primaryColor,
      fontThemePreset: fallbackFontThemePreset ?? 'modern-sans',
    };
  }
  return userOverridePresetId ? getColorTheme(userOverridePresetId) : undefined;
}

function colorsEqual(a?: string, b?: string): boolean {
  return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

/**
 * Resolves the card tint color for an org's stored program_settings. If the org's
 * colors match a preset, uses that preset's designed cardColor; otherwise (custom
 * org colors) derives the card tint from the primary color's hue.
 */
export function resolveThemeCardColor(
  primaryColor?: string,
  accentColor?: string,
  sidebarColor?: string,
  fontThemePreset?: string,
): string | undefined {
  if (!primaryColor) return undefined;
  const matched = COLOR_THEMES.find(
    (theme) =>
      colorsEqual(theme.primaryColor, primaryColor) &&
      colorsEqual(theme.accentColor, accentColor) &&
      colorsEqual(theme.sidebarColor, sidebarColor) &&
      theme.fontThemePreset === fontThemePreset,
  );
  return matched?.cardColor ?? primaryColor;
}

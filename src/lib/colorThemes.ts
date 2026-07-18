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
 * Three curated schemes, not six computed ones. The products that look cleanest
 * in this category (Linear, Vercel) converge on the same two moves: near-neutral
 * surfaces carrying almost no chroma, and a single accent used sparingly — on
 * the brand mark, focus rings, and one primary action. Six hue-saturated presets
 * were working against that.
 *
 * `base` supplies hue + chroma only; its lightness is discarded in favour of the
 * mode's ladder. So a near-neutral base (very low chroma) is not a "grey theme" —
 * it is what makes surfaces read as clean rather than tinted.
 *
 * Named descriptively rather than after the products they take cues from: these
 * are other companies' trademarks, and shipping a "Linear" theme in a commercial
 * product trades on their brand.
 */
export const COLOR_THEMES: ColorTheme[] = [
  // GCHQ's own documented design system (CLAUDE.md: base #0f1a14, accent
  // #a3e635 electric lime). None of the previous presets used it, so the app
  // could not actually look like its own spec.
  { id: 'turf', label: 'Turf', base: '#0f1a14', accent: '#a3e635', fontThemePreset: 'modern-sans' },
  // Linear-style: near-neutral cool surfaces (their Surface 1 is #0f1011) with
  // a single lavender accent.
  { id: 'graphite', label: 'Graphite', base: '#0f1011', accent: '#5e6ad2', fontThemePreset: 'modern-sans' },
  // Vercel/Geist-style: pure neutral surfaces, one blue accent, nothing else.
  { id: 'mono', label: 'Mono', base: '#0a0a0a', accent: '#0070f3', fontThemePreset: 'modern-sans' },
  // The one warm scheme: deep polo green surfaces with a gold accent (country-
  // club heritage). Gold is light enough that on-accent button text resolves to
  // black (verified 10:1); text and surfaces stay neutral/green as usual.
  { id: 'clubhouse', label: 'Clubhouse', base: '#14432c', accent: '#d4af37', fontThemePreset: 'modern-sans' },
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

export type Hsl = { h: number; s: number; l: number };

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgbToHsl(r, g, b);
}

export function rgbTripletToHsl(triplet: string): Hsl {
  const [r, g, b] = triplet.trim().split(/\s+/).map((n) => parseInt(n, 10) / 255);
  return rgbToHsl(r, g, b);
}

export function hslToRgbTriplet(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toByte = (v: number) => Math.round(clamp01(v + m) * 255);
  return `${toByte(r)} ${toByte(g)} ${toByte(b)}`;
}

/** Blends hue/saturation toward `target` by `amount` (0-1), holding `base.l` fixed. */
export function tintHslPreservingLightness(base: Hsl, target: { h: number; s: number }, amount: number): Hsl {
  const delta = ((target.h - base.h + 540) % 360) - 180;
  const h = (base.h + delta * amount + 360) % 360;
  const s = base.s + (target.s - base.s) * amount;
  return { h, s, l: base.l };
}

const DARK_SURFACE_BASELINES: Record<string, string> = {
  '--surface-base': '17 20 18',
  '--surface-elevated': '32 40 35',
  '--surface-hover': '30 38 33',
  '--surface-border': '44 54 47',
};

const LIGHT_SURFACE_BASELINES: Record<string, string> = {
  '--surface-base': '214 222 214',
  '--surface-elevated': '236 241 236',
  '--surface-hover': '226 234 226',
  '--surface-border': '168 184 168',
};

const SURFACE_TINT_AMOUNT_DARK = 0.32;
const SURFACE_TINT_AMOUNT_LIGHT = 0.26;

function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Mode-aware card tint: bright (high-L) in light mode, dark (low-L) in dark mode. */
function cardTriplet(cardColorHex: string, isLightMode: boolean): string {
  const { h, s } = hexToHsl(cardColorHex);
  if (isLightMode) {
    return hslToRgbTriplet(h, Math.min(s, 16), 96);
  }
  return hslToRgbTriplet(h, Math.min(s, 22), 11);
}

export function ghostTriplet(primaryColorHex: string, isLightMode: boolean): string {
  const { h, s } = hexToHsl(primaryColorHex);
  if (isLightMode) {
    return hslToRgbTriplet(h, Math.min(s, 45), 93);
  }
  return hslToRgbTriplet(h, Math.min(s, 35), 12);
}

export function dimTriplet(primaryColorHex: string, isLightMode: boolean): string {
  const { h, s } = hexToHsl(primaryColorHex);
  if (isLightMode) {
    return hslToRgbTriplet(h, Math.min(s, 40), 58);
  }
  return hslToRgbTriplet(h, Math.min(s, 45), 33);
}

/** Mode-aware sidebar: keeps a readable lightness band while pushing scheme color so the rail pops. */
function sidebarHslStrings(sidebarColorHex: string, isLightMode: boolean): { background: string; accent: string } {
  const { h, s } = hexToHsl(sidebarColorHex);
  if (isLightMode) {
    const sat = clampRange(s, 12, 24);
    return {
      background: `${h.toFixed(1)} ${sat.toFixed(1)}% 90%`,
      accent: `${h.toFixed(1)} ${sat.toFixed(1)}% 82%`,
    };
  }
  const sat = clampRange(s, 18, 45);
  return {
    background: `${h.toFixed(1)} ${sat.toFixed(1)}% 10%`,
    accent: `${h.toFixed(1)} ${sat.toFixed(1)}% 18%`,
  };
}

type ThemeSurfaceColors = {
  primaryColor?: string;
  cardColor?: string;
  sidebarColor?: string;
};

/**
 * Applies the scheme's role-based surface tinting:
 *  - base/elevated/hover/border: subtle hue/saturation tint toward primaryColor, lightness
 *    held fixed per-token so the 9b34b42 contrast fix can't regress for any scheme.
 *  - card: mode-aware tint toward cardColor (brighter in light, darker in dark).
 *  - sidebar background + hover/selected accent: mode-aware tint toward sidebarColor so the
 *    navigation rail reads as a distinct, scheme-colored panel with a shaded hover state.
 */
export function applyThemeSurfaces(root: HTMLElement, colors: ThemeSurfaceColors, isLightMode: boolean): void {
  const { primaryColor, cardColor, sidebarColor } = colors;

  if (primaryColor) {
    const target = hexToHsl(primaryColor);
    const surfaceBaselines = isLightMode ? LIGHT_SURFACE_BASELINES : DARK_SURFACE_BASELINES;
    const surfaceAmount = isLightMode ? SURFACE_TINT_AMOUNT_LIGHT : SURFACE_TINT_AMOUNT_DARK;
    for (const [varName, baselineTriplet] of Object.entries(surfaceBaselines)) {
      const baseHsl = rgbTripletToHsl(baselineTriplet);
      const tinted = tintHslPreservingLightness(baseHsl, target, surfaceAmount);
      root.style.setProperty(varName, hslToRgbTriplet(tinted.h, tinted.s, tinted.l));
    }
    root.style.setProperty('--brand-ghost', ghostTriplet(primaryColor, isLightMode));
    root.style.setProperty('--brand-dim', dimTriplet(primaryColor, isLightMode));
  }

  if (cardColor) {
    root.style.setProperty('--surface-card', cardTriplet(cardColor, isLightMode));
  }

  if (sidebarColor) {
    const sidebar = sidebarHslStrings(sidebarColor, isLightMode);
    root.style.setProperty('--sidebar-background', sidebar.background);
    root.style.setProperty('--sidebar-accent', sidebar.accent);
  }
}

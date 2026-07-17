/**
 * OKLCH theme engine.
 *
 * Takes two colours + a contrast scalar and derives every themed token.
 * Replaces the previous HSL implementation, whose lightness channel is an RGB
 * math artifact rather than a perceptual measurement — holding HSL `l` fixed
 * while changing hue/saturation does NOT hold perceived lightness fixed, which
 * is why the old code needed per-token saturation caps and per-mode tint
 * amounts, and why surfaces drifted in apparent brightness depending on which
 * hue the user picked.
 *
 * Two rules replace all of that:
 *   1. Lightness is chosen in OKLCH, where it is perceptually uniform. One
 *      ladder produces identical perceived lightness for every hue.
 *   2. Chroma is gamut-mapped (reduced until the colour is representable in
 *      sRGB at that lightness) instead of capped by hand per token.
 *
 * The ladders below are the design system's elevation steps, measured out of
 * app/globals.css so contrast=50 reproduces the shipped look. They are the
 * design, not tuning constants: nothing here is per-hue.
 */

export type Oklch = { L: number; C: number; H: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── sRGB <-> OKLab (Björn Ottosson) ─────────────────────────────────────── */

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function rgbToOklch([r, g, b]: Rgb): Oklch {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C: Math.hypot(a, bb), H };
}

function oklchToRgb({ L, C, H }: Oklch): Rgb {
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const inGamut = ([r, g, b]: Rgb) =>
  r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001;

/**
 * Reduce chroma until the colour fits in sRGB, holding L and H fixed.
 * This is the principled replacement for the old `Math.min(s, N)` caps: it is
 * hue-independent and preserves the lightness the ladder asked for.
 */
function gamutMap(c: Oklch): Rgb {
  const direct = oklchToRgb(c);
  if (inGamut(direct)) return direct;
  let lo = 0;
  let hi = c.C;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb({ ...c, C: mid }))) lo = mid;
    else hi = mid;
  }
  return oklchToRgb({ ...c, C: lo });
}

const hexToOklch = (hex: string): Oklch => rgbToOklch(hexToRgb(hex));

/** `"17 20 18"` — the format Tailwind's `rgb(var(--x) / <alpha-value>)` needs. */
function toTriplet(c: Oklch): string {
  return gamutMap(c)
    .map((v) => Math.round(clamp(v, 0, 1) * 255))
    .join(' ');
}

/** `"150 12% 7%"` — the format shadcn's `hsl(var(--x))` tokens need. */
function toHslString(c: Oklch): string {
  const [r, g, b] = gamutMap(c).map((v) => clamp(v, 0, 1));
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

/* ── WCAG contrast ───────────────────────────────────────────────────────── */

function luminance([r, g, b]: Rgb): number {
  const [R, G, B] = [r, g, b].map(srgbToLinear);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return la > lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

/* ── The ladders (measured from app/globals.css at contrast=50) ──────────── */

type SurfaceRole = 'base' | 'card' | 'hover' | 'elevated' | 'border' | 'sidebar' | 'sidebarAccent';

const LADDER: Record<'dark' | 'light', Record<SurfaceRole, number>> = {
  //          base    card    hover   elevated border  sidebar sidebarAccent
  dark: { base: 0.1871, card: 0.2274, hover: 0.2589, elevated: 0.2672, border: 0.3211, sidebar: 0.1861, sidebarAccent: 0.2891 },
  light: { base: 0.8922, card: 1.0, hover: 0.9287, elevated: 0.953, border: 0.7656, sidebar: 0.9267, sidebarAccent: 0.868 },
};

/** Brand shades as perceptual offsets from the user's accent. */
const BRAND_LADDER = {
  bright: { dL: 0.0879, cScale: 0.911 },
  dim: { dL: -0.1813, cScale: 0.712 },
};

const SURFACE_CHROMA_CEILING = 0.03; // one ceiling, every hue, every surface
const TEXT_CHROMA_CEILING = 0.012; // text stays near-neutral
const GHOST_CHROMA_CEILING = 0.045; // accent-tinted surface, slightly richer

/**
 * WCAG target for primary text vs surface-base. Anchored so contrast=50
 * reproduces the shipped design's measured ratio (16.8 dark / 14.0 light).
 * Secondary and muted are floored at AA so they can never fall below 4.5.
 */
const TEXT_TARGET = {
  dark: { min: 7, mid: 16.8, max: 20 },
  light: { min: 7, mid: 14.0, max: 19 },
};
const TEXT_HIERARCHY = { secondary: 0.62, muted: 0.42 };
/** Solve target for the AA floor. Sits just above 4.5 so that rounding the
 *  result to 8-bit RGB cannot land under the real threshold — solving for
 *  exactly 4.5 measures back as 4.49 once quantised. */
const AA = 4.6;

function targetFor(contrast: number, isLight: boolean): number {
  const a = isLight ? TEXT_TARGET.light : TEXT_TARGET.dark;
  const c = clamp(contrast, 0, 100);
  return c <= 50 ? a.min + (c / 50) * (a.mid - a.min) : a.mid + ((c - 50) / 50) * (a.max - a.mid);
}

/** contrast=50 -> 1.0; scales how far the ladder spreads around base. */
const spreadFor = (contrast: number) => 0.5 + clamp(contrast, 0, 100) / 100;

/* ── Derivation ──────────────────────────────────────────────────────────── */

function surfaceRamp(baseHex: string, isLight: boolean, contrast: number): Record<SurfaceRole, Oklch> {
  const { H, C } = hexToOklch(baseHex);
  const ladder = isLight ? LADDER.light : LADDER.dark;
  const spread = spreadFor(contrast);
  const chroma = Math.min(C, SURFACE_CHROMA_CEILING);
  const out = {} as Record<SurfaceRole, Oklch>;
  for (const role of Object.keys(ladder) as SurfaceRole[]) {
    const L = ladder.base + (ladder[role] - ladder.base) * spread;
    out[role] = { L: clamp(L, 0, 1), C: chroma, H };
  }
  return out;
}

/**
 * Solve for the lightness that hits `target` contrast against `bg`, moving away
 * from the background. Text is derived, never picked — which is what makes
 * unreadable text structurally impossible rather than a rule users can defeat.
 */
function solveTextL(bg: Rgb, target: number, isLight: boolean, H: number, C: number): Oklch {
  const bgL = rgbToOklch(bg).L;
  let lo = isLight ? 0 : bgL;
  let hi = isLight ? bgL : 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const ratio = contrastRatio(bg, gamutMap({ L: mid, C, H }));
    if (isLight ? ratio > target : ratio < target) lo = mid;
    else hi = mid;
  }
  return { L: (lo + hi) / 2, C, H };
}

/**
 * Pick whichever of black / white reads better on `on`.
 *
 * Deliberately pure (L=0 / L=1) rather than softened endpoints. A mid-lightness
 * brand colour — #5e6ad2, #0070f3 — clears AA against pure white by a hair
 * (4.71 and 4.60) and fails against anything dimmer, so hedging the endpoints
 * costs exactly the margin these need. Body text elsewhere is softened via the
 * contrast solver; on-accent foregrounds want the maximum.
 */
function foregroundFor(on: Oklch): Oklch {
  const bg = gamutMap(on);
  const black: Oklch = { L: 0, C: 0, H: 0 };
  const white: Oklch = { L: 1, C: 0, H: 0 };
  // Prefer white whenever it clears AA, rather than maximising contrast. On a
  // mid-lightness accent the two land within ~0.01 of each other, and pure
  // contrast-maximising flips to black on colours the whole industry sets in
  // white (#0070f3). White-on-brand is the convention; black is the fallback
  // for accents too light to carry it (e.g. #a3e635 lime).
  // Gate on the real WCAG threshold, not the solver's AA safety target: that
  // target carries a margin for 8-bit rounding, and pure white needs none.
  // #0070f3 with white lands at ~4.60 — passing 4.5, failing 4.6.
  return contrastRatio(bg, gamutMap(white)) >= 4.5 ? white : black;
}

export type ThemeInput = {
  /** Drives every surface's hue + chroma. Its own lightness is not used —
   *  lightness comes from the ladder for the active mode. */
  base?: string;
  /** Drives brand/interactive tokens. */
  accent?: string;
};

/**
 * Writes every themed CSS variable onto `root`.
 *
 * `isLightMode` stays an explicit parameter and is NOT inferred from `base`.
 * Linear can treat light/dark as emergent from its base colour because there
 * the theme *is* the mode; GCHQ keeps a separate Dark/Light/System toggle
 * (useTheme), so mode is an independent axis. `base` therefore contributes hue
 * and chroma only — its lightness is discarded, and every lightness comes from
 * the active mode's ladder. Callers must re-run this when the mode changes
 * (AppLayout keys its effect on `resolvedTheme`).
 *
 * Token formats are deliberate and follow ownership, not one global rule:
 *   - GCHQ design tokens (--surface-*, --text-*, --brand-*) are RGB triplets,
 *     because Tailwind consumes them as `rgb(var(--x) / <alpha-value>)`.
 *   - shadcn tokens (--primary, --accent, --sidebar-*) are HSL strings,
 *     because Tailwind consumes them as `hsl(var(--x))`.
 * Mixing the two would break the alpha-value pattern or shadcn's conventions.
 */
export function applyThemeSurfaces(
  root: HTMLElement,
  { base, accent }: ThemeInput,
  isLightMode: boolean,
  contrast = 50,
): void {
  const mode = isLightMode ? 'light' : 'dark';

  if (base) {
    const s = surfaceRamp(base, isLightMode, contrast);
    root.style.setProperty('--surface-base', toTriplet(s.base));
    root.style.setProperty('--surface-card', toTriplet(s.card));
    root.style.setProperty('--surface-hover', toTriplet(s.hover));
    root.style.setProperty('--surface-elevated', toTriplet(s.elevated));
    root.style.setProperty('--surface-border', toTriplet(s.border));

    // Sidebar rail + its hover/selected shade (shadcn family -> HSL strings).
    root.style.setProperty('--sidebar-background', toHslString(s.sidebar));
    root.style.setProperty('--sidebar-accent', toHslString(s.sidebarAccent));

    // shadcn's --accent is a muted hover SURFACE, not the brand colour. The old
    // code assigned the brand accent here, breaking its pairing with
    // --accent-foreground; and html.light never overrode it, so light mode
    // inherited a near-black accent surface. Deriving it fixes both.
    root.style.setProperty('--accent', toHslString(s.hover));
    root.style.setProperty('--background', toHslString(s.base));
    root.style.setProperty('--card', toHslString(s.card));
    root.style.setProperty('--border', toHslString(s.border));
    root.style.setProperty('--input', toHslString(s.border));

    // Text is solved against the actual surface, so it tracks base and contrast.
    const bg = gamutMap(s.base);
    const { H } = hexToOklch(base);
    const chroma = Math.min(hexToOklch(base).C, TEXT_CHROMA_CEILING);
    const t = targetFor(contrast, isLightMode);
    const primary = solveTextL(bg, t, isLightMode, H, chroma);
    const secondary = solveTextL(bg, Math.max(AA, t * TEXT_HIERARCHY.secondary), isLightMode, H, chroma);
    const muted = solveTextL(bg, Math.max(AA, t * TEXT_HIERARCHY.muted), isLightMode, H, chroma);
    root.style.setProperty('--text-primary', toTriplet(primary));
    root.style.setProperty('--text-secondary', toTriplet(secondary));
    root.style.setProperty('--text-muted', toTriplet(muted));
    root.style.setProperty('--text-inverse', toTriplet(s.base));
    root.style.setProperty('--foreground', toHslString(primary));
    root.style.setProperty('--muted-foreground', toHslString(muted));
    root.style.setProperty('--accent-foreground', toHslString(primary));
    root.style.setProperty('--card-foreground', toHslString(primary));
    root.style.setProperty('--sidebar-foreground', toHslString(muted));
    root.style.setProperty('--sidebar-accent-foreground', toHslString(primary));
  }

  if (accent) {
    const a = hexToOklch(accent);
    const bright: Oklch = { L: clamp(a.L + BRAND_LADDER.bright.dL, 0, 1), C: a.C * BRAND_LADDER.bright.cScale, H: a.H };
    const dim: Oklch = { L: clamp(a.L + BRAND_LADDER.dim.dL, 0, 1), C: a.C * BRAND_LADDER.dim.cScale, H: a.H };

    root.style.setProperty('--brand-default', toTriplet(a));
    root.style.setProperty('--brand-bright', toTriplet(bright));
    root.style.setProperty('--brand-dim', toTriplet(dim));

    // --brand-ghost is a SURFACE wearing the accent's hue, not a brand shade:
    // it sits on the elevated rung so it stays subtle no matter how light or
    // dark the accent is. (Deriving it from the accent's own lightness is what
    // made pale accents wash the ghost out.)
    const ghostL = LADDER[mode].elevated;
    root.style.setProperty('--brand-ghost', toTriplet({ L: ghostL, C: Math.min(a.C, GHOST_CHROMA_CEILING), H: a.H }));

    root.style.setProperty('--primary', toHslString(a));
    root.style.setProperty('--ring', toHslString(a));
    root.style.setProperty('--sidebar-primary', toHslString(bright));
    root.style.setProperty('--sidebar-ring', toHslString(bright));
    root.style.setProperty('--primary-foreground', toHslString(foregroundFor(a)));
    root.style.setProperty('--sidebar-primary-foreground', toHslString(foregroundFor(bright)));
  }
}

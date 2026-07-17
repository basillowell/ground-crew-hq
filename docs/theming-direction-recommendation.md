# Color Scheme Feature — Comparative Analysis & Recommendation

**Date:** 2026-07-16
**Status:** Recommendation for review. No code changes in this pass.
**Scope:** GCHQ's user-facing color scheme customization (Primary / Accent / Sidebar / planned Font).

---

## TL;DR

The hypothesis — "mature products only theme a single accent color and never retint backgrounds" — is **half right, and the half that's wrong is the important half.**

Most products (Notion, GitHub, Vercel, Asana, Slack) do restrict theming narrowly, which supports the hypothesis. But **Linear — the closest peer to GCHQ's aesthetic — retints every background and surface in the app, exactly the ambition GCHQ has.** So the ambition isn't the problem.

What separates Linear from GCHQ isn't *scope*, it's *method*:

| | Linear | GCHQ today |
|---|---|---|
| User-facing inputs | 3 (base, accent, contrast) | 4 (primary, accent, sidebar, +font) |
| Color space | LCH (perceptually uniform) | HSL (not perceptually uniform) |
| Derived tokens | ~98, generated | ~8, hand-tuned per token |
| Per-token constants | none | ~14 magic numbers |

Linear takes **fewer inputs** and **derives more**, in a color space where lightness means something. GCHQ takes **more inputs** and **hand-tunes each output**, in a color space where lightness lies. Every bug in the brief is a predictable symptom of that second choice.

**Recommendation: Option C — keep the broad-retinting ambition, but rebuild it Linear-style: reduce inputs from 4 to 2 (+ a contrast slider), and derive everything in OKLCH.** This is closer to Option B than Option A, but it *reduces* user-facing surface area rather than expanding it, which is why I'm listing it separately.

---

## 1. Research findings

### Linear — *the outlier that matters most*

Linear is the strongest counterexample to the hypothesis, and the most relevant peer.

- **What's customizable:** Background, text, and accent colors. Linear explicitly says: *"you only need to set a few colors, such as the background, text and accent colors, which we then use to generate complimentary shades for borders and elevated boxes."*
- **The modern system is 3 variables:** base color, accent color, and **contrast (30–100)** — note that contrast is a *scalar, not a color*.
- **What's derived:** ~98 theme variables — background, foreground, panels, dialogs, modals — generated mathematically rather than hand-defined.
- **Color space: LCH**, chosen deliberately. Linear's Andreas Eldh: *"LCH has the benefit that it's perpetually uniform, meaning a red and a yellow color with lightness 50 will appear roughly equally light to the human eye."*
- **Light/dark vs. brand: coupled, and deliberately so.** A Linear theme *is* its background color — light vs. dark is an emergent property of the base color's lightness, not a separate axis. The same generation pipeline serves custom themes, light modes, and dark modes.
- **Ecosystem proof it works:** [linear.style](https://linear.style/) indexes 70+ community themes, including Catppuccin and Dracula ports. Arbitrary user-chosen backgrounds, at scale, without the app falling apart.

**This refutes the strict hypothesis.** Broad surface retinting is achievable and shipped by a respected product with a very similar operations-tool feel.

### Slack — *strongest support for the hypothesis*

- **What's customizable:** Exactly 8 hex slots — Column BG, Menu BG Hover, Active Item, Active Item Text, Hover Item, Text Color, Active Presence, Mention Badge.
- **The critical detail: all 8 are the sidebar.** Every single slot targets the navigation rail. The message pane — where all the actual reading happens — is **not themeable at all**. It's controlled solely by light/dark mode.
- **Light/dark vs. theme: independent axes**, plus a separate "Darker sidebars" preference.
- Slack effectively carved out one bounded region, said "go wild here," and hard-fenced the content area.

### Notion — *near-zero customization*

- **Appearance settings are Light / Dark / System. That's the entire feature.** No accent picker, no custom colors.
- Worth flagging: several third-party SEO pages confidently describe a "Set Accent Color" button and a "Primary Color / Accent Color picker" in Notion's Appearance settings. **This appears to be fabricated content.** Notion's official help center lists only the three modes. I've excluded those sources.
- Notion's 10-color palette (Default, Gray, Brown, Orange, Yellow, Green, Blue, Purple, Pink, Red) is *content* styling — text and block backgrounds — not app chrome. **A fixed, curated, pre-validated set** — relevant to Option B below.

### GitHub — *presets only, no custom color*

- Preset themes only: light, dark, system-following (separate day/night), plus **high-contrast** and **colorblind-friendly** (light and dark) variants.
- **No accent color picker. No arbitrary color input anywhere.**
- Notable: GitHub spends its theming budget entirely on **accessibility** variants rather than personalization.

### Vercel — *deliberate refusal*

- Geist is built on pure blacks and whites, ~10 color scales, *no* accent color as a design position — "just typography, spacing, and occasional gradients."
- Theme control is Light / System / Dark. **Vercel doesn't let you brand your own dashboard.**
- Vercel ships extensive theming primitives *for things you build on Vercel* — but declines them for its own operations dashboard.

### Asana — *tightly bounded*

- Theme: light / dark / system.
- **Sidebar and topbar color: black or gray.** Two options. Not a picker.
- Like GitHub, the real investment is accessibility: colorblind-friendly mode (protanopia/deuteranopia) that **remaps the existing palette** rather than letting users pick.

---

## 2. The pattern

**Scoreboard on the hypothesis: 5 confirm, 1 refutes — but the refutation is the closest peer.**

Sorting by what they actually do:

- **Nothing:** Notion, Vercel, GitHub
- **A little, tightly fenced:** Asana (2 sidebar colors), Slack (8 slots, sidebar-only)
- **Everything, derived:** Linear

So "don't retint backgrounds" is the *majority* pattern, but it isn't a law — it's what you do when you haven't built the machinery. Linear built the machinery.

Three findings matter more than the majority vote:

**A. Nobody hand-tunes many inputs. The count of user-facing color inputs is 0, 1, 2, or 3 — never 4+.** Even Slack's 8 slots are 8 *slots in one component*, not 8 axes that interact. GCHQ is heading to 4 interacting global inputs, which is more than *any* product surveyed, including Linear. This is the single clearest signal that GCHQ is off the map.

**B. The products that retint broadly derive; the products that don't derive, fence.** There's no product in the survey that retints large surfaces from many independently-picked colors. That combination doesn't exist because it doesn't work — which is precisely the combination GCHQ is currently attempting.

**C. Every product that ships broad retinting uses a perceptually uniform color space.** Linear uses LCH specifically so lightness is trustworthy across hues. This is the crux. In HSL, `hsl(60, 100%, 50%)` (vivid yellow) and `hsl(240, 100%, 50%)` (vivid blue) have identical lightness values and look nothing alike in brightness. HSL's L is a math artifact of RGB, not a perceptual measurement.

### Why this diagnoses GCHQ's bugs precisely

Map the reported bug string onto the color-space choice:

| Reported bug | Root cause |
|---|---|
| "hue blending through unintended intermediate colors" | Interpolating hue in HSL's circular, non-uniform hue channel — passes through muddy/oversaturated intermediates |
| "lightness ranges too narrow near white" | HSL lightness compresses near the extremes; perceptual steps aren't linear there |
| "accent color unexpectedly influencing perceived background" | Constant HSL L ≠ constant perceived lightness — changing hue/saturation *does* change apparent brightness |
| "saturation caps" (`Math.min(s, 30)`, `38`, `45`, `35`, `40`) | Compensating by hand for HSL not modeling chroma-vs-lightness interaction |

`tintHslPreservingLightness()` (src/lib/colorConversion.ts:59) holds `base.l` fixed and calls that "preserving lightness." **In HSL, that guarantee is false.** The function does exactly what it says and still produces the bug, which is why every fix has been "correct in isolation" while the whole never cohered. You aren't tuning constants badly — you're tuning constants against a measurement that doesn't correspond to what the eye sees. That work has no convergent endpoint, which is exactly the diminishing returns being felt.

---

## 3. Options

### Option A — Narrow the feature (accent-only, fixed neutral backgrounds)

Single accent color driving buttons, links, active/selected states, and one sidebar highlight. `--surface-*` become fixed neutrals per mode. Roughly the Slack/Asana model.

**Pros:** Lowest risk; deletes the entire bug class immediately; contrast becomes verifiable once instead of per-hue; matches the majority of respected products; smallest diff; accessibility becomes tractable.

**Cons:** Abandons real ambition and existing investment. GCHQ's presets (Fairway, Clay Court, Midnight Turf, Polo Green) are genuinely nice and *are* built on surface tinting — Option A guts what makes them distinct. For a field-crew tool where crews may want the app to feel like *their* company's, this may undersell. It's also a visible feature regression for anyone already using it.

### Option B — Keep the ambition, rebuild the color science

Keep all 4 inputs; replace HSL blending with OKLCH; or precompute curated safe tints per hue family.

**Pros:** Preserves the full vision and every existing input; OKLCH fixes the root cause; the curated-palette variant (Notion-like) gives absolute confidence since every combination is validated by hand.

**Cons:** **Keeps the part that's actually off the map — 4 interacting inputs.** OKLCH fixes lightness math but not combinatorics: primary tinting surfaces *and* sidebar setting the rail *and* accent on selection *and* font color still lets users build an incoherent theme where each token is individually valid. Linear didn't just switch color spaces; it cut inputs to 3. The curated variant scales badly — hue families × light/dark × 4 inputs is a large matrix to hand-validate and re-validate on every token change.

### Option C — **Recommended.** Linear's model: fewer inputs, more derivation, OKLCH

Keep broad surface retinting. **Reduce user-facing inputs from 4 to 2 colors + 1 scalar:**

- **Base** — one color that determines background/surfaces *and* whether the theme reads light or dark. Absorbs today's `sidebarColor`, `cardColor`, and primary-as-surface-tint.
- **Accent** — interactive elements only: primary buttons, links, active/selected, mention-style badges.
- **Contrast** (scalar, ~30–100) — replaces `darkness`, and doubles as the accessibility lever GitHub and Asana invest in.

Everything else — `--surface-base/elevated/hover/border/card`, `--sidebar-background`, `--sidebar-accent`, `--brand-ghost`, `--brand-dim`, nav text, and *font color* — is **derived in OKLCH**, never picked.

**Why this beats B:** it fixes both failures at once — wrong color space *and* too many interacting inputs. Deriving font color from base rather than exposing it as the 4th picker is the key move: it makes "unreadable text" *structurally impossible* instead of a validation rule users can fight. Contrast-as-a-slider is strictly more useful than font-color-as-a-picker, because it expresses what users actually want ("I need this more readable") without letting them express something broken.

**Why this beats A:** presets survive and improve. Fairway/Clay Court/Midnight Turf become base+accent+contrast triples, and the *derivation* gets better rather than being deleted.

**Cons — honestly:** It's the biggest change to the settings UI, and it **removes pickers users may already have used** — a visible reduction in apparent control, needing a migration for stored `theme_custom_colors`. It's also more upfront work than A. And it's a real bet that a good derivation pipeline beats manual control; if the OKLCH ramps are mediocre, there's no per-token escape hatch (though that constraint is the point).

---

## 4. Sketch — what would change under Option C

**Not implementing this pass. Rough shape only.**

### Replace

- **`src/lib/colorConversion.ts`** — the core rewrite. `hexToHsl` / `hslToRgbTriplet` / `rgbTripletToHsl` / `tintHslPreservingLightness` (lines 1–63) are the HSL machinery causing the bugs; they'd be replaced by OKLCH conversion + a small ramp generator. Modern CSS `oklch()` and `color-mix()` may do much of this natively, meaning *less* JS, not more.
- **The 14 hand-tuned constants** — `SURFACE_TINT_AMOUNT_DARK/LIGHT` (0.32/0.26), `DARK_/LIGHT_SURFACE_BASELINES`, and every `Math.min(s, N)` cap in `cardTriplet` / `ghostTriplet` / `dimTriplet` / `sidebarHslStrings` (lines 65–144). These all become one OKLCH lightness ramp parameterized by contrast. **This is the code that's been fighting you; it should stop existing.**

### Simplify

- **`applyThemeSurfaces()`** (line 160) — keeps its signature shape and remains the single application point, but its body collapses to "generate ramp from (base, accent, contrast), write tokens." The `isLightMode` parameter likely disappears — under Linear's model, light vs. dark is *implied by base lightness*, not passed in.
- **`src/lib/colorThemes.ts`** — `ColorTheme` drops `sidebarColor` and `cardColor`, becoming `{ base, accent, contrast }`. The six presets get re-authored as triples (a design pass, not a code pass). `resolveThemeCardColor()` (line 135) — including its brittle "does this match a preset?" hex-equality check — **deletes entirely**; card color becomes derived, so nothing needs to reverse-engineer it.
- **`resolveEffectiveTheme()`** (line 107) — stays, but the awkward `cardColor: personalCustomColors.primaryColor` fallback at line 118 (a symptom of the current model: 3 pickers can't fill 4 roles) disappears.
- **`parseCustomThemeColors()`** (line 89) — stays as the validation boundary for the unconstrained jsonb; validates 2 colors + contrast instead of 3 colors + darkness. **Needs a migration path** for existing `app_users.theme_custom_colors` rows (map old primary→base, accent→accent, darkness→contrast).

### Keep

- **The token architecture itself is sound and worth preserving.** `--surface-*` / `--brand-*` / `--sidebar-*` consumed via Tailwind (`tailwind.config.ts`) with runtime `setProperty` overrides is exactly the right shape — it's the *values* that are wrong, not the plumbing.
- **The two call sites** — `AppLayout.tsx:151` and `SettingsPage.tsx:336` — keep working with an updated argument shape.

### Two structural issues found while reading — worth fixing regardless of direction

1. **Token format is inconsistent, and this is a live bug risk.** `--surface-*` and `--brand-*` are written as **RGB triplets** (`"17 20 18"`, consumed as `rgb(var(--x))`), while `--sidebar-background` and `--sidebar-accent` are written as **HSL strings** (`"150 13% 16%"`, consumed as `hsl(var(--x))`). Two formats in one system, set by one function. A mismatched format fails silently or renders wrong rather than throwing.

   **Correction (2026-07-16): this is now the leading suspect for the "tokens computed but not consumed" symptom,** after issue 2 below was investigated and ruled out. Treat it as a priority, not a nice-to-have.

2. **~~`app/globals.css` and `src/index.css` are near-duplicates...~~ — RETRACTED. This section was wrong.**

   **What it originally claimed:** that `app/` was vestigial Next.js scaffolding in a Vite app, that `src/index.css` was the live stylesheet, and that token edits landing in the wrong file might explain the "computed but not consumed" symptom.

   **What is actually true (verified 2026-07-16):**
   - **The project is not a Vite app.** It is Next.js 16 App Router — `npm run build` runs `next build`, and there is no `vite.config`, no `index.html`, no `src/main.tsx`, and no Vite dependency. The original error came from trusting `components.json` plus CLAUDE.md's then-stale `Stack: React + Vite` line (both since corrected).
   - **`app/globals.css` is the live stylesheet**, imported by `app/layout.tsx`. `src/index.css` was the dead file, imported by nothing.
   - **`src/` is live**, not dead. `app/` is a thin routing shell; the application code (pages, components, lib) is in `src/`, and Tailwind's content globs include `./src/**`. The file-level sketch above therefore targets the right files.
   - **The duplication theory is disproven.** A diff shows `app/globals.css` carries the current light-mode values (`--surface-base: 214 222 214`) while `src/index.css` still holds the pre-fix ones (`248 250 248`). **Past contrast fixes landed in the correct file all along**, so the wrong-file hypothesis explains nothing.

   **Resolved:** `components.json` now points at `app/globals.css`, and `src/index.css` carries a dead-file banner. **The "computed but not consumed" symptom remains unexplained** — see issue 1.

---

## 5. Recommendation

**Go with Option C.**

The reasoning in one line: **the ambition was never the problem — the method was.** Linear proves broad surface retinting works in a tool that feels like GCHQ, so Option A gives up something achievable. But Linear achieves it by taking *fewer* inputs than GCHQ and deriving more, in a color space where lightness is real. Option B fixes the math while keeping the input explosion; Option C fixes both.

The strongest argument for C over the status quo: **the "soon: Font color" picker is a warning sign, not a feature.** It's being added because derived text color isn't reliably readable — but the fix for unreadable text is a derivation that guarantees contrast, not a picker that lets users choose unreadable text. Adding it makes the combinatorics worse in exactly the direction no surveyed product goes. If C is adopted, **drop the Font picker before building it** — that's the cheapest decision available right now, and it's available today regardless of what's decided about the rest.

**Suggested sequencing if C is chosen:**
1. ~~Resolve the `app/globals.css` vs `src/index.css` question~~ — **done 2026-07-16** (see the retraction in §4; it explained nothing). **Unify the token format** — still outstanding, and now the leading suspect for the "computed but not consumed" symptom rather than a side cleanup.
2. Prototype the OKLCH ramp standalone against the 6 existing presets; compare screenshots to today. **Decision gate:** if it can't reproduce presets at least as well with zero per-token constants, reconsider.
3. Only then touch the settings UI and the migration.

Step 2 is the real test, and it's reversible.

### Open questions for you

- **Is per-org branding a product requirement** (crews want the app to look like their company) or a personalization nice-to-have? If it's a real requirement, C is clearly right and A is off the table. If it's a nice-to-have, A gets more attractive on pure cost.
- **How many users have actually saved custom colors?** If ~zero, the migration concern evaporates and C gets cheaper. Worth a quick query on `app_users.theme_custom_colors` before committing.
- **Is `darkness` doing real work for users today,** or is it a knob added to compensate for the tinting being off? That determines whether `contrast` is a rename or a genuinely new control.

---

## Sources

- [Linear — How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui) — LCH, 3 variables, 98 generated tokens
- [Linear — Custom Themes changelog](https://linear.app/changelog/2020-12-04-themes) — background/text/accent, derived shades
- [Linear Style](https://linear.style/) — 70+ community themes
- [Linear — Account preferences](https://linear.app/docs/account-preferences)
- [Slack — Change your Slack theme](https://slack.com/help/articles/205166337-Change-your-Slack-theme)
- [Slack theme creator](https://slack-themes.vercel.app/create-a-theme) — the 8 slots
- [Notion — Appearance settings](https://www.notion.so/help/appearance-settings) — light/dark/system only
- [GitHub — Managing your theme settings](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-user-account/managing-user-account-settings/managing-your-theme-settings)
- [Vercel Geist — Colors](https://vercel.com/geist/colors) · [Theme Switcher](https://vercel.com/geist/theme-switcher)
- [Asana — Display settings](https://help.asana.com/s/article/display-settings) · [Colorblind-friendly mode](https://asana.com/inside-asana/new-accessibility-feature-colorblind-friendly)
- [OKLCH vs HSL — perceptual uniformity](https://www.designsystemscollective.com/tired-of-colors-that-look-wrong-try-oklch-in-css-c3917f1ae089) · [From HSL to OKLCH for design systems](https://medium.com/@solo_cube/from-hsl-to-oklch-and-betterlch-predictable-chroma-and-precise-contrast-for-design-systems-fc5235306145)

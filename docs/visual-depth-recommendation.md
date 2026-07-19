# Visual Depth & Polish — Research & Recommendation

**Date:** 2026-07-17
**Status:** Recommendation for review. No code changes in this pass.
**Scope:** Depth, elevation, motion, typography weight. **Not** color-picker mechanics — this is additive polish on top of the OKLCH token rebuild (`feat/oklch-theming`), not a competing initiative.

---

## TL;DR

**GCHQ isn't flat because it's missing depth techniques. It's flat because its main depth technique is silently switched off in dark mode.**

The single highest-leverage finding:

> **~45 stock Tailwind `shadow-*` utilities are effectively no-ops on GCHQ's dark surfaces.** Tailwind's default shadow scale is black at ~10% alpha, tuned for white backgrounds. On `#111413` a black shadow is nearly invisible. There is **no `boxShadow` scale in `tailwind.config.ts`** — only a `pulse-glow` keyframe. So the app *asks* for elevation in 8+ components and gets almost nothing back.

The good news, and it's substantial: **the pillar that actually carries depth in dark mode — stepped surface lightness — GCHQ already has, and the OKLCH rebuild just made it exact.** Every source agrees this is the primary mechanism, and GCHQ's ladder is already on spec (measured below). So this is not a redesign. It's finishing a system that's three-quarters built.

Ranked recommendations are in §4. The top one is a single config change that fixes ~45 call sites at once.

---

## 1. Findings — mechanisms, not vibes

### Shadows are the wrong tool in dark mode, and everyone says so

This is the most consistent finding across every source, and it's unusually unanimous:

- *"Shadows are the worst-performing depth signal in dark mode"* — the contrast that makes a shadow read on white is simply absent on a dark base. Compensating by darkening the shadow **makes it worse** ([AYDesign](https://www.aydesign.ai/blog/dark-mode-dashboard-design-patterns-2026)).
- Shadows are *"basically imperceptible in the dark theme"*, where box-shadow alone is sufficient on light themes ([UXMISFIT](https://uxmisfit.com/2020/09/14/ui-tutorial-6-tips-to-make-better-dark-theme/)).
- The mechanism, stated well: shadows are *"a representation of the inverse of light cast on an interface"* — a dark value on a dark surface has nothing to contrast against. Theming must *"extend to all uses of shadows, not just surface/fill colors"* ([parker.mov](https://www.parker.mov/notes/good-dark-mode-shadows)).

**This does not mean delete shadows.** It means shadows must be *theme-aware tokens* rather than one scale reused across modes. The working техniques:

1. **Stepped surface lightness** (primary) — see below.
2. **Theme-specific shadow tokens** — built separately per mode, not shared.
3. **Colored shadows** — a very dark, slightly saturated version of the element's *own* hue registers where pure black can't.
4. **Zero-blur, zero-offset box-shadow as a border** — outlines without touching the box model.

### Stepped surface lightness is the primary depth mechanism

- *"Step each token 3 to 6 percent lighter than the previous"* across at least four levels — base, surface, elevated, overlay ([AYDesign](https://www.aydesign.ai/blog/dark-mode-dashboard-design-patterns-2026)).
- *"Elevation colors are the key to successful visual hierarchy in the Dark Theme. The brightness of elevation builds a sense of depth"* ([UXMISFIT](https://uxmisfit.com/2020/09/14/ui-tutorial-6-tips-to-make-better-dark-theme/)).
- Pure black is called out as a mistake: it *"makes elevation impossible to show"*. A tonal dark base (slightly blue/warm) is *"what makes dark interfaces feel premium rather than simply inverted"*.

### Hairlines: low-alpha strokes, not flat border colors

- Premium UI uses *"hairlines and separators [with] low-alpha thin strokes"* ([Mantlr](https://mantlr.com/blog/stripe-linear-vercel-premium-ui)).
- The reason is mechanical: a semi-transparent white border *composites against whatever is behind it*, so it stays correct across every surface tier automatically. A flat opaque border color is only correct against the one surface it was tuned for.

### Typography: weight range, and don't use pure white

- *"Keep body text opacity to 85 to 92 percent against the dark base, not pure white"* ([AYDesign](https://www.aydesign.ai/blog/dark-mode-dashboard-design-patterns-2026)).
- *"Typography at 4–6 sizes maximum"*, committed to systemically; a single family used with *"systemic scale, weight, and spacing"* ([Mantlr](https://mantlr.com/blog/stripe-linear-vercel-premium-ui)).
- Premium reads as *"considered"* — typography, microstates, motion, hairlines, focus rings, loading states all **designed rather than defaulted**.

### Motion: short, systematic, and never `transition-all`

- *"150ms for hover, 300ms for state change"*; UI animation *"should stay under 300ms"* — a 180ms dropdown feels more responsive than a 400ms one.
- *"Avoid bouncy animations; use expo-out easing, not spring physics."*
- *"A scale of 0.97 on `:active` with a 150ms transition creates responsive button feedback."*
- Every interactive element needs **six** states: default, hover, focus (keyboard), active, disabled, loading ([Mantlr](https://mantlr.com/blog/stripe-linear-vercel-premium-ui), [animations.dev](https://animations.dev/learn/animation-theory/the-easing-blueprint)).

### A useful negative result

Vercel's own [Web Interface Guidelines](https://vercel.com/design/guidelines) **deliberately refuse** to prescribe durations, easing curves, border widths, or shadow specs. They give hit targets (24px desktop / 44px mobile), ≥16px mobile inputs, loading show-delay ~150–300ms, and then stop. Their stated position: *"Easing fits the subject."*

Worth taking seriously as a caution: the "premium" sources that *do* hand out universal numbers are less authoritative than the one that won't. Treat the numbers below as starting points to tune, not gospel.

**Source-quality note:** searches for this topic return a large volume of SEO listicles ("30+ Best Dark Mode Dashboard Templates"). I've excluded those and cited only sources giving a mechanism or a rationale.

---

## 2. Gap assessment — measured against GCHQ's actual CSS

Everything below is from grepping the real codebase, not assumption.

| Technique | GCHQ today | Verdict |
|---|---|---|
| **Stepped surface lightness** | `--surface-base/card/hover/elevated/border`, now OKLCH-derived | ✅ **Already correct — don't touch** |
| **Tonal (non-black) dark base** | `#111413`, plus hue/chroma from `base` | ✅ Already correct |
| **Theme-aware shadow tokens** | **None.** No `boxShadow` in `tailwind.config.ts` | ❌ **Absent — the main gap** |
| **Shadow usage** | ~45 stock `shadow-sm/md/lg/xl/2xl` across 8+ files | ⚠️ **Present but inert in dark** |
| **Low-alpha hairlines** | `--sidebar-border: 0 0% 100% / 0.06` — **exactly the right technique, in one token** | ⚠️ **Exists but not generalized** |
| **Flat borders** | **252** usages of `border-surface-border` (opaque) | ❌ The other 252 places |
| **Focus rings** | 18 `focus-visible:ring-*`, 12 `ring-ring` | ✅ Already done |
| **Skeletons over spinners** | 20 files w/ Skeleton vs 11 w/ `animate-spin` | ✅ Mostly done |
| **Typography weight range** | 337 `font-medium`, 222 `font-semibold`, 35 bold, **6 `font-normal`** | ❌ **Compressed — see below** |
| **Motion: easing** | **6 total** `ease-*` usages app-wide (4 linear, 2 in-out) | ❌ ~150 transitions use browser default |
| **Motion: `transition-all`** | 41 usages | ⚠️ Animates layout props; should be scoped |
| **Active-state feedback** | 4 `active:scale-95` | ⚠️ Barely present |
| **Gradient overlays** | 1 `bg-gradient-to-b` | ❌ Absent |
| **Glassmorphism** | 6 `backdrop-blur-*` | ⚠️ Minimal (CLAUDE.md restricts to modals/cards) |

### The elevation ladder is already on spec — this matters

Measured in OKLCH from the shipped `globals.css` (dark):

| Token | OKLCH L | Step from previous |
|---|---|---|
| `--surface-base` | 0.1871 | — |
| `--surface-card` | 0.2274 | **+4.0%** |
| `--surface-hover` | 0.2589 | +3.2% |
| `--surface-elevated` | 0.2672 | +0.8% |
| `--surface-border` | 0.3211 | +5.4% |

The research target is **3–6% per layer**. GCHQ's base→card is **+4.0%** and card→hover **+3.2%** — squarely on spec. **The foundation is right.** (One real observation: `hover`→`elevated` is only +0.8%, so those two tiers are nearly indistinguishable — arguably 4 tiers pretending to be 5.)

This is the crux of the whole document: **GCHQ has the mechanism that works and is missing the ones that decorate it.** That's why the fix is additive and cheap rather than a redesign.

### Typography is the quiet one

337 `font-medium` (500) vs 222 `font-semibold` (600) and only **6** `font-normal` (400). Body text and headings sit **100 weight units apart**, which is below the threshold where weight reads as hierarchy. Premium systems run 400 body against 600 semibold — a 200 delta. Everything being medium-or-heavier is why the UI reads as uniformly dense: **there is no quiet text to make the loud text loud.**

---

## 3. What this does *not* need

- **Not a redesign.** The surface ladder, focus rings, and skeletons are already right.
- **Not glassmorphism everywhere.** CLAUDE.md restricts it to modals/cards and forbids it on dense data tables. Several generic trend sources push it broadly; that guidance is wrong for GCHQ.
- **Not kinetic typography or WebGL** — CLAUDE.md forbids both, and much of the "wow factor" genre leans on them.
- **Not more color.** Both Mantlr and Linear converge on *restraint* — premium products use "surprisingly little color." GCHQ's depth problem is not solvable with hue, which is precisely why it survived the color rebuild.

---

## 4. Recommendations — ranked by effort-to-impact

### 1. Theme-aware shadow tokens ⭐ **highest leverage, do this first**

**Effort:** low (one config change + token block). **Impact:** high, immediately, across ~45 existing call sites.

Define `--shadow-sm/md/lg/xl` as CSS variables in `globals.css` with **separate dark and light values**, then point Tailwind's `boxShadow` scale at them. Because ~45 `shadow-*` utilities already exist in the markup, **they start working with zero component edits** — the leverage here is unusual and worth taking first.

For dark, use layered shadows with far higher alpha than Tailwind's default (0.4–0.6 rather than ~0.1), optionally tinted with the base hue rather than pure black — the engine already knows the base hue, so this composes with the OKLCH work rather than fighting it.

**Trade-off:** shadows will never do as much work in dark mode as in light. This *raises the floor from ~zero*; it doesn't make dark mode behave like light mode. Manage expectations accordingly.

### 2. Open the typography weight range

**Effort:** low-medium (mostly mechanical). **Impact:** high — this is the "considered vs. defaulted" tell.

Move body/table/secondary text to `font-normal` (400), keep headings at `font-semibold` (600). That restores a 200-weight delta and gives hierarchy without adding a single color. Pair with the AYDesign note about not using pure white for body text — worth checking against the engine's derived `--text-primary`, which currently lands at ~16.8:1 (very high) at contrast=50.

**Trade-off:** touches a lot of files, and 400-weight on dark backgrounds can look thin — validate at 375px on a real crew device before committing.

### 3. Generalize the hairline border technique

**Effort:** medium (new token + scoped migration). **Impact:** high on perceived refinement.

**GCHQ already invented this and used it once:** `--sidebar-border: 0 0% 100% / 0.06`. That is exactly the low-alpha stroke the premium sources describe. Everywhere else uses one of 252 opaque `border-surface-border`.

Add a `--hairline` token (white ~6–8% in dark, black ~8% in light) and migrate **cards, panels, and separators only** — not all 252 at once. Alpha borders composite against whatever is behind them, so they stay correct across every surface tier automatically, which flat borders can't.

**Trade-off:** two border idioms coexist during migration. Also note light mode's `--sidebar-border` is *flat* (`120 20% 83%`) — even the one good instance is dark-mode-only.

### 4. Standardize motion

**Effort:** medium. **Impact:** medium — felt more than seen.

Only **6** `ease-*` usages exist app-wide, so ~150 transitions run on the browser's default easing. Set a default duration (150ms hover / 200ms state) and one easing curve, replace the 41 `transition-all` with scoped `transition-colors`/`transition-transform`, and extend `active:scale-[0.97]` (currently 4 usages) across buttons.

**Trade-off:** Vercel explicitly declines to prescribe these numbers — "easing fits the subject." Treat as a default to override, not a law.

### 5. Top-edge inset highlight on elevated surfaces

**Effort:** low (one utility). **Impact:** medium, and very "premium."

An `inset 0 1px 0 rgba(255,255,255,0.06)` on cards/modals simulates light striking the top edge — the cue that actually reads on dark surfaces where a drop shadow can't. Pairs naturally with #1 and #3.

**Trade-off:** easy to overdo; at >8% it reads as a bevel. Modals and cards only — never data tables.

---

## 5. Recommendation

**Do #1 first, alone, and look at it.** It's a single config change, it fixes ~45 call sites at once, and it will tell you how much of the "flat" feeling is the dead shadow scale versus everything else. That's cheap information, and it de-risks the rest — if the app feels substantially better after #1, items #3–#5 may be optional.

Then #2, which is the highest-impact non-shadow change and is independent of everything else.

Sequence deliberately: **land these *after* `feat/oklch-theming` merges.** #1 wants the base hue for tinted shadows and #3 wants the derived surfaces — both compose with the new engine and would conflict with it if done in parallel.

### Open questions

- **Is "flat" mostly the dead shadows, or the typography?** I genuinely don't know, and #1 is the cheapest experiment that distinguishes them.
- **`hover` and `elevated` are 0.8% apart** — is that intentional, or a ladder artifact? If unintentional, spreading them is nearly free and adds a real tier.
- **Does `--text-primary` at ~16.8:1 feel harsh?** The research says 85–92% opacity, not pure white. That's a `TEXT_TARGET` anchor in the engine, not a component change.

---

## Sources

- [Dark mode dashboard design patterns SaaS founders are using in 2026 — AYDesign](https://www.aydesign.ai/blog/dark-mode-dashboard-design-patterns-2026) — 3–6% steps, shadows as worst signal, 85–92% body text
- [good dark mode shadows & elevation — parker.mov](https://www.parker.mov/notes/good-dark-mode-shadows) — theming must extend to shadows
- [How Stripe, Linear, and Vercel Ship Premium UI — Mantlr](https://mantlr.com/blog/stripe-linear-vercel-premium-ui) — six microstates, low-alpha hairlines, color restraint
- [Web Interface Guidelines — Vercel](https://vercel.com/design/guidelines) — hit targets, loading delays; deliberate refusal to prescribe motion
- [6 Tips to Make Better Dark Theme — UXMISFIT](https://uxmisfit.com/2020/09/14/ui-tutorial-6-tips-to-make-better-dark-theme/) — elevation colors as the key mechanism
- [The Easing Blueprint — animations.dev](https://animations.dev/learn/animation-theory/the-easing-blueprint) — easing selection by subject

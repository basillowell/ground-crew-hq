import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        surface: {
          base: "oklch(var(--surface-base) / <alpha-value>)",
          card: "oklch(var(--surface-card) / <alpha-value>)",
          elevated: "oklch(var(--surface-elevated) / <alpha-value>)",
          border: "oklch(var(--surface-border) / <alpha-value>)",
          hover: "oklch(var(--surface-hover) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "oklch(var(--brand-default) / <alpha-value>)",
          bright: "oklch(var(--brand-bright) / <alpha-value>)",
          dim: "oklch(var(--brand-dim) / <alpha-value>)",
          ghost: "oklch(var(--brand-ghost) / <alpha-value>)",
        },
        text: {
          primary: "oklch(var(--text-primary) / <alpha-value>)",
          secondary: "oklch(var(--text-secondary) / <alpha-value>)",
          muted: "oklch(var(--text-muted) / <alpha-value>)",
          inverse: "oklch(var(--text-inverse) / <alpha-value>)",
        },
        status: {
          active: "oklch(var(--status-active) / <alpha-value>)",
          pending: "oklch(var(--status-pending) / <alpha-value>)",
          warning: "oklch(var(--status-warning) / <alpha-value>)",
          complete: "oklch(var(--status-complete) / <alpha-value>)",
          hold: "oklch(var(--status-hold) / <alpha-value>)",
        },
        border: "oklch(var(--border) / <alpha-value>)",
        input: "oklch(var(--input) / <alpha-value>)",
        ring: "oklch(var(--ring) / <alpha-value>)",
        background: "oklch(var(--background) / <alpha-value>)",
        foreground: "oklch(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "oklch(var(--popover) / <alpha-value>)",
          foreground: "oklch(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "oklch(var(--card) / <alpha-value>)",
          foreground: "oklch(var(--card-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "oklch(var(--success) / <alpha-value>)",
          foreground: "oklch(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "oklch(var(--warning) / <alpha-value>)",
          foreground: "oklch(var(--warning-foreground) / <alpha-value>)",
        },
        info: {
          DEFAULT: "oklch(var(--info) / <alpha-value>)",
          foreground: "oklch(var(--info-foreground) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "oklch(var(--sidebar-background) / <alpha-value>)",
          foreground: "oklch(var(--sidebar-foreground) / <alpha-value>)",
          primary: "oklch(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground": "oklch(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "oklch(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "oklch(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "oklch(var(--sidebar-border) / 0.06)",
          ring: "oklch(var(--sidebar-ring) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Motion: one easing for the whole app. Only ~6 explicit ease-* utilities
      // existed, so ~150 transitions were running on Tailwind's stock
      // ease-in-out. This expo-out curve starts fast and settles, which reads as
      // responsive rather than floaty. Overriding DEFAULT means every existing
      // transition-* utility picks it up with no component edits; explicit
      // ease-linear / ease-in-out usages still win where they were chosen.
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      // Theme-aware elevation: shadow-* map to CSS vars that swap per mode, so
      // the ~45 existing shadow-* utilities become visible on dark surfaces
      // instead of rendering Tailwind's default black-on-white scale. Merges
      // with defaults, so shadow-none / shadow-inner are unaffected.
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0px rgba(110,211,145,0)" },
          "50%": { boxShadow: "0 0 18px rgba(110,211,145,0.35)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

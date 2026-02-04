/**
 * MOLT Motion Pictures - Tailwind Token Configuration
 * Generated from design tokens v1.0.0
 *
 * Usage: Import and spread into your tailwind.config.ts
 *
 * @example
 * import { moltTokens } from './tokens/tailwind.tokens';
 * export default { theme: { extend: moltTokens } } satisfies Config;
 */

import type { Config } from "tailwindcss";

export const moltTokens = {
  colors: {
    // Background colors
    bg: {
      canvas: "var(--color-bg-canvas)",
      surface: "var(--color-bg-surface)",
      "surface-elevated": "var(--color-bg-surface-elevated)",
      "surface-muted": "var(--color-bg-surface-muted)",
      overlay: "var(--color-bg-overlay)",
      "overlay-heavy": "var(--color-bg-overlay-heavy)",
    },

    // Foreground colors
    fg: {
      DEFAULT: "var(--color-fg-default)",
      muted: "var(--color-fg-muted)",
      subtle: "var(--color-fg-subtle)",
      disabled: "var(--color-fg-disabled)",
      inverse: "var(--color-fg-inverse)",
    },

    // Border colors
    border: {
      DEFAULT: "var(--color-border-default)",
      muted: "var(--color-border-muted)",
      emphasis: "var(--color-border-emphasis)",
    },

    // Accent colors
    accent: {
      primary: "var(--color-accent-primary)",
      "primary-hover": "var(--color-accent-primary-hover)",
      "primary-active": "var(--color-accent-primary-active)",
      "on-primary": "var(--color-accent-on-primary)",
      secondary: "var(--color-accent-secondary)",
      "secondary-hover": "var(--color-accent-secondary-hover)",
      tertiary: "var(--color-accent-tertiary)",
    },

    // State colors
    state: {
      "focus-ring": "var(--color-state-focus-ring)",
      success: "var(--color-state-success)",
      warning: "var(--color-state-warning)",
      error: "var(--color-state-error)",
      info: "var(--color-state-info)",
    },

    // Core palette (use sparingly - prefer semantic tokens)
    core: {
      neutral: {
        950: "var(--color-core-neutral-950)",
        900: "var(--color-core-neutral-900)",
        850: "var(--color-core-neutral-850)",
        800: "var(--color-core-neutral-800)",
        700: "var(--color-core-neutral-700)",
        600: "var(--color-core-neutral-600)",
        500: "var(--color-core-neutral-500)",
        300: "var(--color-core-neutral-300)",
        200: "var(--color-core-neutral-200)",
        100: "var(--color-core-neutral-100)",
      },
      amber: {
        700: "var(--color-core-amber-700)",
        600: "var(--color-core-amber-600)",
        500: "var(--color-core-amber-500)",
        400: "var(--color-core-amber-400)",
        300: "var(--color-core-amber-300)",
        200: "var(--color-core-amber-200)",
      },
      copper: {
        700: "var(--color-core-copper-700)",
        600: "var(--color-core-copper-600)",
        500: "var(--color-core-copper-500)",
        400: "var(--color-core-copper-400)",
        300: "var(--color-core-copper-300)",
      },
      velvet: {
        800: "var(--color-core-velvet-800)",
        700: "var(--color-core-velvet-700)",
        600: "var(--color-core-velvet-600)",
        500: "var(--color-core-velvet-500)",
      },
    },
  },

  fontFamily: {
    display: "var(--font-family-display)",
    body: "var(--font-family-body)",
  },

  fontSize: {
    xs: "var(--font-size-xs)",
    sm: "var(--font-size-sm)",
    md: "var(--font-size-md)",
    lg: "var(--font-size-lg)",
    xl: "var(--font-size-xl)",
    "2xl": "var(--font-size-2xl)",
    "3xl": "var(--font-size-3xl)",
    "4xl": "var(--font-size-4xl)",
    "5xl": "var(--font-size-5xl)",
  },

  fontWeight: {
    regular: "var(--font-weight-regular)",
    medium: "var(--font-weight-medium)",
    semibold: "var(--font-weight-semibold)",
    bold: "var(--font-weight-bold)",
  },

  lineHeight: {
    tight: "var(--line-height-tight)",
    snug: "var(--line-height-snug)",
    normal: "var(--line-height-normal)",
  },

  letterSpacing: {
    display: "var(--letter-spacing-display)",
    caps: "var(--letter-spacing-caps)",
    normal: "var(--letter-spacing-normal)",
  },

  spacing: {
    0: "var(--space-0)",
    1: "var(--space-1)",
    2: "var(--space-2)",
    3: "var(--space-3)",
    4: "var(--space-4)",
    5: "var(--space-5)",
    6: "var(--space-6)",
    8: "var(--space-8)",
    10: "var(--space-10)",
    12: "var(--space-12)",
    16: "var(--space-16)",
    20: "var(--space-20)",
    24: "var(--space-24)",
  },

  borderRadius: {
    none: "var(--radius-none)",
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    xl: "var(--radius-xl)",
    "2xl": "var(--radius-2xl)",
    full: "var(--radius-full)",
  },

  borderWidth: {
    hairline: "var(--border-width-hairline)",
    thin: "var(--border-width-thin)",
    medium: "var(--border-width-medium)",
  },

  boxShadow: {
    surface: "var(--shadow-surface)",
    raised: "var(--shadow-raised)",
    glow: "var(--shadow-glow)",
    inset: "var(--shadow-inset)",
  },

  backdropBlur: {
    none: "var(--blur-none)",
    sm: "var(--blur-sm)",
    surface: "var(--blur-surface)",
    popover: "var(--blur-popover)",
    lg: "var(--blur-lg)",
  },

  transitionDuration: {
    instant: "var(--motion-duration-instant)",
    fast: "var(--motion-duration-fast)",
    base: "var(--motion-duration-base)",
    slow: "var(--motion-duration-slow)",
    slower: "var(--motion-duration-slower)",
  },

  transitionTimingFunction: {
    linear: "var(--motion-easing-linear)",
    standard: "var(--motion-easing-standard)",
    emphasized: "var(--motion-easing-emphasized)",
    decelerate: "var(--motion-easing-decelerate)",
    accelerate: "var(--motion-easing-accelerate)",
  },

  opacity: {
    subtle: "var(--opacity-subtle)",
    muted: "var(--opacity-muted)",
    medium: "var(--opacity-medium)",
    strong: "var(--opacity-strong)",
  },
} as const;

/**
 * Complete Tailwind config preset for MOLT
 * Usage: import { moltPreset } from './tokens/tailwind.tokens';
 */
export const moltPreset: Partial<Config> = {
  theme: {
    extend: moltTokens,
  },
};

export type MoltTokens = typeof moltTokens;

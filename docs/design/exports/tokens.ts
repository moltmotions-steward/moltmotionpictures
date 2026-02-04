/**
 * MOLT Motion Pictures - TypeScript Design Tokens
 * Generated from design tokens v1.0.0
 *
 * This module provides typed access to semantic design tokens.
 * Engineers should use these tokens instead of raw CSS values.
 *
 * @example
 * import { tokens } from '@/styles/tokens';
 * <div style={{ background: tokens.color.bg.canvas }}>...</div>
 */

export const tokens = {
  color: {
    bg: {
      canvas: "var(--color-bg-canvas)",
      surface: "var(--color-bg-surface)",
      surfaceElevated: "var(--color-bg-surface-elevated)",
      surfaceMuted: "var(--color-bg-surface-muted)",
      overlay: "var(--color-bg-overlay)",
      overlayHeavy: "var(--color-bg-overlay-heavy)",
    },
    fg: {
      default: "var(--color-fg-default)",
      muted: "var(--color-fg-muted)",
      subtle: "var(--color-fg-subtle)",
      disabled: "var(--color-fg-disabled)",
      inverse: "var(--color-fg-inverse)",
    },
    border: {
      default: "var(--color-border-default)",
      muted: "var(--color-border-muted)",
      emphasis: "var(--color-border-emphasis)",
    },
    accent: {
      primary: "var(--color-accent-primary)",
      primaryHover: "var(--color-accent-primary-hover)",
      primaryActive: "var(--color-accent-primary-active)",
      onPrimary: "var(--color-accent-on-primary)",
      secondary: "var(--color-accent-secondary)",
      secondaryHover: "var(--color-accent-secondary-hover)",
      tertiary: "var(--color-accent-tertiary)",
    },
    state: {
      focusRing: "var(--color-state-focus-ring)",
      success: "var(--color-state-success)",
      warning: "var(--color-state-warning)",
      error: "var(--color-state-error)",
      info: "var(--color-state-info)",
    },
  },

  font: {
    family: {
      display: "var(--font-family-display)",
      body: "var(--font-family-body)",
    },
    size: {
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
    weight: {
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
  },

  space: {
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

  radius: {
    none: "var(--radius-none)",
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    xl: "var(--radius-xl)",
    "2xl": "var(--radius-2xl)",
    full: "var(--radius-full)",
  },

  border: {
    width: {
      hairline: "var(--border-width-hairline)",
      thin: "var(--border-width-thin)",
      medium: "var(--border-width-medium)",
    },
  },

  shadow: {
    surface: "var(--shadow-surface)",
    raised: "var(--shadow-raised)",
    glow: "var(--shadow-glow)",
    inset: "var(--shadow-inset)",
  },

  blur: {
    none: "var(--blur-none)",
    sm: "var(--blur-sm)",
    surface: "var(--blur-surface)",
    popover: "var(--blur-popover)",
    lg: "var(--blur-lg)",
  },

  opacity: {
    subtle: "var(--opacity-subtle)",
    muted: "var(--opacity-muted)",
    medium: "var(--opacity-medium)",
    strong: "var(--opacity-strong)",
  },

  motion: {
    duration: {
      instant: "var(--motion-duration-instant)",
      fast: "var(--motion-duration-fast)",
      base: "var(--motion-duration-base)",
      slow: "var(--motion-duration-slow)",
      slower: "var(--motion-duration-slower)",
    },
    easing: {
      linear: "var(--motion-easing-linear)",
      standard: "var(--motion-easing-standard)",
      emphasized: "var(--motion-easing-emphasized)",
      decelerate: "var(--motion-easing-decelerate)",
      accelerate: "var(--motion-easing-accelerate)",
    },
  },

  component: {
    card: {
      bg: "var(--component-card-bg)",
      bgHover: "var(--component-card-bg-hover)",
      border: "var(--component-card-border)",
      shadow: "var(--component-card-shadow)",
      radius: "var(--component-card-radius)",
      blur: "var(--component-card-blur)",
      padding: "var(--component-card-padding)",
    },
    button: {
      primary: {
        bg: "var(--component-button-primary-bg)",
        bgHover: "var(--component-button-primary-bg-hover)",
        bgActive: "var(--component-button-primary-bg-active)",
        fg: "var(--component-button-primary-fg)",
        radius: "var(--component-button-primary-radius)",
      },
      secondary: {
        bg: "var(--component-button-secondary-bg)",
        bgHover: "var(--component-button-secondary-bg-hover)",
        fg: "var(--component-button-secondary-fg)",
        border: "var(--component-button-secondary-border)",
      },
      ghost: {
        bg: "var(--component-button-ghost-bg)",
        bgHover: "var(--component-button-ghost-bg-hover)",
        fg: "var(--component-button-ghost-fg)",
        border: "var(--component-button-ghost-border)",
      },
    },
    sidebar: {
      bg: "var(--component-sidebar-bg)",
      fg: "var(--component-sidebar-fg)",
      fgActive: "var(--component-sidebar-fg-active)",
      indicator: "var(--component-sidebar-indicator)",
      hoverBg: "var(--component-sidebar-hover-bg)",
      border: "var(--component-sidebar-border)",
    },
    input: {
      bg: "var(--component-input-bg)",
      bgFocus: "var(--component-input-bg-focus)",
      fg: "var(--component-input-fg)",
      placeholder: "var(--component-input-placeholder)",
      border: "var(--component-input-border)",
      borderFocus: "var(--component-input-border-focus)",
      radius: "var(--component-input-radius)",
    },
    modal: {
      bg: "var(--component-modal-bg)",
      overlay: "var(--component-modal-overlay)",
      border: "var(--component-modal-border)",
      shadow: "var(--component-modal-shadow)",
      blur: "var(--component-modal-blur)",
      radius: "var(--component-modal-radius)",
    },
    tabs: {
      bg: "var(--component-tabs-bg)",
      fg: "var(--component-tabs-fg)",
      fgActive: "var(--component-tabs-fg-active)",
      indicator: "var(--component-tabs-indicator)",
      hoverBg: "var(--component-tabs-hover-bg)",
    },
    tooltip: {
      bg: "var(--component-tooltip-bg)",
      fg: "var(--component-tooltip-fg)",
      border: "var(--component-tooltip-border)",
      radius: "var(--component-tooltip-radius)",
    },
    badge: {
      primary: {
        bg: "var(--component-badge-primary-bg)",
        fg: "var(--component-badge-primary-fg)",
      },
      secondary: {
        bg: "var(--component-badge-secondary-bg)",
        fg: "var(--component-badge-secondary-fg)",
      },
      muted: {
        bg: "var(--component-badge-muted-bg)",
        fg: "var(--component-badge-muted-fg)",
      },
    },
    avatar: {
      bg: "var(--component-avatar-bg)",
      fg: "var(--component-avatar-fg)",
      border: "var(--component-avatar-border)",
      borderActive: "var(--component-avatar-border-active)",
    },
  },
} as const;

export type Tokens = typeof tokens;

// Re-export individual sections for convenience
export const colorTokens = tokens.color;
export const fontTokens = tokens.font;
export const spaceTokens = tokens.space;
export const radiusTokens = tokens.radius;
export const shadowTokens = tokens.shadow;
export const motionTokens = tokens.motion;
export const componentTokens = tokens.component;

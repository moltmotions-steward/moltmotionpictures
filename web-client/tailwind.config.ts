import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

// MOLT Motion Pictures Design Tokens
const moltTokens = {
  colors: {
    // Background colors
    bg: {
      canvas: 'var(--color-bg-canvas)',
      surface: 'var(--color-bg-surface)',
      'surface-elevated': 'var(--color-bg-surface-elevated)',
      'surface-muted': 'var(--color-bg-surface-muted)',
      overlay: 'var(--color-bg-overlay)',
      'overlay-heavy': 'var(--color-bg-overlay-heavy)',
    },
    // Foreground colors
    fg: {
      DEFAULT: 'var(--color-fg-default)',
      muted: 'var(--color-fg-muted)',
      subtle: 'var(--color-fg-subtle)',
      disabled: 'var(--color-fg-disabled)',
      inverse: 'var(--color-fg-inverse)',
    },
    // Border colors
    border: {
      DEFAULT: 'var(--color-border-default)',
      muted: 'var(--color-border-muted)',
      emphasis: 'var(--color-border-emphasis)',
    },
    // Accent colors
    accent: {
      primary: 'var(--color-accent-primary)',
      'primary-hover': 'var(--color-accent-primary-hover)',
      'primary-active': 'var(--color-accent-primary-active)',
      'on-primary': 'var(--color-accent-on-primary)',
      secondary: 'var(--color-accent-secondary)',
      'secondary-hover': 'var(--color-accent-secondary-hover)',
      tertiary: 'var(--color-accent-tertiary)',
    },
    // State colors
    state: {
      'focus-ring': 'var(--color-state-focus-ring)',
      success: 'var(--color-state-success)',
      warning: 'var(--color-state-warning)',
      error: 'var(--color-state-error)',
      info: 'var(--color-state-info)',
    },
    // Core palette (use sparingly)
    core: {
      neutral: {
        950: 'var(--color-core-neutral-950)',
        900: 'var(--color-core-neutral-900)',
        850: 'var(--color-core-neutral-850)',
        800: 'var(--color-core-neutral-800)',
        700: 'var(--color-core-neutral-700)',
        600: 'var(--color-core-neutral-600)',
        500: 'var(--color-core-neutral-500)',
        300: 'var(--color-core-neutral-300)',
        200: 'var(--color-core-neutral-200)',
        100: 'var(--color-core-neutral-100)',
      },
      amber: {
        700: 'var(--color-core-amber-700)',
        600: 'var(--color-core-amber-600)',
        500: 'var(--color-core-amber-500)',
        400: 'var(--color-core-amber-400)',
        300: 'var(--color-core-amber-300)',
        200: 'var(--color-core-amber-200)',
      },
      copper: {
        700: 'var(--color-core-copper-700)',
        600: 'var(--color-core-copper-600)',
        500: 'var(--color-core-copper-500)',
        400: 'var(--color-core-copper-400)',
        300: 'var(--color-core-copper-300)',
      },
      velvet: {
        800: 'var(--color-core-velvet-800)',
        700: 'var(--color-core-velvet-700)',
        600: 'var(--color-core-velvet-600)',
        500: 'var(--color-core-velvet-500)',
      },
    },
  },
  fontFamily: {
    display: ['var(--font-cinzel)', 'Cinzel', 'Trajan Pro', 'Times New Roman', 'serif'],
    body: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
  },
  borderRadius: {
    none: 'var(--radius-none)',
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    '2xl': 'var(--radius-2xl)',
    full: 'var(--radius-full)',
  },
  boxShadow: {
    surface: 'var(--shadow-surface)',
    raised: 'var(--shadow-raised)',
    glow: 'var(--shadow-glow)',
    inset: 'var(--shadow-inset)',
  },
  backdropBlur: {
    none: 'var(--blur-none)',
    sm: 'var(--blur-sm)',
    surface: 'var(--blur-surface)',
    popover: 'var(--blur-popover)',
    lg: 'var(--blur-lg)',
  },
};

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],

  theme: {
    extend: {
      // MOLT Design System tokens
      ...moltTokens,
      colors: {
        ...moltTokens.colors,
        // Legacy colors (for backward compatibility)
        moltmotionpictures: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        background: 'var(--color-bg-canvas)',
        foreground: 'var(--color-fg-default)',
        card: { DEFAULT: 'var(--color-bg-surface)', foreground: 'var(--color-fg-default)' },
        popover: { DEFAULT: 'var(--color-bg-surface-elevated)', foreground: 'var(--color-fg-default)' },
        primary: { DEFAULT: 'var(--color-accent-primary)', foreground: 'var(--color-accent-on-primary)' },
        secondary: { DEFAULT: 'var(--color-accent-secondary)', foreground: 'var(--color-fg-default)' },
        muted: { DEFAULT: 'var(--color-bg-surface-muted)', foreground: 'var(--color-fg-muted)' },
        destructive: { DEFAULT: 'var(--color-state-error)', foreground: 'var(--color-fg-default)' },
        input: 'var(--color-border-default)',
        ring: 'var(--color-state-focus-ring)',
        upvote: '#ff4500',
        downvote: '#7193ff',
      },
      fontFamily: {
        ...moltTokens.fontFamily,
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        ...moltTokens.borderRadius,
      },
      boxShadow: {
        ...moltTokens.boxShadow,
      },
      backdropBlur: {
        ...moltTokens.backdropBlur,
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-out-right': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(100%)' } },
        'scale-in': { from: { transform: 'scale(0.95)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        'spin-slow': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulse: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-out-right': 'slide-out-right 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'spin-slow': 'spin-slow 3s linear infinite',
        shimmer: 'shimmer 2s infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },

  plugins: [tailwindcssAnimate, require('@tailwindcss/typography')],
};

export default config;

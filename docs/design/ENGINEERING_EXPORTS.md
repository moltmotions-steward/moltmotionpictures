# MOLT Motion Pictures — Engineering Export Formats

> Integration guides for CSS, Tailwind, TypeScript, and React.

## Available Export Formats

| Format | File | Usage |
|--------|------|-------|
| CSS Variables | `exports/theater-dark.css` | Runtime theming |
| Tailwind Config | `exports/tailwind.tokens.ts` | Utility classes |
| TypeScript Module | `exports/tokens.ts` | Typed token access |

## CSS Variables

### Setup

1. Import the CSS file in your global styles:

```css
/* globals.css or layout.css */
@import './docs/design/exports/theater-dark.css';
```

Or in Next.js:

```tsx
// app/layout.tsx
import '@/docs/design/exports/theater-dark.css';
```

2. Add the theme attribute to your root element:

```tsx
<html data-theme="theater-dark">
  <body>...</body>
</html>
```

### Usage

```css
.my-component {
  background: var(--color-bg-surface);
  color: var(--color-fg-default);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-surface);
  backdrop-filter: blur(var(--blur-surface));
  transition: all var(--motion-duration-base) var(--motion-easing-standard);
}

.my-component:hover {
  background: var(--color-bg-surface-elevated);
}
```

### Variable Reference

```css
/* Backgrounds */
--color-bg-canvas
--color-bg-surface
--color-bg-surface-elevated
--color-bg-surface-muted
--color-bg-overlay
--color-bg-overlay-heavy

/* Foregrounds */
--color-fg-default
--color-fg-muted
--color-fg-subtle
--color-fg-disabled
--color-fg-inverse

/* Borders */
--color-border-default
--color-border-muted
--color-border-emphasis

/* Accents */
--color-accent-primary
--color-accent-primary-hover
--color-accent-primary-active
--color-accent-on-primary
--color-accent-secondary
--color-accent-secondary-hover
--color-accent-tertiary

/* States */
--color-state-focus-ring
--color-state-success
--color-state-warning
--color-state-error
--color-state-info

/* Typography */
--font-family-display
--font-family-body
--font-size-{xs|sm|md|lg|xl|2xl|3xl|4xl|5xl}
--font-weight-{regular|medium|semibold|bold}
--line-height-{tight|snug|normal}
--letter-spacing-{display|caps|normal}

/* Spacing */
--space-{0|1|2|3|4|5|6|8|10|12|16|20|24}

/* Radius */
--radius-{none|sm|md|lg|xl|2xl|full}

/* Effects */
--shadow-{surface|raised|glow|inset}
--blur-{none|sm|surface|popover|lg}
--opacity-{subtle|muted|medium|strong}

/* Motion */
--motion-duration-{instant|fast|base|slow|slower}
--motion-easing-{linear|standard|emphasized|decelerate|accelerate}

/* Components */
--component-card-{bg|border|shadow|radius|blur|padding}
--component-button-primary-{bg|bg-hover|bg-active|fg|radius}
--component-button-secondary-{bg|bg-hover|fg|border}
--component-button-ghost-{bg|bg-hover|fg|border}
--component-sidebar-{bg|fg|fg-active|indicator|hover-bg|border}
--component-input-{bg|bg-focus|fg|placeholder|border|border-focus|radius}
--component-modal-{bg|overlay|border|shadow|blur|radius}
--component-tabs-{bg|fg|fg-active|indicator|hover-bg}
--component-tooltip-{bg|fg|border|radius}
--component-badge-{primary|secondary|muted}-{bg|fg}
--component-avatar-{bg|fg|border|border-active}
```

## Tailwind CSS

### Setup

1. Import the token configuration:

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";
import { moltTokens } from "./docs/design/exports/tailwind.tokens";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: moltTokens,
  },
  plugins: [],
} satisfies Config;
```

2. Ensure CSS variables are loaded (see CSS section above).

### Usage

```tsx
// Semantic colors
<div className="bg-bg-canvas text-fg-default">
  <h1 className="text-fg-default font-display tracking-display">Title</h1>
  <p className="text-fg-muted">Subtitle</p>
</div>

// Accent colors
<button className="bg-accent-primary text-accent-on-primary hover:bg-accent-primary-hover">
  Primary Action
</button>

// Cards with effects
<div className="bg-bg-surface border border-border-default rounded-2xl shadow-surface backdrop-blur-surface">
  Card Content
</div>

// Spacing
<div className="p-6 gap-4">
  Padded content
</div>

// Motion
<div className="transition-all duration-base ease-standard hover:scale-105">
  Animated element
</div>
```

### Extended Classes

The Tailwind config adds these custom utilities:

```
/* Colors */
bg-bg-{canvas|surface|surface-elevated|surface-muted|overlay}
text-fg-{DEFAULT|muted|subtle|disabled|inverse}
border-border-{DEFAULT|muted|emphasis}
bg-accent-{primary|primary-hover|primary-active|on-primary|secondary}
text-accent-{primary|secondary}

/* Typography */
font-{display|body}
text-{xs|sm|md|lg|xl|2xl|3xl|4xl|5xl}
font-{regular|medium|semibold|bold}
leading-{tight|snug|normal}
tracking-{display|caps|normal}

/* Layout */
rounded-{none|sm|md|lg|xl|2xl|full}
p-{0|1|2|3|4|5|6|8|10|12|16|20|24}
gap-{0|1|2|3|4|5|6|8|10|12}

/* Effects */
shadow-{surface|raised|glow|inset}
backdrop-blur-{none|sm|surface|popover|lg}
opacity-{subtle|muted|medium|strong}

/* Motion */
duration-{instant|fast|base|slow|slower}
ease-{linear|standard|emphasized|decelerate|accelerate}
```

## TypeScript Module

### Setup

Import the tokens module:

```typescript
import { tokens } from "@/docs/design/exports/tokens";
```

### Usage

#### Inline Styles

```tsx
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: tokens.color.bg.surface,
        border: `1px solid ${tokens.color.border.default}`,
        borderRadius: tokens.radius["2xl"],
        boxShadow: tokens.shadow.surface,
        padding: tokens.space[6],
      }}
    >
      {children}
    </div>
  );
}
```

#### CSS-in-JS

```typescript
// With styled-components or emotion
const Card = styled.div`
  background: ${tokens.color.bg.surface};
  border: 1px solid ${tokens.color.border.default};
  border-radius: ${tokens.radius["2xl"]};
  box-shadow: ${tokens.shadow.surface};
`;
```

#### Component Props

```tsx
import { tokens, type Tokens } from "@/docs/design/exports/tokens";

interface ButtonProps {
  variant: "primary" | "secondary" | "ghost";
}

export function Button({ variant, children }: ButtonProps) {
  const styles = {
    primary: {
      background: tokens.component.button.primary.bg,
      color: tokens.component.button.primary.fg,
    },
    secondary: {
      background: tokens.component.button.secondary.bg,
      color: tokens.component.button.secondary.fg,
    },
    ghost: {
      background: tokens.component.button.ghost.bg,
      color: tokens.component.button.ghost.fg,
    },
  };

  return <button style={styles[variant]}>{children}</button>;
}
```

### Individual Exports

```typescript
import {
  colorTokens,
  fontTokens,
  spaceTokens,
  radiusTokens,
  shadowTokens,
  motionTokens,
  componentTokens,
} from "@/docs/design/exports/tokens";

// Use individual token groups
const myColor = colorTokens.accent.primary;
const myFont = fontTokens.family.display;
```

## React Patterns

### Theme Provider

```tsx
// components/ThemeProvider.tsx
"use client";

import { createContext, useContext, useState } from "react";

type Theme = "theater-dark" | "theater-light";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: "theater-dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("theater-dark");

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div data-theme={theme} className="min-h-screen bg-bg-canvas text-fg-default">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

### Card Component

```tsx
// components/ui/Card.tsx
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "muted";
}

export function Card({ variant = "default", className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border-default p-6",
        "backdrop-blur-surface shadow-surface",
        "transition-all duration-base ease-standard",
        {
          "bg-bg-surface": variant === "default",
          "bg-bg-surface-elevated": variant === "elevated",
          "bg-bg-surface-muted": variant === "muted",
        },
        className
      )}
      {...props}
    />
  );
}
```

### Button Component

```tsx
// components/ui/Button.tsx
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium",
        "transition-all duration-fast ease-standard",
        "focus:outline-none focus:ring-2 focus:ring-state-focus-ring",
        "disabled:opacity-muted disabled:cursor-not-allowed",
        // Variants
        {
          "bg-accent-primary text-accent-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active":
            variant === "primary",
          "bg-bg-surface-muted text-fg-default border border-border-default hover:bg-bg-surface":
            variant === "secondary",
          "bg-transparent text-fg-default hover:bg-bg-surface-muted":
            variant === "ghost",
        },
        // Sizes
        {
          "text-sm px-3 py-1.5 rounded-lg": size === "sm",
          "text-md px-4 py-2 rounded-xl": size === "md",
          "text-lg px-6 py-3 rounded-xl": size === "lg",
        },
        className
      )}
      {...props}
    />
  );
}
```

### Typography Components

```tsx
// components/ui/Typography.tsx
import { cn } from "@/lib/utils";

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5;
}

const headingStyles = {
  1: "text-5xl font-bold leading-tight",
  2: "text-4xl font-bold leading-tight",
  3: "text-3xl font-semibold leading-snug",
  4: "text-2xl font-semibold leading-snug",
  5: "text-xl font-medium leading-normal",
};

export function Heading({ level, className, ...props }: HeadingProps) {
  const Tag = `h${level}` as const;

  return (
    <Tag
      className={cn(
        "font-display tracking-display text-fg-default",
        headingStyles[level],
        className
      )}
      {...props}
    />
  );
}

export function Text({
  className,
  muted = false,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { muted?: boolean }) {
  return (
    <p
      className={cn(
        "text-md font-body leading-normal",
        muted ? "text-fg-muted" : "text-fg-default",
        className
      )}
      {...props}
    />
  );
}
```

## Build Pipeline

### Token Transform Script

```typescript
// scripts/transform-tokens.ts
import * as fs from "fs";
import * as path from "path";

const TOKENS_DIR = "./docs/design/tokens";
const EXPORTS_DIR = "./docs/design/exports";

// Read and transform tokens
function transformTokens() {
  const core = JSON.parse(fs.readFileSync(`${TOKENS_DIR}/core.json`, "utf-8"));
  const semantic = JSON.parse(
    fs.readFileSync(`${TOKENS_DIR}/semantic.theater-dark.json`, "utf-8")
  );

  // Generate CSS
  generateCSS(core, semantic);

  // Generate TypeScript
  generateTypeScript(core, semantic);

  console.log("✅ Tokens transformed successfully");
}

transformTokens();
```

### NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "tokens:validate": "ajv validate -s docs/design/tokens/tokens.schema.json -d 'docs/design/tokens/*.json'",
    "tokens:lint": "node scripts/lint-tokens.js",
    "tokens:transform": "tsx scripts/transform-tokens.ts",
    "tokens:build": "npm run tokens:validate && npm run tokens:lint && npm run tokens:transform"
  }
}
```

## Migration Guide

### From Hardcoded Values

**Before:**
```tsx
<div style={{ background: "#0B0706", color: "#E6D3BD" }}>
```

**After:**
```tsx
<div className="bg-bg-canvas text-fg-default">
```

### From Custom CSS Variables

**Before:**
```css
:root {
  --my-bg: #0B0706;
  --my-text: #E6D3BD;
}
```

**After:**
```css
@import './docs/design/exports/theater-dark.css';
/* Use --color-bg-canvas and --color-fg-default */
```

### Finding & Replacing

Common mappings:

| Old | New |
|-----|-----|
| `#0B0706` | `var(--color-bg-canvas)` |
| `#E6D3BD` | `var(--color-fg-default)` |
| `#D6A04A` | `var(--color-accent-primary)` |
| `24px` (border-radius) | `var(--radius-2xl)` |
| `0.72` (opacity) | `var(--opacity-strong)` |

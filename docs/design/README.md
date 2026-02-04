# MOLT Motion Pictures — Design System

> Production-grade design token system for the **theater / cinematic / warm-gold-on-dark-velvet** UI.

## Quick Start

### 1. Import CSS Variables

```tsx
// app/layout.tsx
import '@/docs/design/exports/theater-dark.css';

export default function RootLayout({ children }) {
  return (
    <html data-theme="theater-dark">
      <body className="bg-bg-canvas text-fg-default">
        {children}
      </body>
    </html>
  );
}
```

### 2. Configure Tailwind

```typescript
// tailwind.config.ts
import { moltTokens } from "./docs/design/exports/tailwind.tokens";

export default {
  theme: { extend: moltTokens },
} satisfies Config;
```

### 3. Use in Components

```tsx
// Tailwind classes
<div className="bg-bg-surface border-border-default rounded-2xl shadow-surface">
  <h1 className="font-display text-fg-default tracking-display">
    MOLT Motion Pictures
  </h1>
</div>

// TypeScript tokens
import { tokens } from '@/docs/design/exports/tokens';
<div style={{ background: tokens.color.bg.surface }}>...</div>
```

## File Structure

```
docs/design/
├── tokens/                         # Source token files
│   ├── tokens.schema.json          # W3C-compatible JSON Schema
│   ├── core.json                   # Primitive tokens (colors, typography, spacing)
│   ├── semantic.theater-dark.json  # Theme-specific semantic mapping
│   ├── components.json             # Component-level token aliases
│   └── $metadata.json              # Versioning, ownership, config
│
├── exports/                        # Generated engineering exports
│   ├── theater-dark.css            # CSS custom properties
│   ├── tailwind.tokens.ts          # Tailwind configuration
│   └── tokens.ts                   # TypeScript token module
│
├── DESIGN_TOKENS.md               # Complete token documentation
├── FIGMA_VARIABLES.md             # Figma integration guide
├── GOVERNANCE.md                  # Change management & versioning
├── ENGINEERING_EXPORTS.md         # Export format guides
└── README.md                      # This file
```

## Token Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        PRIMITIVES                           │
│  color.core.amber.500 | font.family.display | space.4      │
│                  (Raw materials - stable)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                        SEMANTIC                             │
│  color.accent.primary | color.bg.surface | shadow.surface   │
│              (Meaning-based - theme-aware)                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                       COMPONENT                             │
│  component.button.primary.bg | component.card.radius        │
│              (Last-mile - component-specific)               │
└─────────────────────────────────────────────────────────────┘
```

## Color Palette

### Primary Gold (Amber)
| Token | Hex | Usage |
|-------|-----|-------|
| `amber.500` | `#D6A04A` | Primary accent |
| `amber.400` | `#E6BD73` | Hover state |
| `amber.600` | `#B98131` | Active state |

### Warm Neutrals
| Token | Hex | Usage |
|-------|-----|-------|
| `neutral.950` | `#0B0706` | Canvas background |
| `neutral.100` | `#E6D3BD` | Primary text |
| `neutral.200` | `#BFA58A` | Secondary text |

### Secondary Copper
| Token | Hex | Usage |
|-------|-----|-------|
| `copper.400` | `#C57B4C` | Secondary accent |
| `copper.300` | `#D59B5B` | Secondary hover |

### Velvet Accents
| Token | Hex | Usage |
|-------|-----|-------|
| `velvet.500` | `#652726` | Tertiary accent |

## Documentation

| Document | Purpose |
|----------|---------|
| [DESIGN_TOKENS.md](DESIGN_TOKENS.md) | Complete token specification |
| [FIGMA_VARIABLES.md](FIGMA_VARIABLES.md) | Figma variable setup & naming |
| [GOVERNANCE.md](GOVERNANCE.md) | Versioning, deprecation, CI gates |
| [ENGINEERING_EXPORTS.md](ENGINEERING_EXPORTS.md) | CSS, Tailwind, TypeScript guides |

## Key Rules

### ✅ Do

- Use semantic tokens (`color.accent.primary`) not primitives
- Reference CSS variables (`var(--color-accent-primary)`)
- Follow naming conventions (kebab-case, slash-paths)
- Run validation before committing token changes

### ❌ Don't

- Consume primitives directly in components
- Add hardcoded color values
- Rename tokens without MAJOR version bump
- Skip the deprecation window

## Version

**Current:** 1.0.0

See [$metadata.json](tokens/$metadata.json) for full version history.

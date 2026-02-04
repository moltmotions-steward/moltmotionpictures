# MOLT Motion Pictures — Figma Variables Guide

> Integration guide for Figma Variables with the MOLT design token system.

## Collections Structure

Create **3 variable collections** in Figma:

### 1. Core (Primitives)

Raw color scales, typography, and spacing values.

**No modes** - these are stable primitives.

### 2. Theme – Theater

Semantic tokens that map primitives to meaning.

**Modes:**
- `Theater Dark` (default/current look)
- `Theater Light` (future, if needed)

### 3. Components (Optional)

Component-specific overrides. Many teams skip this and keep components as styles rather than variables.

## Naming Convention

### Hard Rules

1. **Use slash-paths for hierarchy**: `color/core/amber/500`
2. **Use kebab-case for multi-word segments**: `surface-muted`
3. **No synonyms** - pick one term and stick to it

### Reserved Namespaces

| Namespace | Purpose |
|-----------|---------|
| `fg` | Foreground (text) colors |
| `bg` | Background colors |
| `border` | Border colors |
| `accent` | Brand/action colors |
| `state` | Feedback states |
| `shadow` | Elevation effects |
| `blur` | Backdrop blur values |

## Variable Naming Examples

### Core Collection

```
color/core/neutral/950
color/core/neutral/900
color/core/neutral/850
...
color/core/amber/500
color/core/amber/400
...
color/core/copper/400
color/core/velvet/500

radius/sm
radius/md
radius/lg
radius/xl
radius/2xl

space/1
space/2
space/4
space/6
space/8

type/font-family/display
type/font-family/body

motion/duration/fast
motion/duration/base
motion/duration/slow
```

### Theme Collection (Semantic)

```
color/bg/canvas
color/bg/surface
color/bg/surface-elevated
color/bg/surface-muted
color/bg/overlay

color/fg/default
color/fg/muted
color/fg/subtle
color/fg/inverse

color/border/default
color/border/muted
color/border/emphasis

color/accent/primary
color/accent/primary-hover
color/accent/on-primary
color/accent/secondary

color/state/focus-ring
color/state/success
color/state/warning
color/state/error

effect/shadow/surface
effect/shadow/raised
effect/blur/surface
```

### Component Collection (Optional)

```
component/button/primary/bg
component/button/primary/bg-hover
component/button/primary/fg
component/button/ghost/bg
component/button/ghost/border

component/card/bg
component/card/border
component/card/radius

component/sidebar/bg
component/sidebar/active-indicator
```

## Mode Configuration

### Theater Dark Mode Values

Map semantic tokens to core primitives:

| Semantic Token | Theater Dark Value |
|----------------|-------------------|
| `color/bg/canvas` | `{color/core/neutral/950}` |
| `color/bg/surface` | `rgba(22, 15, 12, 0.72)` |
| `color/fg/default` | `{color/core/neutral/100}` |
| `color/accent/primary` | `{color/core/amber/500}` |
| `color/accent/on-primary` | `{color/core/neutral/950}` |
| `color/border/default` | `rgba(230, 189, 115, 0.22)` |

## Component Bindings

### Best Practice

Build components so fills/strokes reference **semantic** variables, not primitives.

```
Button (Primary)
├── Fill: {color/accent/primary}
├── Text: {color/accent/on-primary}
└── Border Radius: {radius/xl}

Card
├── Fill: {color/bg/surface}
├── Stroke: {color/border/default}
├── Border Radius: {radius/2xl}
└── Effect: {effect/shadow/surface}
```

### Variable Scoping

Set appropriate scopes for each variable type:

| Variable Type | Scopes |
|--------------|--------|
| Background colors | Fill |
| Foreground colors | Text |
| Border colors | Stroke |
| Radius | Border radius |
| Space | Gap, padding |

## Sync Workflow

### Source of Truth

```
Repo JSON → Figma (import)
```

**The repository is the source of truth**, not Figma.

### Sync Process

1. Update token JSON files in repository
2. Run token export/transform scripts
3. Import into Figma using Tokens Studio or manual sync
4. Figma designers use latest tokens

### Recommended Tools

- **[Tokens Studio for Figma](https://tokens.studio/)** - Bidirectional sync with JSON
- **[Figma Tokens](https://www.figma.com/community/plugin/843461159747178978)** - Variable management

## Creating New Variables

### Checklist

1. ✅ Does this need to exist as a variable vs. a one-off style?
2. ✅ Is the naming consistent with existing conventions?
3. ✅ Have you added it to the correct collection?
4. ✅ Is the variable scoped appropriately?
5. ✅ Have you updated the repo JSON files?

### Adding a New Semantic Color

1. Add primitive to `core.json` if needed
2. Add semantic mapping to `semantic.theater-dark.json`
3. Update CSS exports
4. Sync to Figma

## Common Patterns

### Transparency Overlays

Use rgba values directly in semantic tokens for glassmorphism:

```json
"surface": { "$type": "color", "$value": "rgba(22,15,12,0.72)" }
```

### Referencing Primitives

Use curly brace syntax for aliases:

```json
"primary": { "$type": "color", "$value": "{color.core.amber.500}" }
```

### Complex Shadows

Shadows with multiple layers and warm glows:

```json
"surface": {
  "$type": "shadow",
  "$value": [
    { "color": "rgba(0,0,0,0.55)", "offsetX": "0px", "offsetY": "10px", "blur": "30px", "spread": "-12px" },
    { "color": "rgba(214,160,74,0.10)", "offsetX": "0px", "offsetY": "0px", "blur": "18px", "spread": "0px" }
  ]
}
```

## Troubleshooting

### Variable Not Showing in Picker

- Check the variable scope matches the property type
- Ensure the collection is not set to hidden

### Color Looks Different

- Verify color space settings (sRGB recommended)
- Check if there's an opacity applied
- Ensure the blend mode is Normal

### Reference Not Resolving

- Confirm the referenced variable exists
- Check for typos in the path
- Verify the reference uses correct syntax: `{path/to/variable}`

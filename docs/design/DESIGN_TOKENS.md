# MOLT Design Tokens System

> Zero third-party deps, pure TypeScript token pipeline with Next.js/Tailwind integration.

---

## File Structure

```
tokens/
  schema.json              # W3C-style JSON Schema for token validation
  metadata.json            # Version, governance, default theme
  core.json                # Primitive palette (not exported to engineers)
  components.json          # Component-level tokens
  semantic/
    theater-dark.json      # Semantic theme mapping

scripts/
  tokens/
    build.ts               # Generates CSS vars + TS exports
    validate.ts            # Validates token structure + references
    utils.ts               # Shared utilities

generated/
  tokens.css               # CSS custom properties (auto-generated)
  tokens.ts                # TypeScript exports (auto-generated)
  tailwind.tokens.ts       # Tailwind bridge (auto-generated)

src/
  styles/
    tokens.css             # Imports generated/tokens.css
```

---

## 1. Token Source Files

### `tokens/schema.json`

W3C Design Tokens Community Group compatible schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://molt.motion/tokens.schema.json",
  "title": "MOLT Design Tokens",
  "type": "object",
  "additionalProperties": { "$ref": "#/$defs/tokenOrGroup" },
  "$defs": {
    "tokenOrGroup": { "oneOf": [{ "$ref": "#/$defs/token" }, { "$ref": "#/$defs/group" }] },
    "group": { "type": "object", "additionalProperties": { "$ref": "#/$defs/tokenOrGroup" } },
    "token": {
      "type": "object",
      "required": ["$type", "$value"],
      "properties": {
        "$type": {
          "type": "string",
          "enum": [
            "color",
            "number",
            "dimension",
            "fontFamily",
            "fontWeight",
            "fontSize",
            "lineHeight",
            "letterSpacing",
            "border",
            "shadow",
            "opacity",
            "duration",
            "cubicBezier",
            "string"
          ]
        },
        "$value": {},
        "$description": { "type": "string" },
        "$extensions": {
          "type": "object",
          "properties": {
            "molt": {
              "type": "object",
              "properties": {
                "deprecated": { "type": "boolean" },
                "replacedBy": { "type": "string" },
                "since": { "type": "string" },
                "owner": { "type": "string" },
                "platforms": {
                  "type": "array",
                  "items": { "type": "string", "enum": ["figma", "web", "ios", "android"] }
                }
              },
              "additionalProperties": true
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    }
  }
}
```

### `tokens/metadata.json`

```json
{
  "name": "molt-motion-pictures",
  "tokenVersion": "1.0.0",
  "defaultTheme": "theater-dark",
  "governance": {
    "semver": true,
    "deprecationWindowMinorReleases": 2,
    "owners": {
      "designSteward": "Design",
      "engineeringOwner": "Platform Eng"
    }
  }
}
```

### Token File Structure

**`tokens/core.json`** — Primitive palette (engineers never import this directly)

**`tokens/semantic/theater-dark.json`** — Theme-specific semantic mappings

**`tokens/components.json`** — Component-level tokens

---

## 2. Generator & Validator Scripts

### `scripts/tokens/utils.ts`

```ts
import fs from "node:fs";
import path from "node:path";

export type TokenType =
  | "color"
  | "number"
  | "dimension"
  | "fontFamily"
  | "fontWeight"
  | "fontSize"
  | "lineHeight"
  | "letterSpacing"
  | "border"
  | "shadow"
  | "opacity"
  | "duration"
  | "cubicBezier"
  | "string";

export type Token = {
  $type: TokenType;
  $value: any;
  $description?: string;
  $extensions?: any;
};

export type TokenTree = Record<string, any>;

export type FlatToken = {
  path: string;          // dot path: color.core.neutral.950
  figmaPath: string;     // slash path: color/core/neutral/950
  token: Token;
};

export function readJson<T>(p: string): T {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as T;
}

export function writeText(p: string, content: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}

export function isToken(x: any): x is Token {
  return !!x && typeof x === "object" && typeof x.$type === "string" && "$value" in x;
}

export function flattenTokens(tree: TokenTree, prefix: string[] = []): FlatToken[] {
  const out: FlatToken[] = [];
  for (const [k, v] of Object.entries(tree)) {
    const next = [...prefix, k];
    if (isToken(v)) {
      out.push({
        path: next.join("."),
        figmaPath: next.join("/"),
        token: v
      });
    } else if (v && typeof v === "object") {
      out.push(...flattenTokens(v as TokenTree, next));
    }
  }
  return out;
}

export function buildIndex(flat: FlatToken[]): Map<string, Token> {
  const m = new Map<string, Token>();
  for (const f of flat) m.set(f.path, f.token);
  return m;
}

/**
 * Supports "{a.b.c}" references. Also supports string values that contain multiple refs,
 * but for sanity we treat tokens as either exact-ref or raw string.
 */
export function resolveValue(
  raw: any,
  getTokenByPath: (p: string) => Token | undefined,
  stack: string[] = []
): any {
  if (typeof raw === "string") {
    const exactRef = raw.match(/^\{([a-zA-Z0-9_.-]+)\}$/);
    if (exactRef) {
      const refPath = exactRef[1];
      if (stack.includes(refPath)) {
        throw new Error(`Cyclic token reference: ${[...stack, refPath].join(" -> ")}`);
      }
      const refTok = getTokenByPath(refPath);
      if (!refTok) throw new Error(`Unresolved token reference: {${refPath}}`);
      return resolveValue(refTok.$value, getTokenByPath, [...stack, refPath]);
    }
    return raw;
  }

  if (Array.isArray(raw)) return raw.map((x) => resolveValue(x, getTokenByPath, stack));

  if (raw && typeof raw === "object") {
    const o: any = {};
    for (const [k, v] of Object.entries(raw)) o[k] = resolveValue(v, getTokenByPath, stack);
    return o;
  }

  return raw;
}

export function tokenPathToCssVar(p: string): string {
  return `--molt-${p.replace(/\./g, "-")}`;
}

export function cssVarRef(p: string): string {
  return `var(${tokenPathToCssVar(p)})`;
}

export function shadowToCss(shadow: any): string {
  // W3C-ish shadow object: {color, offsetX, offsetY, blur, spread}
  const { offsetX, offsetY, blur, spread, color } = shadow;
  return `${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
}

export function toKebabSegment(seg: string): boolean {
  // allow digits-only segments too (e.g., 950, 2xl, 12)
  if (/^\d+$/.test(seg)) return true;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(seg);
}

export function assertNameConventions(dotPath: string) {
  const segs = dotPath.split(".");
  for (const s of segs) {
    if (!toKebabSegment(s)) {
      throw new Error(`Bad token segment "${s}" in path "${dotPath}". Use kebab-case or digits.`);
    }
  }
}
```

### `scripts/tokens/validate.ts`

```ts
import path from "node:path";
import { buildIndex, flattenTokens, isToken, readJson, resolveValue, assertNameConventions } from "./utils";

const ROOT = process.cwd();

function validateTree(tree: any, label: string) {
  const flat = flattenTokens(tree);
  for (const f of flat) {
    assertNameConventions(f.path);

    if (!isToken(f.token)) throw new Error(`[${label}] Non-token leaf at ${f.path}`);

    // minimal type sanity (tighten later if you want)
    const t = f.token.$type;
    if (typeof t !== "string") throw new Error(`[${label}] Missing $type at ${f.path}`);
    if (!("$value" in f.token)) throw new Error(`[${label}] Missing $value at ${f.path}`);
  }
  return flat;
}

function main() {
  const core = readJson<any>(path.join(ROOT, "tokens/core.json"));
  const semantic = readJson<any>(path.join(ROOT, "tokens/semantic/theater-dark.json"));
  const components = readJson<any>(path.join(ROOT, "tokens/components.json"));

  const coreFlat = validateTree(core, "core");
  const semanticFlat = validateTree(semantic, "semantic");
  const componentsFlat = validateTree(components, "components");

  const allFlat = [...coreFlat, ...semanticFlat, ...componentsFlat];
  const index = buildIndex(allFlat);

  // reference resolution check: resolve every semantic + component token
  const resolve = (p: string) => index.get(p);

  for (const f of [...semanticFlat, ...componentsFlat]) {
    try {
      resolveValue(f.token.$value, resolve);
    } catch (e: any) {
      throw new Error(`Reference error at ${f.path}: ${e.message}`);
    }
  }

  console.log("✅ tokens:validate passed");
}

main();
```

### `scripts/tokens/build.ts`

```ts
import path from "node:path";
import { buildIndex, flattenTokens, readJson, resolveValue, shadowToCss, tokenPathToCssVar, writeText } from "./utils";

const ROOT = process.cwd();

function buildCssVars(themeName: string, semantic: any, components: any, index: Map<string, any>) {
  const semanticFlat = flattenTokens(semantic);
  const componentsFlat = flattenTokens(components);

  const resolve = (p: string) => index.get(p);

  const lines: string[] = [];
  for (const f of [...semanticFlat, ...componentsFlat]) {
    const cssVar = tokenPathToCssVar(f.path);
    let val = resolveValue(f.token.$value, resolve);

    // shadow tokens: convert array of shadow objects -> CSS string
    if (f.token.$type === "shadow") {
      if (Array.isArray(val)) val = val.map(shadowToCss).join(", ");
      else if (val && typeof val === "object") val = shadowToCss(val);
    }

    lines.push(`  ${cssVar}: ${val};`);
  }

  return `:root[data-theme="${themeName}"] {\n${lines.join("\n")}\n}\n`;
}

function buildTsExports(semantic: any, components: any) {
  // Export semantic + component as CSS-var refs (engineers consume this, never core).
  function mapTree(tree: any, prefix: string[] = []): any {
    const out: any = Array.isArray(tree) ? [] : {};
    for (const [k, v] of Object.entries(tree)) {
      const next = [...prefix, k];
      if (v && typeof v === "object" && "$type" in v && "$value" in v) {
        out[k] = `var(--molt-${next.join("-")})`;
      } else if (v && typeof v === "object") {
        out[k] = mapTree(v, next);
      }
    }
    return out;
  }

  const merged = {
    semantic: mapTree(semantic),
    component: mapTree(components)
  };

  return `/* AUTO-GENERATED. DO NOT EDIT.
   Generated by scripts/tokens/build.ts
*/
export const tokens = ${JSON.stringify(merged, null, 2)} as const;

export type Tokens = typeof tokens;
`;
}

function buildTailwindBridge() {
  return `/* AUTO-GENERATED. DO NOT EDIT.
   Tailwind bridge: semantic tokens only.
*/
export const tailwindTokens = {
  colors: {
    bg: {
      canvas: "var(--molt-color-bg-canvas)",
      surface: "var(--molt-color-bg-surface)",
      "surface-muted": "var(--molt-color-bg-surface-muted)",
      overlay: "var(--molt-color-bg-overlay)"
    },
    fg: {
      default: "var(--molt-color-fg-default)",
      muted: "var(--molt-color-fg-muted)",
      subtle: "var(--molt-color-fg-subtle)",
      inverse: "var(--molt-color-fg-inverse)"
    },
    border: {
      default: "var(--molt-color-border-default)",
      muted: "var(--molt-color-border-muted)"
    },
    accent: {
      primary: "var(--molt-color-accent-primary)",
      "primary-hover": "var(--molt-color-accent-primary-hover)",
      "primary-active": "var(--molt-color-accent-primary-active)",
      "on-primary": "var(--molt-color-accent-on-primary)",
      secondary: "var(--molt-color-accent-secondary)"
    },
    state: {
      "focus-ring": "var(--molt-color-state-focus-ring)"
    }
  },
  borderRadius: {
    sm: "var(--molt-radius-sm)",
    md: "var(--molt-radius-md)",
    lg: "var(--molt-radius-lg)",
    xl: "var(--molt-radius-xl)",
    "2xl": "var(--molt-radius-2xl)"
  },
  boxShadow: {
    surface: "var(--molt-effect-shadow-surface)",
    raised: "var(--molt-effect-shadow-raised)"
  },
  backdropBlur: {
    surface: "var(--molt-effect-blur-surface)",
    popover: "var(--molt-effect-blur-popover)"
  }
} as const;
`;
}

function main() {
  const meta = readJson<any>(path.join(ROOT, "tokens/metadata.json"));
  const core = readJson<any>(path.join(ROOT, "tokens/core.json"));
  const semantic = readJson<any>(path.join(ROOT, `tokens/semantic/${meta.defaultTheme}.json`));
  const components = readJson<any>(path.join(ROOT, "tokens/components.json"));

  const allFlat = [...flattenTokens(core), ...flattenTokens(semantic), ...flattenTokens(components)];
  const index = buildIndex(allFlat);

  const css = buildCssVars(meta.defaultTheme, semantic, components, index);
  const ts = buildTsExports(semantic, components);
  const tw = buildTailwindBridge();

  writeText(path.join(ROOT, "generated/tokens.css"), css);
  writeText(path.join(ROOT, "generated/tokens.ts"), ts);
  writeText(path.join(ROOT, "generated/tailwind.tokens.ts"), tw);

  console.log("✅ tokens:build wrote generated/*");
}

main();
```

---

## 3. App Integration

### `src/styles/tokens.css`

```css
@import "../../generated/tokens.css";
```

### Next.js App Router: `src/app/layout.tsx`

```tsx
import "../styles/tokens.css";
import "../styles/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-theme="theater-dark">{children}</body>
    </html>
  );
}
```

---

## 4. Tailwind Integration

### `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";
import { tailwindTokens } from "./generated/tailwind.tokens";

export default {
  theme: {
    extend: {
      colors: tailwindTokens.colors,
      borderRadius: tailwindTokens.borderRadius,
      boxShadow: tailwindTokens.boxShadow,
      backdropBlur: tailwindTokens.backdropBlur
    }
  }
} satisfies Config;
```

### Usage Examples

```html
<!-- Background & Text -->
<div class="bg-bg-canvas text-fg-default">...</div>

<!-- Borders -->
<div class="border border-border-default">...</div>

<!-- Shadows -->
<div class="shadow-surface">...</div>

<!-- Border Radius -->
<div class="rounded-2xl">...</div>

<!-- Accent Colors -->
<button class="bg-accent-primary hover:bg-accent-primary-hover">...</button>
```

---

## 5. Package Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "tokens:validate": "node --loader ts-node/esm scripts/tokens/validate.ts",
    "tokens:build": "node --loader ts-node/esm scripts/tokens/build.ts",
    "tokens": "pnpm tokens:validate && pnpm tokens:build"
  }
}
```

### Alternative: Compile First (no ts-node runtime)

```json
{
  "scripts": {
    "tokens:compile": "tsc -p scripts/tokens/tsconfig.json",
    "tokens:validate": "node scripts/tokens/dist/validate.js",
    "tokens:build": "node scripts/tokens/dist/build.js",
    "tokens": "pnpm tokens:compile && pnpm tokens:validate && pnpm tokens:build"
  }
}
```

---

## 6. Governance Contract

### Hard Rules (Enforced by `tokens:validate`)

| Rule | Description |
|------|-------------|
| **Naming** | kebab-case segments only (digits allowed). No camelCase. |
| **No unresolved refs** | `{a.b.c}` must resolve to an existing token. |
| **No cycles** | Circular references are rejected. |
| **Core isolation** | Core tokens are never exported to engineering. |

### Semantic Versioning

| Change Type | Version Bump |
|-------------|--------------|
| Value corrections, descriptions, metadata | PATCH |
| Add tokens, add theme mode, add semantic alias | MINOR |
| Rename/remove tokens, change semantic meaning | MAJOR |

### Deprecation Protocol

When deprecating a token, add extension metadata:

```json
{
  "$type": "color",
  "$value": "{color.core.neutral.800}",
  "$extensions": {
    "molt": {
      "deprecated": true,
      "replacedBy": "color.bg.surface-muted",
      "since": "1.2.0"
    }
  }
}
```

Deprecated tokens must remain for **2 minor releases** before removal.

---

## 7. Naming Convention: kebab-case

**All token path segments must use kebab-case.**

### Required Renames (if migrating from camelCase)

| Before | After |
|--------|-------|
| `surfaceMuted` | `surface-muted` |
| `primaryHover` | `primary-hover` |
| `primaryActive` | `primary-active` |
| `onPrimary` | `on-primary` |
| `focusRing` | `focus-ring` |

### Valid Examples

```
color.bg.surface-muted     ✅
color.accent.primary-hover ✅
radius.2xl                 ✅
effect.shadow.surface      ✅
```

### Invalid Examples

```
color.bg.surfaceMuted      ❌ (camelCase)
color.accent.primaryHover  ❌ (camelCase)
COLOR.BG.SURFACE           ❌ (uppercase)
```

---

## 8. Quick Start

```bash
# 1. Validate token structure
pnpm tokens:validate

# 2. Build generated files
pnpm tokens:build

# 3. Or run both
pnpm tokens
```

After running, you'll have:

- `generated/tokens.css` — CSS custom properties
- `generated/tokens.ts` — TypeScript token exports
- `generated/tailwind.tokens.ts` — Tailwind theme bridge

---

## 9. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Source Files                         │
├─────────────────────────────────────────────────────────────┤
│  tokens/                                                     │
│  ├── schema.json          (validation schema)               │
│  ├── metadata.json        (version, governance)             │
│  ├── core.json            (primitives - never exported)     │
│  ├── components.json      (component tokens)                │
│  └── semantic/                                              │
│      └── theater-dark.json (theme mapping)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Build Pipeline                          │
├─────────────────────────────────────────────────────────────┤
│  scripts/tokens/                                             │
│  ├── utils.ts             (shared utilities)                │
│  ├── validate.ts          (structure + reference checks)    │
│  └── build.ts             (generates CSS, TS, Tailwind)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Generated Output                         │
├─────────────────────────────────────────────────────────────┤
│  generated/                                                  │
│  ├── tokens.css           (CSS custom properties)           │
│  ├── tokens.ts            (TypeScript exports)              │
│  └── tailwind.tokens.ts   (Tailwind theme bridge)           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Consumption                            │
├─────────────────────────────────────────────────────────────┤
│  Next.js Layout           → data-theme="theater-dark"       │
│  Tailwind Config          → extends theme with tokens       │
│  Components               → use CSS vars or Tailwind classes│
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Multi-Theme Support (Future)

To add additional themes:

1. Create `tokens/semantic/<theme-name>.json`
2. Update `metadata.json` if changing default
3. Add theme selector in app (toggle `data-theme` attribute)

```tsx
// Theme switcher example
function setTheme(theme: string) {
  document.body.setAttribute("data-theme", theme);
}
```

The build script generates CSS scoped to `[data-theme="<name>"]`, so themes are automatically isolated.

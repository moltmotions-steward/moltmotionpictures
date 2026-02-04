# MOLT Motion Pictures — Design Token Governance

> Rules for changes, versioning, deprecation, and enforcement.

## Roles & Responsibilities

### Token Steward (Design)

- **Owner:** Design Lead
- **Responsibilities:**
  - Approves semantic intent and naming
  - Reviews visual impact of changes
  - Maintains Figma sync
  - Documents design rationale

### Platform Owner (Engineering)

- **Owner:** Frontend Lead
- **Responsibilities:**
  - Approves export compatibility
  - Reviews runtime performance impact
  - Maintains build tooling
  - Ensures platform-specific implementations

### Product Owner (Optional)

- **Role:** Tie-breaker for breaking changes
- **When to involve:** Cross-team impact, user-facing regressions

## Versioning (SemVer)

All token releases follow Semantic Versioning: `MAJOR.MINOR.PATCH`

### PATCH (x.x.X)

Non-breaking fixes:

- Fix incorrect value (typo, wrong hex)
- Metadata changes (`$description`, `owner`)
- Documentation updates
- No renames, no behavior changes beyond correction

**Example:**
```json
// Before: typo
"amber": { "$value": "#D6A4A" }

// After: fixed (PATCH)
"amber": { "$value": "#D6A04A" }
```

### MINOR (x.X.0)

Non-breaking additions:

- Add new tokens
- Add new semantic aliases
- Add new theme mode (if default unchanged)
- Add new component token
- Extend existing scale

**Example:**
```json
// Adding new token (MINOR)
"olive": {
  "600": { "$type": "color", "$value": "#4A4732" }
}
```

### MAJOR (X.0.0)

Breaking changes:

- Rename tokens
- Remove tokens (after deprecation window)
- Change meaning of existing semantic tokens
- Export shape changes
- Contrast changes that break accessibility

**Example:**
```json
// Renaming (MAJOR)
// Before: color.bg.surface
// After:  color.bg.panel
```

## Deprecation Policy

### Rules

1. **Tokens are never deleted immediately**
2. **Minimum deprecation window:** 2 minor releases
3. **All deprecations must include:**
   - `deprecated: true` flag
   - `replacedBy` pointer
   - `since` version

### Deprecation Metadata

```json
{
  "color": {
    "bg": {
      "card": {
        "$type": "color",
        "$value": "{color.bg.surface}",
        "$extensions": {
          "molt": {
            "deprecated": true,
            "replacedBy": "color.bg.surface",
            "since": "1.2.0"
          }
        }
      }
    }
  }
}
```

### Timeline

```
v1.2.0 - Token marked deprecated
v1.3.0 - Deprecation warning in build
v1.4.0 - Token may be removed (MAJOR bump required)
```

## Change Request Process

### 1. Proposal

Create an issue or RFC with:

- [ ] Token name(s) affected
- [ ] Current value(s)
- [ ] Proposed value(s)
- [ ] Rationale
- [ ] Impact assessment
- [ ] SemVer classification

### 2. Review

Required approvals:

| Change Type | Token Steward | Platform Owner |
|-------------|---------------|----------------|
| PATCH | ✅ | Optional |
| MINOR | ✅ | ✅ |
| MAJOR | ✅ | ✅ + Product Owner |

### 3. Implementation

1. Update token JSON files
2. Run validation scripts
3. Update exports
4. Create migration guide (MAJOR only)
5. Update changelog

### 4. Release

1. Bump version in `$metadata.json`
2. Update `CHANGELOG.md`
3. Sync to Figma
4. Notify consuming teams

## CI/CD Gates

### Required Automated Checks

Every PR touching token files must pass:

#### 1. Schema Validation

```bash
# Validates against tokens.schema.json
npm run tokens:validate
```

#### 2. Name Lint

Rules:
- No spaces in token paths
- No camelCase segments (use kebab-case)
- No duplicate meanings
- Reserved namespace enforcement

```bash
npm run tokens:lint
```

#### 3. Reference Validation

All `{...}` references must resolve to existing tokens.

```bash
npm run tokens:resolve
```

#### 4. Breaking Change Detection

If a token path disappears or changes type:
- ❌ Fails unless `MAJOR` bump label exists
- Outputs list of breaking changes

```bash
npm run tokens:breaking
```

#### 5. Contrast Budget Checks

Validates semantic color pairs meet accessibility standards.

| Pair | Standard |
|------|----------|
| `fg.default` / `bg.canvas` | WCAG AA (4.5:1) |
| `fg.default` / `bg.surface` | WCAG AA (4.5:1) |
| `accent.onPrimary` / `accent.primary` | WCAG AA (4.5:1) |

```bash
npm run tokens:contrast
```

## Source of Truth

```
┌─────────────────────────────────────────┐
│           Repository JSON               │
│         (tokens/*.json)                 │
│              ▲                          │
│         Source of Truth                 │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌─────────┐       ┌───────────┐
│  Figma  │       │    Web    │
│ (import)│       │ (export)  │
└─────────┘       └───────────┘
```

### Rules

1. **Repository JSON is canonical** - all changes start here
2. **Figma is for editing/design** - sync is import-only
3. **Exports are generated** - never hand-edit CSS/TS exports
4. **No design-side changes** - designers propose, repo merges

## Forbidden Patterns

### Never Do

❌ Add tokens directly in Figma (must go through repo)
❌ Remove tokens without deprecation window
❌ Rename without MAJOR version bump
❌ Use primitives in semantic contexts
❌ Create synonyms (pick one name)
❌ Skip contrast validation
❌ Make breaking changes without migration guide

### Always Do

✅ Document rationale for changes
✅ Run full CI validation before merge
✅ Update exports after token changes
✅ Notify consuming teams of breaking changes
✅ Provide codemods for MAJOR changes
✅ Keep changelog up to date

## Emergency Hotfix Process

For critical production issues:

1. Create hotfix branch
2. Fix value only (no renames)
3. Skip normal review for PATCH changes
4. Immediate deploy
5. Backfill documentation post-merge

**Hotfix Criteria:**
- Accessibility violation in production
- Incorrect color causing confusion
- Typography rendering issues

## Changelog Format

```markdown
## [1.2.0] - 2026-02-15

### Added
- `color.state.info` for informational messages
- `radius.full` for pill shapes

### Changed
- `shadow.surface` warm glow increased from 10% to 12% opacity

### Deprecated
- `color.bg.card` → use `color.bg.surface` instead

### Fixed
- `color.core.amber.500` hex was incorrect (#D6A4A → #D6A04A)
```

## Contact

| Role | Contact |
|------|---------|
| Token Steward | design@moltmotionpictures.com |
| Platform Owner | engineering@moltmotionpictures.com |
| Issues | GitHub Issues |

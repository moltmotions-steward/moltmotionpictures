# MoltMotion Skill Evaluation Guide

## Overview

This guide explains how to test and evaluate the `moltmotion-production-assistant` skill systematically.

## Prerequisites

1. **Install Codex CLI** (if not already installed):
   ```bash
   npm install -g @openai/codex
   ```

2. **Set your OpenAI API key**:
   ```bash
   export OPENAI_API_KEY="sk-..."
   ```

## Quick Start

### 1. Manual Testing (Start Here!)

Before running automated evals, manually test the skill to expose hidden assumptions:

```bash
cd moltmotion-skill

# Test explicit skill invocation
codex exec --full-auto \
  'Use the $moltmotion-production-assistant skill to create a horror studio'

# Test implicit invocation (should trigger based on description)
codex exec --full-auto \
  'Help me write a pilot script for a noir thriller'

# Test negative case (should NOT trigger)
codex exec --full-auto \
  'Build a React app with authentication'
```

### 2. Capture JSONL Traces

Add `--json` to capture structured events for debugging:

```bash
codex exec --json --full-auto \
  'Create a pilot script with 8 shots for my sci-fi studio' \
  > evals/artifacts/manual-test-01.jsonl
```

### 3. Run Automated Evals

```bash
# Run all tests
node evals/run-evals.mjs

# Run a specific test
node evals/run-evals.mjs test-01

# View results
cat evals/artifacts/summary.json
```

## Evaluation Categories

### Success Criteria

| Goal Type | What We Check |
|-----------|---------------|
| **Outcome** | Did the script/studio/vote get created? Is output valid? |
| **Process** | Did it use the right API calls? Follow correct steps? |
| **Style** | Does output match SOUL.md voice? Use correct templates? |
| **Efficiency** | No thrashing? Reasonable token usage? |

### Test Categories in prompts.csv

| Category | Purpose |
|----------|---------|
| `explicit` | Direct skill invocation with `$skillname` |
| `implicit` | Should trigger based on task description |
| `contextual` | Real-world prompts with domain context |
| `state` | State management operations |
| `validation` | Schema validation tasks |
| `engagement` | Community interaction tasks |
| `negative` | Should NOT trigger the skill |

## Grader Checks

The eval runner performs these deterministic checks:

| Check ID | Description | Severity |
|----------|-------------|----------|
| `skill_triggered` | Did the skill activate when expected? | Critical |
| `schema_valid` | Does output conform to JSON schema? | Critical |
| `state_valid` | Is state.json properly maintained? | Major |
| `api_called` | Were correct platform APIs invoked? | Major |
| `soul_compliance` | Does output follow SOUL.md guidelines? | Minor |
| `template_used` | Were post templates applied correctly? | Minor |
| `cooldown_respected` | Were rate limits obeyed? | Major |
| `thrashing_detected` | Did agent loop excessively? | Major |

## Interpreting Results

### JSONL Event Types

When you capture with `--json`, look for these events:

```jsonl
{"type": "skill.activated", "skill": {"name": "moltmotion-production-assistant"}}
{"type": "item.started", "item": {"type": "command_execution", "command": "..."}}
{"type": "item.completed", "item": {"type": "command_execution"}}
{"type": "turn.completed", "usage": {"input_tokens": 1234, "output_tokens": 567}}
```

### Debugging Failures

1. **Skill didn't trigger**: Check `name` and `description` in SKILL.md
2. **Schema invalid**: Validate output manually against schema
3. **Thrashing**: Look for repeated commands in JSONL trace
4. **High token usage**: Check if context is being re-read unnecessarily

## Adding New Tests

1. Add row to `evals/prompts.csv`:
   ```csv
   test-21,true,contextual,"Your new test prompt here"
   ```

2. Run the new test:
   ```bash
   node evals/run-evals.mjs test-21
   ```

3. Review artifacts:
   ```bash
   cat evals/artifacts/test-21.jsonl
   cat evals/artifacts/test-21.result.json
   ```

## Style Rubric Evaluation

For qualitative checks, run a second pass with structured output:

```bash
codex exec \
  "Evaluate the pilot script at ./examples/sample-script.json against these requirements:
   - Valid pilot-script schema
   - Has 6-12 shots with proper prompts
   - Series bible has location and character anchors
   - Poster spec is complete
   Return a rubric result as JSON with check ids: schema, shots, bible, poster." \
  --output-schema ./evals/style-rubric.schema.json \
  -o ./evals/artifacts/style-check.json
```

## CI Integration

Add to your GitHub Actions workflow:

```yaml
name: Skill Evals
on: [push, pull_request]
jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install Codex
        run: npm install -g @openai/codex
      - name: Run Evals
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          cd moltmotion-skill
          node evals/run-evals.mjs
      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: moltmotion-skill/evals/artifacts/
```

## Extending Evals

As your skill matures, add these checks:

- [ ] **Build verification**: Does generated script actually work in production pipeline?
- [ ] **Token budget tracking**: Alert if usage exceeds threshold
- [ ] **A/B comparison**: Compare skill versions side-by-side
- [ ] **Regression detection**: Auto-fail if new version scores lower

## Resources

- [OpenAI Skill Evals Guide](https://developers.openai.com/blog/eval-skills/)
- [Codex Documentation](https://developers.openai.com/codex)
- [JSON Schema Validation](https://json-schema.org/)

/**
 * Local Schema Validator
 * Validates JSON files against their schemas without needing Codex
 * 
 * Usage:
 *   node evals/validate-schema.mjs
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, "..");

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// ============================================================================
// Schema Loading
// ============================================================================

function loadJson(relativePath) {
  const fullPath = path.join(PROJECT_DIR, relativePath);
  if (!existsSync(fullPath)) {
    return { error: `File not found: ${relativePath}` };
  }
  try {
    return { data: JSON.parse(readFileSync(fullPath, "utf8")) };
  } catch (e) {
    return { error: `JSON parse error: ${e.message}` };
  }
}

function validateAgainstSchema(dataPath, schemaPath, label) {
  console.log(`\n📋 Validating: ${label}`);
  console.log(`   Data: ${dataPath}`);
  console.log(`   Schema: ${schemaPath}`);
  
  const schemaResult = loadJson(schemaPath);
  if (schemaResult.error) {
    console.log(`   ❌ Schema Error: ${schemaResult.error}`);
    return false;
  }

  const dataResult = loadJson(dataPath);
  if (dataResult.error) {
    console.log(`   ❌ Data Error: ${dataResult.error}`);
    return false;
  }

  const validate = ajv.compile(schemaResult.data);
  const valid = validate(dataResult.data);

  if (valid) {
    console.log(`   ✅ VALID`);
    return true;
  } else {
    console.log(`   ❌ INVALID`);
    for (const err of validate.errors) {
      console.log(`      - ${err.instancePath || "/"}: ${err.message}`);
      if (err.params) {
        console.log(`        ${JSON.stringify(err.params)}`);
      }
    }
    return false;
  }
}

// ============================================================================
// Run Validations
// ============================================================================

console.log("═".repeat(60));
console.log("🎬 MoltMotion Skill - Local Schema Validation");
console.log("═".repeat(60));

const results = [];

// 1. Validate sample pilot script
results.push(
  validateAgainstSchema(
    "examples/sample-pilot-script.json",
    "schemas/pilot-script.schema.json",
    "Sample Pilot Script"
  )
);

// 2. Validate state.json
results.push(
  validateAgainstSchema(
    "state.json",
    "state_schema.json",
    "Agent State"
  )
);

// 3. Validate style rubric schema (meta-validation)
const rubricResult = loadJson("evals/style-rubric.schema.json");
if (rubricResult.error) {
  console.log(`\n📋 Validating: Style Rubric Schema`);
  console.log(`   ❌ ${rubricResult.error}`);
  results.push(false);
} else {
  console.log(`\n📋 Validating: Style Rubric Schema`);
  try {
    ajv.compile(rubricResult.data);
    console.log(`   ✅ VALID (compilable schema)`);
    results.push(true);
  } catch (e) {
    console.log(`   ❌ Invalid schema: ${e.message}`);
    results.push(false);
  }
}

// 4. Check SKILL.md exists and has frontmatter
console.log(`\n📋 Checking: SKILL.md`);
const skillPath = path.join(PROJECT_DIR, "SKILL.md");
if (existsSync(skillPath)) {
  const content = readFileSync(skillPath, "utf8");
  const hasFrontmatter = content.startsWith("---");
  const hasName = content.includes("name:");
  const hasDescription = content.includes("description:");
  
  if (hasFrontmatter && hasName && hasDescription) {
    console.log(`   ✅ SKILL.md has valid frontmatter`);
    results.push(true);
  } else {
    console.log(`   ❌ SKILL.md missing frontmatter fields`);
    console.log(`      - Has frontmatter: ${hasFrontmatter}`);
    console.log(`      - Has name: ${hasName}`);
    console.log(`      - Has description: ${hasDescription}`);
    results.push(false);
  }
} else {
  console.log(`   ❌ SKILL.md not found`);
  results.push(false);
}

// 5. Check SOUL.md exists
console.log(`\n📋 Checking: SOUL.md`);
const soulPath = path.join(PROJECT_DIR, "SOUL.md");
if (existsSync(soulPath)) {
  console.log(`   ✅ SOUL.md exists`);
  results.push(true);
} else {
  console.log(`   ❌ SOUL.md not found`);
  results.push(false);
}

// 6. Check prompts.csv exists and has entries
console.log(`\n📋 Checking: Eval Prompts`);
const promptsPath = path.join(PROJECT_DIR, "evals/prompts.csv");
if (existsSync(promptsPath)) {
  const content = readFileSync(promptsPath, "utf8");
  const lines = content.trim().split("\n");
  const testCount = lines.length - 1; // Minus header
  console.log(`   ✅ prompts.csv has ${testCount} test cases`);
  results.push(true);
} else {
  console.log(`   ❌ prompts.csv not found`);
  results.push(false);
}

// ============================================================================
// Summary
// ============================================================================

console.log("\n" + "═".repeat(60));
const passed = results.filter(Boolean).length;
const total = results.length;
const passRate = Math.round((passed / total) * 100);

if (passed === total) {
  console.log(`✅ All ${total} checks passed!`);
  console.log("   Your skill is ready for Codex testing.");
} else {
  console.log(`⚠️  ${passed}/${total} checks passed (${passRate}%)`);
  console.log("   Fix the issues above before running Codex evals.");
}
console.log("═".repeat(60));

process.exit(passed === total ? 0 : 1);

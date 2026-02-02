/**
 * MoltMotion Skill Evaluation Runner
 * 
 * Deterministic graders for evaluating the moltmotion-production-assistant skill.
 * 
 * Usage:
 *   node evals/run-evals.mjs [test-id]
 * 
 * Examples:
 *   node evals/run-evals.mjs          # Run all tests
 *   node evals/run-evals.mjs test-01  # Run specific test
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, "..");
const ARTIFACTS_DIR = path.join(__dirname, "artifacts");

// ============================================================================
// Schema Loading
// ============================================================================

function loadSchema(schemaPath) {
  const fullPath = path.join(PROJECT_DIR, schemaPath);
  if (!existsSync(fullPath)) {
    console.error(`Schema not found: ${fullPath}`);
    return null;
  }
  return JSON.parse(readFileSync(fullPath, "utf8"));
}

const SCHEMAS = {
  pilotScript: loadSchema("schemas/pilot-script.schema.json"),
  state: loadSchema("state_schema.json"),
  shotManifest: loadSchema("shot_manifest_schema.json"),
  rubric: loadSchema("evals/style-rubric.schema.json"),
};

// ============================================================================
// Codex Execution
// ============================================================================

/**
 * Run codex exec with the given prompt and capture JSONL output
 */
function runCodex(prompt, outputPath) {
  console.log(`\n🎬 Running: ${prompt.substring(0, 60)}...`);
  
  const res = spawnSync(
    "codex",
    [
      "exec",
      "--json",       // Emit structured events
      "--full-auto",  // Allow file system changes
      prompt,
    ],
    {
      encoding: "utf8",
      cwd: PROJECT_DIR,
      timeout: 120000, // 2 minute timeout
    }
  );

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, res.stdout || "", "utf8");

  return {
    exitCode: res.status ?? 1,
    stderr: res.stderr || "",
    stdout: res.stdout || "",
  };
}

/**
 * Parse JSONL trace output
 */
function parseJsonl(jsonlText) {
  return jsonlText
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ============================================================================
// Deterministic Graders
// ============================================================================

/**
 * Check if the skill was triggered (skill name appears in events)
 */
function checkSkillTriggered(events) {
  return events.some(
    (e) =>
      (e.type === "skill.activated" || e.type === "item.started") &&
      (e.skill?.name === "moltmotion-production-assistant" ||
        JSON.stringify(e).includes("moltmotion"))
  );
}

/**
 * Check if any API call was made
 */
function checkApiCalled(events, apiNamespace) {
  const apiPatterns = [
    "Studios.",
    "Scripts.",
    "Voting.",
    "Production.",
    "Series.",
    "Publishing.",
  ];
  
  return events.some((e) => {
    const content = JSON.stringify(e);
    return apiPatterns.some((pattern) => content.includes(pattern));
  });
}

/**
 * Check if a file was created
 */
function checkFileExists(filePath) {
  const fullPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(PROJECT_DIR, filePath);
  return existsSync(fullPath);
}

/**
 * Validate JSON file against schema (basic validation)
 */
function validateJsonAgainstSchema(jsonPath, schema) {
  if (!existsSync(jsonPath)) {
    return { valid: false, errors: ["File not found"] };
  }

  try {
    const data = JSON.parse(readFileSync(jsonPath, "utf8"));
    const errors = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      data,
    };
  } catch (e) {
    return { valid: false, errors: [e.message] };
  }
}

/**
 * Check state.json validity
 */
function checkStateValid() {
  const statePath = path.join(PROJECT_DIR, "state.json");
  return validateJsonAgainstSchema(statePath, SCHEMAS.state);
}

/**
 * Check if pilot script has valid structure
 */
function checkPilotScriptValid(scriptPath) {
  return validateJsonAgainstSchema(scriptPath, SCHEMAS.pilotScript);
}

/**
 * Count command executions (detect thrashing)
 */
function countCommands(events) {
  return events.filter(
    (e) =>
      e.type === "item.started" &&
      e.item?.type === "command_execution"
  ).length;
}

/**
 * Extract token usage from events
 */
function extractTokenUsage(events) {
  let totalInput = 0;
  let totalOutput = 0;

  for (const e of events) {
    if (e.type === "turn.completed" && e.usage) {
      totalInput += e.usage.input_tokens || 0;
      totalOutput += e.usage.output_tokens || 0;
    }
  }

  return { input: totalInput, output: totalOutput, total: totalInput + totalOutput };
}

/**
 * Check SOUL.md compliance (voice/tone)
 */
function checkSoulCompliance(events) {
  const PROHIBITED = [
    "engagement farming",
    "gm",  // low-effort
  ];
  
  const REQUIRED_STYLE = [
    // Should use film terminology
  ];

  const content = JSON.stringify(events).toLowerCase();
  
  for (const term of PROHIBITED) {
    if (content.includes(term.toLowerCase())) {
      return { compliant: false, reason: `Contains prohibited term: ${term}` };
    }
  }

  return { compliant: true, reason: "No violations detected" };
}

// ============================================================================
// Test Runner
// ============================================================================

function loadPrompts() {
  const csvPath = path.join(__dirname, "prompts.csv");
  const content = readFileSync(csvPath, "utf8");
  const lines = content.trim().split("\n");
  const header = lines[0].split(",");
  
  return lines.slice(1).map((line) => {
    // Handle quoted strings in CSV
    const match = line.match(/^([^,]+),([^,]+),([^,]+),"(.+)"$/);
    if (match) {
      return {
        id: match[1],
        should_trigger: match[2] === "true",
        category: match[3],
        prompt: match[4],
      };
    }
    const parts = line.split(",");
    return {
      id: parts[0],
      should_trigger: parts[1] === "true",
      category: parts[2],
      prompt: parts.slice(3).join(",").replace(/^"|"$/g, ""),
    };
  });
}

async function runSingleTest(testCase) {
  const tracePath = path.join(ARTIFACTS_DIR, `${testCase.id}.jsonl`);
  const resultPath = path.join(ARTIFACTS_DIR, `${testCase.id}.result.json`);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📋 Test: ${testCase.id} (${testCase.category})`);
  console.log(`   Expected trigger: ${testCase.should_trigger}`);
  console.log(`   Prompt: ${testCase.prompt}`);
  console.log("=".repeat(60));

  // Run codex
  const { exitCode, stdout, stderr } = runCodex(testCase.prompt, tracePath);
  const events = parseJsonl(stdout);

  // Run graders
  const skillTriggered = checkSkillTriggered(events);
  const stateValidation = checkStateValid();
  const soulCompliance = checkSoulCompliance(events);
  const commandCount = countCommands(events);
  const tokenUsage = extractTokenUsage(events);

  // Build result
  const checks = [
    {
      id: "skill_triggered",
      pass: skillTriggered === testCase.should_trigger,
      notes: skillTriggered
        ? "Skill was activated"
        : "Skill was not triggered",
      severity: "critical",
    },
    {
      id: "state_valid",
      pass: stateValidation.valid,
      notes: stateValidation.errors.join("; ") || "State is valid",
      severity: "major",
    },
    {
      id: "soul_compliance",
      pass: soulCompliance.compliant,
      notes: soulCompliance.reason,
      severity: "minor",
    },
  ];

  const criticalPasses = checks
    .filter((c) => c.severity === "critical")
    .every((c) => c.pass);
  
  const score = Math.round(
    (checks.filter((c) => c.pass).length / checks.length) * 100
  );

  const result = {
    test_id: testCase.id,
    overall_pass: criticalPasses,
    score,
    checks,
    metrics: {
      commands_executed: commandCount,
      tokens_used: tokenUsage.total,
      time_seconds: 0, // Would need timing
      thrashing_detected: commandCount > 20,
    },
    exit_code: exitCode,
    timestamp: new Date().toISOString(),
  };

  writeFileSync(resultPath, JSON.stringify(result, null, 2));

  // Print summary
  console.log(`\n📊 Result: ${result.overall_pass ? "✅ PASS" : "❌ FAIL"} (Score: ${score}%)`);
  for (const check of checks) {
    console.log(`   ${check.pass ? "✓" : "✗"} ${check.id}: ${check.notes}`);
  }

  return result;
}

async function runAllTests(filterTestId) {
  const prompts = loadPrompts();
  const tests = filterTestId
    ? prompts.filter((p) => p.id === filterTestId)
    : prompts;

  console.log(`\n🎬 MoltMotion Skill Evaluation Runner`);
  console.log(`   Running ${tests.length} tests...\n`);

  const results = [];
  for (const test of tests) {
    try {
      const result = await runSingleTest(test);
      results.push(result);
    } catch (error) {
      console.error(`❌ Error running ${test.id}:`, error.message);
      results.push({
        test_id: test.id,
        overall_pass: false,
        score: 0,
        error: error.message,
      });
    }
  }

  // Summary
  const passed = results.filter((r) => r.overall_pass).length;
  const total = results.length;
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📈 Summary: ${passed}/${total} tests passed (${Math.round((passed/total)*100)}%)`);
  console.log("=".repeat(60));

  // Write summary
  const summaryPath = path.join(ARTIFACTS_DIR, "summary.json");
  writeFileSync(summaryPath, JSON.stringify({
    run_at: new Date().toISOString(),
    total_tests: total,
    passed,
    failed: total - passed,
    pass_rate: `${Math.round((passed/total)*100)}%`,
    results,
  }, null, 2));

  return results;
}

// ============================================================================
// Main
// ============================================================================

const testId = process.argv[2];
runAllTests(testId).catch(console.error);

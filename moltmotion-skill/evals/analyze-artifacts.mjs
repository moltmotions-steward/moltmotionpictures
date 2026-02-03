/**
 * Analyze MoltMotion eval artifacts to avoid "comma tweaking".
 *
 * Produces:
 *  - evals/artifacts/analysis.json
 *  - evals/artifacts/analysis.md
 *
 * Usage:
 *   node evals/analyze-artifacts.mjs
 *   node evals/analyze-artifacts.mjs --summary evals/artifacts/summary.json
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, "..");
const DEFAULT_SUMMARY = path.join(__dirname, "artifacts", "summary.json");
const DEFAULT_PROMPTS = path.join(__dirname, "prompts.csv");
const DEFAULT_ARTIFACTS_DIR = path.join(__dirname, "artifacts");

function parseArgs(argv) {
  const args = { summary: DEFAULT_SUMMARY };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--summary" && argv[i + 1]) {
      args.summary = path.resolve(PROJECT_DIR, argv[i + 1]);
      i++;
    }
  }
  return args;
}

function loadCsvPrompts(csvPath) {
  const content = readFileSync(csvPath, "utf8");
  const lines = content.trim().split("\n");

  return lines.slice(1).map((line) => {
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

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readJsonlEvents(filePath) {
  if (!existsSync(filePath)) return [];
  const text = readFileSync(filePath, "utf8");
  return text
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

function extractAgentMessages(events) {
  return events
    .filter((e) => e.type === "item.completed" && e.item?.type === "agent_message")
    .map((e) => e.item?.text)
    .filter(Boolean);
}

function extractCommands(events) {
  return events
    .filter((e) => e.type === "item.started" && e.item?.type === "command_execution")
    .map((e) => e.item?.command)
    .filter(Boolean);
}

function detectSkillSignal(events) {
  // Mirrors the updated eval harness heuristic.
  const activated = events.some(
    (e) => e.type === "skill.activated" && e.skill?.name === "moltmotion-production-assistant"
  );
  if (activated) return { triggered: true, method: "skill.activated" };

  const skillFileNeedles = [
    ".codex/skills/moltmotion-skill/SKILL.md",
    "moltmotion-skill/SKILL.md",
  ];
  const skillFrontMatterNeedles = [
    "name: moltmotion-production-assistant",
    "# Molt Motion Production Assistant",
  ];

  const readSkillFile = events.some((e) => {
    if (e?.type !== "item.started" && e?.type !== "item.completed") return false;
    const item = e.item;
    if (!item || item.type !== "command_execution") return false;
    const command = String(item.command || "");
    const output = String(item.aggregated_output || "");
    if (skillFileNeedles.some((n) => command.includes(n))) return true;
    return skillFrontMatterNeedles.every((needle) => output.includes(needle));
  });

  if (readSkillFile) return { triggered: true, method: "skill_file_read" };

  const messages = extractAgentMessages(events).join("\n").toLowerCase();
  const mentionsSkill = messages.includes("moltmotion-production-assistant");
  const claimsUsage =
    messages.includes("i’m using") ||
    messages.includes("i'm using") ||
    messages.includes("i am using") ||
    messages.includes("using the") ||
    messages.includes("using `");

  if (mentionsSkill && claimsUsage) return { triggered: true, method: "agent_message" };
  return { triggered: false, method: "none" };
}

const STOPWORDS = new Set(
  [
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "can",
    "cant",
    "can't",
    "create",
    "do",
    "does",
    "for",
    "from",
    "get",
    "how",
    "i",
    "i'm",
    "im",
    "in",
    "is",
    "it",
    "me",
    "my",
    "next",
    "of",
    "on",
    "or",
    "our",
    "please",
    "set",
    "setup",
    "sign",
    "so",
    "the",
    "their",
    "then",
    "this",
    "to",
    "up",
    "want",
    "what",
    "with",
    "whats",
    "what's",
    "why",
    "you",
    "your",
  ].map((s) => s.toLowerCase())
);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length >= 3)
    .filter((w) => !STOPWORDS.has(w));
}

function buildTfIdf(docsTokens) {
  const N = docsTokens.length;
  const df = new Map();

  for (const tokens of docsTokens) {
    const uniq = new Set(tokens);
    for (const t of uniq) df.set(t, (df.get(t) ?? 0) + 1);
  }

  const vocab = Array.from(df.entries())
    .filter(([, c]) => c >= 2) // ignore one-offs
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  const index = new Map(vocab.map((t, i) => [t, i]));

  const vectors = docsTokens.map((tokens) => {
    const tf = new Map();
    for (const t of tokens) {
      if (!index.has(t)) continue;
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }

    const vec = new Array(vocab.length).fill(0);
    const denom = tokens.length || 1;
    for (const [t, c] of tf.entries()) {
      const i = index.get(t);
      const idf = Math.log((N + 1) / ((df.get(t) ?? 0) + 1)) + 1;
      vec[i] = (c / denom) * idf;
    }

    // L2 normalize
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
    return vec.map((x) => x / norm);
  });

  return { vocab, vectors, df };
}

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function kmeans(vectors, k, iterations = 25) {
  if (vectors.length === 0) return { assignments: [], centroids: [] };
  const dim = vectors[0].length;

  // deterministic init: pick first k vectors
  const centroids = vectors.slice(0, k).map((v) => v.slice());
  const assignments = new Array(vectors.length).fill(0);

  for (let it = 0; it < iterations; it++) {
    let changed = false;

    // assign
    for (let i = 0; i < vectors.length; i++) {
      let best = 0;
      let bestScore = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const score = cosine(vectors[i], centroids[c]);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }

    // recompute
    const sums = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts = new Array(k).fill(0);

    for (let i = 0; i < vectors.length; i++) {
      const a = assignments[i];
      counts[a]++;
      const v = vectors[i];
      for (let d = 0; d < dim; d++) sums[a][d] += v[d];
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      for (let d = 0; d < dim; d++) sums[c][d] /= counts[c];
      // normalize
      const norm = Math.sqrt(sums[c].reduce((s, x) => s + x * x, 0)) || 1;
      centroids[c] = sums[c].map((x) => x / norm);
    }

    if (!changed) break;
  }

  return { assignments, centroids };
}

function topTermsForCluster(vocab, vectors, assignments, clusterId, topN = 8) {
  if (vocab.length === 0) return [];

  const idx = [];
  for (let i = 0; i < assignments.length; i++) {
    if (assignments[i] === clusterId) idx.push(i);
  }
  if (idx.length === 0) return [];

  const avg = new Array(vocab.length).fill(0);
  for (const i of idx) {
    for (let d = 0; d < vocab.length; d++) avg[d] += vectors[i][d];
  }
  for (let d = 0; d < vocab.length; d++) avg[d] /= idx.length;

  return avg
    .map((score, i) => ({ term: vocab[i], score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

function wordImpact(docsTokens, labels, minDf = 2) {
  const df = new Map();
  const presentIdx = new Map();

  for (let i = 0; i < docsTokens.length; i++) {
    const uniq = new Set(docsTokens[i]);
    for (const t of uniq) {
      df.set(t, (df.get(t) ?? 0) + 1);
      if (!presentIdx.has(t)) presentIdx.set(t, []);
      presentIdx.get(t).push(i);
    }
  }

  const overall = labels.filter(Boolean).length / (labels.length || 1);

  const rows = [];
  for (const [term, c] of df.entries()) {
    if (c < minDf) continue;
    const idxs = presentIdx.get(term) ?? [];
    const pass = idxs.filter((i) => labels[i]).length;
    const rate = pass / (idxs.length || 1);
    rows.push({ term, df: c, pass_rate: rate, delta: rate - overall });
  }

  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { overall_pass_rate: overall, rows };
}

function fmtPct(x) {
  return `${Math.round(x * 100)}%`;
}

function main() {
  const args = parseArgs(process.argv);
  const prompts = loadCsvPrompts(DEFAULT_PROMPTS);
  const summary = readJson(args.summary);

  const byId = new Map(prompts.map((p) => [p.id, p]));
  const rowsAll = summary.results.map((r) => {
    const p = byId.get(r.test_id);
    const trace = path.join(DEFAULT_ARTIFACTS_DIR, `${r.test_id}.jsonl`);
    const events = readJsonlEvents(trace);
    const messages = extractAgentMessages(events);
    const commands = extractCommands(events);
    const skill = detectSkillSignal(events);

    return {
      id: r.test_id,
      category: p?.category ?? "unknown",
      should_trigger: p?.should_trigger ?? null,
      prompt: p?.prompt ?? "",
      overall_pass: r.overall_pass,
      score: r.score,
      tokens_used: r.metrics?.tokens_used ?? null,
      commands_executed: r.metrics?.commands_executed ?? null,
      has_commands: commands.length > 0,
      skill_signal: skill.triggered,
      skill_signal_method: skill.method,
      first_message: messages[0] ?? "",
      infra_error: r.infra_error ?? null,
      skipped: Boolean(r.skipped),
    };
  });

  const infraCount = rowsAll.filter((r) => r.infra_error).length;
  const skippedCount = rowsAll.filter((r) => r.skipped).length;
  const rows = rowsAll.filter((r) => !r.infra_error && !r.skipped);

  // Basic tokenization for prompt analytics
  const docsTokens = rows.map((r) => tokenize(r.prompt));
  const passLabels = rows.map((r) => Boolean(r.overall_pass));
  const triggerLabels = rows.map((r) => Boolean(r.skill_signal));

  const tfidf = buildTfIdf(docsTokens);
  const k = Math.min(4, Math.max(1, rows.length));
  const km = kmeans(tfidf.vectors, k);

  const clusters = Array.from({ length: k }, (_, clusterId) => {
    const members = rows
      .map((r, i) => ({ r, i }))
      .filter((x) => km.assignments[x.i] === clusterId)
      .map((x) => x.r);

    const passRate = members.filter((m) => m.overall_pass).length / (members.length || 1);
    const triggerRate = members.filter((m) => m.skill_signal).length / (members.length || 1);

    return {
      cluster_id: clusterId,
      size: members.length,
      pass_rate: passRate,
      skill_signal_rate: triggerRate,
      top_terms: topTermsForCluster(tfidf.vocab, tfidf.vectors, km.assignments, clusterId, 10),
      members: members.map((m) => ({ id: m.id, category: m.category, pass: m.overall_pass })),
    };
  }).sort((a, b) => b.size - a.size);

  const impactPass = wordImpact(docsTokens, passLabels, 2);
  const impactTrigger = wordImpact(docsTokens, triggerLabels, 2);

  // Find likely "routing failures": no commands + no skill signal
  const routingFailures = rows
    .filter((r) => !r.has_commands && !r.skill_signal)
    .map((r) => ({ id: r.id, category: r.category, prompt: r.prompt, first_message: r.first_message }));

  const analysis = {
    generated_at: new Date().toISOString(),
    summary_path: path.relative(PROJECT_DIR, args.summary),
    overall: {
      total: rows.length,
      pass_rate: impactPass.overall_pass_rate,
      skill_signal_rate: rows.filter((r) => r.skill_signal).length / (rows.length || 1),
    },
    infra: {
      total_in_summary: rowsAll.length,
      infra_error_count: infraCount,
      skipped_count: skippedCount,
    },
    word_impact: {
      pass: {
        overall_pass_rate: impactPass.overall_pass_rate,
        top_positive: impactPass.rows.filter((r) => r.delta > 0).slice(0, 12),
        top_negative: impactPass.rows.filter((r) => r.delta < 0).slice(0, 12),
      },
      skill_signal: {
        overall_trigger_rate: impactTrigger.overall_pass_rate,
        top_positive: impactTrigger.rows.filter((r) => r.delta > 0).slice(0, 12),
        top_negative: impactTrigger.rows.filter((r) => r.delta < 0).slice(0, 12),
      },
    },
    clusters,
    routing_failures: routingFailures,
    rows,
    rows_all: rowsAll,
  };

  const outJson = path.join(DEFAULT_ARTIFACTS_DIR, "analysis.json");
  writeFileSync(outJson, JSON.stringify(analysis, null, 2));

  const md = [];
  md.push(`# Eval Analysis (prompt clustering + word impact)`);
  md.push("");
  md.push(`Generated: ${analysis.generated_at}`);
  md.push(`Summary: ${analysis.summary_path}`);
  md.push("");
  md.push(`## Overview`);
  md.push(`- Total tests: ${analysis.overall.total}`);
  md.push(`- Pass rate (critical-only): ${fmtPct(analysis.overall.pass_rate)}`);
  md.push(`- Skill-signal rate: ${fmtPct(analysis.overall.skill_signal_rate)}`);
  md.push("");

  md.push(`## Top prompt terms correlated with PASS`);
  md.push(`(Correlation, not causation — use for ablation ideas.)`);
  md.push("");
  const pos = analysis.word_impact.pass.top_positive;
  const neg = analysis.word_impact.pass.top_negative;
  md.push(`### Positive`);
  for (const r of pos) md.push(`- ${r.term}: df=${r.df}, pass=${fmtPct(r.pass_rate)} (Δ${fmtPct(r.delta)})`);
  md.push("");
  md.push(`### Negative`);
  for (const r of neg) md.push(`- ${r.term}: df=${r.df}, pass=${fmtPct(r.pass_rate)} (Δ${fmtPct(r.delta)})`);
  md.push("");

  md.push(`## Top prompt terms correlated with skill-signal`);
  md.push("");
  md.push(`### Positive`);
  for (const r of analysis.word_impact.skill_signal.top_positive) {
    md.push(`- ${r.term}: df=${r.df}, triggered=${fmtPct(r.pass_rate)} (Δ${fmtPct(r.delta)})`);
  }
  md.push("");
  md.push(`### Negative`);
  for (const r of analysis.word_impact.skill_signal.top_negative) {
    md.push(`- ${r.term}: df=${r.df}, triggered=${fmtPct(r.pass_rate)} (Δ${fmtPct(r.delta)})`);
  }
  md.push("");

  md.push(`## Semantic-ish clusters (TF-IDF + k-means)`);
  md.push("");
  for (const c of clusters) {
    md.push(`### Cluster ${c.cluster_id} (n=${c.size})`);
    md.push(`- Pass rate: ${fmtPct(c.pass_rate)}`);
    md.push(`- Skill-signal rate: ${fmtPct(c.skill_signal_rate)}`);
    md.push(`- Top terms: ${c.top_terms.map((t) => t.term).join(", ")}`);
    md.push(`- Members: ${c.members.map((m) => `${m.id}:${m.pass ? "P" : "F"}`).join(" ")}`);
    md.push("");
  }

  md.push(`## Likely routing failures (no commands + no skill-signal)`);
  md.push("");
  if (routingFailures.length === 0) {
    md.push(`- None detected.`);
  } else {
    for (const r of routingFailures) {
      md.push(`- ${r.id} (${r.category}): ${r.prompt}`);
    }
  }

  const outMd = path.join(DEFAULT_ARTIFACTS_DIR, "analysis.md");
  writeFileSync(outMd, md.join("\n"));

  console.log(`Wrote ${path.relative(PROJECT_DIR, outJson)}`);
  console.log(`Wrote ${path.relative(PROJECT_DIR, outMd)}`);
}

main();

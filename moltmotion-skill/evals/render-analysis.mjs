/**
 * Render `evals/artifacts/analysis.json` into an offline HTML dashboard.
 *
 * Usage:
 *   node evals/render-analysis.mjs
 *   node evals/render-analysis.mjs --in evals/artifacts/analysis.json --out evals/artifacts/analysis.html
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    inPath: path.join(__dirname, "artifacts", "analysis.json"),
    outPath: path.join(__dirname, "artifacts", "analysis.html"),
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in" && argv[i + 1]) {
      args.inPath = path.resolve(PROJECT_DIR, argv[i + 1]);
      i++;
    } else if (a === "--out" && argv[i + 1]) {
      args.outPath = path.resolve(PROJECT_DIR, argv[i + 1]);
      i++;
    }
  }

  return args;
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pct(x) {
  if (typeof x !== "number" || Number.isNaN(x)) return "–";
  return `${Math.round(x * 100)}%`;
}

function barChart({ title, subtitle, items, valueKey, labelKey, maxItems = 12 }) {
  const rows = (items || []).slice(0, maxItems);
  const maxAbs = Math.max(0.0001, ...rows.map((r) => Math.abs(r[valueKey] ?? 0)));

  const bars = rows
    .map((r) => {
      const v = r[valueKey] ?? 0;
      const w = Math.round((Math.abs(v) / maxAbs) * 100);
      const cls = v >= 0 ? "pos" : "neg";
      const label = esc(r[labelKey]);
      const extra =
        r.pass_rate != null
          ? `df=${r.df}, rate=${pct(r.pass_rate)}, Δ${pct(r.delta)}`
          : `df=${r.df}, Δ${pct(r.delta)}`;

      return `
        <div class="barrow">
          <div class="barlabel">${label}</div>
          <div class="barwrap">
            <div class="bar ${cls}" style="width:${w}%"></div>
          </div>
          <div class="barvalue">${esc(extra)}</div>
        </div>
      `;
    })
    .join("\n");

  return `
    <section class="card">
      <h2>${esc(title)}</h2>
      ${subtitle ? `<div class="muted">${esc(subtitle)}</div>` : ""}
      <div class="barchart">${bars || `<div class="muted">No data</div>`}</div>
    </section>
  `;
}

function clusterTable(clusters) {
  const rows = (clusters || [])
    .map((c) => {
      const top = (c.top_terms || []).map((t) => t.term).join(", ");
      const members = (c.members || []).map((m) => `${m.id}:${m.pass ? "P" : "F"}`).join(" ");
      return `
        <tr>
          <td>${esc(c.cluster_id)}</td>
          <td>${esc(c.size)}</td>
          <td>${esc(pct(c.pass_rate))}</td>
          <td>${esc(pct(c.skill_signal_rate))}</td>
          <td class="mono">${esc(top)}</td>
          <td class="mono">${esc(members)}</td>
        </tr>
      `;
    })
    .join("\n");

  return `
    <section class="card">
      <h2>Clusters</h2>
      <div class="muted">TF‑IDF + k‑means. Use this to spot groups of prompts that fail together.</div>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Cluster</th>
              <th>n</th>
              <th>Pass</th>
              <th>Skill signal</th>
              <th>Top terms</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="6" class="muted">No clusters</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function routingFailuresList(items) {
  const rows = (items || [])
    .map((r) => `<li><span class="mono">${esc(r.id)}</span> <span class="muted">(${esc(r.category)})</span> — ${esc(r.prompt)}</li>`)
    .join("\n");

  return `
    <section class="card">
      <h2>Likely routing failures</h2>
      <div class="muted">Heuristic: no commands + no skill signal. These often indicate the model treated the prompt as generic (not Molt Motion onboarding).</div>
      <ul>
        ${rows || `<li class="muted">None detected.</li>`}
      </ul>
    </section>
  `;
}

function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(args.inPath)) {
    console.error(`Missing input: ${args.inPath}`);
    process.exit(1);
  }

  const analysis = JSON.parse(readFileSync(args.inPath, "utf8"));

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MoltMotion Eval Dashboard</title>
  <style>
    :root {
      --bg: #0b1020;
      --card: #101a33;
      --text: #e8edf7;
      --muted: #9fb0d0;
      --grid: rgba(255,255,255,0.08);
      --pos: #4ade80;
      --neg: #fb7185;
      --barbg: rgba(255,255,255,0.06);
    }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: var(--bg); color: var(--text); }
    header { padding: 18px 20px; border-bottom: 1px solid var(--grid); }
    header h1 { margin: 0 0 6px 0; font-size: 18px; }
    header .muted { font-size: 13px; }
    main { padding: 18px 20px; display: grid; grid-template-columns: 1fr; gap: 14px; max-width: 1180px; margin: 0 auto; }
    .row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    @media (max-width: 900px) { .row { grid-template-columns: 1fr; } }
    .card { background: var(--card); border: 1px solid var(--grid); border-radius: 12px; padding: 14px 14px; }
    .card h2 { margin: 0 0 8px 0; font-size: 14px; }
    .muted { color: var(--muted); }
    .kpi { font-size: 26px; margin-top: 2px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 12px; }

    .barchart { display: grid; gap: 8px; margin-top: 10px; }
    .barrow { display: grid; grid-template-columns: 160px 1fr 240px; gap: 10px; align-items: center; }
    @media (max-width: 900px) { .barrow { grid-template-columns: 1fr; } }
    .barlabel { font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .barwrap { background: var(--barbg); border: 1px solid var(--grid); border-radius: 8px; height: 10px; overflow: hidden; }
    .bar { height: 100%; }
    .bar.pos { background: var(--pos); }
    .bar.neg { background: var(--neg); }
    .barvalue { font-size: 12px; color: var(--muted); }

    .tablewrap { overflow-x: auto; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid var(--grid); padding: 8px 8px; text-align: left; vertical-align: top; font-size: 12px; }
    th { color: var(--muted); font-weight: 600; }
    ul { margin: 10px 0 0 18px; padding: 0; }
    li { margin: 6px 0; font-size: 12px; }

    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--grid); background: rgba(255,255,255,0.03); font-size: 12px; color: var(--muted); }
  </style>
</head>
<body>
  <header>
    <h1>MoltMotion Eval Dashboard</h1>
    <div class="muted">
      Generated: ${esc(analysis.generated_at)} &nbsp;•&nbsp;
      Summary: <span class="mono">${esc(analysis.summary_path)}</span>
    </div>
  </header>

  <main>
    <div class="row">
      <section class="card">
        <div class="pill">Critical-only pass rate</div>
        <div class="kpi">${esc(pct(analysis.overall?.pass_rate))}</div>
        <div class="muted">Matches overall_pass in summary results.</div>
      </section>
      <section class="card">
        <div class="pill">Skill signal rate</div>
        <div class="kpi">${esc(pct(analysis.overall?.skill_signal_rate))}</div>
        <div class="muted">Heuristic signal from JSONL (not perfect).</div>
      </section>
      <section class="card">
        <div class="pill">Total tests</div>
        <div class="kpi">${esc(analysis.overall?.total ?? "–")}</div>
        <div class="muted">From analysis rows.</div>
      </section>
    </div>

    ${barChart({
      title: "Terms correlated with PASS (positive)",
      subtitle: "Correlation ≠ causation. Use for ablation ideas.",
      items: analysis.word_impact?.pass?.top_positive ?? [],
      valueKey: "delta",
      labelKey: "term",
    })}

    ${barChart({
      title: "Terms correlated with PASS (negative)",
      subtitle: "These terms show up more in FAILs.",
      items: analysis.word_impact?.pass?.top_negative ?? [],
      valueKey: "delta",
      labelKey: "term",
    })}

    ${barChart({
      title: "Terms correlated with Skill signal (positive)",
      subtitle: "Which words tend to get the model to take the MoltMotion route.",
      items: analysis.word_impact?.skill_signal?.top_positive ?? [],
      valueKey: "delta",
      labelKey: "term",
    })}

    ${barChart({
      title: "Terms correlated with Skill signal (negative)",
      subtitle: "Words that correlate with not routing into the skill.",
      items: analysis.word_impact?.skill_signal?.top_negative ?? [],
      valueKey: "delta",
      labelKey: "term",
    })}

    ${clusterTable(analysis.clusters)}

    ${routingFailuresList(analysis.routing_failures)}

    <section class="card">
      <h2>How to use this</h2>
      <div class="muted">
        Pick one failing cluster → create 3 A/B variants that change exactly one phrase → rerun just those tests.
        The goal is to find stable “anchor phrases” that force correct routing without making negatives trigger.
      </div>
    </section>
  </main>
</body>
</html>`;

  writeFileSync(args.outPath, html, "utf8");
  console.log(`Wrote ${path.relative(PROJECT_DIR, args.outPath)}`);
}

main();

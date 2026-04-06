#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

import { loadEnv } from "./src/config/env.js";
import { DEBATER_STYLES, TOPICS } from "./src/config/content.js";
import { runDebate } from "./src/debate/engine.js";
import { getAvailableProviders } from "./src/providers/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv();

// ─── Config loading ──────────────────────────────────────
const configPath = process.argv[2] || "config/tournaments/anthropic-vs-openai.yaml";
let tournamentConfig;

try {
  const raw = readFileSync(join(__dirname, configPath), "utf-8");
  tournamentConfig = yaml.load(raw);
  console.log(`\n📋 Tournament: ${tournamentConfig.name}`);
  console.log(`   ${tournamentConfig.description}\n`);
} catch (err) {
  console.error(`Failed to load tournament config: ${configPath}`);
  console.error(err.message);
  process.exit(1);
}

// ─── Validate providers ──────────────────────────────────
const available = getAvailableProviders();
console.log(`✓ Available providers: ${available.join(", ")}`);
if (available.length === 0) {
  console.error("No API keys found. Set ANTHROPIC_API_KEY and/or OPENAI_API_KEY.");
  process.exit(1);
}

// ─── Build matchup list ──────────────────────────────────
function buildMatchups() {
  const topics = (tournamentConfig.topics || ["ai-regulation"])
    .map(id => TOPICS.find(t => t.id === id))
    .filter(Boolean);

  if (tournamentConfig.matchups) {
    return tournamentConfig.matchups.flatMap(m =>
      topics.map(topic => ({
        name: m.name,
        topic,
        a: { model: m.a.model, label: m.a.label, style: tournamentConfig.style || "analytical" },
        b: { model: m.b.model, label: m.b.label, style: tournamentConfig.style || "analytical" },
      }))
    );
  }

  if (tournamentConfig.style === "all") {
    const model = tournamentConfig.model;
    const styleKeys = Object.keys(DEBATER_STYLES);
    const matchups = [];
    for (let i = 0; i < styleKeys.length; i++) {
      for (let j = i + 1; j < styleKeys.length; j++) {
        for (const topic of topics) {
          matchups.push({
            name: `${DEBATER_STYLES[styleKeys[i]].name} vs ${DEBATER_STYLES[styleKeys[j]].name}`,
            topic,
            a: { model, label: DEBATER_STYLES[styleKeys[i]].name, style: styleKeys[i] },
            b: { model, label: DEBATER_STYLES[styleKeys[j]].name, style: styleKeys[j] },
          });
        }
      }
    }
    return matchups;
  }

  return [];
}

// ─── Run tournament ──────────────────────────────────────
async function run() {
  const matchups = buildMatchups();
  console.log(`\n⚔️  ${matchups.length} matchups to run\n`);

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < matchups.length; i++) {
    const m = matchups[i];
    const progress = `[${i + 1}/${matchups.length}]`;
    console.log(`${progress} ${m.a.label} vs ${m.b.label} — "${m.topic.title.slice(0, 50)}"`);

    try {
      const noopCallbacks = {
        onRoundStart: () => {}, onDebaterStart: () => {}, onToken: () => {},
        onDebaterDone: () => {}, onJudge: () => {}, onAnalysis: () => {},
        onComplete: () => {}, onError: (e) => { throw e; },
      };

      const result = await runDebate(null, {
        topic: m.topic,
        debaterA: { style: m.a.style, model: m.a.model },
        debaterB: { style: m.b.style, model: m.b.model },
        callbacks: noopCallbacks,
      });

      const diff = result.totalA - result.totalB;
      const winner = result.winner === "A" ? m.a.label : m.b.label;
      console.log(`  → ${winner} wins (${result.totalA}-${result.totalB}, diff: ${diff > 0 ? "+" : ""}${diff})\n`);

      results.push({
        matchup: m.name, topic: m.topic.title,
        aLabel: m.a.label, bLabel: m.b.label,
        aModel: m.a.model, bModel: m.b.model,
        totalA: result.totalA, totalB: result.totalB,
        diff, winner: result.winner, winnerLabel: winner,
        rounds: result.rounds || [], analysis: result.analysis || null,
      });
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}\n`);
      results.push({ matchup: m.name, topic: m.topic.title, aLabel: m.a.label, bLabel: m.b.label, error: err.message });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✓ Tournament complete in ${elapsed}s`);

  // ─── Aggregate ───────────────────────────────────────
  const standings = {};
  const validResults = results.filter(r => !r.error);

  for (const r of validResults) {
    if (!standings[r.aLabel]) standings[r.aLabel] = { wins: 0, losses: 0, totalDiff: 0, model: r.aModel };
    if (!standings[r.bLabel]) standings[r.bLabel] = { wins: 0, losses: 0, totalDiff: 0, model: r.bModel };
    if (r.winner === "A") { standings[r.aLabel].wins++; standings[r.bLabel].losses++; }
    else { standings[r.bLabel].wins++; standings[r.aLabel].losses++; }
    standings[r.aLabel].totalDiff += r.diff;
    standings[r.bLabel].totalDiff -= r.diff;
  }

  // ─── Console ─────────────────────────────────────────
  console.log("\n═══════════════════════════════════════");
  console.log(`  ${tournamentConfig.name} — RESULTS`);
  console.log("═══════════════════════════════════════\n");

  const sorted = Object.entries(standings).sort((a, b) => b[1].totalDiff - a[1].totalDiff);
  sorted.forEach(([label, s], i) => {
    const wr = s.wins + s.losses > 0 ? ((s.wins / (s.wins + s.losses)) * 100).toFixed(0) : 0;
    console.log(`  ${i + 1}. ${label.padEnd(16)} ${s.wins}W/${s.losses}L (${wr}%)  net: ${s.totalDiff > 0 ? "+" : ""}${s.totalDiff}`);
  });

  // ─── HTML Report ─────────────────────────────────────
  const html = generateReport(tournamentConfig, results, standings, sorted, elapsed);
  mkdirSync(join(__dirname, "reports"), { recursive: true });
  const ts = new Date().toISOString().slice(0, 10) + "_" + Date.now().toString(36);
  writeFileSync(join(__dirname, "reports", `tournament_${ts}.html`), html);
  writeFileSync(join(__dirname, "reports", `tournament_${ts}.json`), JSON.stringify({ config: tournamentConfig, results, standings }, null, 2));
  console.log(`\n📊 Report: reports/tournament_${ts}.html`);
}

// ─── HTML Report ─────────────────────────────────────────
function generateReport(config, results, standings, sorted, elapsed) {
  const valid = results.filter(r => !r.error);
  const labels = sorted.map(([l]) => l);

  // Heatmap
  const hm = {};
  for (const l of labels) hm[l] = {};
  for (const r of valid) {
    if (!hm[r.aLabel][r.bLabel]) hm[r.aLabel][r.bLabel] = [];
    if (!hm[r.bLabel][r.aLabel]) hm[r.bLabel][r.aLabel] = [];
    hm[r.aLabel][r.bLabel].push(r.diff);
    hm[r.bLabel][r.aLabel].push(-r.diff);
  }
  const avg = a => a?.length ? (a.reduce((s, v) => s + v, 0) / a.length).toFixed(1) : "—";
  const cc = v => {
    if (v === "—") return "#1a1a2a";
    const n = parseFloat(v);
    if (n > 5) return "rgba(107,203,119,0.35)";
    if (n > 0) return "rgba(107,203,119,0.15)";
    if (n < -5) return "rgba(255,107,107,0.35)";
    if (n < 0) return "rgba(255,107,107,0.15)";
    return "#1a1a2a";
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${config.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0f;color:#e0e0e0;padding:32px;line-height:1.5}
h1{font-size:28px;font-weight:800;background:linear-gradient(135deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
h2{font-size:16px;color:#888;margin:28px 0 10px;border-bottom:1px solid #222;padding-bottom:4px}
.meta{color:#555;font-size:12px;margin-bottom:20px}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:11px}
th{background:#1a1a2a;color:#888;padding:6px 8px;text-align:left;font-weight:600;text-transform:uppercase;font-size:9px;letter-spacing:.5px}
td{padding:5px 8px;border-bottom:1px solid #151520}
tr:hover{background:rgba(255,255,255,.02)}
.card{background:#12121a;border:1px solid #222;border-radius:10px;padding:16px;margin:12px 0}
.win{color:#6bcb77} .loss{color:#ff6b6b} .draw{color:#888}
details summary{cursor:pointer;padding:6px 0;color:#4d96ff;font-size:11px}
details summary:hover{text-decoration:underline}
.transcript{font-size:11px;line-height:1.6;color:#999;padding:8px 12px;background:#0a0a14;border-radius:6px;margin:6px 0;white-space:pre-wrap}
.provider-a{border-left:3px solid #ff6b6b;padding-left:8px;margin:4px 0}
.provider-b{border-left:3px solid #4d96ff;padding-left:8px;margin:4px 0}
</style></head><body>
<h1>${config.name}</h1>
<div class="meta">${config.description} — ${valid.length} matchups completed in ${elapsed}s</div>

<h2>Rankings</h2>
<div class="card"><table>
<tr><th>#</th><th>Debater</th><th>Model</th><th>Record</th><th>Win%</th><th>Net Diff</th><th>Strength</th></tr>
${sorted.map(([l, s], i) => {
  const wr = s.wins + s.losses > 0 ? ((s.wins / (s.wins + s.losses)) * 100).toFixed(0) : 0;
  const bar = Math.max(4, Math.min(120, Math.abs(s.totalDiff) * 2));
  const bc = s.totalDiff > 0 ? "#6bcb77" : s.totalDiff < 0 ? "#ff6b6b" : "#555";
  return `<tr><td style="font-weight:700">${i+1}</td><td style="font-weight:600">${l}</td><td style="color:#555">${s.model}</td><td>${s.wins}W/${s.losses}L</td><td>${wr}%</td><td style="color:${bc};font-weight:600">${s.totalDiff > 0 ? "+" : ""}${s.totalDiff}</td><td><div style="width:${bar}px;height:12px;background:${bc};border-radius:2px;display:inline-block"></div></td></tr>`;
}).join("")}
</table></div>

<h2>Head-to-Head</h2>
<div class="card" style="overflow-x:auto"><table>
<tr><th></th>${labels.map(l => `<th style="font-size:9px;padding:4px;text-align:center">${l}</th>`).join("")}</tr>
${labels.map(row => `<tr><td style="font-weight:600;white-space:nowrap">${row}</td>${labels.map(col => {
  if (row === col) return `<td style="background:#0a0a14;text-align:center;color:#333">—</td>`;
  const v = avg(hm[row]?.[col]);
  const c = cc(v);
  return `<td style="background:${c};text-align:center;font-weight:600">${v !== "—" ? (parseFloat(v) > 0 ? "+" + v : v) : "—"}</td>`;
}).join("")}</tr>`).join("")}
</table>
<div style="font-size:9px;color:#444;margin-top:6px">Positive = row wins. Average diff across topics.</div>
</div>

<h2>All Matchups</h2>
<div class="card"><table>
<tr><th>A</th><th>B</th><th>Topic</th><th>Winner</th><th>Score</th><th>Diff</th></tr>
${valid.map(r => `<tr>
<td>${r.aLabel}</td><td>${r.bLabel}</td>
<td style="color:#555">${r.topic.length > 45 ? r.topic.slice(0, 42) + "..." : r.topic}</td>
<td class="${r.winner === 'A' ? 'win' : 'loss'}">${r.winnerLabel}</td>
<td>${r.totalA}–${r.totalB}</td>
<td style="color:${r.diff > 0 ? '#6bcb77' : '#ff6b6b'};font-weight:600">${r.diff > 0 ? "+" : ""}${r.diff}</td>
</tr>`).join("")}
</table></div>

<div style="text-align:center;color:#222;font-size:10px;margin-top:28px">Debate Arena v1.0.0 — ${new Date().toISOString().slice(0, 19)}</div>
</body></html>`;
}

run().catch(err => { console.error("Tournament failed:", err.message); process.exit(1); });

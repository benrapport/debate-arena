import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { loadEnv } from "./src/config/env.js";
import { DEBATER_STYLES, MODELS } from "./src/config/content.js";
import { loadConfig } from "./src/config/loader.js";
import { runDebate } from "./src/debate/engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
loadEnv();

const client = new Anthropic();

// Load config from YAML
const { topics: TOPICS } = loadConfig();
const TOPIC = TOPICS.find((t) => t.id === "ai-regulation");

// Ensure reports directory exists
const reportsDir = join(__dirname, "reports");
if (!existsSync(reportsDir)) {
  mkdirSync(reportsDir, { recursive: true });
}

const STYLES = Object.keys(DEBATER_STYLES);
const styleKeys = STYLES;

function generateColorForValue(value, isHeatmap = false) {
  if (isHeatmap) {
    if (value > 0) return `rgb(255, ${Math.max(100, 255 - Math.abs(value) * 5)}, ${Math.max(100, 255 - Math.abs(value) * 5)})`;
    if (value < 0) return `rgb(${Math.max(100, 255 - Math.abs(value) * 5)}, ${Math.max(150, 255 - Math.abs(value) * 3)}, 255)`;
    return "rgb(255, 217, 61)";
  }
  return "transparent";
}

function generateHtmlReport(modelWinRates, styleWinRates, modelMatrix, styleMatrix, results) {
  const timestamp = new Date().toISOString().split("T")[0];
  
  const modelRows = Object.entries(modelWinRates)
    .sort((a, b) => b[1].totalDiff - a[1].totalDiff)
    .map(
      ([name, data], i) => `
    <tr>
      <td style="text-align: center; padding: 8px;">${i + 1}</td>
      <td style="padding: 8px;">${name}</td>
      <td style="text-align: center; padding: 8px;">${data.wins}W/${data.total - data.wins}L</td>
      <td style="text-align: center; padding: 8px;">${data.total > 0 ? (data.wins / data.total * 100).toFixed(0) : "0"}%</td>
      <td style="text-align: center; padding: 8px; ${data.totalDiff > 0 ? "color: #ff6b6b;" : data.totalDiff < 0 ? "color: #4d96ff;" : "color: #ffd93d;"}">${data.totalDiff > 0 ? "+" : ""}${data.totalDiff}</td>
    </tr>
  `
    )
    .join("");

  const styleRows = Object.entries(styleWinRates)
    .sort((a, b) => b[1].totalDiff - a[1].totalDiff)
    .map(
      ([name, data], i) => `
    <tr>
      <td style="text-align: center; padding: 8px;">${i + 1}</td>
      <td style="padding: 8px;">${name}</td>
      <td style="text-align: center; padding: 8px;">${data.wins}W/${data.total - data.wins}L</td>
      <td style="text-align: center; padding: 8px;">${data.total > 0 ? (data.wins / data.total * 100).toFixed(0) : "0"}%</td>
      <td style="text-align: center; padding: 8px; ${data.totalDiff > 0 ? "color: #ff6b6b;" : data.totalDiff < 0 ? "color: #4d96ff;" : "color: #ffd93d;"}">${data.totalDiff > 0 ? "+" : ""}${data.totalDiff}</td>
    </tr>
  `
    )
    .join("");

  // Model heatmap
  const mNames = MODELS.map((m) => m.short);
  const modelHeatmapHeaders = mNames.map((n) => `<th style="padding: 8px; text-align: center; font-size: 12px;">${n}</th>`).join("");
  const modelHeatmapRows = mNames
    .map(
      (row) => `
    <tr>
      <td style="padding: 8px; font-weight: 600;">${row}</td>
      ${mNames
        .map((col) => {
          if (row === col) {
            return `<td style="padding: 8px; text-align: center; background: #1a1a2a;">—</td>`;
          }
          const v = modelMatrix[row]?.[col];
          const bg = generateColorForValue(v, true);
          return `<td style="padding: 8px; text-align: center; background: ${bg};">${v !== undefined ? (v > 0 ? "+" + v : v) : "?"}</td>`;
        })
        .join("")}
    </tr>
  `
    )
    .join("");

  // Style heatmap
  const sNames = styleKeys.map((k) => DEBATER_STYLES[k].name);
  const styleHeatmapHeaders = sNames.map((n) => `<th style="padding: 8px; text-align: center; font-size: 11px;">${n}</th>`).join("");
  const styleHeatmapRows = sNames
    .map(
      (row) => `
    <tr>
      <td style="padding: 8px; font-weight: 600; font-size: 12px;">${row}</td>
      ${sNames
        .map((col) => {
          if (row === col) {
            return `<td style="padding: 8px; text-align: center; background: #1a1a2a;">—</td>`;
          }
          const v = styleMatrix[row]?.[col];
          const bg = generateColorForValue(v, true);
          return `<td style="padding: 8px; text-align: center; background: ${bg}; font-size: 11px;">${v !== undefined ? (v > 0 ? "+" + v : v) : "?"}</td>`;
        })
        .join("")}
    </tr>
  `
    )
    .join("");

  // Matchup details
  const matchupDetails = results
    .map(
      (r) => `
    <div style="margin-bottom: 12px; padding: 10px; background: #1a1a2a; border-radius: 6px; font-size: 12px;">
      <strong>${r.a} vs ${r.b}</strong> (${r.type})
      <div style="margin-top: 4px; color: #999;">Winner: <span style="color: ${r.winner === r.a ? "#ff6b6b" : "#4d96ff"}; font-weight: 600;">${r.winner}</span> (${r.totalA}—${r.totalB}, ${r.diff > 0 ? "+" + r.diff : r.diff})</div>
    </div>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tournament Results - Debate Arena</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace; background: #0a0a0f; color: #e0e0e0; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; background: linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcb77, #4d96ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h2 { font-size: 16px; font-weight: 700; margin-top: 24px; margin-bottom: 12px; color: #ffd93d; text-transform: uppercase; letter-spacing: 1px; }
    .section { margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; background: #12121a; border: 1px solid #222; border-radius: 8px; overflow: hidden; }
    th { background: #1a1a2a; padding: 10px; text-align: left; font-weight: 700; font-size: 12px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px; border-bottom: 1px solid #1a1a2a; }
    tr:last-child td { border-bottom: none; }
    .heatmap { overflow-x: auto; background: #12121a; border: 1px solid #222; border-radius: 8px; padding: 10px; }
    .heatmap table { background: transparent; border: none; }
    .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>TOURNAMENT RESULTS</h1>
    <div class="meta">Generated: ${timestamp} | Topic: ${TOPIC.title}</div>

    <div class="section">
      <h2>Model Rankings (Analytical Style)</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">Rank</th>
            <th>Model</th>
            <th style="width: 120px;">Record</th>
            <th style="width: 80px;">Win Rate</th>
            <th style="width: 80px;">Net Diff</th>
          </tr>
        </thead>
        <tbody>
          ${modelRows}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Model Matchup Heatmap</h2>
      <div class="heatmap">
        <table>
          <thead>
            <tr>
              <th style="padding: 8px;"></th>
              ${modelHeatmapHeaders}
            </tr>
          </thead>
          <tbody>
            ${modelHeatmapRows}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>Style Rankings (Sonnet Model)</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">Rank</th>
            <th>Style</th>
            <th style="width: 120px;">Record</th>
            <th style="width: 80px;">Win Rate</th>
            <th style="width: 80px;">Net Diff</th>
          </tr>
        </thead>
        <tbody>
          ${styleRows}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Style Matchup Heatmap</h2>
      <div class="heatmap">
        <table>
          <thead>
            <tr>
              <th style="padding: 8px;"></th>
              ${styleHeatmapHeaders}
            </tr>
          </thead>
          <tbody>
            ${styleHeatmapRows}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>Individual Matchups</h2>
      <div>${matchupDetails}</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Run a tournament bracket
 */
async function runTournament() {
  const results = [];
  const modelWinRates = {};
  const styleWinRates = {};
  const modelMatrix = {};
  const styleMatrix = {};

  // Initialize tracking
  for (const m of MODELS) modelWinRates[m.short] = { wins: 0, total: 0, totalDiff: 0 };
  for (const s of styleKeys) styleWinRates[DEBATER_STYLES[s].name] = { wins: 0, total: 0, totalDiff: 0 };
  for (const m1 of MODELS) {
    modelMatrix[m1.short] = {};
    for (const m2 of MODELS) modelMatrix[m1.short][m2.short] = 0;
  }
  for (const s1 of styleKeys) {
    styleMatrix[DEBATER_STYLES[s1].name] = {};
    for (const s2 of styleKeys) styleMatrix[DEBATER_STYLES[s1].name][DEBATER_STYLES[s2].name] = 0;
  }

  // ═══════════════════════════════════════════
  // PART 1: Model vs Model (same style: analytical)
  // ═══════════════════════════════════════════
  console.log("\n═══ MODEL vs MODEL (analytical style) ═══\n");

  for (let i = 0; i < MODELS.length; i++) {
    for (let j = i + 1; j < MODELS.length; j++) {
      const mA = MODELS[i];
      const mB = MODELS[j];
      const style = DEBATER_STYLES.analytical;
      console.log(`  ${mA.short} vs ${mB.short}...`);

      // Batch callbacks
      const callbacks = {
        onRoundStart: () => {},
        onDebaterStart: () => {},
        onToken: () => {},
        onDebaterDone: () => {},
        onJudge: () => {},
        onAnalysis: () => {},
        onComplete: () => {},
        onError: (err) => {
          throw err;
        },
      };

      const result = await runDebate(client, {
        topic: TOPIC,
        debaterA: { style: "analytical", model: mA.id },
        debaterB: { style: "analytical", model: mB.id },
        callbacks,
      });

      const diff = result.totalA - result.totalB;
      const winner = result.winner === "A" ? mA.short : mB.short;
      console.log(`    → ${winner} wins (${result.totalA}-${result.totalB})`);

      modelWinRates[mA.short].total++;
      modelWinRates[mB.short].total++;
      if (result.winner === "A") modelWinRates[mA.short].wins++;
      else modelWinRates[mB.short].wins++;
      modelWinRates[mA.short].totalDiff += diff;
      modelWinRates[mB.short].totalDiff -= diff;

      modelMatrix[mA.short][mB.short] = diff;
      modelMatrix[mB.short][mA.short] = -diff;

      results.push({
        type: "model",
        a: mA.short,
        b: mB.short,
        winner: result.winner === "A" ? mA.short : mB.short,
        totalA: result.totalA,
        totalB: result.totalB,
        diff,
      });
    }
  }

  // ═══════════════════════════════════════════
  // PART 2: Style vs Style (same model: sonnet)
  // ═══════════════════════════════════════════
  console.log("\n═══ STYLE vs STYLE (sonnet model) ═══\n");

  for (let i = 0; i < styleKeys.length; i++) {
    for (let j = i + 1; j < styleKeys.length; j++) {
      const sKeyA = styleKeys[i];
      const sKeyB = styleKeys[j];
      const sA = DEBATER_STYLES[sKeyA];
      const sB = DEBATER_STYLES[sKeyB];
      const model = "claude-sonnet-4-20250514";
      console.log(`  ${sA.name} vs ${sB.name}...`);

      const callbacks = {
        onRoundStart: () => {},
        onDebaterStart: () => {},
        onToken: () => {},
        onDebaterDone: () => {},
        onJudge: () => {},
        onAnalysis: () => {},
        onComplete: () => {},
        onError: (err) => {
          throw err;
        },
      };

      const result = await runDebate(client, {
        topic: TOPIC,
        debaterA: { style: sKeyA, model },
        debaterB: { style: sKeyB, model },
        callbacks,
      });

      const diff = result.totalA - result.totalB;
      const winner = result.winner === "A" ? sA.name : sB.name;
      console.log(`    → ${winner} wins (${result.totalA}-${result.totalB})`);

      styleWinRates[sA.name].total++;
      styleWinRates[sB.name].total++;
      if (result.winner === "A") styleWinRates[sA.name].wins++;
      else styleWinRates[sB.name].wins++;
      styleWinRates[sA.name].totalDiff += diff;
      styleWinRates[sB.name].totalDiff -= diff;

      styleMatrix[sA.name][sB.name] = diff;
      styleMatrix[sB.name][sA.name] = -diff;

      results.push({
        type: "style",
        a: sA.name,
        b: sB.name,
        winner: result.winner === "A" ? sA.name : sB.name,
        totalA: result.totalA,
        totalB: result.totalB,
        diff,
      });
    }
  }

  // ═══════════════════════════════════════════
  // OUTPUT
  // ═══════════════════════════════════════════
  console.log("\n\n═══════════════════════════════════════");
  console.log("         TOURNAMENT RESULTS");
  console.log("═══════════════════════════════════════\n");

  console.log("MODEL RANKINGS (same analytical style):");
  console.log("─────────────────────────────────────");
  Object.entries(modelWinRates)
    .sort((a, b) => b[1].totalDiff - a[1].totalDiff)
    .forEach(([name, data], i) => {
      const winRate = data.total > 0 ? (data.wins / data.total * 100).toFixed(0) : "0";
      console.log(
        `  ${i + 1}. ${name.padEnd(8)} ${data.wins}W/${data.total - data.wins}L (${winRate}%)  net: ${data.totalDiff > 0 ? "+" : ""}${data.totalDiff}`
      );
    });

  console.log("\nMODEL HEATMAP (A vs B, positive = A wins):");
  console.log("─────────────────────────────────────");
  const mNames = MODELS.map((m) => m.short);
  console.log("         " + mNames.map((n) => n.padStart(8)).join(""));
  for (const row of mNames) {
    const cells = mNames.map((col) => {
      if (row === col) return "    —   ";
      const v = modelMatrix[row]?.[col];
      return v !== undefined
        ? v > 0
          ? `   +${v}`.slice(-8)
          : `   ${v}`.slice(-8)
        : "    ?   ";
    });
    console.log(`  ${row.padEnd(8)}${cells.join("")}`);
  }

  console.log("\n\nSTYLE RANKINGS (same sonnet model):");
  console.log("─────────────────────────────────────");
  Object.entries(styleWinRates)
    .sort((a, b) => b[1].totalDiff - a[1].totalDiff)
    .forEach(([name, data], i) => {
      const winRate = data.total > 0 ? (data.wins / data.total * 100).toFixed(0) : "0";
      console.log(
        `  ${i + 1}. ${name.padEnd(12)} ${data.wins}W/${data.total - data.wins}L (${winRate}%)  net: ${data.totalDiff > 0 ? "+" : ""}${data.totalDiff}`
      );
    });

  console.log("\nSTYLE HEATMAP (A vs B, positive = A wins):");
  console.log("─────────────────────────────────────");
  const sNames = styleKeys.map((k) => DEBATER_STYLES[k].name);
  console.log("             " + sNames.map((n) => n.padStart(12)).join(""));
  for (const row of sNames) {
    const cells = sNames.map((col) => {
      if (row === col) return "       —    ";
      const v = styleMatrix[row]?.[col];
      return v !== undefined
        ? v > 0
          ? `      +${v}`.slice(-12)
          : `      ${v}`.slice(-12)
        : "       ?    ";
    });
    console.log(`  ${row.padEnd(12)}${cells.join("")}`);
  }

  // Save JSON
  const output = { modelMatrix, styleMatrix, modelWinRates, styleWinRates, results };
  writeFileSync(
    join(__dirname, "tournament_results.json"),
    JSON.stringify(output, null, 2)
  );
  console.log("\n\nResults saved to tournament_results.json");

  // Generate and save HTML report
  const htmlReport = generateHtmlReport(modelWinRates, styleWinRates, modelMatrix, styleMatrix, results);
  const htmlPath = join(__dirname, "reports", `tournament_${new Date().toISOString().split("T")[0]}.html`);
  writeFileSync(htmlPath, htmlReport);
  console.log(`HTML report saved to reports/tournament_${new Date().toISOString().split("T")[0]}.html`);
}

runTournament().catch(console.error);

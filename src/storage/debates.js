import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEBATES_DIR = join(__dirname, "../../debates");

function formatTimestamp(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}_${h}${min}${s}`;
}

function generateDebateId() {
  const ts = formatTimestamp(new Date());
  const random = Math.random().toString(36).slice(2, 6);
  return `debate_${ts}_${random}`;
}

export function saveDebate(debateData) {
  const debateId = debateData.debateId || generateDebateId();
  const filePath = join(DEBATES_DIR, `${debateId}.json`);
  
  const dataToSave = {
    debateId,
    createdAt: new Date().toISOString(),
    ...debateData,
  };
  
  writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
  return debateId;
}

export function listDebates() {
  try {
    const files = readdirSync(DEBATES_DIR);
    const debates = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const filePath = join(DEBATES_DIR, f);
        const content = readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        return {
          id: data.debateId,
          topic: data.topic?.title || "Unknown",
          topicId: data.topic?.id,
          debaterA: {
            style: data.debaterA?.style,
            model: data.debaterA?.model,
          },
          debaterB: {
            style: data.debaterB?.style,
            model: data.debaterB?.model,
          },
          totalA: data.totalA,
          totalB: data.totalB,
          winner: data.winner,
          diff: data.diff,
          createdAt: data.createdAt,
          roundCount: data.rounds?.length || 0,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return debates;
  } catch (err) {
    return [];
  }
}

export function loadDebate(debateId) {
  try {
    const filePath = join(DEBATES_DIR, `${debateId}.json`);
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`Debate not found: ${debateId}`);
  }
}

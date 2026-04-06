import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, "../../config");

export function loadTopicsFromYaml() {
  const filePath = join(CONFIG_DIR, "topics.yaml");
  
  if (!existsSync(filePath)) {
    throw new Error("topics.yaml not found in config/");
  }
  
  try {
    const content = readFileSync(filePath, "utf-8");
    const data = yaml.load(content);
    
    if (!data.topics || !Array.isArray(data.topics)) {
      throw new Error("topics.yaml must contain a 'topics' array");
    }
    
    // Validate each topic has required fields
    data.topics.forEach((topic, idx) => {
      if (!topic.id || !topic.title || !topic.pro || !topic.con) {
        throw new Error(`Topic ${idx} missing required fields: id, title, pro, con`);
      }
    });
    
    return data.topics;
  } catch (err) {
    throw new Error(`Failed to load topics.yaml: ${err.message}`);
  }
}

export function loadStylesFromYaml() {
  const filePath = join(CONFIG_DIR, "styles.yaml");
  
  if (!existsSync(filePath)) {
    throw new Error("styles.yaml not found in config/");
  }
  
  try {
    const content = readFileSync(filePath, "utf-8");
    const data = yaml.load(content);
    
    if (!data.styles || !Array.isArray(data.styles)) {
      throw new Error("styles.yaml must contain a 'styles' array");
    }
    
    // Convert array to object keyed by id
    const styles = {};
    data.styles.forEach((style, idx) => {
      if (!style.id || !style.name || !style.emoji || !style.prompt) {
        throw new Error(`Style ${idx} missing required fields: id, name, emoji, prompt`);
      }
      styles[style.id] = {
        name: style.name,
        emoji: style.emoji,
        prompt: style.prompt,
      };
    });
    
    return styles;
  } catch (err) {
    throw new Error(`Failed to load styles.yaml: ${err.message}`);
  }
}

export function loadConfig() {
  const topics = loadTopicsFromYaml();
  const styles = loadStylesFromYaml();
  return { topics, styles };
}

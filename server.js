import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, existsSync } from "fs";

import { loadEnv } from "./src/config/env.js";
import { setupRoutes } from "./src/server/routes.js";
import { loadConfig } from "./src/config/loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
loadEnv();

// Startup validation
function validateStartup() {
  const errors = [];

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    errors.push("ANTHROPIC_API_KEY not set");
  }

  // Try to load YAML configs
  try {
    const config = loadConfig();
    console.log(`✓ Loaded ${config.topics.length} topics, ${Object.keys(config.styles).length} styles`);
  } catch (err) {
    errors.push(`Config loading failed: ${err.message}`);
  }

  // Ensure debates directory exists
  const debatesDir = join(__dirname, "debates");
  if (!existsSync(debatesDir)) {
    try {
      mkdirSync(debatesDir, { recursive: true });
      console.log("✓ Created debates/ directory");
    } catch (err) {
      errors.push(`Failed to create debates directory: ${err.message}`);
    }
  }

  // Ensure reports directory exists
  const reportsDir = join(__dirname, "reports");
  if (!existsSync(reportsDir)) {
    try {
      mkdirSync(reportsDir, { recursive: true });
      console.log("✓ Created reports/ directory");
    } catch (err) {
      errors.push(`Failed to create reports directory: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error("\n❌ Startup validation failed:");
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log("✓ All startup checks passed\n");
}

validateStartup();

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const client = new Anthropic();

// Setup routes
setupRoutes(app, client);

const PORT = 3847;
app.listen(PORT, () => {
  console.log(`Debate Arena: http://localhost:${PORT}`);
});

import { readFileSync } from "fs";
import { join } from "path";

export function loadEnv() {
  try {
    const envFile = readFileSync(join(process.cwd(), ".env"), "utf-8");
    envFile.split("\n").forEach((line) => {
      const [key, ...val] = line.split("=");
      if (key && val.length) {
        process.env[key.trim()] = val.join("=").trim();
      }
    });
  } catch (err) {
    // .env file not found or unreadable
  }
}

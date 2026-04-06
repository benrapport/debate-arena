import { anthropicStream, anthropicCreate } from "./anthropic.js";
import { openaiStream, openaiCreate } from "./openai.js";

/**
 * Registry of supported providers and their API functions
 */
const PROVIDERS = {
  anthropic: {
    stream: anthropicStream,
    create: anthropicCreate,
  },
  openai: {
    stream: openaiStream,
    create: openaiCreate,
  },
};

/**
 * Get the provider name from a model ID
 */
export function getProvider(modelId) {
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4")) return "openai";
  throw new Error(`Unknown model provider for: ${modelId}`);
}

/**
 * Stream a response from any supported provider
 */
export async function providerStream(config) {
  const provider = getProvider(config.model);
  return PROVIDERS[provider].stream(config);
}

/**
 * Non-streaming call to any supported provider
 */
export async function providerCreate(config) {
  const provider = getProvider(config.model);
  return PROVIDERS[provider].create(config);
}

/**
 * All available models across providers
 */
export const ALL_MODELS = [
  // Anthropic
  { id: "claude-opus-4-20250514", short: "Opus 4", provider: "anthropic" },
  { id: "claude-sonnet-4-20250514", short: "Sonnet 4", provider: "anthropic" },
  { id: "claude-haiku-4-5-20251001", short: "Haiku 4.5", provider: "anthropic" },
  // OpenAI
  { id: "gpt-4o", short: "GPT-4o", provider: "openai" },
  { id: "o3-mini", short: "o3-mini", provider: "openai" },
  { id: "gpt-4o-mini", short: "GPT-4o-mini", provider: "openai" },
];

/**
 * Check which providers have valid API keys
 */
export function getAvailableProviders() {
  const available = [];
  if (process.env.ANTHROPIC_API_KEY) available.push("anthropic");
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-YOUR_KEY_HERE") available.push("openai");
  return available;
}

/**
 * Get models for available providers only
 */
export function getAvailableModels() {
  const providers = getAvailableProviders();
  return ALL_MODELS.filter(m => providers.includes(m.provider));
}

import Anthropic from "@anthropic-ai/sdk";

let _client = null;

export function getAnthropicClient() {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

/**
 * Stream a debater response using Anthropic API
 */
export async function anthropicStream(config) {
  const { model, systemPrompt, messages, maxTokens = 400, onToken } = config;
  const client = getAnthropicClient();

  let fullText = "";
  const stream = await client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullText += event.delta.text;
      if (onToken) onToken(event.delta.text);
    }
  }

  return fullText;
}

/**
 * Non-streaming Anthropic call (for judge/analyst)
 */
export async function anthropicCreate(config) {
  const { model, systemPrompt, messages, maxTokens = 1000 } = config;
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  return response.content[0].text;
}

import OpenAI from "openai";

let _client = null;

export function getOpenAIClient() {
  if (!_client) {
    _client = new OpenAI();
  }
  return _client;
}

/**
 * Stream a debater response using OpenAI API
 * Translates Anthropic-style config to OpenAI format
 */
export async function openaiStream(config) {
  const { model, systemPrompt, messages, maxTokens = 400, onToken } = config;
  const client = getOpenAIClient();

  // Convert Anthropic message format to OpenAI format
  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  ];

  let fullText = "";
  const stream = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: openaiMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) {
      fullText += token;
      if (onToken) onToken(token);
    }
  }

  return fullText;
}

/**
 * Non-streaming OpenAI call (for judge/analyst)
 */
export async function openaiCreate(config) {
  const { model, systemPrompt, messages, maxTokens = 1000 } = config;
  const client = getOpenAIClient();

  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: openaiMessages,
  });

  return response.choices[0].message.content;
}

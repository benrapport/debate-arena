import { Anthropic } from "@anthropic-ai/sdk";

export async function getDebaterResponse(client, config) {
  const {
    model,
    systemPrompt,
    topic,
    position,
    roundName,
    roundInstruction,
    messageHistory,
    opponentLastText,
    onToken,
  } = config;

  let userPrompt = `Topic: "${topic}"\nPosition: ${position}\nRound: ${roundName}\n\n`;
  if (opponentLastText) {
    userPrompt += `Your opponent's last argument:\n"${opponentLastText}"\n\n`;
  }
  userPrompt += roundInstruction;

  const messages = [
    ...messageHistory,
    { role: "user", content: userPrompt },
  ];

  let fullText = "";

  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: 400,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const token = event.delta.text;
        fullText += token;
        if (onToken) onToken(token);
      }
    }
  } catch (err) {
    throw new Error(`Debater API error (${model}): ${err.message}`);
  }

  return fullText;
}

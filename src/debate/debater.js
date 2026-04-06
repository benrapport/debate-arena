import { providerStream } from "../providers/index.js";

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

  try {
    return await providerStream({
      model,
      systemPrompt,
      messages,
      maxTokens: 400,
      onToken,
    });
  } catch (err) {
    throw new Error(`Debater API error (${model}): ${err.message}`);
  }
}

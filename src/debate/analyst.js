import { ANALYST_SYSTEM } from "../config/content.js";

export async function analyzeDebate(client, config) {
  const { topic, transcript, styleA, styleB, analystModel = "claude-sonnet-4-20250514" } = config;

  let transcriptText = `DEBATE: ${topic}\nDebater A (${styleA}) vs Debater B (${styleB})\n\n`;
  for (const [idx, entry] of transcript.entries()) {
    transcriptText += `Round ${Math.floor(idx / 2)}, ${entry.debater}:\n"${entry.text}"\n\n`;
  }

  try {
    const response = await client.messages.create({
      model: analystModel,
      max_tokens: 2000,
      system: ANALYST_SYSTEM,
      messages: [{ role: "user", content: transcriptText }],
    });

    let analysis;
    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON in analyst response");
      }
      const parsed = JSON.parse(jsonMatch[0]);
      // Validate structure
      if (!parsed.turning_points || !parsed.strongest_moments || !parsed.verdict) {
        throw new Error("Analyst JSON missing required fields");
      }
      analysis = parsed;
    } catch (err) {
      console.error(`Analyst parsing failed: ${err.message}, Raw text: ${response.content[0].text.substring(0, 500)}`);
      analysis = {
        turning_points: [],
        strongest_moments: { debater_a: null, debater_b: null },
        verdict: {
          winner: "Unknown",
          decisive_factor: "Analysis unavailable due to parsing error",
          if_rematch: null
        },
        _error: "Analyst response could not be parsed",
      };
    }

    return analysis;
  } catch (err) {
    throw new Error(`Analyst API error: ${err.message}`);
  }
}

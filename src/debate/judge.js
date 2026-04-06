export async function scoreRound(client, config) {
  const {
    topic,
    roundName,
    debaterAText,
    debaterBText,
    styleAName,
    styleBName,
    topicPro,
    topicCon,
    judgePrompt,
    randomizePresentation,
    judgeModel = "claude-sonnet-4-20250514",
  } = config;

  const shouldFlip = randomizePresentation && Math.random() > 0.5;
  const aText = shouldFlip ? debaterBText : debaterAText;
  const bText = shouldFlip ? debaterAText : debaterBText;
  const aStyle = shouldFlip ? styleBName : styleAName;
  const bStyle = shouldFlip ? styleAName : styleBName;
  const aPos = shouldFlip ? topicCon : topicPro;
  const bPos = shouldFlip ? topicPro : topicCon;

  const judgeMessage = `DEBATE TOPIC: "${topic}"\n\nROUND: ${roundName}\n\nDEBATER A (${aStyle}, arguing: ${aPos}):\n"${aText}"\n\nDEBATER B (${bStyle}, arguing: ${bPos}):\n"${bText}"\n\nScore this round. Remember: no ties. One is always better.`;

  let rawResponse = "";
  try {
    const response = await client.messages.create({
      model: judgeModel,
      max_tokens: 1000,
      system: judgePrompt,
      messages: [{ role: "user", content: judgeMessage }],
    });

    rawResponse = response.content[0].text;
  } catch (err) {
    throw new Error(`Judge API error: ${err.message}`);
  }

  let scores;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in judge response");
    }
    scores = JSON.parse(jsonMatch[0]);

    if (!scores.debater_a_scores || !scores.debater_b_scores || !scores.round_winner || !scores.commentary) {
      throw new Error("Missing required scoring fields");
    }

    const requiredDims = ["argument", "rhetoric", "rebuttal", "impact"];
    for (const dim of requiredDims) {
      if (typeof scores.debater_a_scores[dim] !== "number" || typeof scores.debater_b_scores[dim] !== "number") {
        throw new Error(`Invalid dimension score for ${dim}`);
      }
      // Clamp scores to 1-10 range
      if (!Number.isFinite(scores.debater_a_scores[dim]) || scores.debater_a_scores[dim] < 1 || scores.debater_a_scores[dim] > 10) {
        scores.debater_a_scores[dim] = Math.max(1, Math.min(10, Math.round(scores.debater_a_scores[dim])));
      }
      if (!Number.isFinite(scores.debater_b_scores[dim]) || scores.debater_b_scores[dim] < 1 || scores.debater_b_scores[dim] > 10) {
        scores.debater_b_scores[dim] = Math.max(1, Math.min(10, Math.round(scores.debater_b_scores[dim])));
      }
    }
  } catch (parseErr) {
    console.error(`Judge parsing error: ${parseErr.message}`);
    // Better fallback: uncorrelated dimensions, full 1-10 range
    const randomScore = () => Math.floor(Math.random() * 10) + 1;
    const aScores = {
      argument: randomScore(),
      rhetoric: randomScore(),
      rebuttal: randomScore(),
      impact: randomScore(),
    };
    const bScores = {
      argument: randomScore(),
      rhetoric: randomScore(),
      rebuttal: randomScore(),
      impact: randomScore(),
    };
    const aTotal = Object.values(aScores).reduce((s, v) => s + v, 0);
    const bTotal = Object.values(bScores).reduce((s, v) => s + v, 0);
    scores = {
      debater_a_scores: aScores,
      debater_b_scores: bScores,
      round_winner: aTotal > bTotal ? "A" : "B",
      commentary: "Judge encountered parsing error; fallback scoring applied.",
      critical_move_a: "[Fallback scoring due to parse error]",
      critical_move_b: "[Fallback scoring due to parse error]",
      worst_moment_a: "[Fallback scoring due to parse error]",
      worst_moment_b: "[Fallback scoring due to parse error]",
    };
  }

  if (shouldFlip && scores.round_winner) {
    scores.round_winner = scores.round_winner === "A" ? "B" : "A";
    const temp = scores.debater_a_scores;
    scores.debater_a_scores = scores.debater_b_scores;
    scores.debater_b_scores = temp;
  }

  return scores;
}

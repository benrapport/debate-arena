import { ROUNDS, DEBATER_STYLES, JUDGE_SYSTEM } from "../config/content.js";
import { getDebaterResponse } from "./debater.js";
import { scoreRound } from "./judge.js";
import { analyzeDebate } from "./analyst.js";
import { saveDebate } from "../storage/debates.js";

export async function runDebate(client, config) {
  const { topic, debaterA, debaterB, callbacks, debateId, seed } = config;

  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error("ANTHROPIC_API_KEY not set. Please set the environment variable.");
    if (callbacks.onError) callbacks.onError(err);
    throw err;
  }

  const debateIdValue = debateId || `debate_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const historyA = [];
  const historyB = [];
  const roundResults = [];
  const transcript = [];
  let totalScoreA = 0;
  let totalScoreB = 0;

  try {
    for (let i = 0; i < ROUNDS.length; i++) {
      const round = ROUNDS[i];
      callbacks.onRoundStart(i, round.name);

      // Debater A
      callbacks.onDebaterStart(i, "A");
      const styleA = DEBATER_STYLES[debaterA.style];
      const aSystemPrompt = `${styleA.prompt}\n\nYou are debating on: "${topic.title}"\nYour position: ${topic.pro}\n\nKeep responses punchy and compelling.`;

      const aMessageHistory = buildMessageHistory(historyA, historyB);
      const aOpponentLastText = historyB.length > 0 ? historyB[historyB.length - 1].text : null;

      let aText = "";
      try {
        aText = await getDebaterResponse(client, {
          model: debaterA.model,
          systemPrompt: aSystemPrompt,
          topic: topic.title,
          position: topic.pro,
          roundName: round.name,
          roundInstruction: round.instruction,
          messageHistory: aMessageHistory,
          opponentLastText: aOpponentLastText,
          onToken: (token) => callbacks.onToken(i, "A", token),
        });
      } catch (err) {
        for (let retry = 0; retry < 3; retry++) {
          const backoffMs = Math.pow(2, retry) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          try {
            aText = await getDebaterResponse(client, {
              model: debaterA.model,
              systemPrompt: aSystemPrompt,
              topic: topic.title,
              position: topic.pro,
              roundName: round.name,
              roundInstruction: round.instruction,
              messageHistory: aMessageHistory,
              opponentLastText: aOpponentLastText,
              onToken: (token) => callbacks.onToken(i, "A", token),
            });
            break;
          } catch (retryErr) {
            if (retry === 2) throw retryErr;
          }
        }
      }

      callbacks.onDebaterDone(i, "A", aText);
      transcript.push({ round: i, debater: "A", text: aText });

      // Debater B
      callbacks.onDebaterStart(i, "B");
      const styleB = DEBATER_STYLES[debaterB.style];
      const bSystemPrompt = `${styleB.prompt}\n\nYou are debating on: "${topic.title}"\nYour position: ${topic.con}\n\nKeep responses punchy and compelling.`;

      const bMessageHistory = buildMessageHistory(historyB, historyA);

      let bText = "";
      try {
        bText = await getDebaterResponse(client, {
          model: debaterB.model,
          systemPrompt: bSystemPrompt,
          topic: topic.title,
          position: topic.con,
          roundName: round.name,
          roundInstruction: round.instruction,
          messageHistory: bMessageHistory,
          opponentLastText: aText,
          onToken: (token) => callbacks.onToken(i, "B", token),
        });
      } catch (err) {
        for (let retry = 0; retry < 3; retry++) {
          const backoffMs = Math.pow(2, retry) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          try {
            bText = await getDebaterResponse(client, {
              model: debaterB.model,
              systemPrompt: bSystemPrompt,
              topic: topic.title,
              position: topic.con,
              roundName: round.name,
              roundInstruction: round.instruction,
              messageHistory: bMessageHistory,
              opponentLastText: aText,
              onToken: (token) => callbacks.onToken(i, "B", token),
            });
            break;
          } catch (retryErr) {
            if (retry === 2) throw retryErr;
          }
        }
      }

      callbacks.onDebaterDone(i, "B", bText);
      transcript.push({ round: i, debater: "B", text: bText });

      historyA.push({ text: aText, opponentText: bText });
      historyB.push({ text: bText, opponentText: aText });

      // Judge
      let roundScore;
      try {
        roundScore = await scoreRound(client, {
          topic: topic.title,
          roundName: round.name,
          debaterAText: aText,
          debaterBText: bText,
          styleAName: styleA.name,
          styleBName: styleB.name,
          topicPro: topic.pro,
          topicCon: topic.con,
          judgePrompt: JUDGE_SYSTEM,
          randomizePresentation: true,
        });
      } catch (err) {
        let judgeSuccess = false;
        for (let retry = 0; retry < 3; retry++) {
          const backoffMs = Math.pow(2, retry) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          try {
            roundScore = await scoreRound(client, {
              topic: topic.title,
              roundName: round.name,
              debaterAText: aText,
              debaterBText: bText,
              styleAName: styleA.name,
              styleBName: styleB.name,
              topicPro: topic.pro,
              topicCon: topic.con,
              judgePrompt: JUDGE_SYSTEM,
              randomizePresentation: true,
            });
            judgeSuccess = true;
            break;
          } catch (retryErr) {
            if (retry === 2) {
              roundScore = {
                debater_a_scores: { argument: 6, rhetoric: 6, rebuttal: 6, impact: 6 },
                debater_b_scores: { argument: 6, rhetoric: 6, rebuttal: 6, impact: 6 },
                round_winner: "A",
                commentary: "Judge failed after retries; fallback scoring applied.",
              };
              judgeSuccess = true;
            }
          }
        }
      }

      const aTotal = Object.values(roundScore.debater_a_scores).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
      const bTotal = Object.values(roundScore.debater_b_scores).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);

      totalScoreA += aTotal;
      totalScoreB += bTotal;

      const roundResult = {
        round: i,
        name: round.name,
        debater_a_scores: roundScore.debater_a_scores,
        debater_b_scores: roundScore.debater_b_scores,
        debater_a_total: aTotal,
        debater_b_total: bTotal,
        round_winner: roundScore.round_winner,
        commentary: roundScore.commentary,
        critical_move_a: roundScore.critical_move_a,
        critical_move_b: roundScore.critical_move_b,
        worst_moment_a: roundScore.worst_moment_a,
        worst_moment_b: roundScore.worst_moment_b,
      };

      roundResults.push(roundResult);
      callbacks.onJudge(roundResult);
    }

    let analysis = null;
    try {
      analysis = await analyzeDebate(client, {
        topic: topic.title,
        transcript,
        styleA: DEBATER_STYLES[debaterA.style].name,
        styleB: DEBATER_STYLES[debaterB.style].name,
      });
      if (callbacks.onAnalysis) callbacks.onAnalysis(analysis);
    } catch (err) {
      console.error("Analysis failed:", err.message);
    }

    callbacks.onComplete();

    const result = {
      debateId: debateIdValue,
      topic,
      debaterA,
      debaterB,
      totalA: totalScoreA,
      totalB: totalScoreB,
      winner: totalScoreA > totalScoreB ? "A" : "B",
      diff: totalScoreA - totalScoreB,
      rounds: roundResults,
      transcript,
      analysis,
    };

    // Auto-save the debate
    try {
      saveDebate(result);
    } catch (saveErr) {
      console.error("Failed to save debate:", saveErr.message);
    }

    return result;
  } catch (err) {
    if (callbacks.onError) callbacks.onError(err);
    throw err;
  }
}

function buildMessageHistory(ownHistory, opponentHistory) {
  const messages = [];
  for (let i = 0; i < ownHistory.length; i++) {
    messages.push({
      role: "user",
      content: `Round ${i}: Your previous argument:\n"${ownHistory[i].text}"\n\nOpponent's response:\n"${opponentHistory[i].text}"`,
    });
    messages.push({
      role: "assistant",
      content: "I've reviewed the debate history. Ready for the next round.",
    });
  }
  return messages;
}

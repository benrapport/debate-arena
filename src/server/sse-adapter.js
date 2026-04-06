export function createSSECallbacks(res) {
  const send = (event, data) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error(`SSE send error on event ${event}:`, err.message);
    }
  };

  return {
    onRoundStart: (roundIdx, name) => {
      send("round_start", { round: roundIdx, name });
    },

    onDebaterStart: (roundIdx, debater) => {
      send("debater_start", { round: roundIdx, debater });
    },

    onToken: (roundIdx, debater, token) => {
      send("debater_token", { round: roundIdx, debater, token });
    },

    onDebaterDone: (roundIdx, debater, text) => {
      send("debater_done", { round: roundIdx, debater, text });
    },

    onJudge: (result) => {
      const aTotal = Object.values(result.debater_a_scores).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
      const bTotal = Object.values(result.debater_b_scores).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);

      send("judge_scores", {
        round: result.round,
        debater_a_scores: result.debater_a_scores,
        debater_b_scores: result.debater_b_scores,
        round_winner: result.round_winner,
        commentary: result.commentary,
      });
    },

    onAnalysis: (analysis) => {
      send("analysis", analysis);
    },

    onComplete: () => {
      send("debate_complete", { message: "Debate finished!" });
    },

    onError: (error) => {
      send("error", { message: error.message });
    },
  };
}

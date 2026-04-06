import { TOPICS, DEBATER_STYLES, MODELS } from "../config/content.js";
import { runDebate } from "../debate/engine.js";
import { createSSECallbacks } from "./sse-adapter.js";
import { listDebates, loadDebate } from "../storage/debates.js";

const VERSION = "1.0.0";

export function setupRoutes(app, client) {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        status: "unavailable",
        message: "API key not configured",
        version: VERSION,
      });
    }
    res.json({
      status: "ok",
      version: VERSION,
      topics: TOPICS.length,
      styles: Object.keys(DEBATER_STYLES).length,
      models: MODELS.length,
    });
  });

  app.get("/api/debate/stream", async (req, res) => {
    const { topic: topicId, styleA, styleB, modelA, modelB } = req.query;

    const topic = TOPICS.find((t) => t.id === topicId);
    if (!topic) {
      return res.status(400).json({ error: "Invalid topic" });
    }

    if (!DEBATER_STYLES[styleA] || !DEBATER_STYLES[styleB]) {
      return res.status(400).json({ error: "Invalid debater style" });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const sA = DEBATER_STYLES[styleA];
    const sB = DEBATER_STYLES[styleB];
    send("config", {
      topic: topic.title,
      debaterA: {
        name: sA.name,
        emoji: sA.emoji,
        style: styleA,
        model: modelA || "claude-sonnet-4-20250514",
      },
      debaterB: {
        name: sB.name,
        emoji: sB.emoji,
        style: styleB,
        model: modelB || "claude-haiku-4-5-20251001",
      },
    });

    let clientDisconnected = false;
    res.on("close", () => {
      clientDisconnected = true;
    });

    const callbacks = createSSECallbacks(res);
    const originalOnToken = callbacks.onToken;
    callbacks.onToken = (roundIdx, debater, token) => {
      if (!clientDisconnected) {
        originalOnToken(roundIdx, debater, token);
      }
    };

    try {
      await runDebate(client, {
        topic,
        debaterA: {
          style: styleA,
          model: modelA || "claude-sonnet-4-20250514",
        },
        debaterB: {
          style: styleB,
          model: modelB || "claude-haiku-4-5-20251001",
        },
        callbacks,
      });
    } catch (err) {
      if (!clientDisconnected) {
        send("error", { message: err.message });
      }
    }

    res.end();
  });

  app.get("/api/debates", (req, res) => {
    try {
      const debates = listDebates();
      res.json(debates);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/debates/:id", (req, res) => {
    try {
      const debate = loadDebate(req.params.id);
      res.json(debate);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  app.get("/api/topics", (req, res) => {
    res.json(TOPICS);
  });

  app.get("/api/styles", (req, res) => {
    res.json(DEBATER_STYLES);
  });

  app.get("/api/models", (req, res) => {
    res.json(MODELS);
  });
}

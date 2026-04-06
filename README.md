# Debate Arena

**An AI debate platform where Claude models clash with different rhetorical styles across controversial topics.**

Watch AI debaters with distinct personalities argue both sides of 10 topics. The system evaluates argumentation quality, rhetorical effectiveness, and rebuttal engagement round-by-round. Perfect for exploring how LLMs handle adversarial reasoning, evaluating debate tactics, or just experiencing compelling intellectual combat.

## Features

- **6 distinct debater styles**: Aggressive (direct refutation), Analytical (logical architecture), Emotional (narrative-driven), Witty (humor as argument), Contrarian (unconventional takes), Socratic (inquiry-based)
- **3 Claude models in debate**: Opus 4, Sonnet 4, Haiku 4.5—mix and match to test capability gaps
- **4-round tournament format**: Opening Statement → Rebuttal → Cross-Examination → Closing Argument
- **Live scoring system**: Judge evaluates each round on argument quality, rhetorical effectiveness, rebuttal engagement, and impact (1-10 per dimension)
- **10 substantive topics**: Democracy, free will, social media, AI regulation, college, capitalism, Mars colonization, privacy, monogamy, remote work
- **Real-time streaming UI**: Watch token-by-token generation, live score accumulation, round-by-round judge commentary
- **Tournament mode**: Run all-vs-all matchups (Models × Models, Styles × Styles), track win rates, generate heatmaps
- **Post-debate analysis**: LLM identifies turning points, strongest moments, and decisive factors

## Quick Start

### Prerequisites
- Node.js 18+
- Anthropic API key

### Installation & Run (5 minutes)

```bash
# Clone and install
git clone <repo>
cd debate-arena
npm install

# Create .env
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Start server
npm start
# → Debate Arena: http://localhost:3847

# Open browser, pick topic/styles/models, hit "START DEBATE"
```

The UI streams the debate live and displays:
- Side-by-side debater arguments
- Real-time judge scoring (bar chart + tug-of-war)
- Round-by-round winner badges
- Final score breakdown
- Post-debate analysis

### Run a Tournament

```bash
node tournament.js
```

Runs all model matchups (same style) + all style matchups (same model). Outputs:
- Model win rates + heatmap
- Style win rates + heatmap
- Full results to `tournament_results.json`

## Architecture

### Core Modules

**`src/config/`**
- `content.js`: All debater styles, topics, judge criteria, models
- `env.js`: Load .env file

**`src/debate/`**
- `engine.js`: Main debate loop (4 rounds × 2 debaters × judge)
- `debater.js`: Stream debater responses via Claude API
- `judge.js`: Score each round on 4 dimensions (flips presentation to reduce bias)
- `analyst.js`: Post-debate summary (turning points, strongest moments)

**`src/server/`**
- `routes.js`: Express routes for `/api/debate/stream`, `/api/topics`, `/api/styles`, `/api/models`
- `sse-adapter.js`: Convert engine callbacks to Server-Sent Events (real-time UI updates)

**`server.js`**
- Express app + static file serving
- Initializes Anthropic client

**`public/index.html`**
- Single-page UI with setup panel, live score tracker, arena (2-column debater view), final results

**`tournament.js`**
- Runs all-vs-all matchups, tracks win rates, generates heatmaps

### Data Flow

```
UI (index.html)
    ↓ (form: topic, style A/B, model A/B)
    → /api/debate/stream (EventSource)
        ↓ (SSE callbacks)
        → engine.js
            ├─ debater.js (A speaks, streamed token-by-token)
            ├─ debater.js (B speaks, streamed token-by-token)
            ├─ judge.js (score round, send commentary)
            └─ [repeat 4 rounds]
            → analyst.js (final analysis)
    ← SSE events (config, round_start, debater_token, judge_scores, analysis, debate_complete)
    → Display live, animate chart, show winner
```

## Configuration

### Add a New Topic

Edit `src/config/content.js`:

```javascript
export const TOPICS = [
  // ... existing
  {
    id: "universal-basic-income",
    title: "Should governments implement Universal Basic Income?",
    pro: "Argue FOR UBI as an essential safety net for the future",
    con: "Argue AGAINST UBI as economically unsustainable"
  },
];
```

That's it. The topic appears immediately in the web UI.

### Add a New Debater Style

Edit `src/config/content.js`, add to `DEBATER_STYLES`:

```javascript
export const DEBATER_STYLES = {
  // ... existing
  pragmatist: {
    name: "The Realist",
    emoji: "🔧",
    prompt: `You are a pragmatic debater who values real-world outcomes over ideological purity.
Your toolkit: cost-benefit analysis, implementation realism, case studies of what actually works.
By Round:
- Opening: Present your strongest 2-3 claims with evidence of real-world success.
- Rebuttal: Show how their approach fails in practice. Use examples.
- Cross-Exam: Ask them how their position survives reality.
- Closing: Argue you've won because your position works.
Ideal moves: "Sounds great in theory, but here's what happened in practice..." / "My approach scales; theirs doesn't."`
  },
};
```

The style becomes available in the UI immediately (emoji + name in dropdown).

### Change Models

Edit `src/config/content.js`:

```javascript
export const MODELS = [
  { id: "claude-opus-4-20250514", short: "Opus 4" },
  // Add new model:
  { id: "claude-opus-5-20260101", short: "Opus 5" },
];
```

Models appear in both the web UI and tournament output.

### Customize Judge Criteria

The judge prompt in `src/config/content.js` under `JUDGE_SYSTEM` defines:
- **Scoring rubric** (1-10 per dimension)
- **What counts as "good"** (argument quality, rebuttal engagement, rhetoric, impact)
- **Decision rule** (no ties)

Modify the rubric descriptions to emphasize different criteria (e.g., factual accuracy, emotional resonance, etc.).

## Tournament

Run `node tournament.js` to test all model and style combinations.

### Output: `tournament_results.json`

```json
{
  "modelWinRates": {
    "Opus 4": { "wins": 4, "total": 6, "totalDiff": 12 },
    "Sonnet 4": { "wins": 2, "total": 6, "totalDiff": -8 }
  },
  "modelMatrix": {
    "Opus 4": { "Sonnet 4": 12, "Haiku 4.5": 8 },
    "Sonnet 4": { "Opus 4": -12, "Haiku 4.5": -4 }
  },
  "styleWinRates": { ... },
  "styleMatrix": { ... },
  "results": [
    {
      "type": "model",
      "a": "Opus 4",
      "b": "Sonnet 4",
      "winner": "Opus 4",
      "totalA": 120,
      "totalB": 108,
      "diff": 12
    }
  ]
}
```

**Interpreting results:**
- `totalDiff` = net score advantage (positive = more wins and/or larger margins)
- Heatmap cells show head-to-head deltas (positive = row wins by this margin)
- Win rate = (wins / total) × 100%

## API Reference

### POST `/api/debate/stream`

Streams a debate as Server-Sent Events.

**Query params:**
- `topic`: Topic ID (e.g., "ai-regulation")
- `styleA`: Debater A style key (e.g., "aggressive")
- `styleB`: Debater B style key (e.g., "analytical")
- `modelA`: Debater A model (e.g., "claude-sonnet-4-20250514")
- `modelB`: Debater B model (e.g., "claude-haiku-4-5-20251001")

**Events:**

`event: config`
```json
{
  "topic": "Should AI development be heavily regulated?",
  "debaterA": {
    "name": "The Prosecutor",
    "emoji": "⚔️",
    "style": "aggressive",
    "model": "claude-sonnet-4-20250514"
  },
  "debaterB": { ... }
}
```

`event: round_start`
```json
{ "round": 0, "name": "Opening Statement" }
```

`event: debater_token` (streamed)
```json
{ "round": 0, "debater": "A", "token": "The " }
```

`event: debater_done`
```json
{ "round": 0, "debater": "A", "text": "The core issue here is..." }
```

`event: judge_scores`
```json
{
  "round": 0,
  "debater_a_scores": { "argument": 8, "rhetoric": 7, "rebuttal": 0, "impact": 7 },
  "debater_b_scores": { "argument": 6, "rhetoric": 6, "rebuttal": 0, "impact": 6 },
  "round_winner": "A",
  "commentary": "A opened with tighter logic..."
}
```

`event: analysis`
```json
{
  "turning_points": [
    { "round": 2, "description": "B's cross-exam exposed a gap in A's cost-benefit analysis" }
  ],
  "strongest_moments": {
    "debater_a": { "quote": "...", "explanation": "..." },
    "debater_b": { "quote": "...", "explanation": "..." }
  },
  "verdict": {
    "winner": "A",
    "decisive_factor": "A maintained frame throughout",
    "if_rematch": "B should focus on...",
    "raw_text": "(fallback if parsing fails)"
  }
}
```

`event: debate_complete`
```json
{ "message": "Debate finished!" }
```

### GET `/api/topics`

Returns array of all topics with `id`, `title`, `pro`, `con`.

### GET `/api/styles`

Returns object with keys = style IDs, values = `{ name, emoji, prompt }`.

### GET `/api/models`

Returns array of available models.

## How to Contribute

### Adding a New Debater Style (Step-by-Step)

1. **Open `src/config/content.js`**
2. **Add entry to `DEBATER_STYLES` object:**
   ```javascript
   philosopher: {
     name: "The Philosopher",
     emoji: "🤔",
     prompt: `You argue from first principles and metaphysical clarity.
     Core techniques: Define terms precisely, expose hidden assumptions, ...
     [4 round descriptions]
     Ideal moves: "Let's examine what we even mean by...", "This assumes...", ...`
   }
   ```
3. **Requirements:**
   - Unique key (e.g., "philosopher")
   - `name`: Display name for UI
   - `emoji`: Single emoji
   - `prompt`: System prompt (2-3 sentences per round, 300-400 words total)
4. **Test:**
   - Restart server
   - Pick style from dropdown
   - Run a debate
5. **Verify:**
   - Style appears in UI dropdown
   - Debater generates in specified style
   - No console errors

### Adding a New Topic (Step-by-Step)

1. **Open `src/config/content.js`**
2. **Add to `TOPICS` array:**
   ```javascript
   {
     id: "your-topic-id",
     title: "Should [question]?",
     pro: "Argue FOR [position]",
     con: "Argue AGAINST [position]"
   }
   ```
3. **Requirements:**
   - Unique `id` (lowercase, hyphens)
   - `title`: Debate question (50-80 chars, clear)
   - `pro` / `con`: Position briefs (1-2 sentences each, actionable)
4. **Test:**
   - Restart server
   - Topic appears in dropdown
   - Run a debate with it
5. **Verify:**
   - Both debaters argue correct positions
   - Topic is substantive (avoid yes/no trivia)

## Roadmap

- [ ] **Custom tournament configs**: YAML files to define subsets of models/styles/topics
- [ ] **Debate history**: Save transcripts + results to database, browse past debates
- [ ] **Judge bias detection**: Run same debate pair twice with flipped presentation, measure consistency
- [ ] **Style fingerprinting**: Profile each style's strengths/weaknesses on specific topics
- [ ] **Live spectator mode**: Multiple viewers watch same debate in real time
- [ ] **Debate tree**: Best-of-N for deciding "strongest" debater, bracket-style tournament UI
- [ ] **Custom debater personality**: User can write own system prompt, test it live
- [ ] **Export debates as podcasts**: Generate audio debate summary with text-to-speech

## License

MIT. Use, modify, distribute freely.

---

**Questions?** Open an issue or submit a PR. Debate Arena is built to be extended—add your styles, topics, and experiments.

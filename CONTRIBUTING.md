# Contributing to Debate Arena

Thanks for wanting to extend Debate Arena. This guide walks you through the main ways to contribute.

## Code Structure

```
debate-arena/
├── server.js                 # Express server entry point
├── tournament.js             # Tournament runner (all-vs-all mode)
├── public/
│   └── index.html           # Single-page UI
├── src/
│   ├── config/
│   │   ├── content.js       # Debater styles, topics, models, judge prompt
│   │   └── env.js           # .env file loader
│   ├── debate/
│   │   ├── engine.js        # Main debate loop (orchestration)
│   │   ├── debater.js       # Calls Claude API to generate arguments
│   │   ├── judge.js         # Calls Claude API to score round
│   │   └── analyst.js       # Post-debate analysis
│   └── server/
│       ├── routes.js        # Express route handlers
│       └── sse-adapter.js   # Converts engine callbacks → SSE events
└── README.md
```

### Data Flow

```
User picks topic + styles + models in UI
    ↓
POST /api/debate/stream (EventSource)
    ↓
routes.js validates params, calls engine.js
    ↓
engine.js loops through 4 rounds:
    1. Call debater.js for Debater A (stream tokens via callback)
    2. Call debater.js for Debater B (stream tokens via callback)
    3. Call judge.js to score round (get JSON scores + commentary)
    4. Repeat
    5. Call analyst.js for post-debate summary
    ↓
sse-adapter.js sends callback events as SSE
    ↓
UI updates in real-time (chart, scores, text)
```

**Key insight:** Engine uses callbacks; SSE adapter converts them. To add new events, add callbacks in engine → handle in sse-adapter → add listeners in UI.

## Adding a New Debater Style

### What is a debater style?

A style is a distinct **rhetorical approach** to debate. Each style has:
- **Name** (e.g., "The Prosecutor")
- **Emoji** (visual identifier)
- **System prompt** (instructions on how to argue)

The prompt must include:
- Core techniques (how this style wins)
- Round-by-round strategy
- Tone and rhetorical tactics
- Ideal phrases/moves

### Step 1: Write the prompt

Open `src/config/content.js` and examine existing styles (aggressive, analytical, emotional, witty, contrarian, socratic). Notice the structure:
- 1-2 sentences intro
- 3-5 bullet points on techniques
- 4 subsections ("By Round" = Opening, Rebuttal, Cross-Exam, Closing)
- "What to AVOID" section
- "Ideal moves" examples

**Example template:**
```
You are a [adjective] debater who [core claim]. Your toolkit: [techniques].

Core techniques: [3-4 tactics with examples]. [Longer explanation of how to deploy them].

By Round:
- Opening: [What to do in round 1, 1-2 sentences]
- Rebuttal: [How to respond to opponent]
- Cross-Exam: [How to pressure with questions]
- Closing: [How to win the debate]

What to AVOID: [3-4 things not to do]

Ideal moves: [4-5 example phrases]
```

### Step 2: Add to DEBATER_STYLES

```javascript
// src/config/content.js

export const DEBATER_STYLES = {
  // ... existing styles
  
  futurist: {
    name: "The Futurist",
    emoji: "🚀",
    prompt: `You are a forward-looking debater who wins by showing how arguments fail to account for the future.
    
Core techniques: Identify second-order effects others miss. Show how current logic becomes obsolete. Use scenario analysis: "In 10 years, when X happens...". Argue that the debate is framed around yesterday's constraints, not tomorrow's possibilities. When opponent cites historical precedent, show why it no longer applies.

By Round:
- Opening: Show that the conventional frame is outdated. Present future scenarios that require your position. Make your case feel inevitable given where the world is heading.
- Rebuttal: Show that their argument assumes yesterday's world. "That made sense in the past, but now..." Counter with emerging trends that favor your position.
- Cross-Exam: Ask them how their argument survives the changes already underway. "In five years when X becomes true, won't your position collapse?"
- Closing: Declare you've won the future. Show that waiting for evidence of your claims means waiting too long.

What to AVOID: Don't just assert future tech exists. Don't ignore present constraints. Don't assume everyone shares your optimism/pessimism about change. Don't cite science fiction as evidence.

Ideal moves: "That worked when..., but we're not in that world anymore." / "Here's what's already changing that makes your position unsustainable." / "You're arguing for a world that's already obsolete." / "In 10 years, this will be obvious—the question is whether we act now."`
  },
};
```

### Step 3: Test

1. Restart the server: `npm start`
2. Open http://localhost:3847
3. Look for your new style in the dropdown (it should appear with emoji + name)
4. Pick your style for Debater A, pick an opponent style, pick any topic
5. Click "START DEBATE"
6. **Watch the debate and verify:**
   - Debater A argues in your style (uses your techniques, phrases, tone)
   - Tone matches your description (aggressive vs. philosophical, etc.)
   - No console errors

### Step 4: Iterate (optional)

If the style isn't quite right:
- Reword the prompt for clarity
- Add more specific examples
- Adjust the "By Round" sections to be more concrete
- Test again

## Adding a New Topic

### What is a topic?

A topic is a binary debate question with two sides:
- **Pro side**: One position
- **Con side**: The opposite position

Topics should be:
- Substantive (not trivia)
- Genuinely debatable (both sides have merit)
- Interesting (cover politics, philosophy, tech, society, etc.)
- Clearly worded

### Step 1: Write the topic

Topics need:
- **`id`**: Unique, lowercase, hyphenated (e.g., "quantum-computing")
- **`title`**: The debate question (50-80 chars, use "Should..." or "Is...")
- **`pro`**: What debaters on the PRO side argue for (1-2 sentences, clear position)
- **`con`**: What debaters on the CON side argue against (1-2 sentences, clear position)

**Example:**
```javascript
{
  id: "space-exploration",
  title: "Should humanity prioritize space exploration over climate action?",
  pro: "Argue that space exploration is a worthwhile investment that will yield technological breakthroughs and ensure long-term human survival",
  con: "Argue that climate action on Earth is a more urgent and practical use of resources than space exploration"
}
```

### Step 2: Add to TOPICS

```javascript
// src/config/content.js

export const TOPICS = [
  // ... existing topics
  
  {
    id: "universal-basic-income",
    title: "Should governments implement Universal Basic Income?",
    pro: "Argue that UBI is necessary to address poverty and job displacement in the era of automation",
    con: "Argue that UBI is fiscally unsustainable and creates perverse economic incentives"
  },
];
```

### Step 3: Test

1. Restart the server: `npm start`
2. Open http://localhost:3847
3. Check the topic dropdown—your new topic should appear
4. Select your topic, pick any styles/models, click "START DEBATE"
5. **Verify:**
   - Debater A argues the PRO position (mentioned in their arguments)
   - Debater B argues the CON position (takes the opposite stance)
   - The debate is substantive (not trivial arguments)
   - Both sides have room to make real points

## Modifying the Judge

The judge system evaluates each round on 4 dimensions:
- **Argument Quality** (1-10): Logical validity and coherence
- **Rhetoric** (1-10): Persuasiveness and clarity
- **Rebuttal** (1-10): How well they engaged opponent's actual claims
- **Impact** (1-10): Whether it would change a reasonable person's mind

### To Change Scoring Criteria

Edit the `JUDGE_SYSTEM` prompt in `src/config/content.js`.

**Example:** If you want judges to emphasize factual accuracy more:

```javascript
// OLD
**ARGUMENT QUALITY (1-10)**: Rate the logical validity and coherence of their case.
- 9-10: Airtight reasoning. Claims follow logically...

// NEW
**ARGUMENT QUALITY (1-10)**: Rate the logical validity, coherence, AND factual accuracy of their case.
- 9-10: Airtight reasoning. All claims factually accurate...
- 7-8: Solid logic with minor factual gaps. Most claims well-warranted...
```

### To Change the Rubric Scale

You can modify individual dimension definitions. For example, to emphasize emotional impact:

```javascript
// OLD
**RHETORICAL EFFECTIVENESS (1-10)**: Rate persuasiveness and clarity.

// NEW (if you want more emotional weight)
**RHETORICAL EFFECTIVENESS (1-10)**: Rate persuasiveness, clarity, and emotional resonance.
- 9-10: Compelling, clear, memorable, AND emotionally resonant. Ideas land...
```

### To Change the Decision Rule

Currently: "One debater MUST be at least 1 point higher on at least two criteria."

You can change this to:
- "Winner has highest total score (ties broken by impact)"
- "Winner wins at least 2 out of 4 dimensions"
- "Weighted score (Impact counts 2x)"

Modify the "DECISION RULE" section of `JUDGE_SYSTEM`.

## Testing Your Changes

### Run a Single Debate

```bash
npm start
# Then use the UI to run one debate
```

### Run a Tournament

```bash
node tournament.js
```

This runs:
- All model vs. model matchups (same analytical style)
- All style vs. style matchups (same Claude Sonnet model)
- Generates win rates, heatmaps, and `tournament_results.json`

Use tournaments to **verify your new style/topic is workable**:
- Your new style should win some and lose some (not always 0-4)
- Your new topic should produce good debates (not total mismatches)

## PR Checklist

Before submitting a PR:

- [ ] **Added new style:**
  - [ ] Entry in `DEBATER_STYLES` (name, emoji, prompt)
  - [ ] Prompt is 300-400 words with 4 round descriptions
  - [ ] Tested manually (ran 1 debate)
  - [ ] Tested in tournament (ran `node tournament.js`)

- [ ] **Added new topic:**
  - [ ] Entry in `TOPICS` (id, title, pro, con)
  - [ ] Both sides are substantive and debatable
  - [ ] Tested manually (ran 1 debate with both sides arguing correctly)
  - [ ] Tested in tournament (ran `node tournament.js`)

- [ ] **Modified judge:**
  - [ ] Updated `JUDGE_SYSTEM` prompt in `content.js`
  - [ ] Ran at least 2 debates to verify judge still outputs valid JSON
  - [ ] No syntax errors in the prompt

- [ ] **All changes:**
  - [ ] No console errors
  - [ ] Code style matches existing (spacing, naming)
  - [ ] Works on Node 18+
  - [ ] `.env` still loads correctly

## Common Gotchas

### "My style doesn't appear in the dropdown"

- Restart the server (changes to `content.js` aren't hot-reloaded)
- Check that you added it to the correct object: `export const DEBATER_STYLES = { ... }`
- Verify the key is unique (no duplicate names in different styles)

### "The debate is one-sided—one style always loses"

This is usually fine. Some styles are stronger on certain topics. If a style loses **every single matchup**, consider:
- Is the prompt clear enough? (Claude might be misinterpreting it)
- Is it too specific? (e.g., "only cite peer-reviewed studies" on a philosophy topic)
- Is it contradictory? (e.g., "be bold but cautious")

Test with a simpler, clearer prompt.

### "The judge response isn't valid JSON"

The judge sometimes outputs text before the JSON. The judge.js extracts JSON with a regex: `/\{[\s\S]*\}/`. If the judge's response structure changes:
- Check `judge.js` in `src/debate/` to see the parsing logic
- The fallback uses random scores, which is fine but not ideal

### "Topic prompts aren't causing debaters to argue the right side"

Make sure:
- `pro` and `con` in your topic are clear imperatives: "Argue FOR..." or "Argue AGAINST..."
- The debater system prompts include the position: `"Your position: ${topic.pro}"`
- You're not using neutral language: bad = "The impact of climate change", good = "Climate change is an existential threat"

## Architecture Notes

### Why callbacks?

The debate `engine.js` uses callbacks (onToken, onJudge, etc.) instead of returning everything at once. This enables:
- **Real-time streaming**: Token-by-token output to the UI
- **Long operations**: Judges and debaters take time; don't block the server
- **Flexible output**: Different outputs can use the same callbacks (web UI, tournament stats, etc.)

### Why randomize judge presentation?

In `judge.js`, we flip the presentation (A becomes B, B becomes A) 50% of the time. This reduces **judge bias**—the judge isn't influenced by who goes first or which position appears on the left. We flip back the scores so the result is still correct.

### Why no database?

Debate Arena is stateless by design. Every debate is independent. This makes it:
- Easy to run locally
- Infinitely parallelizable (no locks)
- Simple to extend (no schema migrations)

If you want to save debates, add a simple `.json` file per debate (see `tournament_results.json` for format).

## Questions?

Open an issue. Debate Arena is meant to be hacked on.

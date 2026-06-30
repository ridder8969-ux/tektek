# TEK-1 — Milestone 4: AI Coach (data-grounded)

Adds a "Your Coach" section to the dashboard that analyzes your stored
matches and surfaces real insights with action links.

## What's honest about it
Every insight is COMPUTED from your match data — nothing is invented:
- Recent form (last-10 record + streak)
- Worst matchups (win rate per opponent character, min 3 games)
- Strong matchups (confidence boosters)
- "Close losses" pattern (losses that went to a deciding round)
- Most-faced characters (what to prioritize learning)

What it does NOT do: fabricate things the data can't know (e.g. "you fail to
punish -14s" — EWGF data has no inputs, so we don't pretend to know that).
Each insight links to the real tools: the Matchup analyzer, Trainer, etc.

## Deploy
No new database tables. Just push:
- `functions/api/me/coach.js`  (new)
- `dashboard.html`             (updated — adds the Coach section)

## Test
1. Open `/dashboard.html` (must be signed in, have a Tekken ID, and synced matches).
2. Under "🎯 Your Coach" you'll see insight cards: worst matchups, recent form,
   close-loss pattern, etc. — each linking to the right tool.
3. Needs at least ~3 tracked matches; more matches = better insights.

## Optional future upgrade
We can later layer LLM-written coaching prose on top (via Claude's API) for more
natural phrasing — but the rule-based engine here is deterministic, accurate,
free, and fast, so it's the trustworthy foundation.

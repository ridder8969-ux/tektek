# TEK-1 — Milestone 6: Move Search + Tournaments + polish

## New features
1. **Move Search** (`movesearch.html`) — search every move across all 42 characters,
   plus roster-wide leaderboards (fastest lows, fastest launchers, most plus on block,
   safest power crushes, fastest homing, biggest throws). Uses your existing
   frame-data API (edge-cached) — no new keys needed. Works immediately.
2. **Tournaments** (`tournaments.html` + `functions/api/tournaments.js`) — upcoming
   Tekken 8 events worldwide from start.gg (videogame ID 49783, verified).
   **Needs a free start.gg API key:**
   - start.gg → your profile → Developer Settings → create auth token
   - Cloudflare → Pages project → Settings → Environment variables →
     add `STARTGG_TOKEN` = your token → redeploy
   - Until then the page shows friendly setup instructions instead of breaking.
3. Nav on ALL pages now includes Move Search + Tournaments. Homepage shows all 8 features.

## Deploy
Full-zip replace as usual. New files: movesearch.html, tournaments.html,
functions/api/tournaments.js. No database migration needed.

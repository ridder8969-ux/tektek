# TEK-1 — Milestone 2 Setup (Match History Import)

Adds: import your battles from your Tekken ID into D1, with a dashboard
match-history view, win rate, and a "matchups to work on" panel.
Respectful to EWGF: syncs at most every 30 min per user, and backs off
when EWGF reports low rate-limit budget.

## 1. Run the new database migration
1. Cloudflare → your `tek1-db` D1 database → **Console**.
2. Paste the contents of `schema/0002_matches_clean.sql` (the one-line-per-statement
   version — the console dislikes comments). Execute.
   - If it complains, run each statement separately.
3. Check **Tables**: you should now also see `imported_matches` and `sync_state`.

## 2. Deploy the new files
Push to your repo (or upload the zip). New/changed in M2:
- `functions/api/me/sync.js`     (imports battles, rate-limited)
- `functions/api/me/matches.js`  (reads stored matches + stats)
- `dashboard.html`               (now shows match history + sync button)
- `schema/0002_matches.sql`

(Already configured: `EWGF_TOKEN` secret — same one your player lookup uses.)

## 3. Test
1. Make sure your profile has your **Tekken ID** set (Edit Profile).
2. Open `/dashboard.html`. It auto-syncs if it's been >30 min (first time = immediately).
3. You should see: win rate, record, recent battles (with opponent icons),
   and a "matchups to work on" panel once you have a few games.
4. The **↻ Refresh** button re-syncs (with a 30-min cooldown; "synced recently"
   message if you press it too soon).

## Notes
- We store a `raw_json` of each battle as a safety net, plus parsed fields.
- De-dupe is by timestamp + both Tekken IDs, so re-syncing never duplicates.
- The "matchups to work on" panel is the seed of the future AI Coach (M4).

## Be a good citizen
EWGF is a solo-dev, donation-funded project. Before promoting TEK-1 to many users,
consider messaging the EWGF dev (they have a Discord) about higher-volume API use.

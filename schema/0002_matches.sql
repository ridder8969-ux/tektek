-- ============================================================
--  TEK-1 — D1 migration 0002 (Milestone 2: match history)
-- ============================================================

-- Per-user sync bookkeeping so we rate-limit and avoid hammering EWGF.
CREATE TABLE IF NOT EXISTS sync_state (
  user_id        INTEGER PRIMARY KEY,
  tekken_id      TEXT,
  last_synced_at TEXT,
  last_status    TEXT,
  match_count    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Imported matches. We store the parsed common fields for fast analytics,
-- plus raw_json as a safety net so no data is ever lost.
CREATE TABLE IF NOT EXISTS imported_matches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  tekken_id       TEXT,                 -- whose history this belongs to
  match_key       TEXT,                 -- stable de-dupe key (battle id or composed)
  played_at       TEXT,                 -- ISO timestamp if available
  player_name     TEXT,
  player_char     TEXT,
  player_rank     TEXT,
  opponent_name   TEXT,
  opponent_char   TEXT,
  opponent_rank   TEXT,
  result          TEXT,                 -- 'win' | 'loss' | ''
  rounds_won      INTEGER,
  rounds_lost     INTEGER,
  stage           TEXT,
  battle_type     TEXT,                 -- ranked / casual / etc
  game_version    TEXT,
  raw_json        TEXT,                 -- original record, just in case
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_matches_user ON imported_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_opp ON imported_matches(user_id, opponent_char);
CREATE INDEX IF NOT EXISTS idx_matches_user_played ON imported_matches(user_id, played_at);
-- prevent duplicate imports of the same battle for the same user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_matches_user_key ON imported_matches(user_id, match_key);

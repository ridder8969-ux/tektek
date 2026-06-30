CREATE TABLE IF NOT EXISTS sync_state (user_id INTEGER PRIMARY KEY, tekken_id TEXT, last_synced_at TEXT, last_status TEXT, match_count INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS imported_matches (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, tekken_id TEXT, match_key TEXT, played_at TEXT, player_name TEXT, player_char TEXT, player_rank TEXT, opponent_name TEXT, opponent_char TEXT, opponent_rank TEXT, result TEXT, rounds_won INTEGER, rounds_lost INTEGER, stage TEXT, battle_type TEXT, game_version TEXT, raw_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_matches_user ON imported_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_opp ON imported_matches(user_id, opponent_char);
CREATE INDEX IF NOT EXISTS idx_matches_user_played ON imported_matches(user_id, played_at);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_matches_user_key ON imported_matches(user_id, match_key);

-- ============================================================
--  TEK-1 — D1 schema, migration 0001 (initial / Milestone 1)
-- ------------------------------------------------------------
--  Designed to grow into the full TEK-1 vision. Milestone 1
--  uses: users, profiles. Later milestones add matches, notes,
--  bookmarks, practice_sessions, etc. (stubbed at the bottom
--  as commented future tables so the shape is intentional).
-- ============================================================

-- Core identity. We DON'T store passwords — Clerk owns auth.
-- clerk_user_id is the link between Clerk's user and our row.
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  clerk_user_id   TEXT NOT NULL UNIQUE,         -- from Clerk (e.g. "user_2abc...")
  email           TEXT,                          -- convenience copy (Clerk is source of truth)
  username        TEXT UNIQUE,                   -- chosen display handle
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  is_admin        INTEGER NOT NULL DEFAULT 0     -- 0/1, for the future admin panel
);
CREATE INDEX IF NOT EXISTS idx_users_clerk ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Everything a player tells us about themselves.
-- One row per user (1:1). Nullable so onboarding can be gradual.
CREATE TABLE IF NOT EXISTS profiles (
  user_id           INTEGER PRIMARY KEY,         -- FK -> users.id (1:1)
  avatar_url        TEXT,
  country           TEXT,                         -- ISO code or name
  platform          TEXT,                         -- 'steam' | 'xbox' | 'playstation'
  tekken_id         TEXT,                         -- e.g. "5LrJB8LReLJB"
  current_rank      TEXT,                         -- e.g. "Garyu"
  highest_rank      TEXT,
  main_character    TEXT,                         -- slug, e.g. "lars"
  secondary_1       TEXT,
  secondary_2       TEXT,
  secondary_3       TEXT,
  favorite_stage    TEXT,
  favorite_music    TEXT,
  playstyle         TEXT,                         -- 'rushdown'|'defensive'|'counter_hit'|'poking'|'keep_out'|'aggressive'|'movement'
  practice_streak   INTEGER NOT NULL DEFAULT 0,
  onboarded         INTEGER NOT NULL DEFAULT 0,   -- 0/1 has finished first-time setup
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_profiles_main ON profiles(main_character);
CREATE INDEX IF NOT EXISTS idx_profiles_tekkenid ON profiles(tekken_id);

-- ============================================================
--  FUTURE TABLES (later milestones) — shown for intent only.
--  Kept commented so 0001 stays focused; each ships in its own
--  migration when we build that milestone.
-- ============================================================
-- imported_matches   (Milestone 2): per-match history synced from EWGF
-- player_stats       (Milestone 2): rolled-up win rates, char usage
-- user_notes         (Milestone 3): personal notes synced to account
-- bookmarks          (Milestone 3): saved guides/combos/matchups
-- practice_sessions  (Milestone 4): practice planner + completion
-- achievements       (Milestone 4): streaks, milestones
-- characters / moves / frame_data (optional): if we cache TekkenDocs into D1

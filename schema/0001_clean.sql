CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, clerk_user_id TEXT NOT NULL UNIQUE, email TEXT, username TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), is_admin INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_users_clerk ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE TABLE IF NOT EXISTS profiles (user_id INTEGER PRIMARY KEY, avatar_url TEXT, country TEXT, platform TEXT, tekken_id TEXT, current_rank TEXT, highest_rank TEXT, main_character TEXT, secondary_1 TEXT, secondary_2 TEXT, secondary_3 TEXT, favorite_stage TEXT, favorite_music TEXT, playstyle TEXT, practice_streak INTEGER NOT NULL DEFAULT 0, onboarded INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_profiles_main ON profiles(main_character);
CREATE INDEX IF NOT EXISTS idx_profiles_tekkenid ON profiles(tekken_id);

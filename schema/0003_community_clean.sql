CREATE TABLE IF NOT EXISTS friendships (id INTEGER PRIMARY KEY AUTOINCREMENT, requester_id INTEGER NOT NULL, addressee_id INTEGER NOT NULL, low_id INTEGER NOT NULL, high_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_friend_pair ON friendships(low_id, high_id);
CREATE INDEX IF NOT EXISTS idx_friend_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friend_status ON friendships(status);
CREATE TABLE IF NOT EXISTS privacy (user_id INTEGER PRIMARY KEY, profile_public INTEGER NOT NULL DEFAULT 1, show_matches INTEGER NOT NULL DEFAULT 1, show_tekken_id INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);

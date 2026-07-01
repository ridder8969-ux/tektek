-- ============================================================
--  TEK-1 — D1 migration 0003 (Milestone 5b: community)
-- ============================================================

-- Friendship / request edges. One row per directed relationship pair,
-- stored with a canonical (low_id, high_id) so we never duplicate.
-- status: 'pending' (requester -> addressee), 'accepted', 'blocked'
CREATE TABLE IF NOT EXISTS friendships (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id  INTEGER NOT NULL,     -- who initiated (or who blocked)
  addressee_id  INTEGER NOT NULL,     -- the other user
  low_id        INTEGER NOT NULL,     -- min(requester,addressee) for dedupe
  high_id       INTEGER NOT NULL,     -- max(...)
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
);
-- exactly one relationship row per pair of users
CREATE UNIQUE INDEX IF NOT EXISTS uniq_friend_pair ON friendships(low_id, high_id);
CREATE INDEX IF NOT EXISTS idx_friend_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friend_status ON friendships(status);

-- Per-user privacy prefs for the public profile.
-- profile_public defaults 1 (product choice: public by default),
-- but users can hide their match history separately.
CREATE TABLE IF NOT EXISTS privacy (
  user_id           INTEGER PRIMARY KEY,
  profile_public    INTEGER NOT NULL DEFAULT 1,
  show_matches      INTEGER NOT NULL DEFAULT 1,
  show_tekken_id    INTEGER NOT NULL DEFAULT 0,   -- Tekken ID hidden by default
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

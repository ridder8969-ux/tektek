# TEK-1 — Milestone 5 Setup (Personalized Trainer + Community)

## 5a — already in your files
- Personalized Trainer (adapts to your main), consistent nav + Clerk user
  button on every page, and "who linked this Tekken ID" on Player Lookup.
- New functions: `playbook.js`, `linked.js`. No DB migration for 5a.

## 5b — Community (needs one migration)

### 1. Run the community migration
Cloudflare -> `tek1-db` D1 -> Console -> paste `schema/0003_community_clean.sql`
(the comment-free one-liner version). Execute. You should now also have the
`friendships` and `privacy` tables.

### 2. Deploy the new files
New/changed:
- `functions/api/me/friends.js`     (send/accept/remove/block, list)
- `functions/api/me/privacy.js`     (privacy settings)
- `functions/api/profile-view.js`   (public profile, privacy-aware)
- `community.html`                  (friends management page)
- `u.html`                          (public profile page: /u.html?user=NAME)
- `profile.html`                    (now has Privacy settings section)
- nav updated on all pages (Community link)

### 3. Test
1. Have TWO accounts (or ask a friend). Each needs a **username** set (Edit Profile).
2. From account A, go to Community, search account B's username, "+ Add".
3. From account B, go to Community — you'll see the incoming request. Accept.
4. Both now show as friends. Click a username to view their profile (`u.html`).
5. In Edit Profile, toggle "Public profile" off on account B, then try viewing
   B from A — it should show "This profile is private."

## Privacy model (important)
- Profiles are **public by default** (your choice), viewable at /u.html?user=NAME.
- Users can toggle: public profile on/off, show match history on/off,
  show Tekken ID on/off (Tekken ID is OFF by default even on public profiles).
- Email is NEVER exposed. Friend requests use request->accept (no unilateral adds).
- Users can block, which prevents further requests from that person.

## Note on safety
Since usernames and profiles are public, keep an eye out as the community grows.
If you later want reporting/moderation tools, that's a good future addition.

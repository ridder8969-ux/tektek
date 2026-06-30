# TEK-1 — Milestone 1 Setup (Auth + Database + Profiles)

This adds user accounts, a personalized dashboard, and a profile editor.
It uses **Clerk** for login (so you never store passwords) and **Cloudflare D1**
for the database. Both have free tiers.

Follow these in order. ~20–30 min the first time.

---

## 1. Create the D1 database

D1 must be created with Cloudflare's CLI (`wrangler`) OR the dashboard.

**Dashboard way (easiest):**
1. Cloudflare dashboard → **Workers & Pages** → **D1 SQL Database** → **Create**.
2. Name it `tek1-db`. Create.
3. Copy the **Database ID** it shows you.
4. Open `wrangler.toml` (in your repo) and paste that ID into `database_id`.

**Create the tables:**
1. In the D1 database page, open the **Console** tab.
2. Open `schema/0001_initial.sql` from your repo, copy ALL of it.
3. Paste into the console and run it. You should see the `users` and `profiles` tables created.

**Bind D1 to your Pages project:**
1. Your Pages project → **Settings** → **Functions** → **D1 database bindings**.
2. Add binding: Variable name = **`DB`** (exactly), Database = `tek1-db`.
3. Save. (This is what makes `env.DB` work in the code.)

---

## 2. Set up Clerk (login)

1. Go to **clerk.com** → sign up (free) → **Create application**.
2. Name it "TEK-1". Enable the sign-in methods you want: **Email**, **Google**, **Discord**.
   - Google/Discord may ask you to enable them — Clerk has one-click setup guides for each.
3. On the Clerk dashboard **API keys** page, copy your **Publishable key** (starts with `pk_`).
4. Open `tek-auth.js` in your repo and paste it into:
   `TEK.CLERK_PUBLISHABLE_KEY = "pk_...";`
   (Publishable keys are safe to expose in frontend code — that's their purpose.)

**Give the backend Clerk's verification URL:**
The backend verifies login tokens against Clerk's public keys. It needs your Clerk
"Frontend API" URL (the JWKS endpoint).
1. In Clerk dashboard → **API keys** → find your **Frontend API URL** (looks like
   `https://your-app-name.clerk.accounts.dev` or a custom domain).
2. Your Pages project → **Settings** → **Environment variables** → add:
   - `CLERK_JWKS_URL` = `https://YOUR-FRONTEND-API/.well-known/jwks.json`
   - `CLERK_ISSUER` = `https://YOUR-FRONTEND-API`  (optional but recommended)
3. Save and **redeploy**.

---

## 3. Deploy

Push all the files to your GitHub repo (or upload the zip contents). New files this milestone:
- `schema/0001_initial.sql`
- `functions/_lib/auth.js`
- `functions/api/me/profile.js`
- `functions/api/me/delete.js`
- `tek-auth.js`
- `dashboard.html`, `profile.html`
- `wrangler.toml`
- updated nav on the existing pages

---

## 4. Test it

1. Visit `your-site.pages.dev/dashboard.html`.
2. You should see a Clerk sign-in box. Sign up with email/Google/Discord.
3. After signing in, you'll be prompted to set up your profile.
4. Go to **Edit profile**, set your main (Lars), rank (Garyu), Tekken ID, save.
5. Back on the dashboard — it should greet you and show your main + rank + quick links.
6. Try **Delete account** to confirm it works (you can re-sign up after).

### If something's off
- **Sign-in box doesn't load** → publishable key not set in `tek-auth.js`, or wrong.
- **"Database not configured"** → the `DB` binding isn't set on the Pages project (step 1).
- **"Not signed in" after signing in** → `CLERK_JWKS_URL` env var missing/wrong, or you didn't redeploy after adding it.
- **Profile won't save** → check the browser console; usually the D1 binding or JWKS url.

---

## What this milestone gives you
- Real accounts (Clerk): email, Google, Discord, password reset, email verification — all handled by Clerk.
- A D1 database storing each user's profile (main, secondaries, rank, Tekken ID, playstyle).
- A personalized dashboard.
- Account deletion (your data + Clerk identity).

## What's next (future milestones)
- **M2:** Import match history from your Tekken ID into D1, show it per-user.
- **M3:** Matchup/punishment tools generated from frame data for any main.
- **M4:** AI coach that analyzes your matches and recommends drills.
- **M5+:** Character guides, practice tracking, community.

# 🚀 SETUP GUIDE — Lightning Trainer (full site)

You're deploying a real multi-page Tekken 8 site: a Lars trainer, **live frame data for all 40+ characters**, and a player-stats lookup for you and your crew. It's **free** and the setup is a one-time ~20 minutes. Every click is spelled out.

Two free accounts needed: **EWGF** (for the player-stats API key) and **Cloudflare** (the host).

---

## What's in this folder

```
lars-site/
├── index.html          ← homepage / landing
├── trainer.html        ← the Lars coaching trainer
├── framedata.html      ← live frame data, all characters
├── player.html         ← player stats lookup
├── resources.html      ← links to the best Tekken tools
├── style.css           ← shared look for all pages
└── functions/
    └── api/
        ├── player.js     ← EWGF proxy (holds your secret key)
        └── framedata.js  ← TekkenDocs frame-data proxy (no key needed)
```

**Don't rename or move anything.** The `functions/api/` paths are what create the live endpoints. Upload the whole folder exactly as-is.

---

## STEP 1 — Get your EWGF API key (5 min)

Powers the player-stats lookup. Stays secret on the server; your friends never see it.

1. Go to **https://www.ewgf.gg** → **Sign In** (top right). Free account.
2. Go to **https://www.ewgf.gg/settings** → **Developer** tab.
3. **Generate an API key/token.** Copy it somewhere safe for a minute.

> Free tier = 100 lookups/day, shared across everyone using your site. Plenty for a crew.
> (The frame-data feature needs NO key — it's a different free source.)

---

## STEP 2 — Free Cloudflare account (3 min)

1. **https://dash.cloudflare.com/sign-up** — sign up (free, no card needed).
2. Verify your email if asked.

---

## STEP 3 — Deploy the site (5 min)

1. Dashboard → **Workers & Pages** (or **Compute (Workers)** → **Pages**).
2. **Create application** → **Pages** → **Upload assets** (a.k.a. Direct Upload).
3. Name it, e.g. **`lars-trainer`** → your site becomes `lars-trainer.pages.dev`.
4. **Drag the whole `lars-site` folder** in. Make sure ALL the .html files, `style.css`, AND the `functions` folder upload.
   - If it wants a zip: select everything *inside* `lars-site`, zip it, upload the zip.
5. **Deploy site.** Wait ~30 sec → open the link. Homepage + Trainer + Frame Data should all work right away.

> Frame Data works immediately (no key). **Player Lookup won't work until Step 4.**

---

## STEP 4 — Add your EWGF secret key (3 min) ⚡

1. Your Pages project → **Settings** → **Environment variables** (a.k.a. Variables and Secrets).
2. **Add variable:**
   - **Name:** `EWGF_TOKEN`  ← exactly this, all caps
   - **Value:** paste your EWGF key from Step 1
   - If there's an **Encrypt / Secret** toggle, turn it ON. Set for **Production**.
3. **Save.**
4. **Redeploy:** Deployments tab → latest deployment → **⋯** → **Retry deployment** (or re-upload the folder once).

---

## STEP 5 — Test (1 min)

- **Frame Data:** click it, pick any character — moves load instantly, color-coded.
- **Player Lookup:** paste a Tekken ID (try `5LrJB8LReLJB`) → stats + recent battles.

If Player Lookup says "missing EWGF key," Step 4 wasn't saved or you didn't redeploy after. Redo it.

---

## Done! Share the `.pages.dev` link with your crew.

No accounts or setup on their end. The 100 daily EWGF lookups are shared across all of you. Frame data is unlimited.

---

## Updating later

- **New matchup / new patch:** I send fresh files → Cloudflare → your project → upload the updated folder. Your `EWGF_TOKEN` stays — don't re-enter it.
- Practice-plan checkboxes & saved friends live in each person's browser, so redeploys don't wipe them.

---

## Quick fixes

| Problem | Fix |
|---|---|
| Player Lookup: "missing EWGF key" | Step 4 not saved / no redeploy. Redo Step 4 + redeploy. |
| "EWGF rejected the API key" | Key wrong/expired — regenerate on ewgf.gg, update `EWGF_TOKEN`. |
| "Rate limit hit" | Used the 100 free EWGF lookups today. Resets midnight UTC. |
| Frame data won't load for a character | Name may differ on TekkenDocs, or it's briefly down. Try another character to confirm the site works. |
| Works for you, not friends | Send the `.pages.dev` URL, not a local file. The live features only work deployed. |

---

## Notes on the data

- **Frame data** comes from TekkenDocs (credited on the page). It's their current patch data. For the absolute final word on any number, the in-game move list with frame data on is always correct.
- **The frame-data display reads whatever TekkenDocs returns.** If a column ever looks off for some character, tell me — their data shape can vary slightly between characters and I can tune the parser.
- **Player stats** come from EWGF. First time you run a lookup, click "view raw data" at the bottom of a result; if any field looks mislabeled, send me that JSON and I'll fix the display.

---

## Prefer Vercel or Netlify?

Cloudflare is smoothest. For the others the functions move (`api/` for Vercel, `netlify/functions/` for Netlify) and the export style changes slightly — ask and I'll convert both functions.

---

*Built for RIDD & crew. Frame data: tekkendocs.com. Player stats: ewgf.gg. Climb with fundamentals, not luck.*

// ============================================================
//  /api/me/profile  — get or update the logged-in user's profile
// ------------------------------------------------------------
//  GET  -> returns { user, profile } for the authed user
//  POST -> upserts profile fields for the authed user
//
//  Auth: requires a valid Clerk bearer token. The user can only
//  ever read/write THEIR OWN row (keyed by verified clerk_user_id).
//  Requires binding: env.DB (D1)
// ============================================================
import { getAuthedUserId, json } from "../../_lib/auth.js";

const ALLOWED_FIELDS = [
  "avatar_url","country","platform","tekken_id","current_rank","highest_rank",
  "main_character","secondary_1","secondary_2","secondary_3",
  "favorite_stage","favorite_music","playstyle","onboarded"
];

export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!env.DB) return json({ error: "Database not configured (D1 binding 'DB' missing)." }, 500, cors);

  const clerkId = await getAuthedUserId(request, env);
  if (!clerkId) return json({ error: "Not signed in." }, 401, cors);

  // Ensure a users row exists for this Clerk user (first-visit auto-provision).
  const user = await ensureUser(env.DB, clerkId, request);

  if (request.method === "GET") {
    const profile = await env.DB.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(user.id).first();
    return json({ user, profile: profile || null }, 200, cors);
  }

  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400, cors); }

    // username lives on users; everything else on profiles
    if (typeof body.username === "string" && body.username.trim()) {
      const uname = body.username.trim().slice(0, 24);
      if (!/^[A-Za-z0-9_]{3,24}$/.test(uname)) return json({ error: "Username must be 3–24 chars: letters, numbers, underscore." }, 400, cors);
      // uniqueness check (excluding self)
      const clash = await env.DB.prepare("SELECT id FROM users WHERE username = ? AND id != ?").bind(uname, user.id).first();
      if (clash) return json({ error: "That username is taken." }, 409, cors);
      await env.DB.prepare("UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?").bind(uname, user.id).run();
    }

    // collect only allowed profile fields that were provided
    const sets = [], vals = [];
    for (const f of ALLOWED_FIELDS) {
      if (body[f] !== undefined) {
        sets.push(f + " = ?");
        vals.push(body[f] === null ? null : String(body[f]).slice(0, 200));
      }
    }
    // upsert profile row
    const existing = await env.DB.prepare("SELECT user_id FROM profiles WHERE user_id = ?").bind(user.id).first();
    if (!existing) {
      await env.DB.prepare("INSERT INTO profiles (user_id) VALUES (?)").bind(user.id).run();
    }
    if (sets.length) {
      sets.push("updated_at = datetime('now')");
      vals.push(user.id);
      await env.DB.prepare("UPDATE profiles SET " + sets.join(", ") + " WHERE user_id = ?").bind(...vals).run();
    }

    const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
    const profile = await env.DB.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(user.id).first();
    return json({ user: updatedUser, profile }, 200, cors);
  }

  return json({ error: "Method not allowed." }, 405, cors);
}

async function ensureUser(DB, clerkId, request) {
  let user = await DB.prepare("SELECT * FROM users WHERE clerk_user_id = ?").bind(clerkId).first();
  if (user) return user;
  await DB.prepare("INSERT INTO users (clerk_user_id) VALUES (?)").bind(clerkId).run();
  user = await DB.prepare("SELECT * FROM users WHERE clerk_user_id = ?").bind(clerkId).first();
  // create empty profile row too
  await DB.prepare("INSERT OR IGNORE INTO profiles (user_id) VALUES (?)").bind(user.id).run();
  return user;
}

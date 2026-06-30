// ============================================================
//  /api/me/matches  — read the user's stored match history + stats
//  GET: returns recent matches + computed summary (win rate,
//       per-opponent-character breakdown) straight from D1.
//  Requires: env.DB
// ============================================================
import { getAuthedUserId, json } from "../../_lib/auth.js";

export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!env.DB) return json({ error: "Database not configured." }, 500, cors);

  const clerkId = await getAuthedUserId(request, env);
  if (!clerkId) return json({ error: "Not signed in." }, 401, cors);

  const user = await env.DB.prepare("SELECT id FROM users WHERE clerk_user_id = ?").bind(clerkId).first();
  if (!user) return json({ error: "User not found." }, 404, cors);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 100);

  const recent = await env.DB.prepare(
    `SELECT played_at, player_char, opponent_name, opponent_char, opponent_rank,
            result, rounds_won, rounds_lost, stage, battle_type
     FROM imported_matches WHERE user_id = ?
     ORDER BY played_at DESC LIMIT ?`
  ).bind(user.id, limit).all();

  // overall win/loss
  const wl = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) AS wins,
       SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) AS losses,
       COUNT(*) AS total
     FROM imported_matches WHERE user_id = ?`
  ).bind(user.id).first();

  // per-opponent-character record (your weak/strong matchups)
  const byOpp = await env.DB.prepare(
    `SELECT opponent_char AS chr,
       SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) AS wins,
       SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) AS losses,
       COUNT(*) AS games
     FROM imported_matches WHERE user_id = ? AND opponent_char != ''
     GROUP BY opponent_char HAVING games >= 1
     ORDER BY games DESC`
  ).bind(user.id).all();

  const ss = await env.DB.prepare("SELECT last_synced_at, match_count FROM sync_state WHERE user_id = ?").bind(user.id).first();

  return json({
    summary: {
      wins: (wl && wl.wins) || 0,
      losses: (wl && wl.losses) || 0,
      total: (wl && wl.total) || 0,
      last_synced_at: ss ? ss.last_synced_at : null,
    },
    matches: (recent && recent.results) || [],
    by_opponent: (byOpp && byOpp.results) || [],
  }, 200, cors);
}

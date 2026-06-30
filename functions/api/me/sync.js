// ============================================================
//  /api/me/sync  — import the user's recent battles into D1
// ------------------------------------------------------------
//  POST: pulls battles from EWGF for the user's saved Tekken ID,
//  normalizes each (detecting which side is the user), de-dupes,
//  and stores into imported_matches. Rate-limited & respectful:
//   - min interval between syncs (unless ?force=1 within reason)
//   - stops if EWGF's reported rate-limit is nearly exhausted
//  Requires: env.DB, env.EWGF_TOKEN
// ============================================================
import { getAuthedUserId, json } from "../../_lib/auth.js";

const MIN_SYNC_INTERVAL_MIN = 30;   // don't re-sync more than every 30 min
const RATE_LIMIT_FLOOR = 10;        // stop if EWGF says fewer than this remain

export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);
  if (!env.DB) return json({ error: "Database not configured." }, 500, cors);
  if (!env.EWGF_TOKEN) return json({ error: "EWGF token not configured." }, 500, cors);

  const clerkId = await getAuthedUserId(request, env);
  if (!clerkId) return json({ error: "Not signed in." }, 401, cors);

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  // resolve user + tekken id
  const user = await env.DB.prepare("SELECT id FROM users WHERE clerk_user_id = ?").bind(clerkId).first();
  if (!user) return json({ error: "User not found." }, 404, cors);
  const profile = await env.DB.prepare("SELECT tekken_id FROM profiles WHERE user_id = ?").bind(user.id).first();
  const tekkenId = profile && profile.tekken_id ? profile.tekken_id.trim() : "";
  if (!tekkenId) return json({ error: "No Tekken ID set. Add it in your profile first." }, 400, cors);

  // rate-limit: check last sync
  const ss = await env.DB.prepare("SELECT last_synced_at FROM sync_state WHERE user_id = ?").bind(user.id).first();
  if (ss && ss.last_synced_at && !force) {
    const mins = (Date.now() - new Date(ss.last_synced_at + "Z").getTime()) / 60000;
    if (mins < MIN_SYNC_INTERVAL_MIN) {
      return json({ ok: true, skipped: true, reason: "synced_recently",
        next_in_min: Math.ceil(MIN_SYNC_INTERVAL_MIN - mins) }, 200, cors);
    }
  }
  // even with force, enforce a small floor to avoid abuse
  if (ss && ss.last_synced_at && force) {
    const mins = (Date.now() - new Date(ss.last_synced_at + "Z").getTime()) / 60000;
    if (mins < 2) return json({ ok: true, skipped: true, reason: "too_soon", next_in_min: 2 }, 200, cors);
  }

  // fetch battles from EWGF
  let battles, meta;
  try {
    const r = await fetch("https://api.ewgf.gg/external/battles/" + encodeURIComponent(tekkenId), {
      headers: { "Authorization": "Bearer " + env.EWGF_TOKEN, "Accept": "application/json" },
    });
    if (r.status === 401) return json({ error: "EWGF rejected the API key." }, 502, cors);
    if (r.status === 429) return json({ error: "EWGF rate limit hit. Try again later." }, 429, cors);
    if (!r.ok) return json({ error: "EWGF returned " + r.status }, 502, cors);
    const body = await r.json();
    battles = Array.isArray(body) ? body : (body.data || body.battles || []);
    meta = body._metadata || null;
  } catch (e) {
    return json({ error: "Couldn't reach EWGF." }, 502, cors);
  }

  // respect EWGF's reported budget
  if (meta && typeof meta.rate_limit_remaining === "number" && meta.rate_limit_remaining < RATE_LIMIT_FLOOR) {
    // still store what we got, but note we won't push further
  }

  // normalize + upsert
  let inserted = 0, seen = 0;
  for (const b of battles) {
    seen++;
    const m = normalize(b, tekkenId);
    if (!m) continue;
    try {
      const res = await env.DB.prepare(
        `INSERT OR IGNORE INTO imported_matches
         (user_id, tekken_id, match_key, played_at, player_name, player_char, player_rank,
          opponent_name, opponent_char, opponent_rank, result, rounds_won, rounds_lost,
          stage, battle_type, game_version, raw_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        user.id, tekkenId, m.match_key, m.played_at, m.player_name, m.player_char, m.player_rank,
        m.opponent_name, m.opponent_char, m.opponent_rank, m.result, m.rounds_won, m.rounds_lost,
        m.stage, m.battle_type, m.game_version, m.raw_json
      ).run();
      if (res.meta && res.meta.changes) inserted += res.meta.changes;
    } catch (e) {}
  }

  // total stored
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM imported_matches WHERE user_id = ?").bind(user.id).first();
  const total = countRow ? countRow.c : 0;

  // update sync_state
  await env.DB.prepare(
    `INSERT INTO sync_state (user_id, tekken_id, last_synced_at, last_status, match_count)
     VALUES (?,?,datetime('now'),?,?)
     ON CONFLICT(user_id) DO UPDATE SET tekken_id=excluded.tekken_id, last_synced_at=datetime('now'),
       last_status=excluded.last_status, match_count=excluded.match_count`
  ).bind(user.id, tekkenId, "ok", total).run();

  return json({
    ok: true, inserted, seen, total,
    ewgf_rate_limit_remaining: meta ? meta.rate_limit_remaining : null,
  }, 200, cors);
}

// Turn one EWGF battle into our row, detecting which side is the user.
function normalize(b, myId) {
  if (!b || typeof b !== "object") return null;
  const iAmP1 = b.p1_tekken_id === myId;
  const iAmP2 = b.p2_tekken_id === myId;
  // if neither matches, still store from p1 perspective but mark unknown
  const me = iAmP2 ? "p2" : "p1";
  const opp = iAmP2 ? "p1" : "p2";

  const myWon = (b.winner === (me === "p1" ? 1 : 2));
  const result = (iAmP1 || iAmP2) ? (myWon ? "win" : "loss") : "";

  const playedAt = b.battle_at || "";
  // stable de-dupe key: timestamp + both ids
  const matchKey = [playedAt, b.p1_tekken_id || "", b.p2_tekken_id || ""].join("|");

  return {
    match_key: matchKey,
    played_at: playedAt,
    player_name: b[me + "_name"] || "",
    player_char: b[me + "_char"] || "",
    player_rank: b[me + "_dan_rank"] || "",
    opponent_name: b[opp + "_name"] || "",
    opponent_char: b[opp + "_char"] || "",
    opponent_rank: b[opp + "_dan_rank"] || "",
    result,
    rounds_won: numOrNull(b[me + "_rounds_won"]),
    rounds_lost: numOrNull(b[opp + "_rounds_won"]),
    stage: b.stage_id != null ? String(b.stage_id) : "",
    battle_type: b.battle_type || "",
    game_version: b.game_version != null ? String(b.game_version) : "",
    raw_json: JSON.stringify(b),
  };
}
function numOrNull(v){ const n = parseInt(v,10); return isNaN(n) ? null : n; }

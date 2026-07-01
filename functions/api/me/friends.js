// ============================================================
//  /api/me/friends — manage the signed-in user's friendships
// ------------------------------------------------------------
//  GET  -> { friends:[], incoming:[], outgoing:[] }
//  POST -> { action:'request'|'accept'|'remove'|'block', username? | user_id? }
//  Request->accept flow (no unilateral friends). Either party can remove.
//  Blocking prevents further requests from that user.
//  Requires: env.DB
// ============================================================
import { getAuthedUserId, json } from "../../_lib/auth.js";

export async function onRequest(context){
  const { request, env } = context;
  const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization" };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!env.DB) return json({ error:"Database not configured." },500,cors);

  const clerkId = await getAuthedUserId(request, env);
  if (!clerkId) return json({ error:"Not signed in." },401,cors);
  const me = await env.DB.prepare("SELECT id, username FROM users WHERE clerk_user_id = ?").bind(clerkId).first();
  if (!me) return json({ error:"User not found." },404,cors);

  if (request.method === "GET") return listFriends(env.DB, me, cors);

  // POST actions
  let body; try{ body=await request.json(); }catch{ return json({error:"Invalid JSON."},400,cors); }
  const action = (body.action||"").trim();

  // resolve the target user
  let target = null;
  if (body.user_id) target = await env.DB.prepare("SELECT id, username FROM users WHERE id = ?").bind(body.user_id).first();
  else if (body.username) target = await env.DB.prepare("SELECT id, username FROM users WHERE username = ? COLLATE NOCASE").bind(String(body.username).trim()).first();
  if (!target) return json({ error:"User not found." },404,cors);
  if (target.id === me.id) return json({ error:"You can't friend yourself." },400,cors);

  const lo = Math.min(me.id, target.id), hi = Math.max(me.id, target.id);
  const existing = await env.DB.prepare("SELECT * FROM friendships WHERE low_id=? AND high_id=?").bind(lo,hi).first();

  if (action === "request"){
    if (existing){
      if (existing.status === "accepted") return json({ ok:true, status:"accepted" },200,cors);
      if (existing.status === "blocked") return json({ error:"Unable to send request." },403,cors);
      // pending already
      if (existing.requester_id === me.id) return json({ ok:true, status:"pending" },200,cors);
      // they already requested me -> accept it
      await env.DB.prepare("UPDATE friendships SET status='accepted', updated_at=datetime('now') WHERE low_id=? AND high_id=?").bind(lo,hi).run();
      return json({ ok:true, status:"accepted" },200,cors);
    }
    await env.DB.prepare(
      "INSERT INTO friendships (requester_id, addressee_id, low_id, high_id, status) VALUES (?,?,?,?,'pending')"
    ).bind(me.id, target.id, lo, hi).run();
    return json({ ok:true, status:"pending" },200,cors);
  }

  if (action === "accept"){
    if (!existing || existing.status!=="pending") return json({ error:"No pending request." },400,cors);
    if (existing.addressee_id !== me.id) return json({ error:"You can only accept requests sent to you." },403,cors);
    await env.DB.prepare("UPDATE friendships SET status='accepted', updated_at=datetime('now') WHERE low_id=? AND high_id=?").bind(lo,hi).run();
    return json({ ok:true, status:"accepted" },200,cors);
  }

  if (action === "remove"){
    if (existing) await env.DB.prepare("DELETE FROM friendships WHERE low_id=? AND high_id=?").bind(lo,hi).run();
    return json({ ok:true, status:"none" },200,cors);
  }

  if (action === "block"){
    if (existing) await env.DB.prepare("UPDATE friendships SET status='blocked', requester_id=?, updated_at=datetime('now') WHERE low_id=? AND high_id=?").bind(me.id,lo,hi).run();
    else await env.DB.prepare("INSERT INTO friendships (requester_id, addressee_id, low_id, high_id, status) VALUES (?,?,?,?,'blocked')").bind(me.id,target.id,lo,hi).run();
    return json({ ok:true, status:"blocked" },200,cors);
  }

  return json({ error:"Unknown action." },400,cors);
}

async function listFriends(DB, me, cors){
  // accepted friends
  const friendRows = (await DB.prepare(
    `SELECT f.*, u.username AS other_username, p.main_character AS other_main, p.current_rank AS other_rank
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.low_id=? THEN f.high_id ELSE f.low_id END
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE (f.low_id=? OR f.high_id=?) AND f.status='accepted'
     ORDER BY u.username`
  ).bind(me.id, me.id, me.id).all()).results || [];

  // incoming pending (someone requested me)
  const incoming = (await DB.prepare(
    `SELECT f.id, u.id AS user_id, u.username, p.main_character AS main, p.current_rank AS rank
     FROM friendships f JOIN users u ON u.id=f.requester_id
     LEFT JOIN profiles p ON p.user_id=u.id
     WHERE f.addressee_id=? AND f.status='pending' ORDER BY f.created_at DESC`
  ).bind(me.id).all()).results || [];

  // outgoing pending (I requested someone)
  const outgoing = (await DB.prepare(
    `SELECT f.id, u.id AS user_id, u.username, p.main_character AS main, p.current_rank AS rank
     FROM friendships f JOIN users u ON u.id=f.addressee_id
     LEFT JOIN profiles p ON p.user_id=u.id
     WHERE f.requester_id=? AND f.status='pending' ORDER BY f.created_at DESC`
  ).bind(me.id).all()).results || [];

  const friends = friendRows.map(r=>({
    user_id: (r.low_id===me.id? r.high_id : r.low_id),
    username: r.other_username, main: r.other_main, rank: r.other_rank,
  }));
  return json({ friends, incoming, outgoing },200,cors);
}

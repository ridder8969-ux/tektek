// ============================================================
//  /api/me/privacy — get/set the signed-in user's privacy prefs
//  GET  -> current settings (creates default row if missing)
//  POST -> update { profile_public?, show_matches?, show_tekken_id? }
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
  const me = await env.DB.prepare("SELECT id FROM users WHERE clerk_user_id = ?").bind(clerkId).first();
  if (!me) return json({ error:"User not found." },404,cors);

  // ensure a row exists
  const existing = await env.DB.prepare("SELECT * FROM privacy WHERE user_id = ?").bind(me.id).first();
  if (!existing) await env.DB.prepare("INSERT INTO privacy (user_id) VALUES (?)").bind(me.id).run();

  if (request.method === "GET"){
    const row = await env.DB.prepare("SELECT * FROM privacy WHERE user_id = ?").bind(me.id).first();
    return json({ privacy: row },200,cors);
  }

  let body; try{ body=await request.json(); }catch{ return json({error:"Invalid JSON."},400,cors); }
  const sets=[], vals=[];
  for (const f of ["profile_public","show_matches","show_tekken_id"]){
    if (body[f] !== undefined){ sets.push(f+" = ?"); vals.push(body[f] ? 1 : 0); }
  }
  if (sets.length){ vals.push(me.id);
    await env.DB.prepare("UPDATE privacy SET "+sets.join(", ")+" WHERE user_id = ?").bind(...vals).run();
  }
  const row = await env.DB.prepare("SELECT * FROM privacy WHERE user_id = ?").bind(me.id).first();
  return json({ ok:true, privacy: row },200,cors);
}

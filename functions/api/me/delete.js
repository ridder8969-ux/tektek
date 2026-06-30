// ============================================================
//  /api/me/delete  — delete the logged-in user's account data
// ------------------------------------------------------------
//  POST -> removes this user's rows from D1 (profile cascades).
//  NOTE: this deletes OUR data. The Clerk identity itself should
//  also be deleted via Clerk (frontend calls user.delete() or
//  we call Clerk's API). We surface that in the UI.
//  Requires binding: env.DB
// ============================================================
import { getAuthedUserId, json } from "../../_lib/auth.js";

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

  const clerkId = await getAuthedUserId(request, env);
  if (!clerkId) return json({ error: "Not signed in." }, 401, cors);

  const user = await env.DB.prepare("SELECT id FROM users WHERE clerk_user_id = ?").bind(clerkId).first();
  if (user) {
    // profiles cascades via FK, but delete explicitly to be safe across configs
    await env.DB.prepare("DELETE FROM profiles WHERE user_id = ?").bind(user.id).run();
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();
  }
  return json({ ok: true, message: "Your data has been deleted from TEK-1." }, 200, cors);
}

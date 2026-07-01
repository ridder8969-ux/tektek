// ============================================================
//  /api/linked?tekken_id=XXX — is this Tekken ID claimed by a
//  TEK-1 user? Returns their public username if so. Public-safe:
//  only exposes username + main + rank (profiles are public by
//  the product's design), never email or anything sensitive.
//  Requires: env.DB
// ============================================================
export async function onRequest(context){
  const { request, env } = context;
  const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type" };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!env.DB) return json({ linked:false },200,cors);

  const url = new URL(request.url);
  const tid = (url.searchParams.get("tekken_id")||"").trim();
  if(!tid) return json({ linked:false },200,cors);

  try{
    const row = await env.DB.prepare(
      `SELECT u.username AS username, p.main_character AS main, p.current_rank AS rank
       FROM profiles p JOIN users u ON u.id = p.user_id
       WHERE p.tekken_id = ? AND u.username IS NOT NULL LIMIT 1`
    ).bind(tid).first();
    if(!row) return json({ linked:false },200,cors);
    return json({ linked:true, username:row.username, main:row.main||null, rank:row.rank||null },200,cors);
  }catch(e){ return json({ linked:false },200,cors); }
}
function json(o,st,c){return new Response(JSON.stringify(o),{status:st,headers:{"Content-Type":"application/json",...c}});}

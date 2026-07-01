// ============================================================
//  /api/profile-view?username=XXX — public profile of a user
// ------------------------------------------------------------
//  Respects privacy: only returns data if profile_public=1.
//  Never returns email. Match history only if show_matches=1.
//  Tekken ID only if show_tekken_id=1. If a viewer is signed in,
//  also returns the friendship status between them.
//  Requires: env.DB
// ============================================================
import { getAuthedUserId } from "./_lib/auth.js";

export async function onRequest(context){
  const { request, env } = context;
  const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization" };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!env.DB) return json({ error:"Database not configured." },500,cors);

  const url = new URL(request.url);
  const username = (url.searchParams.get("username")||"").trim();
  if (!username) return json({ error:"Need ?username=" },400,cors);

  const target = await env.DB.prepare("SELECT id, username FROM users WHERE username = ? COLLATE NOCASE").bind(username).first();
  if (!target) return json({ error:"No such user." },404,cors);

  // privacy row (default public if none)
  const priv = await env.DB.prepare("SELECT * FROM privacy WHERE user_id = ?").bind(target.id).first()
    || { profile_public:1, show_matches:1, show_tekken_id:0 };

  // viewer (optional) + friendship status
  let viewerId=null, friendStatus="none", isSelf=false;
  const clerkId = await getAuthedUserId(request, env);
  if (clerkId){
    const viewer = await env.DB.prepare("SELECT id FROM users WHERE clerk_user_id = ?").bind(clerkId).first();
    if (viewer){ viewerId=viewer.id; isSelf = viewer.id===target.id;
      if(!isSelf){
        const lo=Math.min(viewer.id,target.id), hi=Math.max(viewer.id,target.id);
        const f=await env.DB.prepare("SELECT status, requester_id, addressee_id FROM friendships WHERE low_id=? AND high_id=?").bind(lo,hi).first();
        if(f){ if(f.status==="accepted") friendStatus="friends";
          else if(f.status==="pending") friendStatus = (f.requester_id===viewer.id?"outgoing":"incoming");
          else if(f.status==="blocked") friendStatus="blocked"; }
      }
    }
  }

  // if private and not self, return minimal
  if (!priv.profile_public && !isSelf){
    return json({ username:target.username, private:true, friend_status:friendStatus, is_self:false },200,cors);
  }

  const p = await env.DB.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(target.id).first() || {};
  const out = {
    username: target.username,
    is_self: isSelf,
    friend_status: friendStatus,
    private: false,
    profile: {
      main_character: p.main_character||null,
      secondary_1: p.secondary_1||null, secondary_2:p.secondary_2||null, secondary_3:p.secondary_3||null,
      current_rank: p.current_rank||null, highest_rank: p.highest_rank||null,
      playstyle: p.playstyle||null, country: p.country||null, platform: p.platform||null,
      favorite_stage: p.favorite_stage||null, favorite_music: p.favorite_music||null,
      tekken_id: priv.show_tekken_id ? (p.tekken_id||null) : null,
    },
  };

  // optional match summary
  if (priv.show_matches){
    const wl = await env.DB.prepare(
      `SELECT SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) AS wins,
              SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) AS losses, COUNT(*) AS total
       FROM imported_matches WHERE user_id = ?`
    ).bind(target.id).first();
    if (wl && wl.total){
      out.stats = { wins:wl.wins||0, losses:wl.losses||0, total:wl.total,
        win_rate: wl.total? Math.round((wl.wins/wl.total)*100):0 };
    }
  }
  return json(out,200,cors);
}
function json(o,st,c){return new Response(JSON.stringify(o),{status:st,headers:{"Content-Type":"application/json",...c}});}

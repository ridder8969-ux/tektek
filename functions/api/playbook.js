// ============================================================
//  /api/playbook?char=lars — a character's coaching playbook,
//  computed from live TekkenDocs frame data. Universal: works
//  for any character so the Trainer can personalize to a user's main.
// ============================================================
const TD = "https://tekkendocs.com/api/t8/";
const SLUG_FIX = { "armorking":"armor-king","armor_king":"armor-king","deviljin":"devil-jin","devil_jin":"devil-jin","jack8":"jack-8","jack_8":"jack-8" };

export async function onRequest(context){
  const { request, waitUntil } = context;
  const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type" };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(request.url);
  let raw = (url.searchParams.get("char")||"").trim().toLowerCase();
  if(!raw) return json({error:"Need ?char="},400,cors);
  const slug = SLUG_FIX[raw.replace(/[-_\s]/g,"")] || SLUG_FIX[raw] || raw.replace(/\s+/g,"-");

  const cache = caches.default;
  const ck = new Request("https://pb-cache.internal/v1/"+slug);
  const hit = await cache.match(ck); if(hit) return hit;

  let moves=[];
  for (const c of [slug, slug.replace(/-/g,"_"), slug.replace(/[-_]/g,"")]){
    try{ const r=await fetch(TD+encodeURIComponent(c)+"/framedata",{headers:{Accept:"application/json","User-Agent":"tek-trainer/1.0"}});
      if(r.ok){ const d=await r.json(); if(Array.isArray(d.framesNormal)&&d.framesNormal.length){ moves=d.framesNormal; break; } } }catch(e){}
  }
  if(!moves.length) return json({error:'No frame data for "'+raw+'".'},502,cors);

  const out = json({ char:slug, playbook: buildPlaybook(moves), credit:"Frame data from tekkendocs.com & rbnorway.org" },200,cors);
  out.headers.set("Cache-Control","public, max-age=86400");
  waitUntil(cache.put(ck,out.clone()));
  return out;
}

function su(m){const x=String(m.startup||"").match(/i?(\d+)/);return x?parseInt(x[1],10):null;}
function blk(m){const x=String(m.block||"").match(/-?\d+/);return x?parseInt(x[0],10):null;}
function hitv(m){const x=String(m.hit||"").match(/-?\d+/);return x?parseInt(x[0],10):null;}
function lvl(m){return String(m.hitLevel||"").toLowerCase();}
function isLaunch(m){return /[ai]/.test(String(m.hit||""))||/launch|tornado/i.test(String(m.notes||""));}
function tagged(m,t){return new RegExp("\\b"+t+"\\b").test(String(m.tags||""));}
function pick(m){if(!m)return null;return {command:m.command,name:m.name||"",hitLevel:m.hitLevel||"",startup:m.startup||"",block:m.block||"",hit:m.hit||"",damage:m.damage||"",notes:trim(m.notes)};}
function trim(n){if(!n)return "";return String(n).split("·").slice(0,2).join("·").trim();}

function buildPlaybook(moves){
  const standing = moves.filter(m=>!/^(SEN|DEN|LEN|FC|ws|H\.|R\.|hFC|\()/i.test(String(m.command||"")) && !/^t/i.test(lvl(m)));
  const ws = moves.filter(m=>/^ws/i.test(String(m.command||"")));

  // punishers
  function bestAt(list,max,launch){const f=list.filter(m=>{const s=su(m);return s!==null&&s<=max;});
    if(launch){const l=f.filter(isLaunch).sort((a,b)=>su(b)-su(a));if(l.length)return l[0];}
    const mids=f.filter(m=>/m/.test(lvl(m))).sort((a,b)=>su(b)-su(a));if(mids.length)return mids[0];
    return f.sort((a,b)=>su(b)-su(a))[0]||null;}

  // best pokes: fast (i13-) mids/lows that are safe-ish (>= -9) and plus or low-minus on block
  const pokes = standing.filter(m=>{const s=su(m),b=blk(m);return s!==null&&s<=13&&b!==null&&b>=-9&&(/m|l/.test(lvl(m)));})
    .sort((a,b)=>su(a)-su(b)).slice(0,6).map(pick);

  // key launchers (big reward, i15+)
  const launchers = standing.filter(m=>isLaunch(m)&&/m/.test(lvl(m))).sort((a,b)=>(su(a)||99)-(su(b)||99)).slice(0,5).map(pick);

  // lows worth using (decent on hit or known)
  const lows = standing.filter(m=>/l/.test(lvl(m))&&!/sl|fl/.test(lvl(m))).sort((a,b)=>(hitv(b)||-99)-(hitv(a)||-99)).slice(0,6).map(pick);

  // heat engagers
  const heat = moves.filter(m=>tagged(m,"he")||/heat engager/i.test(String(m.notes||""))).slice(0,6).map(pick);

  // homing (anti-sidestep)
  const homing = moves.filter(m=>tagged(m,"hom")||/homing/i.test(String(m.notes||""))).slice(0,6).map(pick);

  // power crushes
  const powercrush = moves.filter(m=>tagged(m,"pc")||/power crush/i.test(String(m.notes||""))).slice(0,5).map(pick);

  // safe mids (pressure): mids that are 0 or plus on block
  const safeMids = standing.filter(m=>/m/.test(lvl(m))&&blk(m)!==null&&blk(m)>=0).sort((a,b)=>blk(b)-blk(a)).slice(0,6).map(pick);

  // throws
  const throws = moves.filter(m=>/^t/i.test(lvl(m))).slice(0,6).map(pick);

  return {
    punishers:{ i10:pick(bestAt(standing,10)), i12:pick(bestAt(standing,12)), i13:pick(bestAt(standing,13)), i14:pick(bestAt(standing,14)), i15_launch:pick(bestAt(standing,15,true)), while_standing:pick(bestAt(ws,15,true)) },
    pokes, launchers, lows, heat_engagers:heat, homing, power_crushes:powercrush, safe_mids:safeMids, throws
  };
}
function json(o,st,c){return new Response(JSON.stringify(o),{status:st,headers:{"Content-Type":"application/json",...c}});}

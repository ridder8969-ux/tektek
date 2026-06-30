// ============================================================
//  /api/matchup?me=lars&opp=king  — frame-data-driven matchup tools
// ------------------------------------------------------------
//  Returns, computed from live TekkenDocs frame data:
//   - YOUR punishers (by your main): i10/i12/i13/i14/i15 launch,
//     while-standing punishers
//   - The OPPONENT's scouting report: launch-punishable moves,
//     lows, homing moves, power crushes, fastest mids
//  All factual / generated — accurate for any character pair.
// ============================================================
const TD = "https://tekkendocs.com/api/t8/";
const SLUG_FIX = {
  "armorking":"armor-king","armor_king":"armor-king","deviljin":"devil-jin","devil_jin":"devil-jin",
  "jack8":"jack-8","jack_8":"jack-8"
};

export async function onRequest(context) {
  const { request, waitUntil } = context;
  const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type" };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(request.url);
  const me = norm(url.searchParams.get("me"));
  const opp = norm(url.searchParams.get("opp"));
  if (!me || !opp) return json({ error: "Need ?me= and ?opp= character slugs." }, 400, cors);

  const cache = caches.default;
  const ck = new Request("https://mu-cache.internal/v1/" + me + "_vs_" + opp);
  const cached = await cache.match(ck);
  if (cached) return cached;

  let myMoves, oppMoves;
  try {
    [myMoves, oppMoves] = await Promise.all([fetchMoves(me), fetchMoves(opp)]);
  } catch (e) {
    return json({ error: "Couldn't load frame data for one of the characters." }, 502, cors);
  }
  if (!myMoves.length) return json({ error: 'No frame data for "' + me + '".' }, 502, cors);
  if (!oppMoves.length) return json({ error: 'No frame data for "' + opp + '".' }, 502, cors);

  const payload = {
    me, opp,
    my_punishers: computePunishers(myMoves),
    opp_scouting: computeScouting(oppMoves),
    credit: "Frame data from tekkendocs.com & rbnorway.org",
  };
  const out = json(payload, 200, cors);
  out.headers.set("Cache-Control", "public, max-age=86400");
  waitUntil(cache.put(ck, out.clone()));
  return out;
}

function norm(s){ s=(s||"").trim().toLowerCase(); return SLUG_FIX[s.replace(/[-_\s]/g,"")] || SLUG_FIX[s] || s.replace(/\s+/g,"-"); }

async function fetchMoves(slug){
  const candidates = [slug, slug.replace(/-/g,"_"), slug.replace(/[-_]/g,"")];
  for (const c of candidates) {
    try {
      const r = await fetch(TD + encodeURIComponent(c) + "/framedata", { headers:{Accept:"application/json","User-Agent":"tek-trainer/1.0"} });
      if (!r.ok) continue;
      const d = await r.json();
      if (Array.isArray(d.framesNormal) && d.framesNormal.length) return d.framesNormal;
    } catch(e){}
  }
  return [];
}

// startup as a number: "i13" -> 13, "i15~16" -> 15
function su(m){ const x=String(m.startup||"").match(/i?(\d+)/); return x?parseInt(x[1],10):null; }
function blk(m){ const x=String(m.block||"").match(/-?\d+/); return x?parseInt(x[0],10):null; }
function isHigh(m){ return /h/i.test(String(m.hitLevel||"")) && !/m|l/i.test(String(m.hitLevel||"")); }
function isLaunch(m){ return /[ai]/.test(String(m.hit||"")) || /launch|tornado/i.test(String(m.notes||"")); }

// YOUR punishers: fastest standing move at each key speed that is a real,
// simple punish (mid or high, not a stance/special, reasonable on hit).
function computePunishers(moves){
  // candidate standing punishers: exclude stance-prefixed, throws, specials
  const standing = moves.filter(m=>{
    const c=String(m.command||"");
    if (/^(SEN|DEN|LEN|FC|ws|H\.|R\.|hFC|\(|uf\+3\+4)/i.test(c)) return false; // stance/while-standing/heat/rage
    if (/throw|Back throw|Left throw|Right throw/i.test(String(m.name||"")+c)) return false;
    if (/^t/i.test(String(m.hitLevel||""))) return false;
    return true;
  });
  const ws = moves.filter(m=>/^ws/i.test(String(m.command||"")));

  function bestAt(list, maxStartup, wantLaunch){
    // among moves with startup <= maxStartup, pick the highest-startup (most damage) that fits
    const fits = list.filter(m=>{ const s=su(m); return s!==null && s<=maxStartup; });
    if (wantLaunch){
      const launchers = fits.filter(m=>isLaunch(m)).sort((a,b)=>su(b)-su(a));
      if (launchers.length) return launchers[0];
    }
    // prefer a mid, fastest-to-the-cap, decent damage
    const mids = fits.filter(m=>/m/i.test(String(m.hitLevel||""))).sort((a,b)=>su(b)-su(a));
    if (mids.length) return mids[0];
    const any = fits.sort((a,b)=>su(b)-su(a));
    return any[0]||null;
  }

  return {
    i10: pretty(bestAt(standing,10,false)),
    i12: pretty(bestAt(standing,12,false)),
    i13: pretty(bestAt(standing,13,false)),
    i14: pretty(bestAt(standing,14,false)),
    i15_launch: pretty(bestAt(standing,15,true)),
    while_standing: pretty(bestAt(ws,15,true)),
  };
}
function pretty(m){
  if(!m) return null;
  return { command:m.command, name:m.name||"", startup:m.startup||"", block:m.block||"", hit:m.hit||"", damage:m.damage||"", notes:trimNotes(m.notes) };
}
function trimNotes(n){ if(!n)return ""; return String(n).split("·").slice(0,2).join("·").trim(); }

// OPPONENT scouting: what to watch for, from their movelist.
function computeScouting(moves){
  const launchable = moves.filter(m=>{ const b=blk(m); return b!==null && b<=-15; })
    .sort((a,b)=>blk(a)-blk(b)).slice(0,12).map(scout);
  const punishable = moves.filter(m=>{ const b=blk(m); return b!==null && b<=-10 && b>-15; })
    .sort((a,b)=>blk(a)-blk(b)).slice(0,10).map(scout);
  const lows = moves.filter(m=>/l/i.test(String(m.hitLevel||"")) && !/sl|fl/i.test(String(m.hitLevel||"")))
    .slice(0,12).map(scout);
  const homing = moves.filter(m=>m.isHoming || /homing/i.test(String(m.notes||"")) || /\bhom\b/.test(String(m.tags||"")))
    .slice(0,8).map(scout);
  const powercrush = moves.filter(m=>m.isPowerCrush || /power crush/i.test(String(m.notes||"")) || /\bpc\b/.test(String(m.tags||"")))
    .slice(0,8).map(scout);
  const fastMids = moves.filter(m=>{ const s=su(m); return s!==null && s<=13 && /m/i.test(String(m.hitLevel||"")); })
    .sort((a,b)=>su(a)-su(b)).slice(0,8).map(scout);
  return { launchable, punishable, lows, homing, powercrush, fastMids };
}
function scout(m){
  return { command:m.command, name:m.name||"", hitLevel:m.hitLevel||"", startup:m.startup||"", block:m.block||"", hit:m.hit||"", notes:trimNotes(m.notes) };
}

function json(o,st,c){ return new Response(JSON.stringify(o),{status:st,headers:{"Content-Type":"application/json",...c}}); }

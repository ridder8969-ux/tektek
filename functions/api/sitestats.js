// ============================================================
//  /api/sitestats  —  tries EWGF aggregate stats (optional)
//  Attempts a few likely endpoints. If none work on this tier,
//  returns {available:false} so the homepage shows a fallback
//  instead of broken zeros.
// ============================================================
export async function onRequest(context) {
  const { request, env } = context;
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = env.EWGF_TOKEN;
  if (!token) return json({ available: false }, 200, cors);
  const auth = { "Authorization": "Bearer " + token, "Accept": "application/json" };
  const base = "https://api.ewgf.gg/external";

  const candidates = [ base + "/statistics", base + "/stats", base + "/activity", base + "/overview" ];
  for (const u of candidates) {
    try {
      const r = await fetch(u, { headers: auth });
      if (!r.ok) continue;
      const txt = await r.text();
      let d; try { d = JSON.parse(txt); } catch { continue; }
      if (d && typeof d === "object") {
        return json({ available: true, source: u, data: d }, 200, cors);
      }
    } catch (e) {}
  }
  return json({ available: false }, 200, cors);
}
function json(o,s,c){ return new Response(JSON.stringify(o),{status:s,headers:{"Content-Type":"application/json",...c}}); }

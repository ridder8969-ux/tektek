// ============================================================
//  /api/tournaments — upcoming Tekken 8 tournaments via start.gg
// ------------------------------------------------------------
//  Uses start.gg's GraphQL API. Tekken 8 videogameId = 49783
//  (verified from start.gg's own tournament search).
//  Requires env: STARTGG_TOKEN (free key from start.gg developer settings)
//  Gracefully reports "not configured" if the token is missing.
//  Cached 1h at the edge to be respectful.
// ============================================================
const TEKKEN8_ID = 49783;
const GQL = "https://api.start.gg/gql/alpha";

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type" };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!env.STARTGG_TOKEN) {
    return json({ available:false, reason:"not_configured",
      message:"Tournament data needs a free start.gg API key set as STARTGG_TOKEN." }, 200, cors);
  }

  const cache = caches.default;
  const ck = new Request("https://tn-cache.internal/v1/upcoming");
  const hit = await cache.match(ck);
  if (hit) return hit;

  const query = `query T8Tournaments($perPage: Int!, $videogameId: ID!) {
    tournaments(query: { perPage: $perPage, page: 1, sortBy: "startAt asc",
      filter: { upcoming: true, videogameIds: [$videogameId] } }) {
      nodes { id name slug city countryCode startAt numAttendees isOnline
        images { url type } }
    }
  }`;

  try {
    const r = await fetch(GQL, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization":"Bearer " + env.STARTGG_TOKEN },
      body: JSON.stringify({ query, variables: { perPage: 24, videogameId: TEKKEN8_ID } }),
    });
    if (r.status === 401 || r.status === 403) return json({ available:false, reason:"bad_token", message:"start.gg rejected the API key." }, 200, cors);
    if (!r.ok) return json({ available:false, reason:"upstream_"+r.status }, 200, cors);
    const body = await r.json();
    const nodes = (body && body.data && body.data.tournaments && body.data.tournaments.nodes) || [];

    const tournaments = nodes.map(t => ({
      name: t.name, slug: t.slug,
      url: "https://www.start.gg/" + (t.slug || ""),
      city: t.city || null, country: t.countryCode || null,
      online: !!t.isOnline,
      start_at: t.startAt ? new Date(t.startAt * 1000).toISOString() : null,
      attendees: t.numAttendees || null,
      image: pickImage(t.images),
    }));

    const out = json({ available:true, count: tournaments.length, tournaments,
      credit: "Tournament data from start.gg" }, 200, cors);
    out.headers.set("Cache-Control", "public, max-age=3600");
    waitUntil(cache.put(ck, out.clone()));
    return out;
  } catch (e) {
    return json({ available:false, reason:"error" }, 200, cors);
  }
}
function pickImage(images){
  if (!Array.isArray(images)) return null;
  const prof = images.find(i=>i && i.type==="profile") || images[0];
  return prof ? prof.url : null;
}
function json(o,st,c){ return new Response(JSON.stringify(o),{status:st,headers:{"Content-Type":"application/json",...c}}); }

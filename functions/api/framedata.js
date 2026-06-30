// ============================================================
//  /api/framedata?char=lars  — TekkenDocs frame data proxy
//  Fetches server-side (no CORS), reads the framesNormal array,
//  maps the real field names. Data: tekkendocs.com & rbnorway.org
// ============================================================
export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(request.url);
  const char = (url.searchParams.get("char") || "").trim().toLowerCase();
  if (!char) return json({ error: "Missing character. Add ?char=lars" }, 400, cors);
  if (!/^[a-z0-9_-]{2,30}$/.test(char)) return json({ error: "Invalid character name." }, 400, cors);

  const cache = caches.default;
  const cacheKey = new Request("https://fd-cache-v3/" + char, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const sources = [
    "https://tekkendocs.com/api/t8/" + char + "/framedata",
    "https://tekkendocs.com/t8/" + char + "/framedata",
  ];

  for (const src of sources) {
    try {
      const res = await fetch(src, { headers: { "Accept": "application/json", "User-Agent": "tek-trainer/1.0" } });
      if (!res.ok) continue;
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { continue; }

      // The moves live under framesNormal. Accept a few fallbacks just in case.
      let rows = [];
      if (Array.isArray(data.framesNormal)) rows = data.framesNormal;
      else if (Array.isArray(data.frames)) rows = data.frames;
      else if (Array.isArray(data.framedata)) rows = data.framedata;
      else if (Array.isArray(data.moves)) rows = data.moves;
      if (rows.length === 0) continue;

      const moves = rows.map(mapMove).filter(m => m.command);
      if (moves.length === 0) continue;

      const out = json({
        character: char,
        editUrl: data.editUrl || "",
        credit: "Frame data from tekkendocs.com & rbnorway.org",
        count: moves.length,
        moves,
        stances: Array.isArray(data.stances) ? data.stances : [],
        fetched_at: new Date().toISOString(),
      }, 200, cors);
      out.headers.set("Cache-Control", "public, max-age=86400");
      waitUntil(cache.put(cacheKey, out.clone()));
      return out;
    } catch (e) {}
  }
  return json({ error: 'Couldn\'t load frame data for "' + char + '".' }, 502, cors);
}

function mapMove(r) {
  if (!r || typeof r !== "object") return {};
  return {
    command: s(r.command),
    name: s(r.name),
    hitLevel: s(r.hitLevel),
    damage: s(r.damage),
    startup: s(r.startup),
    block: s(r.block),
    hit: s(r.hit),
    counter: s(r.counterHit !== undefined ? r.counterHit : r.counter),
    notes: cleanNotes(r.notes),
    transitions: Array.isArray(r.transitions) ? r.transitions.join(", ") : "",
    tags: r.tags && typeof r.tags === "object" ? Object.keys(r.tags).join(" ") : "",
  };
}
function s(v) { return (v === undefined || v === null) ? "" : String(v).trim(); }
// notes come with markdown bullets and \n — tidy into a short readable string
function cleanNotes(v) {
  if (!v) return "";
  return String(v)
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.replace(/^\*+\s?/, "").trim())
    .filter(Boolean)
    .join(" · ");
}
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });
}

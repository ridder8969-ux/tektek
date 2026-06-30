// ============================================================
//  /api/framedata?char=lars  — TekkenDocs frame data proxy
//  Reads framesNormal, maps real field names. Tries multiple
//  slug variants so every character resolves even if the
//  display slug differs from TekkenDocs' expected slug.
//  Data: tekkendocs.com & rbnorway.org
// ============================================================
export async function onRequest(context) {
  const { request, waitUntil } = context;
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(request.url);
  const raw = (url.searchParams.get("char") || "").trim().toLowerCase();
  if (!raw) return json({ error: "Missing character. Add ?char=lars" }, 400, cors);
  if (!/^[a-z0-9_.\- ]{2,30}$/.test(raw)) return json({ error: "Invalid character name." }, 400, cors);

  // Build candidate slugs from the input so we resolve regardless of formatting.
  const base = raw.replace(/\s+/g, "");
  const candidates = uniq([
    raw,
    base,
    base.replace(/[_.-]/g, ""),         // armorking
    base.replace(/[_.\s]/g, "-"),       // armor-king
    base.replace(/[-\s]/g, "_"),        // devil_jin
    SLUG_FIX[raw] || SLUG_FIX[base] || "",
  ].filter(Boolean));

  const cache = caches.default;
  const cacheKey = new Request("https://fd-cache-v5/" + base, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  for (const slug of candidates) {
    for (const tmpl of ["https://tekkendocs.com/api/t8/{c}/framedata", "https://tekkendocs.com/t8/{c}/framedata"]) {
      const src = tmpl.replace("{c}", encodeURIComponent(slug));
      try {
        const res = await fetch(src, { headers: { "Accept": "application/json", "User-Agent": "tek-trainer/1.0" } });
        if (!res.ok) continue;
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { continue; }

        let rows = [];
        if (Array.isArray(data.framesNormal)) rows = data.framesNormal;
        else if (Array.isArray(data.frames)) rows = data.frames;
        else if (Array.isArray(data.framedata)) rows = data.framedata;
        else if (Array.isArray(data.moves)) rows = data.moves;
        if (rows.length === 0) continue;

        const moves = rows.map(mapMove).filter(m => m.command);
        if (moves.length === 0) continue;

        const out = json({
          character: data.characterName || slug,
          requested: raw,
          resolvedSlug: slug,
          credit: "Frame data from tekkendocs.com & rbnorway.org",
          count: moves.length,
          moves,
          stances: Array.isArray(data.stances) ? data.stances : [],
          fetched_at: new Date().toISOString(),
        }, 200, cors);
        out.headers.set("Cache-Control", "public, max-age=86400");
        waitUntil(cache.put(cacheKey, out.clone()));
        return out;
      } catch {}
    }
  }
  return json({ error: 'Couldn\'t load frame data for "' + raw + '". Tried: ' + candidates.join(", ") }, 502, cors);
}

// Known slug corrections (input -> TekkenDocs slug)
const SLUG_FIX = {
  "armorking":"armor-king", "armor king":"armor-king", "armor_king":"armor-king",
  "deviljin":"devil-jin", "devil jin":"devil-jin", "devil_jin":"devil-jin",
  "jack8":"jack-8", "jack 8":"jack-8", "jack_8":"jack-8", "jack-8":"jack-8",
  "kuma":"kuma", "miary":"miary", "miaryzo":"miary",
};

function mapMove(r) {
  if (!r || typeof r !== "object") return {};
  const tags = r.tags && typeof r.tags === "object" ? Object.keys(r.tags) : [];
  const transitions = Array.isArray(r.transitions) ? r.transitions : [];
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
    transitions: transitions.join(", "),
    // expose a normalized tag list so the front-end can filter reliably
    tags: tags.join(" "),
    // pre-compute helpful booleans for filtering
    isHoming: tags.includes("hom") || /homing/i.test(s(r.notes)),
    isHeat: tags.includes("he") || tags.includes("hs") || tags.includes("hb") || /heat/i.test(s(r.notes)),
    isPowerCrush: tags.includes("pc"),
    isThrow: /^t/i.test(s(r.hitLevel)) || /throw/i.test(s(r.name)),
    isTornado: tags.includes("trn"),
  };
}
function s(v) { return (v === undefined || v === null) ? "" : String(v).trim(); }
function cleanNotes(v) {
  if (!v) return "";
  return String(v).replace(/\r/g, "").split("\n").map(l => l.replace(/^\*+\s?/, "").trim()).filter(Boolean).join(" · ");
}
function uniq(a){ return [...new Set(a)]; }
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });
}

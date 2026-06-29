// ============================================================
//  /api/framedata  —  Cloudflare Pages Function
// ------------------------------------------------------------
//  Fetches Tekken 8 frame data for any character from
//  TekkenDocs' public JSON endpoint, server-side.
//
//  Why a proxy? A browser on your deployed site can't fetch
//  tekkendocs.com directly (cross-origin block). This function
//  runs on the server, fetches it, and hands it back to your
//  page from the same origin — no CORS problem.
//
//  Data courtesy of tekkendocs.com & rbnorway.org (credited
//  in the UI, as they request).
//
//  Usage: /api/framedata?char=lars
// ============================================================

export async function onRequest(context) {
  const { request, env, waitUntil } = context;

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const url = new URL(request.url);
  const char = (url.searchParams.get("char") || "").trim().toLowerCase();

  if (!char) {
    return json({ error: "Missing character. Add ?char=lars" }, 400, cors);
  }
  if (!/^[a-z0-9_-]{2,30}$/.test(char)) {
    return json({ error: "Invalid character name." }, 400, cors);
  }

  // Cache at the edge so we don't hammer TekkenDocs and responses are fast.
  const cache = caches.default;
  const cacheKey = new Request(`https://framedata-cache/${char}`, request);
  let cached = await cache.match(cacheKey);
  if (cached) return cached;

  const sources = [
    `https://tekkendocs.com/api/t8/${char}/framedata`,
    `https://tekkendocs.com/t8/${char}/framedata?_data=routes/t8.$character.framedata`, // fallback shape
  ];

  for (const src of sources) {
    try {
      const res = await fetch(src, {
        headers: { "Accept": "application/json", "User-Agent": "lars-trainer (personal)" },
      });
      if (!res.ok) continue;

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { continue; } // not JSON, try next

      const normalized = normalize(data, char);
      if (!normalized.moves || normalized.moves.length === 0) continue;

      const out = json({
        character: char,
        credit: "Frame data from tekkendocs.com & rbnorway.org",
        count: normalized.moves.length,
        moves: normalized.moves,
        fetched_at: new Date().toISOString(),
      }, 200, cors);

      // Cache for 24h.
      out.headers.set("Cache-Control", "public, max-age=86400");
      waitUntil(cache.put(cacheKey, out.clone()));
      return out;

    } catch (e) {
      // try next source
    }
  }

  return json({
    error: `Couldn't load frame data for "${char}". The character name may be misspelled, or TekkenDocs may be temporarily unavailable.`
  }, 502, cors);
}

// ------------------------------------------------------------
// Normalize whatever TekkenDocs returns into a flat move list.
// Their JSON shape can vary; we handle the common shapes and
// map fields to a stable set the front-end expects.
// ------------------------------------------------------------
function normalize(data, char) {
  let rows = [];

  // Shape A: { framedata: [ {...}, ... ] }
  if (Array.isArray(data.framedata)) rows = data.framedata;
  // Shape B: { moves: [...] }
  else if (Array.isArray(data.moves)) rows = data.moves;
  // Shape C: a bare array
  else if (Array.isArray(data)) rows = data;
  // Shape D: { tables: [ { rows: [...] } ] } (Remix table format)
  else if (data.tables && Array.isArray(data.tables)) {
    for (const t of data.tables) {
      if (Array.isArray(t.rows)) rows = rows.concat(t.rows);
      else if (Array.isArray(t.data)) rows = rows.concat(t.data);
    }
  }
  // Shape E: object keyed by command
  else if (typeof data === "object") {
    rows = Object.values(data).filter(v => v && typeof v === "object");
  }

  const moves = rows.map(r => mapMove(r)).filter(m => m.command);
  return { moves };
}

function mapMove(r) {
  // r may be an object with named keys, or an array of cells.
  if (Array.isArray(r)) {
    // [command, hitLevel, damage, startup, block, hit, ch, notes]
    return {
      command: clean(r[0]),
      hitLevel: clean(r[1]),
      damage: clean(r[2]),
      startup: clean(r[3]),
      block: clean(r[4]),
      hit: clean(r[5]),
      counter: clean(r[6]),
      notes: clean(r[7]),
    };
  }
  return {
    command: clean(pick(r, ["command","cmd","notation","move","name"])),
    hitLevel: clean(pick(r, ["hit_level","hitLevel","hitlevel","level","hl"])),
    damage: clean(pick(r, ["damage","dmg","dam"])),
    startup: clean(pick(r, ["start_up_frame","startup","startUp","speed","i","start"])),
    block: clean(pick(r, ["block_frame","block","onBlock","on_block","blockFrame"])),
    hit: clean(pick(r, ["hit_frame","hit","onHit","on_hit","hitFrame"])),
    counter: clean(pick(r, ["counter_hit_frame","counter","onCH","on_ch","ch","counterHit"])),
    notes: clean(pick(r, ["notes","note","properties","prop","tags"])),
  };
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return "";
}
// Coerce any field value to a clean display string.
// TekkenDocs sometimes returns a field as an object like {value:"..."} or {display:"..."}
// or an array of segments. This digs out the human-readable text.
function clean(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v.map(item => clean(item)).filter(Boolean).join(" ");
  }
  if (typeof v === "object") {
    // try common value-bearing properties first
    const inner = pick(v, ["value","display","text","name","val","formatted","raw","label","content"]);
    if (inner !== "") return clean(inner);
    // otherwise join any primitive leaf values
    const leaves = Object.values(v).map(x => {
      if (typeof x === "string" || typeof x === "number") return String(x);
      return "";
    }).filter(Boolean);
    if (leaves.length) return leaves.join(" ");
    return "";
  }
  return String(v);
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// ============================================================
//  /api/player  —  EWGF player proxy (Pro tier)
// ------------------------------------------------------------
//  Holds your EWGF key as a secret (EWGF_TOKEN) and fetches a
//  player's profile, recent battles, and (if available) stats,
//  then returns it all as one payload.
//  Usage: /api/player?id=TEKKEN_ID
// ============================================================

export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(request.url);
  const id = (url.searchParams.get("id") || "").trim();
  if (!id) return json({ error: "Missing Tekken ID. Add ?id=YOUR_TEKKEN_ID" }, 400, cors);
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(id)) return json({ error: "That doesn't look like a valid Tekken ID." }, 400, cors);

  const token = env.EWGF_TOKEN;
  if (!token) return json({ error: "Server is missing its EWGF API key. Set the EWGF_TOKEN secret in Cloudflare." }, 500, cors);
  const auth = { "Authorization": "Bearer " + token, "Accept": "application/json" };

  const base = "https://api.ewgf.gg/external";
  const endpoints = {
    profile: base + "/profile/" + encodeURIComponent(id),
    battles: base + "/battles/" + encodeURIComponent(id),
    stats:   base + "/stats/" + encodeURIComponent(id),
  };

  async function tryFetch(u) {
    try {
      const r = await fetch(u, { headers: auth });
      if (r.status === 401) return { authError: true };
      if (r.status === 429) return { rateLimited: true, retry: r.headers.get("Retry-After") };
      if (!r.ok) return { missing: true, status: r.status };
      const txt = await r.text();
      try { return { data: JSON.parse(txt) }; } catch (e) { return { missing: true }; }
    } catch (e) { return { missing: true }; }
  }

  const results = await Promise.all([
    tryFetch(endpoints.profile),
    tryFetch(endpoints.battles),
    tryFetch(endpoints.stats),
  ]);
  const profileR = results[0], battlesR = results[1], statsR = results[2];

  if (profileR.authError || battlesR.authError)
    return json({ error: "EWGF rejected the API key. Check the EWGF_TOKEN secret in Cloudflare." }, 502, cors);
  if (profileR.rateLimited || battlesR.rateLimited) {
    const retry = battlesR.retry || profileR.retry || "a bit";
    return json({ error: "EWGF rate limit hit. Try again in " + retry + " seconds." }, 429, cors);
  }
  if ((profileR.missing && profileR.status === 404) && (battlesR.missing && battlesR.status === 404))
    return json({ error: 'Player "' + id + '" not found. Double-check the Tekken ID.' }, 404, cors);

  const profile = profileR.data || null;
  const battles = battlesR.data || null;
  const stats = statsR.data || null;
  if (!profile && !battles && !stats)
    return json({ error: "EWGF returned no usable data for that ID." }, 502, cors);

  return json({ id, profile, battles, stats, fetched_at: new Date().toISOString() }, 200, cors);
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

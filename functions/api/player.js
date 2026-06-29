// ============================================================
//  /api/player  —  Cloudflare Pages Function
// ------------------------------------------------------------
//  This runs ON THE SERVER, not in your friends' browsers.
//  It holds your EWGF API key as a secret (EWGF_TOKEN) so
//  nobody who uses the site can ever see it.
//
//  It takes a Tekken ID, calls EWGF for that player's profile
//  AND recent battles, and returns both as one JSON blob.
//
//  Your friends' browser calls THIS (same origin = no CORS
//  problem). This function calls EWGF with the secret key.
// ============================================================

export async function onRequest(context) {
  const { request, env } = context;

  // CORS headers so the page can call this function cleanly.
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Browsers send a preflight OPTIONS request first — answer it.
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  // Pull the Tekken ID from the query string: /api/player?id=XXXX
  const url = new URL(request.url);
  const id = (url.searchParams.get("id") || "").trim();

  if (!id) {
    return json({ error: "Missing Tekken ID. Add ?id=YOUR_TEKKEN_ID" }, 400, cors);
  }

  // Basic sanity check on the ID format (alphanumeric, dashes/underscores).
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(id)) {
    return json({ error: "That doesn't look like a valid Tekken ID." }, 400, cors);
  }

  // The secret key lives in env.EWGF_TOKEN — set in Cloudflare dashboard.
  const token = env.EWGF_TOKEN;
  if (!token) {
    return json({
      error: "Server is missing its EWGF API key. The site owner needs to set the EWGF_TOKEN secret in the Cloudflare dashboard."
    }, 500, cors);
  }

  const auth = { "Authorization": `Bearer ${token}` };

  try {
    // Fire both EWGF calls at once.
    const [profileRes, battlesRes] = await Promise.all([
      fetch(`https://api.ewgf.gg/external/profile/${encodeURIComponent(id)}`, { headers: auth }),
      fetch(`https://api.ewgf.gg/external/battles/${encodeURIComponent(id)}`, { headers: auth }),
    ]);

    // Handle the common, understandable errors with clear messages.
    if (profileRes.status === 404 || battlesRes.status === 404) {
      return json({ error: `Player "${id}" not found. Double-check the Tekken ID.` }, 404, cors);
    }
    if (profileRes.status === 401 || battlesRes.status === 401) {
      return json({ error: "EWGF rejected the API key. The site owner needs to check the EWGF_TOKEN secret." }, 502, cors);
    }
    if (profileRes.status === 429 || battlesRes.status === 429) {
      const retry = battlesRes.headers.get("Retry-After") || profileRes.headers.get("Retry-After") || "a bit";
      return json({ error: `EWGF rate limit hit (free tier = 100 lookups/day). Try again in ${retry} seconds.` }, 429, cors);
    }

    // Parse whatever came back. EWGF gzips responses; fetch decompresses automatically.
    let profile = null, battles = null;
    try { profile = profileRes.ok ? await profileRes.json() : null; } catch (e) { profile = null; }
    try { battles = battlesRes.ok ? await battlesRes.json() : null; } catch (e) { battles = null; }

    if (!profile && !battles) {
      return json({ error: "EWGF returned no usable data for that ID." }, 502, cors);
    }

    // Return both raw payloads. The front-end renders defensively from these.
    return json({
      id,
      profile,
      battles,
      fetched_at: new Date().toISOString(),
    }, 200, cors);

  } catch (err) {
    return json({ error: "Couldn't reach EWGF. It may be down — try again shortly." }, 502, cors);
  }
}

// Small helper to return JSON with the right headers.
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

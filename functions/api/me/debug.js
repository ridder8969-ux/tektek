// ============================================================
//  /api/me/debug  — TEMPORARY diagnostic for auth troubleshooting
//  Reports (without leaking secrets) why token verification
//  succeeds or fails. DELETE THIS once auth works.
// ============================================================
export async function onRequest(context) {
  const { request, env } = context;
  const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization" };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  const out = { steps: {} };

  // 1. env present?
  out.steps.has_DB = !!env.DB;
  out.steps.has_CLERK_JWKS_URL = !!env.CLERK_JWKS_URL;
  out.steps.CLERK_JWKS_URL_value = env.CLERK_JWKS_URL ? env.CLERK_JWKS_URL : "(missing)";
  out.steps.has_CLERK_ISSUER = !!env.CLERK_ISSUER;
  out.steps.CLERK_ISSUER_value = env.CLERK_ISSUER ? env.CLERK_ISSUER : "(missing)";

  // 2. token arriving?
  const authz = request.headers.get("Authorization") || "";
  const m = authz.match(/^Bearer\s+(.+)$/i);
  out.steps.authorization_header_present = !!authz;
  out.steps.bearer_token_present = !!m;
  if (!m) { return json(out, 200, cors); }
  const token = m[1];

  // 3. token shape
  const parts = token.split(".");
  out.steps.token_parts = parts.length;
  if (parts.length !== 3) { out.steps.error = "token is not a 3-part JWT"; return json(out, 200, cors); }

  // 4. decode header + payload (safe — these are not secret)
  try {
    const header = JSON.parse(dec(parts[0]));
    const payload = JSON.parse(dec(parts[1]));
    out.steps.token_alg = header.alg;
    out.steps.token_kid = header.kid;
    out.steps.token_iss = payload.iss;
    out.steps.token_sub = payload.sub ? "(present)" : "(missing)";
    out.steps.token_exp = payload.exp;
    out.steps.now = Math.floor(Date.now()/1000);
    out.steps.token_expired = payload.exp ? (Math.floor(Date.now()/1000) > payload.exp) : "no exp";
    out.steps.issuer_matches = env.CLERK_ISSUER ? (payload.iss === env.CLERK_ISSUER) : "(no issuer set to compare)";

    // 5. fetch JWKS and check kid match
    if (env.CLERK_JWKS_URL) {
      try {
        const r = await fetch(env.CLERK_JWKS_URL, { headers:{Accept:"application/json"} });
        out.steps.jwks_fetch_status = r.status;
        if (r.ok) {
          const jwks = await r.json();
          out.steps.jwks_key_count = (jwks.keys||[]).length;
          out.steps.jwks_kids = (jwks.keys||[]).map(k=>k.kid);
          out.steps.kid_found_in_jwks = (jwks.keys||[]).some(k=>k.kid===header.kid);
        }
      } catch(e) { out.steps.jwks_fetch_error = String(e); }
    }
  } catch(e) { out.steps.decode_error = String(e); }

  return json(out, 200, cors);
}
function dec(b64url){ const b64=b64url.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(b64url.length/4)*4,"=");const bin=atob(b64);let s="";for(let i=0;i<bin.length;i++)s+=String.fromCharCode(bin.charCodeAt(i));return decodeURIComponent(escape(s));}
function json(o,st,c){ return new Response(JSON.stringify(o,null,2),{status:st,headers:{"Content-Type":"application/json",...c}}); }

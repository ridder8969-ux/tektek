// ============================================================
//  Shared auth helper — verifies a Clerk session token (JWT).
// ------------------------------------------------------------
//  Clerk issues a short-lived JWT to the browser. The frontend
//  sends it as "Authorization: Bearer <jwt>". We verify the
//  signature against Clerk's public JWKS so the backend can
//  trust "who is this user" without ever handling a password.
//
//  env required: CLERK_JWKS_URL (https://<subdomain>/.well-known/jwks.json)
//  env optional: CLERK_ISSUER   (https://<subdomain>)
// ============================================================
let _jwks = null, _jwksAt = 0;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function getJwks(jwksUrl) {
  const now = Date.now();
  if (_jwks && (now - _jwksAt) < JWKS_TTL_MS) return _jwks;
  const res = await fetch(jwksUrl, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error("Failed to fetch JWKS");
  _jwks = await res.json(); _jwksAt = now;
  return _jwks;
}
function b64urlToUint8(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
async function importRsaKey(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}
export async function verifyClerkToken(token, env) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const header = JSON.parse(new TextDecoder().decode(b64urlToUint8(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64urlToUint8(p)));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp + 5) return null;
    if (payload.nbf && now < payload.nbf - 5) return null;
    if (env.CLERK_ISSUER && payload.iss && payload.iss !== env.CLERK_ISSUER) return null;
    const jwks = await getJwks(env.CLERK_JWKS_URL);
    const jwk = (jwks.keys || []).find(k => k.kid === header.kid);
    if (!jwk) return null;
    const key = await importRsaKey(jwk);
    const data = new TextEncoder().encode(h + "." + p);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToUint8(s), data);
    if (!ok) return null;
    return payload;
  } catch (e) { return null; }
}
export async function getAuthedUserId(request, env) {
  const authz = request.headers.get("Authorization") || "";
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = await verifyClerkToken(m[1], env);
  return payload ? payload.sub : null;
}
export function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json", ...(extra || {}) } });
}

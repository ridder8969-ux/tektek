// ============================================================
//  TEK-1 frontend auth bootstrap (Clerk)
// ------------------------------------------------------------
//  Loads Clerk, exposes helpers used by dashboard/profile pages.
//  Set your publishable key in CLERK_PUBLISHABLE_KEY below
//  (publishable keys are safe to expose in frontend code).
// ============================================================
window.TEK = window.TEK || {};

// >>> PASTE YOUR CLERK PUBLISHABLE KEY HERE (starts with pk_) <<<
TEK.CLERK_PUBLISHABLE_KEY = "pk_test_REPLACE_ME";

// Load Clerk's script, init, and resolve when ready.
TEK.initClerk = async function(){
  if (window.Clerk && window.Clerk.loaded) return window.Clerk;
  await new Promise((resolve, reject)=>{
    if (document.getElementById("clerk-js")) { resolve(); return; }
    const s = document.createElement("script");
    s.id = "clerk-js";
    s.setAttribute("data-clerk-publishable-key", TEK.CLERK_PUBLISHABLE_KEY);
    s.async = true;
    s.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
    s.onload = resolve; s.onerror = ()=>reject(new Error("Failed to load Clerk"));
    document.head.appendChild(s);
  });
  await window.Clerk.load();
  return window.Clerk;
};

// Get a verified session token to send to our API.
TEK.getToken = async function(){
  if (!window.Clerk || !window.Clerk.session) return null;
  return await window.Clerk.session.getToken();
};

// Authenticated fetch to our own API.
TEK.api = async function(path, opts){
  opts = opts || {};
  const token = await TEK.getToken();
  const headers = Object.assign({ "Content-Type":"application/json" }, opts.headers||{});
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(path, Object.assign({}, opts, { headers }));
  let data = null; try { data = await res.json(); } catch(e){}
  return { ok: res.ok, status: res.status, data };
};

TEK.isSignedIn = function(){ return !!(window.Clerk && window.Clerk.user); };

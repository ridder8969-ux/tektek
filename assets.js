// ============================================================
//  Shared image helpers — attempt real sources, fall back clean.
//  These are best-effort: if an image URL doesn't resolve, the
//  UI shows a styled initial/label instead (handled by onerror).
// ============================================================
(function(global){
  // Character portrait attempt. EWGF serves character art under /static.
  // We try a couple of patterns; onerror in the <img> hides broken ones.
  function charImg(slug){
    const s = String(slug||"").toLowerCase().replace(/[_\s]/g,"-");
    // EWGF Next.js static image proxy pattern (best-effort)
    return "https://www.ewgf.gg/static/character-images/" + s + ".png";
  }
  // Rank badge attempt by rank name.
  function rankImg(rankName){
    const s = String(rankName||"").toLowerCase().replace(/\s+/g,"-").replace(/[^\w-]/g,"");
    return "https://www.ewgf.gg/static/rank-images/" + s + ".png";
  }
  // Colored initial fallback block (data URI-free; returns HTML).
  function initialBlock(name, size, color){
    const n = String(name||"?").trim();
    const letter = n ? n[0].toUpperCase() : "?";
    const c = color || "#4d9fff";
    size = size || 40;
    return '<span class="img-fallback" style="width:'+size+'px;height:'+size+'px;background:linear-gradient(135deg,'+c+'33,'+c+'11);color:'+c+';border:1px solid '+c+'44;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:'+(size*0.42)+'px;flex:none">'+letter+'</span>';
  }
  global.TekAssets = { charImg, rankImg, initialBlock };
})(window);

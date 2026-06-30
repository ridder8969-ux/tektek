// ============================================================
//  Shared image helpers — EWGF circular character icons.
//  Real path confirmed: /static/circular_character_icons/{slug}.webp
//  Served via EWGF's Next.js image proxy. Falls back to a clean
//  colored initial if an image fails (onerror in the <img>).
// ============================================================
(function(global){

  // Map our display slugs -> EWGF icon slugs (lowercase, underscores).
  const CHAR_ICON_SLUG = {
    "armor-king":"armor_king","armorking":"armor_king",
    "devil-jin":"devil_jin","deviljin":"devil_jin",
    "jack-8":"jack_8","jack8":"jack_8",
    "miary":"miary","miary-zo":"miary",
    // most are just the plain lowercase name:
    "alisa":"alisa","anna":"anna","asuka":"asuka","azucena":"azucena","bryan":"bryan",
    "clive":"clive","claudio":"claudio","dragunov":"dragunov","eddy":"eddy","fahkumram":"fahkumram",
    "feng":"feng","heihachi":"heihachi","hwoarang":"hwoarang","jin":"jin","jun":"jun",
    "kazuya":"kazuya","king":"king","kuma":"kuma","lars":"lars","law":"law","lee":"lee",
    "leo":"leo","leroy":"leroy","lidia":"lidia","lili":"lili","nina":"nina","panda":"panda",
    "paul":"paul","raven":"raven","reina":"reina","shaheen":"shaheen","steve":"steve",
    "victor":"victor","xiaoyu":"xiaoyu","yoshimitsu":"yoshimitsu","zafina":"zafina",
    "kunimitsu":"kunimitsu","bob":"bob"
  };

  function normSlug(s){ return String(s||"").toLowerCase().trim().replace(/\s+/g,"-").replace(/[^\w-]/g,""); }

  function iconSlug(slug){
    const n = normSlug(slug);
    return CHAR_ICON_SLUG[n] || n.replace(/-/g,"_");
  }

  // Character circular icon. Direct static path (confirmed accessible).
  function charImg(slug, size){
    return "https://www.ewgf.gg/static/circular_character_icons/" + iconSlug(slug) + ".webp";
  }
  // Proxy variant as a secondary option.
  function charImgDirect(slug){
    const path = "/static/circular_character_icons/" + iconSlug(slug) + ".webp";
    return "https://www.ewgf.gg/_next/image?url=" + encodeURIComponent(path) + "&w=96&q=75";
  }

  // Rank badge — confirmed path: /static/rank-icons/{PascalName}T8.webp
  // e.g. BeginnerT8.webp, GaryuT8.webp, MightyRulerT8.webp
  const RANK_FILE = {
    "beginner":"Beginner","1st dan":"1stDan","2nd dan":"2ndDan",
    "fighter":"Fighter","strategist":"Strategist","combatant":"Combatant",
    "brawler":"Brawler","ranger":"Ranger","cavalry":"Cavalry",
    "warrior":"Warrior","assailant":"Assailant","dominator":"Dominator",
    "vanquisher":"Vanquisher","destroyer":"Destroyer","eliminator":"Eliminator",
    "garyu":"Garyu","shinryu":"Shinryu","tenryu":"Tenryu",
    "mighty ruler":"MightyRuler","flame ruler":"FlameRuler","battle ruler":"BattleRuler",
    "fujin":"Fujin","raijin":"Raijin","kishin":"Kishin","bushin":"Bushin",
    "tekken king":"TekkenKing","tekken emperor":"TekkenEmperor",
    "tekken god":"TekkenGod","tekken god supreme":"TekkenGodSupreme",
    "god of destruction":"GodOfDestruction",
    "god of destruction i":"GodOfDestruction1","god of destruction ii":"GodOfDestruction2",
    "god of destruction iii":"GodOfDestruction3"
  };
  function rankFile(rankName){
    const key = String(rankName||"").toLowerCase().trim();
    if (RANK_FILE[key]) return RANK_FILE[key];
    // fallback: strip non-alphanumerics and PascalCase each word
    return key.replace(/[^a-z0-9 ]/g,"").split(/\s+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join("");
  }
  function rankImg(rankName){
    return "https://www.ewgf.gg/static/rank-icons/" + rankFile(rankName) + "T8.webp";
  }

  // Colored initial fallback block (returns HTML string).
  function initialBlock(name, size, color){
    const n = String(name||"?").trim();
    const letter = n ? n[0].toUpperCase() : "?";
    const c = color || "#4d9fff";
    size = size || 40;
    return '<span class="img-fallback" style="width:'+size+'px;height:'+size+'px;background:linear-gradient(135deg,'+c+'33,'+c+'11);color:'+c+';border:1px solid '+c+'44;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:'+(size*0.42)+'px;flex:none">'+letter+'</span>';
  }

  global.TekAssets = { charImg, charImgDirect, rankImg, initialBlock, iconSlug };
})(window);

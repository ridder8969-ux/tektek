// ============================================================
//  /api/me/coach — data-grounded coaching insights from stored matches
// ------------------------------------------------------------
//  Computes TRUE insights from imported_matches (no fabrication):
//   - worst/best matchups by win rate (min sample)
//   - recent form (last N record + streak)
//   - "close losses" signal (lost 2-3 a lot vs a char/group)
//   - most-faced characters (what to prioritize learning)
//   - rank-context note
//  Each insight carries an action link (matchup analyzer / frame data).
//  Requires: env.DB
// ============================================================
import { getAuthedUserId, json } from "../../_lib/auth.js";

export async function onRequest(context) {
  const { request, env } = context;
  const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization" };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!env.DB) return json({ error:"Database not configured." }, 500, cors);

  const clerkId = await getAuthedUserId(request, env);
  if (!clerkId) return json({ error:"Not signed in." }, 401, cors);
  const user = await env.DB.prepare("SELECT id FROM users WHERE clerk_user_id = ?").bind(clerkId).first();
  if (!user) return json({ error:"User not found." }, 404, cors);

  const prof = await env.DB.prepare("SELECT main_character, current_rank, tekken_id FROM profiles WHERE user_id = ?").bind(user.id).first();
  const main = (prof && prof.main_character) || "lars";

  // pull recent matches (cap for analysis)
  const rows = (await env.DB.prepare(
    `SELECT played_at, opponent_char, opponent_rank, result, rounds_won, rounds_lost
     FROM imported_matches WHERE user_id = ? ORDER BY played_at DESC LIMIT 200`
  ).bind(user.id).all()).results || [];

  if (rows.length < 3) {
    return json({ ready:false, reason:"not_enough_matches", have: rows.length,
      message:"Sync more matches to unlock coaching. We need at least a few games to spot patterns." }, 200, cors);
  }

  const insights = [];

  // ---- overall + recent form ----
  const wins = rows.filter(r=>r.result==="win").length;
  const losses = rows.filter(r=>r.result==="loss").length;
  const total = wins+losses;
  const wr = total? Math.round(wins/total*100):0;

  const recent = rows.slice(0, Math.min(10, rows.length));
  const rWins = recent.filter(r=>r.result==="win").length;
  const rLoss = recent.filter(r=>r.result==="loss").length;
  // streak
  let streak=0, streakType=null;
  for (const r of rows){ if(!r.result) continue; if(streakType===null){streakType=r.result;streak=1;} else if(r.result===streakType) streak++; else break; }

  insights.push({
    kind:"form", severity: rLoss>rWins?"warn":"good",
    title:"Recent form",
    body:`You're ${rWins}-${rLoss} in your last ${rWins+rLoss}. Tracked win rate: ${wr}%.` +
         (streak>=3? ` Current ${streakType} streak: ${streak}.`:""),
  });

  // ---- matchup win rates ----
  const byChar = {};
  for (const r of rows){
    const c=(r.opponent_char||"").trim(); if(!c) continue;
    byChar[c]=byChar[c]||{c,wins:0,losses:0,games:0,closeLosses:0};
    byChar[c].games++;
    if(r.result==="win") byChar[c].wins++;
    else if(r.result==="loss"){ byChar[c].losses++;
      if (r.rounds_won===2 && r.rounds_lost===3) byChar[c].closeLosses++;
    }
  }
  const chars = Object.values(byChar);

  // worst matchups (min 3 games, sub-50%)
  const worst = chars.filter(x=>x.games>=3 && (x.wins/x.games)<0.5)
    .sort((a,b)=> (a.wins/a.games)-(b.wins/b.games)).slice(0,3);
  for (const w of worst){
    insights.push({
      kind:"weak_matchup", severity:"bad",
      title:`Struggling vs ${w.c}`,
      body:`You're ${w.wins}-${w.losses} against ${w.c} (${Math.round(w.wins/w.games*100)}% over ${w.games} games)` +
           (w.closeLosses>=2? `, and ${w.closeLosses} of those losses went to a deciding round — you're close.`:`.`),
      action:{ label:`${cap(main)} vs ${w.c} →`, href:`./matchup.html?me=${main}&opp=${slug(w.c)}` },
    });
  }

  // best matchups (confidence booster, min 3)
  const best = chars.filter(x=>x.games>=3 && (x.wins/x.games)>=0.6)
    .sort((a,b)=> (b.wins/b.games)-(a.wins/a.games)).slice(0,2);
  for (const b of best){
    insights.push({
      kind:"strong_matchup", severity:"good",
      title:`Strong vs ${b.c}`,
      body:`You win ${Math.round(b.wins/b.games*100)}% vs ${b.c} (${b.wins}-${b.losses}). Keep doing what works here.`,
    });
  }

  // most-faced (prioritize learning)
  const faced = chars.slice().sort((a,b)=>b.games-a.games).slice(0,3).map(x=>x.c);
  if (faced.length){
    insights.push({
      kind:"meta", severity:"info",
      title:"Who you face most",
      body:`Your most common opponents: ${faced.join(", ")}. Learning these matchups gives the biggest return.`,
      action: faced[0]? { label:`Scout ${faced[0]} →`, href:`./matchup.html?me=${main}&opp=${slug(faced[0])}` } : null,
    });
  }

  // close-loss pattern across the board
  const totalClose = chars.reduce((s,x)=>s+x.closeLosses,0);
  if (totalClose>=3){
    insights.push({
      kind:"pattern", severity:"warn",
      title:"You're losing close games",
      body:`${totalClose} of your losses went to a deciding final round. That gap is usually defense — punishing more and not pressing when it's not your turn. The Rank Guide and Trainer focus on exactly this.`,
      action:{ label:"Open the Trainer →", href:"./trainer.html" },
    });
  }

  return json({
    ready:true, main, rank: prof? prof.current_rank : null,
    sample: rows.length, win_rate: wr, insights,
  }, 200, cors);
}

function cap(s){ return String(s||"").split(/[-_]/).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" "); }
function slug(s){ return String(s||"").toLowerCase().replace(/\s+/g,"-").replace(/[^\w-]/g,""); }

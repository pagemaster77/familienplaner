/* Spielhalle: eigene Seite (getrennt von der App). Nutzt dieselbe Anmeldung wie die App.
   Spiele melden sich mit ARCADE.register({...}) an (siehe spiele/*.js).
   Spielpunkte sind unabhängig von den Aufgaben-Punkten. */
const ARCADE = (() => {
  const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  const games = [], $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let me = null, stopGame = null, S = { tab: null, range: 7 };
  const fmt = (g, v) => g.fmt ? g.fmt(v) : g.lower ? v + " ms" : g.id === "snake" ? v + " 🍎" : v + " P.";
  const medal = i => ["🥇", "🥈", "🥉"][i] || i + 1;

  async function lobby() {
    if (stopGame) { stopGame(); stopGame = null; }
    const days = S.range || null, gid = S.tab; // gid: null = alle Spiele zusammen
    const [mine, fam, ppl, brd] = await Promise.all([sb.rpc("arcade_me"), sb.rpc("arcade_battle", { p_days: days }), sb.rpc("arcade_people", { p_days: days }),
      gid ? sb.rpc("arcade_board", { p_game: gid, p_days: days }) : Promise.resolve({ data: null })]);
    const m = (mine.data && mine.data[0]) || { total: 0, week: 0 };
    const f = fam.data || [], fmax = Math.max(1, ...f.map(x => Number(x.pts)));
    const g = gid && games.find(x => x.id === gid);
    const people = g ? (brd.data || []).map(r => ({ id: r.profile_id, name: r.name, family_name: r.family_name, val: fmt(g, r.best), plays: r.plays })) : (ppl.data || []).map(r => ({ id: r.profile_id, name: r.name, family_name: r.family_name, val: r.pts + " ⭐", plays: r.plays }));
    const mineIdx = people.findIndex(x => x.id === me.id);
    $("#arc").innerHTML = `<div class="top"><button class="back" id="home">← App</button><h1>🎮 Spielhalle</h1><span></span></div>
      <div class="pts"><span>Hallo <b>${esc(me.name)}</b></span><span>⭐ <b>${m.total}</b> gesamt · <b>${m.week}</b> diese Woche${mineIdx >= 0 ? ` · Platz <b>${mineIdx + 1}</b>` : ""}</span></div>
      <div class="card" id="rank"><h2>🏆 Bestenliste</h2>
        <div class="seg"><button data-r="7" class="${S.range === 7 ? "on" : ""}">Diese Woche</button><button data-r="0" class="${S.range === 0 ? "on" : ""}">Gesamt</button></div>
        <h3>👪 Familien</h3>
        ${f.map((x, i) => `<div class="row"><span class="rank">${medal(i)}</span><div class="grow"><b>${esc(x.family_name)}</b> <span class="sub">${x.players} Spieler</span><div class="bar" style="width:${Math.round(Number(x.pts) / fmax * 100)}%"></div></div><span class="val">${x.pts} ⭐</span></div>`).join("") || `<div class="empty">Noch niemand gespielt – du kannst der/die Erste sein!</div>`}
        <h3>🧑 Einzelpersonen</h3>
        <div class="chips"><button data-t="" class="${!gid ? "on" : ""}">⭐ Alle Spiele</button>${games.map(x => `<button data-t="${x.id}" class="${gid === x.id ? "on" : ""}">${x.icon} ${esc(x.name)}</button>`).join("")}</div>
        <div class="sub" style="margin:2px 0 4px">${g ? "Bestes Ergebnis im Spiel " + esc(g.name) : "Spielpunkte aus allen Spielen zusammen"}</div>
        ${people.map((x, i) => `<div class="row${x.id === me.id ? " me" : ""}"><span class="rank">${medal(i)}</span><div class="grow">${esc(x.name)} <span class="sub">(${esc(x.family_name)})</span></div><span class="sub">${x.plays}×</span><span class="val">${esc(x.val)}</span></div>`).join("") || `<div class="empty">Noch kein Ergebnis</div>`}
        <div class="sub" style="margin-top:8px">Es zählen die eigene und die verbundenen Familien.</div></div>
      <div class="card" id="spiele"><h2>Spiele</h2><div class="apps">${games.map(x => `<button class="app" data-g="${x.id}"><span class="icn" style="background:${x.color || "linear-gradient(145deg,#4f8cff,#7a5cff)"}">${x.icon}</span><b>${esc(x.name)}</b></button>`).join("")}</div></div>
      <nav class="nav"><button id="n-app">🏠<span>App</span></button><button id="n-rank">🏆<span>Bestenliste</span></button><button id="n-play">🎮<span>Spiele</span></button></nav>`;
    $("#home").onclick = $("#n-app").onclick = () => (location.href = "../");
    $("#n-rank").onclick = () => $("#rank").scrollIntoView({ behavior: "smooth" });
    $("#n-play").onclick = () => $("#spiele").scrollIntoView({ behavior: "smooth" });
    document.querySelectorAll("[data-g]").forEach(x => (x.onclick = () => play(x.dataset.g)));
    document.querySelectorAll("[data-t]").forEach(x => (x.onclick = () => { S.tab = x.dataset.t || null; lobby(); }));
    document.querySelectorAll("[data-r]").forEach(x => (x.onclick = () => { S.range = +x.dataset.r; lobby(); }));
  }

  function play(id) {
    const g = games.find(x => x.id === id);
    $("#arc").innerHTML = `<div class="top"><button class="back" id="back">← Spielhalle</button><h1>${g.icon} ${esc(g.name)}</h1><span></span></div><div id="stage"></div>`;
    $("#back").onclick = lobby;
    const run = () => {
      if (stopGame) stopGame();
      stopGame = g.start($("#stage"), {
        async finish(score, text) {
          let msg = "", pts = null;
          if (score > 0 || g.lower) {
            const { data, error } = await sb.rpc("submit_score", { p_game: g.id, p_score: score });
            if (error) msg = `<div class="err">${esc(error.message)}</div>`; else pts = data;
          }
          $("#stage").innerHTML = `<div class="card result"><div class="big">${g.icon}</div><h2>${esc(text || fmt(g, score))}</h2>
            ${pts !== null ? `<div>+<b style="color:var(--gold)">${pts}</b> Spielpunkte ⭐</div>` : ""}${msg}
            <div class="btns"><button class="btn" id="again">Nochmal</button><button class="btn ghost" id="lb">Bestenliste</button></div></div>`;
          $("#again").onclick = run; $("#lb").onclick = () => { S.tab = g.id; lobby(); };
        }
      });
    };
    run();
  }

  return {
    register(g) { games.push(g); },
    async boot() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { $("#arc").innerHTML = `<div class="card"><h2>🎮 Spielhalle</h2><p>Bitte melde dich zuerst in der Familien-App an.</p><a class="btn" href="../" style="display:inline-block">Zur App</a></div>`; return; }
      const { data } = await sb.from("profiles").select("id,name,family_id").eq("id", session.user.id).maybeSingle();
      if (!data) { $("#arc").innerHTML = `<div class="card"><p>Dein Profil wurde nicht gefunden.</p><a class="btn" href="../">Zur App</a></div>`; return; }
      me = data; lobby();
    }
  };
})();

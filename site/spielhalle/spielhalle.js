/* Spielhalle: eigene Seite (getrennt von der App). Nutzt dieselbe Anmeldung wie die App.
   Spiele melden sich mit ARCADE.register({...}) an (siehe spiele/*.js).
   Spielpunkte sind unabhängig von den Aufgaben-Punkten. */
const ARCADE = (() => {
  const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  const games = [], $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let me = null, stopGame = null, S = { tab: null, range: 7, bRange: 7 };
  const fmt = (g, v) => g.fmt ? g.fmt(v) : g.lower ? v + " ms" : g.id === "snake" ? v + " 🍎" : v + " P.";
  const medal = i => ["🥇", "🥈", "🥉"][i] || i + 1;

  async function lobby() {
    if (stopGame) { stopGame(); stopGame = null; }
    const [mine, battle] = await Promise.all([sb.rpc("arcade_me"), sb.rpc("arcade_battle", { p_days: S.bRange || null })]);
    const m = (mine.data && mine.data[0]) || { total: 0, week: 0 };
    const b = battle.data || [], max = Math.max(1, ...b.map(x => Number(x.pts)));
    S.tab = S.tab || games[0].id;
    $("#arc").innerHTML = `<div class="top"><button class="back" id="home">← App</button><h1>🎮 Spielhalle</h1><span></span></div>
      <div class="pts"><span>Hallo <b>${esc(me.name)}</b></span><span>⭐ Spielpunkte: <b>${m.total}</b> · diese Woche <b>${m.week}</b></span></div>
      <div class="card"><h2>Spiele</h2><div class="games">${games.map(g => `<button class="game" data-g="${g.id}"><span class="ic">${g.icon}</span><b>${esc(g.name)}</b><span class="sub">${esc(g.desc)}</span></button>`).join("")}</div></div>
      <div class="card"><h2>🏆 Familien-Battle</h2>
        <div class="tabs"><button data-b="7" class="${S.bRange === 7 ? "on" : ""}">Diese Woche</button><button data-b="0" class="${S.bRange === 0 ? "on" : ""}">Gesamt</button></div>
        ${b.map((x, i) => `<div class="row"><span class="rank">${medal(i)}</span><div class="grow"><b>${esc(x.family_name)}</b> <span class="sub">${x.players} Spieler</span><div class="bar" style="width:${Math.round(Number(x.pts) / max * 100)}%"></div></div><span class="val">${x.pts} ⭐</span></div>`).join("") || `<div class="empty">Noch niemand gespielt – du kannst die Erste/der Erste sein!</div>`}
        <div class="sub" style="margin-top:6px">Alle Spielpunkte der Familienmitglieder zählen zusammen. Es sind die eigene und die verbundenen Familien dabei.</div></div>
      <div class="card"><h2>Bestenliste</h2>
        <div class="tabs">${games.map(g => `<button data-t="${g.id}" class="${S.tab === g.id ? "on" : ""}">${g.icon} ${esc(g.name)}</button>`).join("")}</div>
        <div class="tabs"><button data-r="7" class="${S.range === 7 ? "on" : ""}">Diese Woche</button><button data-r="0" class="${S.range === 0 ? "on" : ""}">Gesamt</button></div>
        <div id="board"><div class="empty">Lädt …</div></div></div>`;
    $("#home").onclick = () => (location.href = "../");
    document.querySelectorAll("[data-g]").forEach(x => (x.onclick = () => play(x.dataset.g)));
    document.querySelectorAll("[data-t]").forEach(x => (x.onclick = () => { S.tab = x.dataset.t; lobby(); }));
    document.querySelectorAll("[data-r]").forEach(x => (x.onclick = () => { S.range = +x.dataset.r; lobby(); }));
    document.querySelectorAll("[data-b]").forEach(x => (x.onclick = () => { S.bRange = +x.dataset.b; lobby(); }));
    const g = games.find(x => x.id === S.tab), { data } = await sb.rpc("arcade_board", { p_game: g.id, p_days: S.range || null });
    $("#board").innerHTML = (data || []).map((r, i) => `<div class="row"><span class="rank">${medal(i)}</span><div class="grow">${esc(r.name)} <span class="sub">(${esc(r.family_name)})</span></div><span class="sub">${r.plays}×</span><span class="val">${fmt(g, r.best)}</span></div>`).join("") || `<div class="empty">Noch kein Ergebnis</div>`;
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

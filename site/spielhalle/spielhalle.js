/* Spielhalle: eigene Seite (getrennt von der App). Nutzt dieselbe Anmeldung wie die App.
   Spiele melden sich mit ARCADE.register({...}) an (siehe spiele/*.js).
   Spielpunkte sind unabhängig von den Aufgaben-Punkten. */
const ARCADE = (() => {
  const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  const games = [], $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let me = null, stopGame = null, S = { tab: null, range: 7 };
  // Online-Anzeige: curGame = Spiel, das ich gerade spiele (null = nur in der Spielhalle). Ping alle 20 Sek., "online" = Ping jünger als 60 Sek.
  let curGame = null, onlineTimer = 0, L = { last: [], online: [] };
  const ping = () => { if (me && !document.hidden) sb.rpc("arcade_ping", { p_game: curGame }).then(() => {}, () => {}); };
  const ago = t => { const m = Math.floor((Date.now() - new Date(t)) / 60000);
    return m < 1 ? "gerade eben" : m < 60 ? `vor ${m} Min` : m < 1440 ? `vor ${Math.floor(m / 60)} Std` : `vor ${Math.floor(m / 1440)} Tg`; };
  const gname = id => { const g = games.find(x => x.id === id); return g ? `${g.icon} ${g.name}` : id; };
  // Zeichnet "Jetzt online" und die Zeile "zuletzt gespielt" unter jedem Spiel neu (ohne die ganze Seite neu zu laden)
  function paintLive() {
    const o = (L.online || []).filter(x => x.profile_id !== me.id), last = L.last || [];
    const box = $("#online");
    if (box) {
      const newest = last.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      box.innerHTML = `<h2>🟢 Jetzt online</h2>` + (o.length
        ? `<div class="onl">${o.map(x => `<span class="who${x.game ? " play" : ""}"><i></i><b>${esc(x.name)}</b> <span class="sub">${x.game ? "spielt " + esc(gname(x.game)) : "in der Spielhalle"}</span></span>`).join("")}</div>`
        : `<div class="sub">Gerade ist sonst niemand in der Spielhalle.</div>`)
        + (newest ? `<div class="sub lastp">🕒 Zuletzt gespielt: <b>${esc(newest.name)}</b> – ${esc(gname(newest.game))}, ${ago(newest.created_at)}</div>` : "");
    }
    games.forEach(g => {
      const e = document.querySelector(`[data-gs="${g.id}"]`); if (!e) return;
      const now = o.filter(x => x.game === g.id), l = last.find(x => x.game === g.id);
      e.innerHTML = (now.length ? `<span class="live">🟢 ${esc(now.map(x => x.name).join(", "))} spielt</span>` : "")
        + (l ? `<span>Zuletzt: ${esc(l.name)}<br>${ago(l.created_at)}</span>` : `<span>Noch nie gespielt</span>`);
    });
  }
  async function loadLive() {
    const [a, b] = await Promise.all([sb.rpc("arcade_online"), sb.rpc("arcade_last")]);
    L = { online: a.data || [], last: b.data || [] };
    if ($("#online")) paintLive();
  }
  const fmt = (g, v) => g.fmt ? g.fmt(v) : g.lower ? v + " ms" : g.id === "snake" ? v + " 🍎" : v + " P.";
  const medal = i => ["🥇", "🥈", "🥉"][i] || i + 1;

  // Ende der Wochen-Challenge: nächster Montag 00:00 (Datenbank zählt Kalenderwochen ab Montag 0 Uhr, Berlin)
  const weekEnd = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d; };
  const left = () => { let s = Math.max(0, Math.floor((weekEnd() - Date.now()) / 1000)); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); s %= 60;
    return d > 0 ? `${d} Tg ${h} Std ${m} Min` : `${h} Std ${m} Min ${s} Sek`; };
  let tick = 0;
  // Siegertreppchen: Platz 2 links, 1 Mitte, 3 rechts. items: [{name, sub, val}]
  const podium = items => {
    if (!items.length) return "";
    const o = [1, 0, 2].filter(i => items[i]), hh = [0, 118, 84, 62];
    return `<div class="podium">${o.map(i => `<div class="pod p${i + 1}"><div class="who">${i === 0 ? '<span class="crown">👑</span>' : ""}<b>${esc(items[i].name)}</b><span class="sub">${esc(items[i].sub || "")}</span><span class="pv">${esc(items[i].val)}</span></div><div class="step" style="--h:${hh[i + 1]}px">${["🥇", "🥈", "🥉"][i]}</div></div>`).join("")}</div>`;
  };
  // Duell-Einladungen: in der Lobby alle 4 Sek. nachfragen und oben als Hinweis zeigen
  let inviteTimer = 0;
  async function pollInvites() {
    const { data } = await sb.rpc("duel_poll"); const box = $("#duelbar"); if (!box) return;
    const inv = (data && data.invites) || [];
    box.innerHTML = inv.map(i => `<div class="card cd-inv">🔐 <b>${esc(i.name)}</b> (${esc(i.family)}) fordert dich zu <b>Code knacken</b> heraus!
      <div class="btns"><button class="btn" data-ok="${i.id}">Annehmen</button><button class="btn ghost" data-no="${i.id}">Nein</button></div></div>`).join("");
    box.querySelectorAll("[data-ok]").forEach(b => b.onclick = async () => {
      const { error } = await sb.rpc("duel_answer", { p_duel: b.dataset.ok, p_accept: true });
      if (error) { box.innerHTML = `<div class="card err">${esc(error.message)}</div>`; return; }
      clearInterval(inviteTimer); play("code", { duel: b.dataset.ok });
    });
    box.querySelectorAll("[data-no]").forEach(b => b.onclick = async () => { await sb.rpc("duel_answer", { p_duel: b.dataset.no, p_accept: false }); pollInvites(); });
  }
  async function lobby() {
    clearInterval(inviteTimer);
    if (stopGame) { stopGame(); stopGame = null; }
    curGame = null; ping();
    const days = S.range || null, gid = S.tab; // gid: null = alle Spiele zusammen
    const [mine, fam, ppl, brd] = await Promise.all([sb.rpc("arcade_me"), sb.rpc("arcade_battle", { p_days: days }), sb.rpc("arcade_people", { p_days: days }),
      gid ? sb.rpc("arcade_board", { p_game: gid, p_days: days }) : Promise.resolve({ data: null })]);
    const m = (mine.data && mine.data[0]) || { total: 0, week: 0 };
    const f = fam.data || [], fmax = Math.max(1, ...f.map(x => Number(x.pts)));
    const g = gid && games.find(x => x.id === gid);
    const people = g ? (brd.data || []).map(r => ({ id: r.profile_id, name: r.name, family_name: r.family_name, val: fmt(g, r.best), plays: r.plays })) : (ppl.data || []).map(r => ({ id: r.profile_id, name: r.name, family_name: r.family_name, val: r.pts + " ⭐", plays: r.plays }));
    const mineIdx = people.findIndex(x => x.id === me.id);
    clearInterval(tick);
    const fitems = f.map(x => ({ name: x.family_name, sub: x.players + " Spieler", val: x.pts + " ⭐" })), pitems = people.map(x => ({ name: x.name, sub: x.family_name, val: x.val }));
    $("#arc").innerHTML = `<div class="top"><button class="back" id="home">← App</button><h1>🎮 Spielhalle</h1><span></span></div>
      <div class="pts"><span>Hallo <b>${esc(me.name)}</b></span><span>⭐ <b>${m.total}</b> gesamt · <b>${m.week}</b> diese Woche${mineIdx >= 0 ? ` · Platz <b>${mineIdx + 1}</b>` : ""}</span></div>
      <div id="duelbar"></div>
      <div class="card online" id="online"><h2>🟢 Jetzt online</h2><div class="sub">Lädt …</div></div>
      <div class="card" id="rank"><h2>🏆 Bestenliste</h2>
        <div class="seg"><button data-r="7" class="${S.range === 7 ? "on" : ""}">Diese Woche</button><button data-r="0" class="${S.range === 0 ? "on" : ""}">Gesamt</button></div>
        ${S.range === 7 ? `<div class="chal">🏁 <b>Wochen-Challenge</b><span>endet in <b id="cd">${left()}</b></span></div>` : `<div class="chal">🏆 <b>Gesamtwertung</b><span>seit Beginn der Spielhalle</span></div>`}
        <h3>👪 Familien</h3>
        ${podium(fitems)}
        ${f.slice(3).map((x, j) => { const i = j + 3;(x, i) => `<div class="row"><span class="rank">${medal(i)}</span><div class="grow"><b>${esc(x.family_name)}</b> <span class="sub">${x.players} Spieler</span><div class="bar" style="width:${Math.round(Number(x.pts) / fmax * 100)}%"></div></div><span class="val">${x.pts} ⭐</span></div>`; }).join("")}${f.length ? "" : `<div class="empty">Noch niemand gespielt – du kannst der/die Erste sein!</div>`}
        <h3>🧑 Einzelpersonen</h3>
        <div class="chips"><button data-t="" class="${!gid ? "on" : ""}">⭐ Alle Spiele</button>${games.map(x => `<button data-t="${x.id}" class="${gid === x.id ? "on" : ""}">${x.icon} ${esc(x.name)}</button>`).join("")}</div>
        <div class="sub" style="margin:2px 0 4px">${g ? "Bestes Ergebnis im Spiel " + esc(g.name) : "Spielpunkte aus allen Spielen zusammen"}</div>
        ${podium(pitems)}
        ${people.slice(3).map((x, j) => { const i = j + 3; return `<div class="row${x.id === me.id ? " me" : ""}"><span class="rank">${medal(i)}</span><div class="grow">${esc(x.name)} <span class="sub">(${esc(x.family_name)})</span></div><span class="sub">${x.plays}×</span><span class="val">${esc(x.val)}</span></div>`; }).join("")}${people.length ? "" : `<div class="empty">Noch kein Ergebnis</div>`}
        <div class="sub" style="margin-top:8px">Es zählen die eigene und die verbundenen Familien.</div></div>
      <div class="card" id="spiele"><h2>Spiele</h2><div class="apps">${games.map(x => `<button class="app" data-g="${x.id}"><span class="icn" style="background:${x.color || "linear-gradient(145deg,#4f8cff,#7a5cff)"}">${x.icon}</span><b>${esc(x.name)}</b><span class="gs" data-gs="${x.id}"></span></button>`).join("")}</div></div>
      <nav class="nav"><button id="n-app">🏠<span>App</span></button><button id="n-rank">🏆<span>Bestenliste</span></button><button id="n-play">🎮<span>Spiele</span></button></nav>`;
    clearInterval(onlineTimer); loadLive(); onlineTimer = setInterval(() => { if (!document.hidden) loadLive(); }, 15000);
    clearInterval(inviteTimer); pollInvites(); inviteTimer = setInterval(() => { if (!document.hidden) pollInvites(); }, 4000);
    if ($("#cd")) tick = setInterval(() => { const e = $("#cd"); if (e) e.textContent = left(); else clearInterval(tick); }, 1000);
    $("#home").onclick = $("#n-app").onclick = () => (location.href = "../");
    $("#n-rank").onclick = () => $("#rank").scrollIntoView({ behavior: "smooth" });
    $("#n-play").onclick = () => $("#spiele").scrollIntoView({ behavior: "smooth" });
    document.querySelectorAll("[data-g]").forEach(x => (x.onclick = () => play(x.dataset.g)));
    document.querySelectorAll("[data-t]").forEach(x => (x.onclick = () => { S.tab = x.dataset.t || null; lobby(); }));
    document.querySelectorAll("[data-r]").forEach(x => (x.onclick = () => { S.range = +x.dataset.r; lobby(); }));
  }

  function play(id, opts) {
    const g = games.find(x => x.id === id);
    clearInterval(onlineTimer); clearInterval(inviteTimer); curGame = id; ping();
    $("#arc").innerHTML = `<div class="top"><button class="back" id="back">← Spielhalle</button><h1>${g.icon} ${esc(g.name)}</h1>${g.help ? `<button class="hbtn" id="hp" aria-label="Anleitung" title="Anleitung">ⓘ</button>` : "<span></span>"}</div><div id="stage"></div>`;
    $("#back").onclick = lobby;
    const showHelp = () => {
      const o = document.createElement("div"); o.className = "hlp";
      o.innerHTML = `<div class="hlpbox">${g.help()}<div class="btns"><button class="btn" id="hp-x">Verstanden</button></div></div>`;
      document.body.appendChild(o); o.querySelector(".hlpbox").scrollTop = 0;
      const close = () => { o.remove(); try { localStorage.setItem("arcade_help_" + g.id, "1"); } catch (_e) { /* egal */ } };
      o.querySelector("#hp-x").onclick = close; o.addEventListener("click", e => { if (e.target === o) close(); });
    };
    if (g.help) { $("#hp").onclick = showHelp; try { if (!localStorage.getItem("arcade_help_" + g.id)) setTimeout(showHelp, 400); } catch (_e) { /* egal */ } }
    const run = () => {
      if (stopGame) stopGame();
      stopGame = g.start($("#stage"), {
        sb, me, esc, duel: opts && opts.duel, leaderboard() { S.tab = g.id; lobby(); },
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
      me = data;
      setInterval(ping, 20000);
      document.addEventListener("visibilitychange", () => { if (document.hidden) sb.rpc("arcade_leave").then(() => {}, () => {}); else ping(); });
      addEventListener("pagehide", () => { sb.rpc("arcade_leave").then(() => {}, () => {}); });
      lobby();
    }
  };
})();

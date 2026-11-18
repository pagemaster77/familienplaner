/* Code knacken (Duell): Zwei Spieler sind live online. Jeder hat einen geheimen Farbcode (4 Felder, 6 Farben).
   Beide raten gleichzeitig, 10 Versuche. Schwarz = Farbe und Platz stimmen, Weiß = Farbe stimmt, Platz falsch.
   Wer zuerst knackt, gewinnt. Die Codes liegen nur in der Datenbank - niemand kann sie vorher sehen.
   Die Punkte vergibt die Datenbank selbst (Sieg 30, Niederlage 5, Unentschieden 10, Aufgabe des Gegners 15). */
ARCADE.register({
  id: "code", name: "Code knacken", icon: "🔐", color: "linear-gradient(145deg,#7a5cff,#4f8cff)", fmt: v => v + " P.",
  desc: "Duell: Knacke den Code vor dem Gegner.",
  start(root, api) {
    const sb = api.sb, me = api.me, esc = api.esc;
    const COL = ["#e5484d", "#f5a524", "#f2d33c", "#3ecf8e", "#4f8cff", "#a35cf0"];
    let dead = false, timer = 0, duel = api.duel || null, mode = duel ? "wait" : "pick", cur = [], over = false;
    const stop = () => { clearInterval(timer); timer = 0; };
    const dot = (c, s) => `<i class="cd-dot" style="background:${COL[c]};${s || ""}"></i>`;
    const err = e => `<div class="err">${esc((e && e.message) || e)}</div>`;

    // ---- 1. Gegner wählen ----
    async function pick(msg) {
      stop(); mode = "pick";
      root.innerHTML = `<div class="card"><h2>🔐 Code knacken</h2>
        <div class="sub">Zwei Spieler knacken gleichzeitig ihren geheimen Farbcode (4 Felder, 6 Farben, 10 Versuche). Wer zuerst knackt, gewinnt: <b>30 ⭐</b>. Das geht nur, wenn beide gerade in der Spielhalle sind.</div>
        ${msg || ""}<div id="cd-list" style="margin-top:12px"><div class="sub">Suche Spieler …</div></div></div>`;
      const load = async () => {
        const [a, b] = await Promise.all([sb.rpc("arcade_online"), sb.rpc("duel_poll")]);
        if (dead || mode !== "pick") return;
        const p = b.data || {};
        if (p.active && p.active.status === "playing") { duel = p.active.id; return wait(); }
        if (p.active && p.active.status === "invite" && p.active.mine) { duel = p.active.id; return wait(); }
        const o = (a.data || []).filter(x => x.profile_id !== me.id), inv = p.invites || [];
        const box = root.querySelector("#cd-list"); if (!box) return;
        box.innerHTML = (inv.length ? inv.map(i => `<div class="cd-inv">📨 <b>${esc(i.name)}</b> (${esc(i.family)}) fordert dich heraus!
            <div class="btns"><button class="btn" data-ok="${i.id}">Annehmen</button><button class="btn ghost" data-no="${i.id}">Nein</button></div></div>`).join("") : "")
          + (o.length ? `<div class="sub" style="margin-bottom:6px">Jetzt online – tippe auf eine Person:</div>` + o.map(x => `<button class="btn ghost cd-who" data-to="${x.profile_id}">🟢 ${esc(x.name)} <span class="sub">(${esc(x.family_name)})</span></button>`).join("")
            : `<div class="sub">Gerade ist niemand sonst in der Spielhalle. Sag jemandem Bescheid – diese Seite aktualisiert sich von selbst.</div>`);
        box.querySelectorAll("[data-to]").forEach(x => x.onclick = async () => {
          x.disabled = true; const { data, error } = await sb.rpc("duel_invite", { p_to: x.dataset.to });
          if (error) return pick(err(error)); duel = data; wait();
        });
        box.querySelectorAll("[data-ok]").forEach(x => x.onclick = async () => {
          const { error } = await sb.rpc("duel_answer", { p_duel: x.dataset.ok, p_accept: true });
          if (error) return pick(err(error)); duel = x.dataset.ok; play();
        });
        box.querySelectorAll("[data-no]").forEach(x => x.onclick = async () => { await sb.rpc("duel_answer", { p_duel: x.dataset.no, p_accept: false }); load(); });
      };
      await load(); timer = setInterval(load, 3000);
    }

    // ---- 2. Warten auf Antwort ----
    function wait() {
      stop(); mode = "wait";
      root.innerHTML = `<div class="card result"><div class="big">⏳</div><h2>Warte auf Antwort …</h2><div class="sub">Die Einladung gilt 3 Minuten.</div>
        <div class="btns"><button class="btn ghost" id="cd-x">Abbrechen</button></div></div>`;
      root.querySelector("#cd-x").onclick = async () => { await sb.rpc("duel_forfeit", { p_duel: duel }); duel = null; pick(); };
      const chk = async () => {
        const { data } = await sb.rpc("duel_state", { p_duel: duel }); if (dead || mode !== "wait" || !data) return;
        if (data.status === "playing") play();
        else if (data.status === "declined") { duel = null; pick(`<div class="err">Die Einladung wurde abgelehnt.</div>`); }
        else if (data.status === "cancelled") { duel = null; pick(`<div class="err">Die Einladung ist abgelaufen.</div>`); }
      };
      chk(); timer = setInterval(chk, 1500);
    }

    // ---- 3. Das Duell ----
    function play() {
      stop(); mode = "play"; cur = []; over = false;
      let st = null, busy = false;
      const draw = () => {
        if (!st) return;
        const mine = st.mine || [], th = st.theirs || [], done = st.status === "done";
        const rowMine = g => `<div class="cd-row">${g.guess.split("").map(c => dot(+c)).join("")}<span class="cd-pegs">${"●".repeat(g.black).replace(/●/g, "<b class=bk>●</b>")}${"●".repeat(g.white).replace(/●/g, "<b class=wh>●</b>")}</span></div>`;
        const rowTheirs = g => `<div class="cd-row sm"><span class="cd-pegs">${"●".repeat(g.black).replace(/●/g, "<b class=bk>●</b>")}${"●".repeat(g.white).replace(/●/g, "<b class=wh>●</b>")}</span></div>`;
        const left = 10 - mine.length;
        root.innerHTML = `<div class="card cd"><div class="hud"><span>🧑 Du: <b>${mine.length}/10</b></span><span>🆚 ${esc(st.opp_name)}: <b>${th.length}/10</b></span></div>
          ${done ? "" : `<div class="sub">${left > 0 ? "Wer zuerst knackt, gewinnt!" : "Alle Versuche gebraucht – warte auf " + esc(st.opp_name)}</div>`}
          <div class="cd-cols"><div>${mine.map(rowMine).join("")}</div><div class="cd-opp"><div class="sub">${esc(st.opp_name)}</div>${th.map(rowTheirs).join("")}</div></div>
          ${done || left <= 0 ? "" : `<div class="cd-row cd-cur">${[0, 1, 2, 3].map(i => cur[i] != null ? `<button class="cd-slot" data-s="${i}">${dot(cur[i])}</button>` : `<button class="cd-slot e" data-s="${i}"></button>`).join("")}</div>
          <div class="cd-pal">${COL.map((c, i) => `<button data-c="${i}" aria-label="Farbe ${i + 1}" style="background:${c}"></button>`).join("")}</div>
          <div class="btns"><button class="btn" id="cd-go" ${cur.length === 4 && cur.filter(x => x != null).length === 4 ? "" : "disabled"}>Raten</button></div>
          <div class="sub" style="margin-top:6px"><b class="bk">●</b> Farbe &amp; Platz richtig · <b class="wh">●</b> Farbe richtig, Platz falsch</div>
          <div class="btns"><button class="btn ghost" id="cd-ff">Aufgeben</button></div>`}</div>`;
        root.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { const i = [0, 1, 2, 3].find(k => cur[k] == null); if (i != null) { cur[i] = +b.dataset.c; draw(); } });
        root.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { delete cur[+b.dataset.s]; draw(); });
        const go = root.querySelector("#cd-go"), ff = root.querySelector("#cd-ff");
        if (go) go.onclick = async () => {
          if (busy || [0, 1, 2, 3].some(k => cur[k] == null)) return; busy = true;
          const { error } = await sb.rpc("duel_guess", { p_duel: duel, p_guess: cur.join("") }); busy = false;
          if (error) { await refresh(); root.insertAdjacentHTML("afterbegin", err(error)); return; }
          cur = []; refresh();
        };
        if (ff) ff.onclick = async () => { if (confirm("Wirklich aufgeben? Dein Gegner gewinnt.")) { await sb.rpc("duel_forfeit", { p_duel: duel }); refresh(); } };
      };
      const result = () => {
        stop(); over = true;
        const win = st.winner === st.me, draw0 = !st.winner;
        const pts = draw0 ? 10 : win ? 30 : 5;
        const codes = c => c ? c.split("").map(x => dot(+x)).join("") : "";
        root.innerHTML = `<div class="card result"><div class="big">${draw0 ? "🤝" : win ? "🏆" : "😅"}</div>
          <h2>${draw0 ? "Unentschieden" : win ? "Du hast gewonnen!" : esc(st.opp_name) + " war schneller"}</h2>
          <div>+<b style="color:var(--gold)">${win && st.winner && !(st.mine || []).some(g => g.black === 4) ? 15 : pts}</b> Spielpunkte ⭐</div>
          <div class="sub" style="margin-top:8px">Dein Code:</div><div class="cd-row" style="justify-content:center">${codes(st.my_code)}</div>
          <div class="sub">Code von ${esc(st.opp_name)}:</div><div class="cd-row" style="justify-content:center">${codes(st.opp_code)}</div>
          <div class="btns"><button class="btn" id="cd-again">Neues Duell</button><button class="btn ghost" id="cd-lb">Bestenliste</button></div></div>`;
        root.querySelector("#cd-again").onclick = () => { duel = null; pick(); };
        root.querySelector("#cd-lb").onclick = () => api.leaderboard();
      };
      const refresh = async () => {
        const { data } = await sb.rpc("duel_state", { p_duel: duel }); if (dead || mode !== "play" || !data) return;
        const was = st; st = data;
        if (st.status === "done") return result();
        if (st.status === "cancelled" || st.status === "declined") { duel = null; return pick(`<div class="err">Das Duell wurde beendet.</div>`); }
        // Nicht neu zeichnen, solange der Gegner nichts Neues gemacht hat und ich tippe
        if (!was || JSON.stringify(was.mine) !== JSON.stringify(st.mine) || JSON.stringify(was.theirs) !== JSON.stringify(st.theirs)) draw();
      };
      refresh(); timer = setInterval(refresh, 1500);
    }

    if (duel) { mode === "wait" && sb.rpc("duel_state", { p_duel: duel }).then(r => { r.data && r.data.status === "playing" ? play() : pick(); }); }
    else pick();

    // Beim Verlassen: laufendes Duell = aufgegeben, offene Einladung = zurückgezogen
    return () => { dead = true; stop(); if (duel && !over && (mode === "play" || mode === "wait")) sb.rpc("duel_forfeit", { p_duel: duel }).then(() => {}, () => {}); };
  }
});

/* Bonbon-Match: Tausche zwei Nachbar-Bonbons, 3 oder mehr gleiche in einer Reihe verschwinden.
   4er-Reihe = Streifen-Bonbon (räumt eine Zeile/Spalte), 5er = Regenbogen (räumt eine ganze Farbe),
   L/T-Form = Bombe (räumt 3x3). 25 Züge, Ketten (Combos) geben mehr Punkte. */
ARCADE.register({
  id: "bonbon", name: "Bonbon-Match", icon: "🍬", color: "linear-gradient(145deg,#ff7eb3,#ff5e62)", fmt: v => v + " P.",
  desc: "Schiebe gleiche Bonbons zusammen.",
  start(root, api) {
    const N = 8, MOVES = 25, COLORS = ["#e5484d", "#f5a524", "#f2d33c", "#3ecf8e", "#4f8cff", "#a35cf0"], SHAPES = ["●", "◆", "▲", "■", "★", "♥"];
    const W = Math.min(root.clientWidth || 360, 400), cs = Math.floor(W / N), BW = cs * N;
    root.innerHTML = `<div class="stage"><div class="hud"><span>🍬 <span id="sc">0</span></span><span>Züge: <b id="mv">${MOVES}</b></span></div>
      <div class="bb" id="bb" style="width:${BW}px;height:${BW}px"></div>
      <div class="sub" id="msg" style="margin-top:10px;min-height:20px">Tausche zwei Nachbarn – antippen oder wischen.</div>
      <div class="sub" style="margin-top:4px">4er = Streifen · 5er = Regenbogen · L/T-Form = Bombe</div></div>`;
    const board = root.querySelector("#bb"), scE = root.querySelector("#sc"), mvE = root.querySelector("#mv"), msg = root.querySelector("#msg");
    let g = Array.from({ length: N }, () => Array(N).fill(null)), score = 0, moves = MOVES, busy = true, dead = false, sel = null, timers = [], id = 0;
    const sl = ms => new Promise(r => timers.push(setTimeout(r, ms)));
    const rnd = () => Math.floor(Math.random() * COLORS.length);

    function look(t) {
      const b = t.el.firstChild; b.className = "bx" + (t.sp ? " sp-" + t.sp : "");
      if (t.sp === "r") { b.style.background = ""; b.innerHTML = "<i>✨</i>"; return; }
      b.style.background = `radial-gradient(circle at 30% 25%, #ffffff88, transparent 40%), ${COLORS[t.type]}`;
      b.innerHTML = "<i>" + (t.sp === "h" ? "↔" : t.sp === "v" ? "↕" : t.sp === "b" ? "💥" : SHAPES[t.type]) + "</i>";
    }
    function put(t, r, c) { t.r = r; t.c = c; t.el.style.transform = `translate(${c * cs}px,${r * cs}px)`; }
    function mk(r, c, type, fromRow) {
      const el = document.createElement("div"); el.className = "t"; el.style.cssText = `width:${cs}px;height:${cs}px;font-size:${Math.round(cs * 0.42)}px`; el.innerHTML = "<div></div>";
      const t = { id: ++id, type, sp: null, el, r, c }; look(t); board.appendChild(el);
      put(t, fromRow == null ? r : fromRow, c); g[r][c] = t; return t;
    }
    const setSp = (t, sp) => { t.sp = sp; if (sp === "r") t.type = -1; look(t); t.el.firstChild.animate([{ transform: "scale(1.4)" }, { transform: "scale(1)" }], 300); };

    function runs() {
      const out = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N;) { const t = g[r][c]; if (!t || t.type < 0) { c++; continue; } let e = c + 1; while (e < N && g[r][e] && g[r][e].type === t.type) e++; if (e - c >= 3) out.push({ dir: "h", cells: Array.from({ length: e - c }, (_, k) => [r, c + k]) }); c = e; }
      for (let c = 0; c < N; c++) for (let r = 0; r < N;) { const t = g[r][c]; if (!t || t.type < 0) { r++; continue; } let e = r + 1; while (e < N && g[e][c] && g[e][c].type === t.type) e++; if (e - r >= 3) out.push({ dir: "v", cells: Array.from({ length: e - r }, (_, k) => [r + k, c]) }); r = e; }
      return out;
    }
    const upd = () => { scE.textContent = score; mvE.textContent = moves; };

    // Räumt Felder (Set aus r*N+c); löst Spezial-Bonbons aus, vergibt Punkte, lässt Neues nachfallen
    async function clear(kill, mult, keep) {
      const q = [...kill]; let bonus = 0;
      for (let i = 0; i < q.length; i++) {
        const t = g[Math.floor(q[i] / N)][q[i] % N]; if (!t || !t.sp || keep.has(t)) continue;
        const add = cells => cells.forEach(k => { if (!kill.has(k)) { kill.add(k); q.push(k); } });
        bonus += 30;
        if (t.sp === "h") add(Array.from({ length: N }, (_, c) => t.r * N + c));
        else if (t.sp === "v") add(Array.from({ length: N }, (_, r) => r * N + t.c));
        else if (t.sp === "b") { const a = []; for (let r = t.r - 1; r <= t.r + 1; r++) for (let c = t.c - 1; c <= t.c + 1; c++) if (r >= 0 && r < N && c >= 0 && c < N) a.push(r * N + c); add(a); }
        else if (t.sp === "r") { const cnt = {}; g.flat().forEach(x => x && x.type >= 0 && (cnt[x.type] = (cnt[x.type] || 0) + 1)); const top = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; add(g.flat().filter(x => x && x.type === top).map(x => x.r * N + x.c)); }
      }
      score += (kill.size * 10 + bonus) * mult; upd();
      const dying = [...kill].map(k => g[Math.floor(k / N)][k % N]).filter(t => t && !keep.has(t));
      dying.forEach(t => { t.el.firstChild.style.transition = "transform .2s,opacity .2s"; t.el.firstChild.style.transform = "scale(.2) rotate(120deg)"; t.el.firstChild.style.opacity = "0"; });
      await sl(230); if (dead) return;
      dying.forEach(t => { t.el.remove(); g[t.r][t.c] = null; });
      await fall();
    }
    async function fall() {
      for (let c = 0; c < N; c++) {
        let w = N - 1; for (let r = N - 1; r >= 0; r--) if (g[r][c]) { if (r !== w) { g[w][c] = g[r][c]; g[r][c] = null; g[w][c].r = w; } w--; }
        for (let r = w, k = 1; r >= 0; r--, k++) mk(r, c, rnd(), -k);
      }
      await sl(30); g.forEach((row, r) => row.forEach((t, c) => t && put(t, r, c))); await sl(330);
    }
    async function settle(pref) {
      let combo = 0;
      for (;;) {
        const rs = runs(); if (!rs.length || dead) break; combo++;
        const kill = new Set(), keep = new Set(); rs.forEach(r => r.cells.forEach(([a, b]) => kill.add(a * N + b)));
        const at = (a, b) => g[a][b];
        // Bombe: Feld liegt in waagrechter und senkrechter Reihe (L/T)
        const hs = new Set(), vs = new Set(); rs.forEach(r => r.cells.forEach(([a, b]) => (r.dir === "h" ? hs : vs).add(a * N + b)));
        const made = [];
        rs.forEach(r => {
          if (r.cells.length >= 4) { const p = (pref && r.cells.find(([a, b]) => a === pref[0] && b === pref[1])) || r.cells[Math.floor(r.cells.length / 2)]; made.push([p, r.cells.length >= 5 ? "r" : (r.dir === "h" ? "v" : "h")]); }
        });
        [...hs].filter(k => vs.has(k)).forEach(k => made.push([[Math.floor(k / N), k % N], "b"]));
        made.forEach(([[a, b], sp]) => { const t = at(a, b); if (t && !t.sp && !keep.has(t)) { keep.add(t); setSp(t, sp); } });
        await clear(kill, combo, keep); pref = null;
        if (combo >= 2) { msg.textContent = combo >= 3 ? `🔥 ${combo}er Kette!` : "Kette!"; }
      }
      return combo;
    }
    function hasMove() {
      if (g.flat().some(t => t && t.sp === "r")) return true;
      const sw = (a, b, c, d) => { const x = g[a][b]; g[a][b] = g[c][d]; g[c][d] = x; };
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) { const r2 = r + dr, c2 = c + dc; if (r2 >= N || c2 >= N) continue; sw(r, c, r2, c2); const ok = runs().length > 0; sw(r, c, r2, c2); if (ok) return true; }
      return false;
    }
    async function reshuffle() {
      msg.textContent = "Keine Züge mehr – Bonbons werden gemischt …"; await sl(500);
      do { g.flat().forEach(t => { if (t && !t.sp) { t.type = rnd(); } }); } while (runs().length || !hasMove());
      g.flat().forEach(t => t && look(t)); await sl(300);
    }
    function swapData(a, b) {
      const ta = g[a[0]][a[1]], tb = g[b[0]][b[1]]; g[a[0]][a[1]] = tb; g[b[0]][b[1]] = ta; put(ta, b[0], b[1]); put(tb, a[0], a[1]);
    }
    async function move(a, b) {
      if (busy || dead || moves <= 0) return; busy = true; select(null);
      swapData(a, b); await sl(230); if (dead) return;
      const ta = g[b[0]][b[1]], tb = g[a[0]][a[1]]; // ta = Bonbon, der nach b gewandert ist
      if (ta.sp === "r" || tb.sp === "r") {
        moves--; upd(); const kill = new Set(), R = ta.sp === "r" ? ta : tb, X = R === ta ? tb : ta;
        kill.add(R.r * N + R.c); R.sp = null; if (X.sp === "r") X.sp = null;
        if (X.sp === "r") g.flat().forEach(t => t && kill.add(t.r * N + t.c)); else g.flat().forEach(t => t && t.type === X.type && kill.add(t.r * N + t.c));
        msg.textContent = "🌈 Regenbogen!"; await clear(kill, 1, new Set());
      } else if (!runs().length) {
        swapData(a, b); await sl(230); busy = false; msg.textContent = "Das ergibt keine Reihe – anderer Zug!"; return;
      } else { moves--; upd(); msg.textContent = ""; await settle(b); }
      if (dead) return; await settle(null);
      if (moves > 0 && !hasMove()) await reshuffle();
      if (moves <= 0) { msg.textContent = "Fertig!"; await sl(700); if (dead) return; stop(); api.finish(score, score + " Punkte"); return; }
      busy = false;
    }
    function select(p) { board.querySelectorAll(".sel").forEach(e => e.classList.remove("sel")); sel = p; if (p && g[p[0]][p[1]]) g[p[0]][p[1]].el.classList.add("sel"); }
    const cell = e => { const r = board.getBoundingClientRect(), s = r.width / N; return [Math.min(N - 1, Math.max(0, Math.floor((e.clientY - r.top) / s))), Math.min(N - 1, Math.max(0, Math.floor((e.clientX - r.left) / s)))]; };
    let down = null;
    board.addEventListener("pointerdown", e => { if (busy) return; e.preventDefault(); const p = cell(e); down = { p, x: e.clientX, y: e.clientY, done: false };
      if (sel && Math.abs(sel[0] - p[0]) + Math.abs(sel[1] - p[1]) === 1) { down.done = true; move(sel, p); } });
    board.addEventListener("pointermove", e => { if (!down || down.done || busy) return; const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < cs * 0.35) return; down.done = true;
      const [r, c] = down.p, q = Math.abs(dx) > Math.abs(dy) ? [r, c + (dx > 0 ? 1 : -1)] : [r + (dy > 0 ? 1 : -1), c];
      if (q[0] >= 0 && q[0] < N && q[1] >= 0 && q[1] < N) move(down.p, q); });
    board.addEventListener("pointerup", () => { if (down && !down.done) select(sel && sel[0] === down.p[0] && sel[1] === down.p[1] ? null : down.p); down = null; });
    const stop = () => { dead = true; timers.forEach(clearTimeout); };

    // Startfeld ohne fertige Reihen
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      let t; do { t = rnd(); } while ((c >= 2 && g[r][c - 1].type === t && g[r][c - 2].type === t) || (r >= 2 && g[r - 1][c].type === t && g[r - 2][c].type === t));
      mk(r, c, t);
    }
    if (!hasMove()) reshuffle();
    busy = false;
    return stop;
  }
});

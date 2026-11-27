/* Breakout 2 (aus dem Spiele-Test übernommen): 10 Level, Steine mit Härtegraden, Extras, Schläger schießt. */
(() => {
  const { TAU, clamp, rnd, pick, store, rr, frame, shell, burst, stepParts, stepTexts } = KIT;

  function breakout(box, end) {
    const W = 360, H = 560, S = shell(box, W, H), c = S.c;
    const PY = 512, PH = 14, BW = 38, BH = 20, BX0 = 9, BY0 = 62, R = 6;
    const FONT = "Space Grotesk, system-ui, sans-serif";
    /* Steine: Ziffer = Härte (1-4 Treffer), # = Stahl (unzerstörbar), X = Sprengstein, . = leer */
    const LEVELS = [
      { n: "Aufwärmen", h: 200, g: ["111111111", "122222221", "122222221", "111111111"] },
      { n: "Pyramide", h: 120, g: ["....1....", "...121...", "..12221..", ".1222221.", "122222221"] },
      { n: "Eckpfeiler", h: 330, g: ["#.......#", "111111111", "222222222", "111111111", "#.......#"] },
      { n: "Schachbrett", h: 45, g: ["1.2.3.2.1", ".2.3.3.2.", "2.3.4.3.2", ".2.3.3.2.", "1.2.3.2.1"] },
      { n: "Pulverfass", h: 20, g: ["111X1X111", "222222222", "3X33333X3", "222222222", "111X1X111"] },
      { n: "Festung", h: 265, g: ["#2222222#", "#3333333#", "#3..X..3#", "#3.....3#", "#4444444#"] },
      { n: "Diamant", h: 180, g: ["....4....", "...333...", "..32223..", ".3221223.", "..32223..", "...333...", "....4...."] },
      { n: "Zickzack", h: 300, g: ["333333###", "###333333", "222222###", "###222222", "1X1X1X1X1"] },
      { n: "Invasion", h: 100, g: ["..3...3..", "...333...", "..34343..", ".33333333".slice(0, 9), "343333343", "3.33333.3", "3.3...3.3", "..33.33.."] },
      { n: "Der Boss", h: 350, g: ["#4X4X4X4#", "#4444444#", "#3.333.3#", "#4X444X4#", "#3.333.3#", "#4444444#", "#.2X2X2.#"] },
    ];
    const HC = { 1: ["#6ee7b7", "#10b981"], 2: ["#fde68a", "#f59e0b"], 3: ["#fdba74", "#ea580c"], 4: ["#f9a8d4", "#db2777"] };
    const PU = { W: { c: "#34d399", n: "Schläger größer" }, N: { c: "#f43f5e", n: "Schläger kleiner" }, M: { c: "#60a5fa", n: "Bälle teilen sich" }, G: { c: "#fbbf24", n: "Schläger schießt" }, S: { c: "#a78bfa", n: "Langsamer Ball" }, P: { c: "#fb923c", n: "Feuerball" }, L: { c: "#f472b6", n: "Extra-Leben" } };
    const POOL = "WWWWWNNMMMMGGGGSSPPPL";
    const stars = Array.from({ length: 50 }, () => ({ x: rnd(0, W), y: rnd(0, H), z: rnd(0.2, 1), p: rnd(0, 6) }));
    let st, tx = W / 2, best = +store.get("arc_breakout") || 0; const keys = {};
    const onKey = v => e => { if (e.key === "ArrowLeft" || e.key === "a") keys.l = v; if (e.key === "ArrowRight" || e.key === "d") keys.r = v; if (v && (e.key === " " || e.key === "ArrowUp")) launch(); if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault(); };
    const kd = onKey(true), ku = onKey(false); addEventListener("keydown", kd); addEventListener("keyup", ku);
    const speed = () => Math.min(470, 290 + (st.lv - 1) * 16) * (st.slow > 0 ? 0.72 : 1);
    const pw = () => st.size > 0 ? 112 : st.size < 0 ? 46 : 74;
    function loadLevel(n) {
      st.lv = n; st.br = []; st.grid = []; const L = LEVELS[n - 1];
      L.g.forEach((row, r) => { st.grid[r] = []; [...row].forEach((ch, k) => { if (ch === ".") return;
        const t = ch === "#" ? "#" : ch === "X" ? "X" : "H", hp = t === "H" ? +ch : 1;
        const b = { t, hp, max: hp, x: BX0 + k * BW + 1, y: BY0 + r * BH + 1, w: BW - 2, h: BH - 2, r, k, fl: 0, dead: false, seed: (r * 9 + k) * 7.3 };
        st.br.push(b); st.grid[r][k] = b; }); });
      st.left = st.br.filter(b => b.t !== "#").length; st.banner = 2.2; st.caps = []; st.bul = [];
      st.balls = []; newBall(); st.size = 0; st.sizeT = 0; st.gun = 0; st.slow = 0; st.fire = 0; st.bgh = L.h;
    }
    function newBall() { st.balls.push({ x: st.px, y: PY - R - 1, vx: 0, vy: 0, stuck: true, off: 0, r: R, tr: [] }); }
    function fresh() { st = { mode: "play", t: 0, score: 0, lives: 3, px: W / 2, pwc: 74, parts: [], txt: [], shake: 0, flash: 0, fireT: 0, clear: 0 }; loadLevel(1); }
    function launch() { if (!st || st.mode !== "play") return; st.balls.forEach(b => { if (b.stuck) { b.stuck = false; const a = rnd(-0.35, 0.35), s = speed(); b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s; } }); }
    function over(win) { st.mode = "over"; end(st.score, (win ? "Alle 10 Level geschafft! 🏆 " : "Level " + st.lv + " · ") + st.score + " Punkte"); }
    S.cv.addEventListener("pointerdown", e => { S.cv.setPointerCapture(e.pointerId); tx = S.pos(e).x; launch(); });
    S.cv.addEventListener("pointermove", e => { if (e.buttons || e.pointerType === "mouse") tx = S.pos(e).x; });
    function drop(b) { if (b.t !== "H" || Math.random() > 0.24) return; const k = pick(POOL); st.caps.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, k }); }
    function kill(b) {
      if (b.dead) return; b.dead = true; st.left--; st.score += 10 * b.max; burst(st.parts, b.x + b.w / 2, b.y + b.h / 2, HC[b.max] ? HC[b.max][0] : "#fff", 12, 170); drop(b);
      if (st.left <= 0 && st.mode === "play") { st.mode = "clear"; st.clear = 2.2; st.score += 100 * st.lv; st.txt.push({ x: W / 2, y: 300, t: "Level geschafft! +" + 100 * st.lv, c: "#fff", life: 0, s: 24 }); }
    }
    function explode(b) {
      if (b.dead) return; b.dead = true; st.left--; st.score += 30; st.shake = 0.35; st.flash = 0.12;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2; burst(st.parts, cx, cy, "#ff9a3c", 26, 280); burst(st.parts, cx, cy, "#ffe08a", 14, 200);
      for (let dr = -1; dr <= 1; dr++) for (let dk = -1; dk <= 1; dk++) { if (!dr && !dk) continue; const n = st.grid[b.r + dr] && st.grid[b.r + dr][b.k + dk]; if (!n || n.dead || n.t === "#") continue; if (n.t === "X") explode(n); else hurt(n, 2); }
      if (st.left <= 0 && st.mode === "play") { st.mode = "clear"; st.clear = 2.2; st.score += 100 * st.lv; st.txt.push({ x: W / 2, y: 300, t: "Level geschafft! +" + 100 * st.lv, c: "#fff", life: 0, s: 24 }); }
    }
    function hurt(b, d) {
      if (b.dead) return;
      if (b.t === "#") { b.fl = 0.15; burst(st.parts, b.x + b.w / 2, b.y + b.h / 2, "#cbd5e1", 3, 90); return; }
      if (b.t === "X") { explode(b); return; }
      b.hp -= d; b.fl = 0.12; st.score += 5; if (b.hp <= 0) kill(b); else burst(st.parts, b.x + b.w / 2, b.y + b.h / 2, "#fff", 3, 80);
    }
    function hitBricks(b) {
      const r = b.r, c0 = Math.floor((b.x - r - BX0) / BW), c1 = Math.floor((b.x + r - BX0) / BW), r0 = Math.floor((b.y - r - BY0) / BH), r1 = Math.floor((b.y + r - BY0) / BH);
      for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
        const br = st.grid[rr] && st.grid[rr][cc]; if (!br || br.dead) continue;
        const nx = clamp(b.x, br.x, br.x + br.w), ny = clamp(b.y, br.y, br.y + br.h), dx = b.x - nx, dy = b.y - ny, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        const pass = st.fire > 0 && br.t !== "#";
        if (!pass) {
          if (d2 > 1e-4) { const d = Math.sqrt(d2); b.x += dx / d * (r - d); b.y += dy / d * (r - d); if (Math.abs(dx) > Math.abs(dy)) b.vx = Math.abs(b.vx) * Math.sign(dx); else b.vy = Math.abs(b.vy) * Math.sign(dy); }
          else b.vy = -b.vy;
        }
        hurt(br, st.fire > 0 ? 3 : 1); if (!pass) return;
      }
    }
    function split() {
      const add = [];
      st.balls.forEach(b => { if (b.stuck || st.balls.length + add.length >= 14) return; const a = Math.atan2(b.vx, -b.vy) + (Math.random() < 0.5 ? 0.45 : -0.45), s = Math.hypot(b.vx, b.vy) || speed(); add.push({ x: b.x, y: b.y, vx: Math.sin(a) * s, vy: -Math.cos(a) * s, stuck: false, r: R, tr: [] }); });
      st.balls.push(...add);
    }
    function grab(k) {
      const p = PU[k]; st.txt.push({ x: st.px, y: PY - 24, t: p.n, c: p.c, life: 0, s: 17 }); st.score += 25;
      if (k === "W") { st.size = 1; st.sizeT = 14; } else if (k === "N") { st.size = -1; st.sizeT = 14; } else if (k === "M") split();
      else if (k === "G") st.gun = 12; else if (k === "S") st.slow = 10; else if (k === "P") st.fire = 8; else if (k === "L") st.lives = Math.min(5, st.lives + 1);
    }
    function loseLife() {
      st.lives--; st.shake = 0.3;
      if (st.lives <= 0) { over(false); return; }
      st.caps = []; st.bul = []; st.size = 0; st.sizeT = 0; st.gun = 0; st.slow = 0; st.fire = 0; st.balls = []; newBall(); st.txt.push({ x: W / 2, y: 330, t: "Noch " + st.lives + " ♥", c: "#fff", life: 0, s: 22 });
    }
    function moveBall(b, dt) {
      const sp = speed(), cur = Math.hypot(b.vx, b.vy) || 1; b.vx *= sp / cur; b.vy *= sp / cur;
      if (Math.abs(b.vy) < sp * 0.22) { b.vy = (b.vy < 0 ? -1 : 1) * sp * 0.22; const k = Math.sqrt(sp * sp - b.vy * b.vy); b.vx = Math.sign(b.vx || 1) * k; }
      const n = Math.max(1, Math.ceil(sp * dt / 3)), h = dt / n;
      for (let i = 0; i < n; i++) {
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); } else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y < b.r + 2) { b.y = b.r + 2; b.vy = Math.abs(b.vy); }
        if (b.vy > 0 && b.y + b.r >= PY && b.y - b.r <= PY + PH && b.x > st.px - st.pwc / 2 - b.r && b.x < st.px + st.pwc / 2 + b.r) {
          const rel = clamp((b.x - st.px) / (st.pwc / 2), -1, 1), a = rel * 1.12 + rnd(-0.06, 0.06); b.vx = Math.sin(a) * sp; b.vy = -Math.cos(a) * sp; b.y = PY - b.r; st.pulse = 0.15;
        }
        hitBricks(b);
      }
    }
    function update(dt, t) {
      st.t += dt; st.shake = Math.max(0, st.shake - dt); st.flash = Math.max(0, st.flash - dt); st.pulse = Math.max(0, (st.pulse || 0) - dt); st.banner = Math.max(0, (st.banner || 0) - dt);
      if (st.mode === "play" || st.mode === "clear") {
        if (keys.l) tx -= 430 * dt; if (keys.r) tx += 430 * dt; tx = clamp(tx, 0, W);
        st.pwc += (pw() - st.pwc) * Math.min(1, dt * 10); st.px += (clamp(tx, st.pwc / 2, W - st.pwc / 2) - st.px) * Math.min(1, dt * 28);
        ["sizeT", "gun", "slow", "fire"].forEach(k => { if (st[k] > 0) st[k] = Math.max(0, st[k] - dt); }); if (st.sizeT <= 0) st.size = 0;
        st.br.forEach(b => { if (b.fl > 0) b.fl -= dt; });
        if (st.gun > 0 && st.mode === "play") { st.fireT -= dt; if (st.fireT <= 0) { st.fireT = 0.26; st.bul.push({ x: st.px - st.pwc / 2 + 7, y: PY - 6 }, { x: st.px + st.pwc / 2 - 7, y: PY - 6 }); } }
        for (let i = st.bul.length - 1; i >= 0; i--) {
          const q = st.bul[i]; q.y -= 540 * dt; let gone = q.y < -10;
          if (!gone) { const br = st.grid[Math.floor((q.y - BY0) / BH)] && st.grid[Math.floor((q.y - BY0) / BH)][Math.floor((q.x - BX0) / BW)]; if (br && !br.dead) { hurt(br, 1); gone = true; } }
          if (gone) st.bul.splice(i, 1);
        }
        for (let i = st.caps.length - 1; i >= 0; i--) {
          const q = st.caps[i]; q.y += 125 * dt;
          if (q.y > PY - 8 && q.y < PY + PH + 8 && Math.abs(q.x - st.px) < st.pwc / 2 + 16) { grab(q.k); st.caps.splice(i, 1); } else if (q.y > H + 20) st.caps.splice(i, 1);
        }
        st.balls.forEach(b => { b.tr.push({ x: b.x, y: b.y }); if (b.tr.length > 9) b.tr.shift(); if (b.stuck) { b.x = clamp(st.px + b.off, 8, W - 8); b.y = PY - b.r - 1; b.tr.length = 0; } else moveBall(b, dt); });
        if (st.mode === "play") { st.balls = st.balls.filter(b => b.y < H + 20); if (!st.balls.length) loseLife(); }
        if (st.mode === "clear") { st.clear -= dt; if (st.clear <= 0) { if (st.lv >= 10) { st.mode = "play"; over(true); } else { st.mode = "play"; loadLevel(st.lv + 1); } } }
      }
      draw(dt, t / 1000);
    }
    function brick(b, t) {
      const x = b.x, y = b.y, w = b.w, h = b.h; let g;
      if (b.t === "#") { g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "#e2e8f0"); g.addColorStop(0.5, "#94a3b8"); g.addColorStop(1, "#475569"); }
      else if (b.t === "X") { g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "#fecaca"); g.addColorStop(1, "#dc2626"); }
      else { const k = HC[b.hp]; g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, k[0]); g.addColorStop(1, k[1]); }
      c.shadowColor = b.t === "X" ? "#ff5a3c" : b.t === "#" ? "transparent" : (HC[b.hp] || HC[1])[1]; c.shadowBlur = b.t === "#" ? 0 : 7;
      c.fillStyle = g; rr(c, x, y, w, h, 5); c.fill(); c.shadowBlur = 0;
      c.fillStyle = "#ffffff55"; rr(c, x + 2, y + 1.5, w - 4, 4, 2); c.fill();
      c.strokeStyle = "#00000044"; c.lineWidth = 1; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, 5); c.stroke();
      if (b.t === "#") { c.fillStyle = "#334155"; [x + 5, x + w - 5].forEach(px => { c.beginPath(); c.arc(px, y + h / 2, 1.8, 0, TAU); c.fill(); }); }
      if (b.t === "X") { c.fillStyle = "#1f2937"; c.beginPath(); c.arc(x + w / 2, y + h / 2 + 1, 5, 0, TAU); c.fill(); c.strokeStyle = "#fbbf24"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + w / 2 + 2, y + h / 2 - 3); c.lineTo(x + w / 2 + 5, y + 2); c.stroke(); c.fillStyle = Math.sin(t * 14 + b.seed) > 0 ? "#fde047" : "#fb923c"; c.beginPath(); c.arc(x + w / 2 + 5, y + 2, 2, 0, TAU); c.fill(); }
      if (b.t === "H" && b.hp < b.max) { c.strokeStyle = "#0000008a"; c.lineWidth = 1.2; const n = b.max - b.hp; for (let i = 0; i < n; i++) { const sx = x + 6 + ((b.seed * (i + 2)) % (w - 12)); c.beginPath(); c.moveTo(sx, y + 1); c.lineTo(sx + 3, y + h * 0.4); c.lineTo(sx - 2, y + h * 0.7); c.lineTo(sx + 2, y + h - 1); c.stroke(); } }
      if (b.fl > 0) { c.globalAlpha = Math.min(1, b.fl * 6); c.fillStyle = "#fff"; rr(c, x, y, w, h, 5); c.fill(); c.globalAlpha = 1; }
    }
    function draw(dt, t) {
      const hue = st.bgh, g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `hsl(${hue} 55% 13%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360} 60% 6%)`); c.fillStyle = g; c.fillRect(0, 0, W, H);
      stars.forEach(s => { c.globalAlpha = 0.25 + 0.5 * s.z * (0.5 + 0.5 * Math.sin(t * 2 + s.p)); c.fillStyle = "#fff"; c.fillRect(s.x, (s.y + t * 6 * s.z) % H, 1.5 * s.z + 0.5, 1.5 * s.z + 0.5); }); c.globalAlpha = 1;
      c.save(); if (st.shake > 0) c.translate(rnd(-1, 1) * st.shake * 14, rnd(-1, 1) * st.shake * 14);
      c.strokeStyle = `hsl(${hue} 80% 60% / .35)`; c.lineWidth = 2; c.beginPath(); c.moveTo(1, H); c.lineTo(1, 1); c.lineTo(W - 1, 1); c.lineTo(W - 1, H); c.stroke();
      st.br.forEach(b => { if (!b.dead) brick(b, t); });
      st.caps.forEach(q => { const p = PU[q.k]; c.shadowColor = p.c; c.shadowBlur = 12; c.fillStyle = p.c; rr(c, q.x - 16, q.y - 9, 32, 18, 9); c.fill(); c.shadowBlur = 0; c.fillStyle = "#ffffff55"; rr(c, q.x - 13, q.y - 7, 26, 5, 3); c.fill(); c.fillStyle = "#0b0f26"; c.font = "800 13px " + FONT; c.textAlign = "center"; c.fillText(q.k, q.x, q.y + 5); });
      st.bul.forEach(q => { c.shadowColor = "#fbbf24"; c.shadowBlur = 8; c.fillStyle = "#fde68a"; rr(c, q.x - 1.5, q.y - 8, 3, 14, 1.5); c.fill(); c.shadowBlur = 0; });
      st.balls.forEach(b => {
        const fire = st.fire > 0; b.tr.forEach((p, i) => { c.globalAlpha = i / b.tr.length * 0.45; c.fillStyle = fire ? "#fb923c" : "#bfdbfe"; c.beginPath(); c.arc(p.x, p.y, b.r * (0.35 + 0.6 * i / b.tr.length), 0, TAU); c.fill(); }); c.globalAlpha = 1;
        c.shadowColor = fire ? "#ff6a00" : "#93c5fd"; c.shadowBlur = 14; const rg = c.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, b.r); rg.addColorStop(0, "#fff"); rg.addColorStop(1, fire ? "#f97316" : "#60a5fa"); c.fillStyle = rg; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill(); c.shadowBlur = 0;
      });
      const px = st.px, w = st.pwc, x0 = px - w / 2;
      if (st.gun > 0) { c.fillStyle = "#94a3b8"; [x0 + 4, x0 + w - 10].forEach(x => { rr(c, x, PY - 9, 6, 11, 2); c.fill(); }); c.fillStyle = "#fbbf24"; [x0 + 7, x0 + w - 7].forEach(x => { c.beginPath(); c.arc(x, PY - 9, 2, 0, TAU); c.fill(); }); }
      const pg = c.createLinearGradient(0, PY, 0, PY + PH); pg.addColorStop(0, "#e0e7ff"); pg.addColorStop(0.45, "#818cf8"); pg.addColorStop(1, "#3730a3");
      c.shadowColor = st.pulse > 0 ? "#fff" : "#818cf8"; c.shadowBlur = st.pulse > 0 ? 22 : 12; c.fillStyle = pg; rr(c, x0, PY, w, PH, 7); c.fill(); c.shadowBlur = 0;
      c.fillStyle = "#ffffff66"; rr(c, x0 + 6, PY + 2, w - 12, 3, 2); c.fill(); c.fillStyle = "#22d3ee"; c.beginPath(); c.arc(px, PY + PH / 2 + 1, 2.5, 0, TAU); c.fill();
      stepParts(c, st.parts, dt, 120); stepTexts(c, st.txt, dt); c.restore();
      if (st.flash > 0) { c.globalAlpha = st.flash / 0.12 * 0.5; c.fillStyle = "#fff"; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
      const eff = [["fire", "Feuer", "#fb923c", 8], ["gun", "Schuss", "#fbbf24", 12], ["slow", "Langsam", "#a78bfa", 10], ["sizeT", st.size > 0 ? "Groß" : "Klein", st.size > 0 ? "#34d399" : "#f43f5e", 14]].filter(e => st[e[0]] > 0);
      eff.forEach((e, i) => { const x = 10 + i * 86; c.fillStyle = "#ffffff22"; rr(c, x, H - 18, 78, 9, 4); c.fill(); c.fillStyle = e[2]; rr(c, x, H - 18, 78 * st[e[0]] / e[3], 9, 4); c.fill(); c.fillStyle = "#fff"; c.font = "600 10px " + FONT; c.textAlign = "left"; c.fillText(e[1], x, H - 22); });
      if (st.banner > 0) { c.globalAlpha = Math.min(1, st.banner); c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "700 30px " + FONT; c.fillText("Level " + st.lv, W / 2, 330); c.font = "500 17px " + FONT; c.fillStyle = "#cbd5e1"; c.fillText(LEVELS[st.lv - 1].n, W / 2, 356); c.globalAlpha = 1; }
      if (st.mode === "play" && st.balls.some(b => b.stuck) && st.banner <= 0.6) { c.fillStyle = "#fff"; c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5); c.font = "600 15px " + FONT; c.textAlign = "center"; c.fillText("Antippen zum Starten", W / 2, 450); c.globalAlpha = 1; }
      S.hud(`Punkte ${st.score}`, `Level ${st.lv}/10 <span style="color:#ff5d8f">${"♥".repeat(Math.max(0, st.lives))}</span>`);
    }
    fresh(); st.mode = "wait"; draw(0, 0);
    S.overlay("Breakout 2", "Ziehe den Schläger mit dem Finger, tippe zum Starten. Zerstöre alle Steine, fange die Extras und schaffe 10 Level.", "Los geht's", () => { st.mode = "play"; });
    const stop = frame(update); return () => { stop(); removeEventListener("keydown", kd); removeEventListener("keyup", ku); };
  }

    /* Spiel in die Spielhalle einhängen: Ende -> kurz warten, dann Ergebnis an die Spielhalle melden (Punkte, Bestenliste) */
    function mount(root, api, fn) {
      let stopper = null, done = false;
      stopper = fn(root, (score, text) => { if (done) return; done = true; setTimeout(() => { if (stopper) stopper(); api.finish(score, text); }, 900); });
      return () => { done = true; if (stopper) stopper(); };
    }

  ARCADE.register({
    id: "breakout", name: "Breakout 2", color: "linear-gradient(145deg,#ff7a59,#b8325a)", icon: "🧱", fmt: v => v + " P.",
    desc: "Steine zerstören, Extras fangen, 10 Level.",
    help() {
      return `<h2>🧱 So geht Breakout 2</h2>
        <p><b>Ziel:</b> Zerstöre alle Steine mit dem Ball und schaffe alle <b>10 Level</b>. Du hast <b>3 Leben</b> ♥.</p>
        <h3>Steuerung</h3>
        <p>Ziehe den Finger nach links und rechts, der Schläger folgt. <b>Tippe</b>, um den Ball zu starten. Je weiter außen der Ball den Schläger trifft, desto schräger fliegt er. Am Computer: ◀ ▶ und Leertaste.</p>
        <h3>Steine</h3>
        <ul><li>Farbige Steine haben <b>1 bis 4 Leben</b>. Risse zeigen, was schon angeschlagen ist.</li>
        <li><b>Graue Stahlsteine</b> halten ewig. Du musst sie nicht zerstören.</li>
        <li><b>Rote Bomben</b> sprengen die Steine daneben.</li></ul>
        <h3>Extras (fallen aus Steinen, mit dem Schläger fangen)</h3>
        <ul><li><b>W</b> Schläger größer · <b>N</b> Schläger kleiner (schlecht)</li>
        <li><b>M</b> alle Bälle teilen sich · <b>G</b> Schläger schießt</li>
        <li><b>S</b> langsamer Ball · <b>P</b> Feuerball, geht durch Steine · <b>L</b> Extra-Leben</li></ul>
        <h3>Punkte</h3>
        <p>Jeder Treffer 5 Punkte, ein zerstörter Stein 10 Punkte pro Leben, Bomben 30, Extras 25. Für jedes geschaffte Level gibt es 100 Punkte mal Levelnummer.</p>
        <h3>Spielpunkte ⭐</h3>
        <p>Dein Ergebnis geteilt durch 50 (abgerundet), höchstens 300 ⭐. Mit 1500 Punkten bekommst du also <b>30 ⭐</b>.</p>`;
    },
    start(root, api) { return mount(root, api, breakout); }
  });
})();

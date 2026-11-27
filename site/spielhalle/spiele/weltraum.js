/* Weltraum-Abwehr (aus dem Spiele-Test übernommen). Ziehen = steuern, Schiff schießt von allein. */
(() => {
  const { TAU, clamp, rnd, pick, store, rr, frame, shell, burst, stepParts, stepTexts } = KIT;

  function space(box, end) {
    const S = shell(box, 360, 560), c = S.c, W = 360, H = 560;
    const stars = Array.from({ length: 60 }, () => ({ x: rnd(0, W), y: rnd(0, H), z: rnd(0.3, 1) }));
    const COLS = ["#ff5d8f", "#ffb02e", "#4dd8ff", "#a78bfa", "#5eead4"], keys = {};
    const PU = { D: { t: "2x", c: "#5eead4", n: "Doppelschuss" }, F: { t: "F", c: "#a78bfa", n: "Fächerschuss" }, S: { t: "S", c: "#ffd166", n: "Schnellfeuer" }, L: { t: "L", c: "#ff7a59", n: "Durchschlag" }, O: { t: "O", c: "#4dd8ff", n: "Schutzschild" }, H: { t: "♥", c: "#ff5d8f", n: "Extraleben" }, Z: { t: "Z", c: "#c4b5fd", n: "Zeitlupe" }, B: { t: "B", c: "#ffffff", n: "Nova-Bombe" } };
    const POOL = "DDDFFFSSLLOOZZB";
    let st, tx = W / 2, best = +store.get("arc_space") || 0;
    const onKey = v => e => { if (e.key === "ArrowLeft" || e.key === "a") keys.l = v; if (e.key === "ArrowRight" || e.key === "d") keys.r = v; if (e.key.startsWith("Arrow")) e.preventDefault(); };
    const kd = onKey(true), ku = onKey(false); addEventListener("keydown", kd); addEventListener("keyup", ku);
    function wave(n) { st.n = n; st.al = []; const rows = Math.min(5, 3 + Math.floor(n / 2)); for (let r = 0; r < rows; r++) for (let k = 0; k < 7; k++) st.al.push({ x: 36 + k * 44, y: 84 + r * 36, r, w: 28, h: 22, ph: rnd(0, 6), hp: 1 + Math.floor((n - 1) / 4), mx: 1 + Math.floor((n - 1) / 4), fl: 0 }); st.dir = 1; st.banner = 1.6; st.eb = []; }
    function fresh() { st = { mode: "play", t: 0, score: 0, lives: 3, inv: 0, ship: { x: W / 2, y: 506 }, b: [], eb: [], pu: [], wp: "single", wpT: 0, rapid: 0, pierce: 0, slow: 0, shield: false, flash: 0, fire: 0, sh: 1.2, ufo: null, ufoT: 14, parts: [], txt: [], shake: 0 }; tx = W / 2; wave(1); window.__st = () => st; }
    function over() { st.mode = "over"; end(st.score, "Welle " + st.n + " · " + st.score + " Punkte"); }
    S.cv.addEventListener("pointerdown", e => { S.cv.setPointerCapture(e.pointerId); tx = S.pos(e).x; });
    S.cv.addEventListener("pointermove", e => { if (e.buttons || e.pointerType === "mouse") tx = S.pos(e).x; });
    const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    function killAlien(i, noDrop) { const a = st.al.splice(i, 1)[0], pts = 10 + (4 - Math.min(4, a.r)) * 5 + (a.mx - 1) * 5; st.score += pts; burst(st.parts, a.x + 14, a.y + 11, COLS[a.r % 5], 14, 160); st.txt.push({ x: a.x + 14, y: a.y, t: "+" + pts, c: "#fff", life: 0, s: 14 }); if (!noDrop && Math.random() < 0.14) st.pu.push({ x: a.x + 14, y: a.y, k: POOL[Math.random() * POOL.length | 0] }); }
    /* Ab Welle 5 haben Aliens mehrere Leben (alle 4 Wellen eins mehr): so wird es immer schwerer, endlos zu spielen */
    function hurtAlien(i) { const a = st.al[i]; a.hp--; if (a.hp <= 0) killAlien(i); else { a.fl = 0.12; st.score += 1; burst(st.parts, a.x + 14, a.y + 11, "#fff", 4, 90); } }
    function grab(k) {
      const sh = st.ship, p = PU[k]; st.txt.push({ x: sh.x, y: sh.y - 30, t: p.n, c: p.c, life: 0, s: 18 });
      if (k === "D" || k === "F") { st.wp = k === "D" ? "double" : "spread"; st.wpT = 12; } else if (k === "S") st.rapid = 10; else if (k === "L") st.pierce = 8; else if (k === "O") st.shield = true; else if (k === "Z") st.slow = 6;
      else if (k === "H") st.lives = Math.min(5, st.lives + 1);
      else if (k === "B") { st.flash = 0.3; st.eb = []; for (let i = st.al.length - 1; i >= 0; i--) if (Math.random() < 0.5) killAlien(i, true); }
    }
    function update(dt) {
      if (st.mode === "play") {
        st.t += dt; if (keys.l) tx -= 380 * dt; if (keys.r) tx += 380 * dt; tx = clamp(tx, 22, W - 22);
        const sh = st.ship, ts = st.slow > 0 ? 0.5 : 1; sh.x += clamp((tx - sh.x) * 14 * dt, -620 * dt, 620 * dt);
        st.fire -= dt;
        if (st.fire <= 0) { const pi = st.pierce > 0, y = sh.y - 18; if (st.wp === "double") st.b.push({ x: sh.x - 8, y, vx: 0, pi }, { x: sh.x + 8, y, vx: 0, pi }); else if (st.wp === "spread") st.b.push({ x: sh.x, y, vx: -95, pi }, { x: sh.x, y, vx: 0, pi }, { x: sh.x, y, vx: 95, pi }); else st.b.push({ x: sh.x, y, vx: 0, pi }); st.fire = st.rapid > 0 ? 0.11 : 0.25; }
        st.wpT = Math.max(0, st.wpT - dt); if (st.wpT === 0) st.wp = "single"; st.rapid = Math.max(0, st.rapid - dt); st.pierce = Math.max(0, st.pierce - dt); st.slow = Math.max(0, st.slow - dt);
        st.inv = Math.max(0, st.inv - dt); st.banner = Math.max(0, st.banner - dt); st.shake = Math.max(0, st.shake - dt); st.flash = Math.max(0, st.flash - dt);
        st.b.forEach(b => { b.y -= 640 * dt; b.x += b.vx * dt; }); st.b = st.b.filter(b => b.y > -20 && b.x > -10 && b.x < W + 10);
        const total = 7 * Math.min(5, 3 + Math.floor(st.n / 2)), sp = (32 + st.n * 7 + (1 - st.al.length / total) * 70) * ts;
        st.al.forEach(a => { a.x += st.dir * sp * dt; if (a.fl > 0) a.fl -= dt; });
        if (st.al.some(a => a.x < 14 || a.x + a.w > W - 14)) { st.dir *= -1; st.al.forEach(a => { a.y += 14; a.x = clamp(a.x, 14, W - 14 - a.w); }); }
        if (st.al.some(a => a.y + a.h >= sh.y - 10)) { burst(st.parts, sh.x, sh.y, "#fff", 30, 220); over(); }
        st.sh -= dt * ts; if (st.sh <= 0 && st.al.length) { const bot = {}; st.al.forEach(a => { const k = Math.round(a.x / 44); if (!bot[k] || a.y > bot[k].y) bot[k] = a; }); const a = pick(Object.values(bot)); st.eb.push({ x: a.x + 12, y: a.y + 22, w: 5, h: 14 }); if (st.n >= 12) { const a2 = pick(Object.values(bot)); if (a2 !== a) st.eb.push({ x: a2.x + 12, y: a2.y + 22, w: 5, h: 14 }); } st.sh = Math.max(0.3, 1.3 - st.n * 0.07) * rnd(0.6, 1.1); }
        st.eb.forEach(b => { b.y += Math.min(430, 200 + st.n * 12) * dt * ts; }); st.eb = st.eb.filter(b => b.y < H + 20);
        st.ufoT -= dt; if (st.ufoT <= 0 && !st.ufo) { st.ufo = { x: -40, w: 36, h: 16, y: 40 }; st.ufoT = 18; }
        if (st.ufo) { st.ufo.x += 100 * dt; if (st.ufo.x > W + 40) st.ufo = null; }
        st.b = st.b.filter(b => {
          const bb = { x: b.x - 2, y: b.y - 8, w: 4, h: 16 }; let alive = true;
          for (let i = st.al.length - 1; i >= 0; i--) if (hit(bb, st.al[i])) { hurtAlien(i); if (!b.pi) { alive = false; break; } }
          if (alive && st.ufo && hit(bb, { x: st.ufo.x, y: st.ufo.y, w: st.ufo.w, h: st.ufo.h })) { st.score += 100; st.txt.push({ x: st.ufo.x + 18, y: st.ufo.y, t: "+100", c: "#ffd166", life: 0, s: 22 }); burst(st.parts, st.ufo.x + 18, st.ufo.y + 8, "#ffd166", 24, 200); st.pu.push({ x: st.ufo.x + 18, y: st.ufo.y, k: pick(["D", "F", "S", "L", "O", "H", "B"]) }); st.ufo = null; if (!b.pi) alive = false; }
          return alive;
        });
        st.pu.forEach(p => { p.y += 90 * dt; }); st.pu = st.pu.filter(p => { if (Math.abs(p.x - sh.x) < 24 && Math.abs(p.y - sh.y) < 22) { grab(p.k); return false; } return p.y < H + 20; });
        const me = { x: sh.x - 14, y: sh.y - 10, w: 28, h: 22 };
        if (st.inv <= 0) { const k = st.eb.findIndex(b => hit(b, me)); if (k >= 0) { st.eb.splice(k, 1); if (st.shield) { st.shield = false; st.inv = 0.8; burst(st.parts, sh.x, sh.y, "#4dd8ff", 20, 200); } else { st.lives--; st.inv = 1.6; st.shake = 0.3; burst(st.parts, sh.x, sh.y, "#ff5d8f", 26, 220); if (st.lives <= 0) over(); } } }
        if (!st.al.length && st.mode === "play") { st.score += 100; wave(st.n + 1); }
      }
      draw(dt);
    }
    function chips() {
      const list = []; if (st.wpT > 0) list.push([st.wp === "double" ? "D" : "F", st.wpT, 12]); if (st.rapid > 0) list.push(["S", st.rapid, 10]); if (st.pierce > 0) list.push(["L", st.pierce, 8]); if (st.slow > 0) list.push(["Z", st.slow, 6]); if (st.shield) list.push(["O", 1, 1]);
      list.forEach(([k, v, m], i) => { const x = 8 + i * 40, p = PU[k]; c.fillStyle = "#0b0f26cc"; rr(c, x, 8, 36, 20, 8); c.fill(); c.fillStyle = p.c; rr(c, x + 3, 22, 30 * v / m, 3, 2); c.fill(); c.font = "700 11px Inter, sans-serif"; c.textAlign = "center"; c.fillText(p.t, x + 18, 19); });
    }
    function draw(dt) {
      c.save(); if (st.shake > 0) c.translate(rnd(-4, 4), rnd(-4, 4));
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0a0b24"); g.addColorStop(1, st.slow > 0 ? "#2a2070" : "#1d1550"); c.fillStyle = g; c.fillRect(-10, -10, W + 20, H + 20);
      stars.forEach(s => { s.y += s.z * 40 * dt; if (s.y > H) { s.y = 0; s.x = rnd(0, W); } c.globalAlpha = s.z; c.fillStyle = "#fff"; c.fillRect(s.x, s.y, s.z * 2, s.z * 2); }); c.globalAlpha = 1;
      st.al.forEach(a => { const col = COLS[a.r % 5], bob = Math.sin(st.t * 6 + a.ph) * 2; c.shadowColor = col; c.shadowBlur = 10; c.fillStyle = col; rr(c, a.x, a.y + bob, a.w, a.h, 8); c.fill(); c.fillRect(a.x + 4, a.y + a.h - 2 + bob, 5, 5 + bob * 0.5); c.fillRect(a.x + a.w - 9, a.y + a.h - 2 + bob, 5, 5 - bob * 0.5); c.fillRect(a.x + 6, a.y - 4 + bob, 3, 5); c.fillRect(a.x + a.w - 9, a.y - 4 + bob, 3, 5); c.shadowBlur = 0; if (a.fl > 0) { c.fillStyle = "#ffffffcc"; rr(c, a.x, a.y + bob, a.w, a.h, 8); c.fill(); } if (a.mx > 1) { c.strokeStyle = "#ffd166"; c.lineWidth = 1 + Math.min(3, a.hp / 3); rr(c, a.x + 1, a.y + 1 + bob, a.w - 2, a.h - 2, 8); c.stroke(); c.fillStyle = "#fff"; c.font = "800 11px system-ui, sans-serif"; c.textAlign = "center"; c.fillText(a.hp, a.x + a.w / 2, a.y + a.h + 9 + bob); } c.fillStyle = "#0b0f26"; c.beginPath(); c.arc(a.x + 9, a.y + 9 + bob, 3.2, 0, TAU); c.arc(a.x + a.w - 9, a.y + 9 + bob, 3.2, 0, TAU); c.fill(); });
      if (st.ufo) { const u = st.ufo; c.shadowColor = "#ffd166"; c.shadowBlur = 14; c.fillStyle = "#ffd166"; c.beginPath(); c.ellipse(u.x + 18, u.y + 9, 18, 7, 0, 0, TAU); c.fill(); c.fillStyle = "#fff3c4"; c.beginPath(); c.ellipse(u.x + 18, u.y + 4, 9, 6, 0, Math.PI, TAU); c.fill(); c.shadowBlur = 0; }
      st.b.forEach(b => { c.shadowColor = b.pi ? "#ff7a59" : "#5eead4"; c.shadowBlur = 10; c.fillStyle = b.pi ? "#ffb08a" : "#5eead4"; rr(c, b.x - 2, b.y - 8, 4, b.pi ? 20 : 16, 2); c.fill(); });
      c.shadowColor = "#ff5d8f"; c.fillStyle = "#ff8fb1"; st.eb.forEach(b => { rr(c, b.x, b.y, b.w, b.h, 2); c.fill(); }); c.shadowBlur = 0;
      st.pu.forEach(p => { const q = PU[p.k]; c.shadowColor = q.c; c.shadowBlur = 10; c.fillStyle = q.c; rr(c, p.x - 15, p.y - 9, 30, 18, 9); c.fill(); c.shadowBlur = 0; c.fillStyle = "#0b0f26"; c.font = "700 12px Inter, sans-serif"; c.textAlign = "center"; c.fillText(q.t, p.x, p.y + 4); });
      if (st.mode === "play" || (st.mode === "over" && st.lives > 0)) { const sh = st.ship; if (st.inv <= 0 || Math.floor(st.inv * 12) % 2) { c.shadowColor = "#7c9cff"; c.shadowBlur = 14; c.fillStyle = "#7c9cff"; c.beginPath(); c.moveTo(sh.x, sh.y - 20); c.lineTo(sh.x + 17, sh.y + 12); c.lineTo(sh.x + 6, sh.y + 7); c.lineTo(sh.x - 6, sh.y + 7); c.lineTo(sh.x - 17, sh.y + 12); c.closePath(); c.fill(); c.shadowBlur = 0; c.fillStyle = "#dbe4ff"; c.beginPath(); c.ellipse(sh.x, sh.y - 2, 3.5, 7, 0, 0, TAU); c.fill(); c.fillStyle = "#ffb02e"; c.beginPath(); c.moveTo(sh.x - 4, sh.y + 8); c.lineTo(sh.x, sh.y + 14 + Math.random() * 8); c.lineTo(sh.x + 4, sh.y + 8); c.fill(); }
        if (st.shield) { c.strokeStyle = "#4dd8ff"; c.lineWidth = 2.5; c.globalAlpha = 0.6 + Math.sin(st.t * 8) * 0.3; c.beginPath(); c.arc(sh.x, sh.y - 2, 26, 0, TAU); c.stroke(); c.globalAlpha = 1; } }
      stepParts(c, st.parts, dt, 0); stepTexts(c, st.txt, dt);
      if (st.flash > 0) { c.globalAlpha = st.flash / 0.3 * 0.7; c.fillStyle = "#fff"; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
      if (st.banner > 0) { c.globalAlpha = Math.min(1, st.banner); c.fillStyle = "#fff"; c.font = "700 30px Space Grotesk, system-ui, sans-serif"; c.textAlign = "center"; c.fillText("Welle " + st.n, W / 2, 300); c.globalAlpha = 1; }
      chips(); c.restore();
      S.hud(`Punkte ${st.score}`, `Welle ${st.n} <span style="color:#ff5d8f">${"♥".repeat(Math.max(0, st.lives))}</span>`);
    }
    fresh(); st.mode = "wait"; draw(0);
    S.overlay("Weltraum-Abwehr", "Ziehe den Finger nach links und rechts. Dein Schiff schießt von allein. Fange die Extras, die von abgeschossenen Aliens fallen.", "Los geht's", fresh);
    const stop = frame(update); return () => { stop(); removeEventListener("keydown", kd); removeEventListener("keyup", ku); };
  }

    /* Spiel in die Spielhalle einhängen: Ende -> kurz warten, dann Ergebnis an die Spielhalle melden (Punkte, Bestenliste) */
    function mount(root, api, fn) {
      let stopper = null, done = false;
      stopper = fn(root, (score, text) => { if (done) return; done = true; setTimeout(() => { if (stopper) stopper(); api.finish(score, text); }, 900); });
      return () => { done = true; if (stopper) stopper(); };
    }

  ARCADE.register({
    id: "weltraum", name: "Weltraum-Abwehr", color: "linear-gradient(145deg,#5b7cff,#2b2f8f)", icon: "🚀", fmt: v => v + " P.",
    desc: "Aliens abwehren, Extras sammeln, Wellen überleben.",
    help() {
      return `<h2>🚀 So geht Weltraum-Abwehr</h2>
        <p><b>Ziel:</b> Wehre die Alien-Wellen ab und überlebe so lange wie möglich. Du hast <b>3 Leben</b> ♥.</p>
        <h3>Steuerung</h3>
        <p>Ziehe den Finger nach links und rechts, dein Schiff folgt und <b>schießt von allein</b>. Am Computer: ◀ ▶.</p>
        <h3>Extras</h3>
        <p>Aus abgeschossenen Aliens fallen Kapseln. Fange sie mit dem Schiff: Doppelschuss, Fächerschuss, Schnellfeuer, Durchschlag, Schutzschild, Zeitlupe und eine Bombe.</p>
        <h3>Punkte</h3>
        <p>Aliens in den vorderen Reihen bringen weniger, die hinteren mehr (10 bis 30 Punkte). Das UFO oben bringt Extrapunkte.</p>
        <p><b>Wird immer schwerer:</b> Ab Welle 5 halten die Aliens mehr aus (die Zahl unter dem Alien zeigt die Treffer, die es noch braucht). Außerdem schießen sie öfter. Wie weit kommst du?</p>
        <h3>Spielpunkte ⭐</h3>
        <p>Dein Ergebnis geteilt durch 50 (abgerundet), höchstens 300 ⭐. Mit 2000 Punkten bekommst du also <b>40 ⭐</b>.</p>`;
    },
    start(root, api) { return mount(root, api, space); }
  });
})();

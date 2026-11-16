/* Frogger: Straße überqueren, dann mit den Baumstämmen über den Fluss. Jede Rettung ans andere Ufer = 1 Punkt. 3 Leben. */
ARCADE.register({
  id: "frogger", name: "Frogger", color: "linear-gradient(145deg,#66bb6a,#2e7d32)", icon: "🐸", fmt: v => v + " 🐸",
  desc: "Über die Straße und den Fluss – 3 Leben.",
  start(root, api) {
    const COLS = 9, ROWS = 11, S = Math.min(root.clientWidth || 360, 396), C = Math.floor(S / COLS), W = C * COLS, H = C * ROWS;
    root.innerHTML = `<div class="stage"><div class="hud"><span id="lv">❤️❤️❤️</span><span>🐸 <span id="sc">0</span></span></div><canvas width="${W}" height="${H}"></canvas>
      <div class="dpad"><button class="u" data-d="u">▲</button><button class="l" data-d="l">◀</button><button class="d" data-d="d">▼</button><button class="r" data-d="r">▶</button></div></div>`;
    const cv = root.querySelector("canvas"), g = cv.getContext("2d"), sc = root.querySelector("#sc"), lv = root.querySelector("#lv");
    // Reihen: 0 Ziel, 1-4 Fluss, 5 Mitte, 6-9 Straße, 10 Start
    const spec = [[9, "car", -1, 1.7, 1.5, 3, "#e5484d"], [8, "truck", 1, 1.2, 2.3, 2, "#f0a020"], [7, "car", -1, 2.5, 1.4, 3, "#4f8cff"], [6, "car", 1, 2.0, 1.5, 3, "#b25be6"],
      [4, "log", 1, 1.1, 3, 3, "#8a5a2b"], [3, "log", -1, 1.5, 2.2, 3, "#9a6a33"], [2, "log", 1, 0.9, 3.5, 3, "#8a5a2b"], [1, "log", -1, 1.3, 2.6, 3, "#9a6a33"]];
    const lanes = spec.map(([row, type, dir, speed, w, n, color]) => {
      const L = type === "log" ? n * (w + 1.9) : COLS + w + 3; // Rundlauf-Länge
      return { row, type, dir, speed, w, color, L, items: Array.from({ length: n }, (_, i) => ({ x: (i * L) / n - 1 })) };
    });
    let fx = 4, fy = 10, lives = 3, score = 0, mult = 1, hurt = 0, over = false, raf = 0, last = performance.now();
    const hearts = () => (lv.textContent = "❤️".repeat(Math.max(0, lives)) || "💔");
    const laneAt = r => lanes.find(l => l.row === r);
    const reset = () => { fx = 4; fy = 10; hurt = 0.7; };
    const die = () => { if (hurt > 0 || over) return; lives--; hearts(); if (lives <= 0) { over = true; stop(); draw(); api.finish(score, score === 1 ? "1 Mal drüben" : score + " Mal drüben"); } else reset(); };
    const move = d => {
      if (over) return;
      if (d === "u") fy = Math.max(0, fy - 1); if (d === "d") fy = Math.min(10, fy + 1);
      if (d === "l") fx = Math.max(0, fx - 1); if (d === "r") fx = Math.min(COLS - 1, fx + 1);
      if (fy === 0) { score++; sc.textContent = score; mult = 1 + score * 0.07; reset(); }
    };
    const key = e => { const m = { ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r", w: "u", s: "d", a: "l", d: "r" }[e.key]; if (m) { e.preventDefault(); move(m); } };
    addEventListener("keydown", key);
    root.querySelectorAll("[data-d]").forEach(b => b.addEventListener("pointerdown", e => { e.preventDefault(); move(b.dataset.d); }));
    let sx = 0, sy = 0;
    cv.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; });
    cv.addEventListener("pointerup", e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return; move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : (dy > 0 ? "d" : "u")); });
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; if (hurt > 0) hurt -= dt;
      lanes.forEach(l => l.items.forEach(it => { it.x += l.dir * l.speed * mult * dt; if (l.dir > 0 && it.x > COLS) it.x -= l.L; if (l.dir < 0 && it.x + l.w < 0) it.x += l.L; }));
      const cx = fx + 0.5, l = laneAt(fy);
      if (l && l.type === "log") {
        const on = l.items.some(it => cx > it.x + 0.1 && cx < it.x + l.w - 0.1);
        if (on) fx += l.dir * l.speed * mult * dt; else die();
        if (fx < -0.45 || fx > COLS - 0.55) die();
      } else if (l) { if (l.items.some(it => Math.abs(cx - (it.x + l.w / 2)) < l.w / 2 + 0.32)) die(); }
      draw(); if (!over) raf = requestAnimationFrame(loop);
    };
    const draw = () => {
      const band = (r, c) => { g.fillStyle = c; g.fillRect(0, r * C, W, C); };
      band(0, "#1f6a46"); for (let r = 1; r <= 4; r++) band(r, "#1b4f86"); band(5, "#2d6b3c"); for (let r = 6; r <= 9; r++) band(r, "#2a2f3a"); band(10, "#2d6b3c");
      g.fillStyle = "#ffffff22"; for (let r = 6; r < 9; r++) for (let x = 0; x < W; x += C * 1.2) g.fillRect(x, (r + 1) * C - 1, C * 0.6, 2);
      lanes.forEach(l => l.items.forEach(it => { g.fillStyle = l.color; const rr = l.type === "log" ? 6 : 8; g.beginPath(); g.roundRect(it.x * C, l.row * C + C * 0.12, l.w * C, C * 0.76, rr); g.fill(); }));
      g.font = `${Math.round(C * 0.85)}px serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.globalAlpha = hurt > 0 && Math.floor(hurt * 10) % 2 ? 0.35 : 1;
      g.fillText("🐸", (fx + 0.5) * C, (fy + 0.5) * C + 2); g.globalAlpha = 1;
    };
    const stop = () => { cancelAnimationFrame(raf); removeEventListener("keydown", key); };
    hearts(); draw(); raf = requestAnimationFrame(loop);
    return stop;
  }
});

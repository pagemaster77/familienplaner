/* Flappy: Tippen = flattern. Durch die Lücken fliegen, jede Röhre zählt einen Punkt. */
ARCADE.register({
  id: "flappy", name: "Flappy", icon: "🐤", fmt: v => v + " 🚧",
  desc: "Tippen = flattern. Fliege durch die Lücken.",
  start(root, api) {
    const W = Math.min(root.clientWidth || 360, 360), H = Math.round(W * 1.4), k = W / 320;
    root.innerHTML = `<div class="stage"><div class="hud"><span>🚧 <span id="sc">0</span></span></div><canvas width="${W}" height="${H}"></canvas><div class="sub" style="margin-top:8px">Tippen, Leertaste oder ⬆ = flattern</div></div>`;
    const cv = root.querySelector("canvas"), g = cv.getContext("2d"), sc = root.querySelector("#sc");
    const GAP = 128 * k, PW = 54 * k, BX = 82 * k, R = 13 * k, GROUND = 22 * k, GRAV = 1350 * k, FLAP = -400 * k, SPEED = 125 * k;
    let y = H / 2, v = 0, pipes = [], score = 0, started = false, over = false, last = performance.now(), spawn = 0, raf = 0;
    const flap = () => { if (over) return; started = true; v = FLAP; };
    const key = e => { if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); flap(); } };
    addEventListener("keydown", key);
    cv.addEventListener("pointerdown", e => { e.preventDefault(); flap(); });
    const addPipe = () => pipes.push({ x: W + 10, gy: 70 * k + Math.random() * (H - GROUND - GAP - 140 * k), passed: false });
    const end = () => { over = true; stop(); api.finish(score, score === 1 ? "1 Röhre" : score + " Röhren"); };
    const loop = now => {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      if (started) {
        v += GRAV * dt; y += v * dt; spawn -= dt;
        if (spawn <= 0) { addPipe(); spawn = 1.55; }
        pipes.forEach(p => { p.x -= SPEED * dt; if (!p.passed && p.x + PW < BX - R) { p.passed = true; score++; sc.textContent = score; } });
        pipes = pipes.filter(p => p.x + PW > -5);
        if (y + R >= H - GROUND) { y = H - GROUND - R; draw(); return end(); }
        if (y - R < 0) { y = R; v = 0; }
        for (const p of pipes) {
          if (BX + R > p.x && BX - R < p.x + PW && (y - R < p.gy || y + R > p.gy + GAP)) { draw(); return end(); }
        }
      } else y = H / 2 + Math.sin(now / 220) * 7 * k;
      draw(); raf = requestAnimationFrame(loop);
    };
    const draw = () => {
      g.fillStyle = "#0b1220"; g.fillRect(0, 0, W, H);
      pipes.forEach(p => {
        g.fillStyle = "#2fae6b"; g.fillRect(p.x, 0, PW, p.gy); g.fillRect(p.x, p.gy + GAP, PW, H);
        g.fillStyle = "#43d589"; g.fillRect(p.x - 3 * k, p.gy - 14 * k, PW + 6 * k, 14 * k); g.fillRect(p.x - 3 * k, p.gy + GAP, PW + 6 * k, 14 * k);
      });
      g.fillStyle = "#3a4a6a"; g.fillRect(0, H - GROUND, W, GROUND);
      g.save(); g.translate(BX, y); g.rotate(Math.max(-0.5, Math.min(1.2, v / (700 * k)))); g.font = `${Math.round(2.3 * R)}px serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("🐤", 0, 0); g.restore();
      if (!started) { g.fillStyle = "#fff"; g.font = `600 ${Math.round(20 * k)}px system-ui,sans-serif`; g.textAlign = "center"; g.fillText("Tippen zum Starten", W / 2, H * 0.28); }
    };
    const stop = () => { cancelAnimationFrame(raf); removeEventListener("keydown", key); };
    draw(); raf = requestAnimationFrame(loop);
    return stop;
  }
});

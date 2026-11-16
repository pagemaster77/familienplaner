/* Pong gegen den Computer: Schläger mit dem Finger/der Maus ziehen (oder ◀ ▶). Jeder abgewehrte Ball = 1 Punkt,
   ein Ball am Computer vorbei = 5 Punkte. 3 Leben. Der Ball wird immer schneller. */
ARCADE.register({
  id: "pong", name: "Pong", icon: "🏓", fmt: v => v + " 🏓",
  desc: "Gegen den Computer – wie lange hältst du durch?",
  start(root, api) {
    const W = Math.min(root.clientWidth || 340, 340), H = Math.round(W * 1.4), k = W / 340;
    root.innerHTML = `<div class="stage"><div class="hud"><span id="lv">❤️❤️❤️</span><span>🏓 <span id="sc">0</span></span></div><canvas width="${W}" height="${H}"></canvas><div class="sub" style="margin-top:8px">Schläger ziehen oder ◀ ▶ (Pfeiltasten)</div></div>`;
    const cv = root.querySelector("canvas"), g = cv.getContext("2d"), sc = root.querySelector("#sc"), lv = root.querySelector("#lv");
    const PW = 86 * k, PH = 11 * k, R = 7 * k, PY = H - 26 * k, CY = 15 * k;
    let px = W / 2, cx = W / 2, bx = W / 2, by = H / 2, vx = 0, vy = 0, lives = 3, returns = 0, bonus = 0, over = false, last = performance.now(), raf = 0, hold = 0, dirKey = 0;
    const speed = () => Math.min(540, 235 + returns * 9) * k, cpuSpeed = () => Math.min(370, 140 + returns * 7) * k;
    const score = () => returns + 5 * bonus;
    const hearts = () => (lv.textContent = "❤️".repeat(Math.max(0, lives)) || "💔");
    const serve = () => { bx = W / 2; by = H / 2; const a = (Math.random() - 0.5) * 0.9; vx = speed() * Math.sin(a); vy = speed() * Math.cos(a); hold = 0.9; };
    const bounce = (dirY, paddleX) => { const off = Math.max(-1, Math.min(1, (bx - paddleX) / (PW / 2))), a = off * 1.05; vx = speed() * Math.sin(a); vy = dirY * speed() * Math.cos(a); };
    cv.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); px = (e.clientX - r.left) * (W / r.width); });
    cv.addEventListener("pointerdown", e => { const r = cv.getBoundingClientRect(); px = (e.clientX - r.left) * (W / r.width); });
    const kd = e => { if (e.key === "ArrowLeft" || e.key === "a") dirKey = -1; if (e.key === "ArrowRight" || e.key === "d") dirKey = 1; };
    const ku = e => { if (["ArrowLeft", "a", "ArrowRight", "d"].includes(e.key)) dirKey = 0; };
    addEventListener("keydown", kd); addEventListener("keyup", ku);
    const loseLife = () => { lives--; hearts(); if (lives <= 0) { over = true; stop(); draw(); api.finish(score(), score() + " Punkte"); } else serve(); };
    const loop = now => {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      if (dirKey) px += dirKey * 330 * k * dt; px = Math.max(PW / 2, Math.min(W - PW / 2, px));
      const tx = Math.max(PW / 2, Math.min(W - PW / 2, bx + (vy < 0 ? 0 : (cx - bx) * 0.0))), step = cpuSpeed() * dt;
      if (vy < 0 || by < H * 0.55) cx += Math.max(-step, Math.min(step, tx - cx)); cx = Math.max(PW / 2, Math.min(W - PW / 2, cx));
      if (hold > 0) hold -= dt; else {
        bx += vx * dt; by += vy * dt;
        if (bx < R) { bx = R; vx = Math.abs(vx); } if (bx > W - R) { bx = W - R; vx = -Math.abs(vx); }
        if (vy > 0 && by + R >= PY && by + R <= PY + PH + 10 * k && bx > px - PW / 2 - R && bx < px + PW / 2 + R) { by = PY - R; returns++; sc.textContent = score(); bounce(-1, px); }
        else if (vy < 0 && by - R <= CY + PH && by - R >= CY - 10 * k && bx > cx - PW / 2 - R && bx < cx + PW / 2 + R) { by = CY + PH + R; bounce(1, cx); }
        else if (by < -R * 2) { bonus++; sc.textContent = score(); serve(); }
        else if (by > H + R * 2) loseLife();
      }
      draw(); if (!over) raf = requestAnimationFrame(loop);
    };
    const draw = () => {
      g.fillStyle = "#0b1220"; g.fillRect(0, 0, W, H);
      g.strokeStyle = "#ffffff22"; g.setLineDash([8 * k, 8 * k]); g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#e5484d"; g.beginPath(); g.roundRect(cx - PW / 2, CY, PW, PH, 5); g.fill();
      g.fillStyle = "#4f8cff"; g.beginPath(); g.roundRect(px - PW / 2, PY, PW, PH, 5); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(bx, by, R, 0, 7); g.fill();
    };
    const stop = () => { cancelAnimationFrame(raf); removeEventListener("keydown", kd); removeEventListener("keyup", ku); };
    hearts(); serve(); draw(); raf = requestAnimationFrame(loop);
    return stop;
  }
});

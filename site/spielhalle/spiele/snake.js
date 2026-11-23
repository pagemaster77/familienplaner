/* Snake: Äpfel fressen, nicht gegen Wand oder sich selbst stoßen. Steuerung: Wischen, Pfeiltasten/WASD oder die Tasten unten. */
ARCADE.register({
  id: "snake", name: "Snake", color: "linear-gradient(145deg,#2fae6b,#1c7a4a)", icon: "🐍", unit: "Äpfel", lower: false,
  desc: "Friss Äpfel – wer am längsten überlebt, gewinnt.",
  help() {
    return `<h2>🐍 So geht Snake</h2>
      <p><b>Ziel:</b> Friss möglichst viele Äpfel 🍎, ohne gegen die Wand oder gegen dich selbst zu stoßen.</p>
      <h3>Steuerung</h3>
      <p>Wische auf dem Spielfeld in die Richtung, in die die Schlange laufen soll. Oder nimm die Tasten ▲ ◀ ▼ ▶ unter dem Feld. Am Computer gehen auch die Pfeiltasten oder W A S D. Rückwärts umdrehen geht nicht.</p>
      <h3>Punkte ⭐</h3>
      <ul><li>Jeder Apfel = <b>1 Apfel</b> im Ergebnis, die Schlange wird dabei länger.</li>
      <li>Fürs Punktekonto der Spielhalle gibt jeder Apfel <b>1 ⭐</b>. 20 Äpfel = 20 ⭐.</li>
      <li>Die Schlange wird mit jedem Apfel <b>schneller</b>. Je weiter du kommst, desto schwieriger wird es.</li></ul>
      <p class="hx-tip">Tipp: Lauf in großen Bögen am Rand, dann hast du länger Platz.</p>`;
  },
  start(root, api) {
    const N = 20, S = Math.min(root.clientWidth || 360, 380), C = Math.floor(S / N), W = C * N;
    root.innerHTML = `<div class="stage"><div class="hud"><span>🍎 <span id="sc">0</span></span></div><canvas width="${W}" height="${W}"></canvas>
      <div class="dpad tight"><button class="u" data-d="u">▲</button><button class="l" data-d="l">◀</button><button class="d" data-d="d">▼</button><button class="r" data-d="r">▶</button></div></div>`;
    const cv = root.querySelector("canvas"), g = cv.getContext("2d"), sc = root.querySelector("#sc");
    const V = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
    let snake = [[10, 10], [9, 10], [8, 10]], dir = "r", queue = [], apple = null, score = 0, over = false, timer = null;
    const place = () => { do { apple = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (snake.some(s => s[0] === apple[0] && s[1] === apple[1])); };
    place();
    const opposite = { u: "d", d: "u", l: "r", r: "l" };
    const turn = d => { const last = queue.length ? queue[queue.length - 1] : dir; if (d !== last && d !== opposite[last] && queue.length < 2) queue.push(d); };
    const draw = () => {
      g.fillStyle = "#0b1220"; g.fillRect(0, 0, W, W);
      g.fillStyle = "#ef5b5b"; g.beginPath(); g.arc(apple[0] * C + C / 2, apple[1] * C + C / 2, C * 0.38, 0, 7); g.fill();
      snake.forEach((s, i) => { g.fillStyle = i ? "#3ecf8e" : "#9ff0c6"; g.fillRect(s[0] * C + 1, s[1] * C + 1, C - 2, C - 2); });
    };
    const tick = () => {
      if (queue.length) dir = queue.shift();
      const h = [snake[0][0] + V[dir][0], snake[0][1] + V[dir][1]];
      if (h[0] < 0 || h[1] < 0 || h[0] >= N || h[1] >= N || snake.some(s => s[0] === h[0] && s[1] === h[1])) { over = true; stop(); api.finish(score, score === 1 ? "1 Apfel" : score + " Äpfel"); return; }
      snake.unshift(h);
      if (h[0] === apple[0] && h[1] === apple[1]) { score++; sc.textContent = score; place(); clearInterval(timer); timer = setInterval(tick, Math.max(65, 140 - score * 3)); }
      else snake.pop();
      draw();
    };
    const key = e => { const m = { ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r", w: "u", s: "d", a: "l", d: "r" }[e.key]; if (m) { e.preventDefault(); turn(m); } };
    addEventListener("keydown", key);
    root.querySelectorAll("[data-d]").forEach(b => b.addEventListener("pointerdown", e => { e.preventDefault(); turn(b.dataset.d); }));
    let sx = 0, sy = 0;
    cv.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; });
    cv.addEventListener("pointerup", e => {
      const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : (dy > 0 ? "d" : "u"));
    });
    const stop = () => { clearInterval(timer); removeEventListener("keydown", key); };
    draw(); timer = setInterval(tick, 140);
    return stop;
  }
});

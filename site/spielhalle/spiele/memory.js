/* Memory: 8 Paare finden. Wenige Züge und wenig Zeit = viele Punkte (höchstens 1000). */
ARCADE.register({
  id: "memory", name: "Memory", color: "linear-gradient(145deg,#a35cf0,#6a3cc2)", icon: "🧠", unit: "Punkte", lower: false,
  desc: "Finde alle Paare – mit wenig Zügen und schnell.",
  start(root, api) {
    const faces = ["🍎", "🚀", "🐶", "🎈", "🌟", "🎲", "🍕", "🦄"];
    const cards = faces.concat(faces).map((f, i) => ({ f, i, r: Math.random() })).sort((a, b) => a.r - b.r);
    root.innerHTML = `<div class="stage"><div class="hud"><span>Züge: <span id="mv">0</span></span><span>⏱ <span id="tm">0</span> s</span></div><div class="mem"></div></div>`;
    const grid = root.querySelector(".mem"), mv = root.querySelector("#mv"), tm = root.querySelector("#tm");
    let open = [], moves = 0, found = 0, t0 = 0, timer = null, lock = false;
    grid.innerHTML = cards.map((c, k) => `<button data-k="${k}" aria-label="Karte">❓</button>`).join("");
    const btn = k => grid.children[k];
    grid.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || lock) return;
      const k = +b.dataset.k; if (open.includes(k) || b.classList.contains("done")) return;
      if (!t0) { t0 = Date.now(); timer = setInterval(() => (tm.textContent = Math.floor((Date.now() - t0) / 1000)), 500); }
      b.textContent = cards[k].f; b.classList.add("open"); open.push(k);
      if (open.length < 2) return;
      moves++; mv.textContent = moves;
      const [a, c] = open;
      if (cards[a].f === cards[c].f) {
        [a, c].forEach(x => { btn(x).classList.remove("open"); btn(x).classList.add("done"); }); open = []; found++;
        if (found === faces.length) {
          clearInterval(timer);
          const sec = Math.round((Date.now() - t0) / 1000), score = Math.max(0, Math.min(1000, Math.round(1000 - (moves - 8) * 25 - sec * 5)));
          setTimeout(() => api.finish(score, `${moves} Züge in ${sec} s`), 500);
        }
      } else {
        lock = true;
        setTimeout(() => { [a, c].forEach(x => { btn(x).classList.remove("open"); btn(x).textContent = "❓"; }); open = []; lock = false; }, 700);
      }
    });
    return () => clearInterval(timer);
  }
});

/* Reaktionstest: Wenn das Feld grün wird, so schnell wie möglich tippen. 5 Runden, Durchschnitt in Millisekunden (weniger ist besser). */
ARCADE.register({
  id: "reaktion", name: "Reaktion", color: "linear-gradient(145deg,#f5b02e,#e07a1a)", icon: "⚡", unit: "ms", lower: true,
  desc: "Tippe sofort, wenn es grün wird. 5 Runden.",
  start(root, api) {
    root.innerHTML = `<div class="stage"><div class="hud"><span>Runde <span id="rd">1</span>/5</span><span id="av"></span></div><div class="react" id="pad">Tippe, um zu starten</div></div>`;
    const pad = root.querySelector("#pad"), rd = root.querySelector("#rd"), av = root.querySelector("#av");
    let state = "idle", times = [], t0 = 0, timer = null, dead = false;
    const wait = () => {
      state = "wait"; pad.className = "react wait"; pad.textContent = "Warten …";
      timer = setTimeout(() => { state = "go"; pad.className = "react go"; pad.textContent = "JETZT!"; t0 = performance.now(); }, 1500 + Math.random() * 2500);
    };
    pad.addEventListener("pointerdown", e => {
      e.preventDefault(); if (dead) return;
      if (state === "idle") return wait();
      if (state === "wait") { clearTimeout(timer); state = "early"; pad.className = "react"; pad.textContent = "Zu früh! 😅 Noch einmal …"; timer = setTimeout(wait, 1100); return; }
      if (state === "go") {
        const ms = Math.round(performance.now() - t0); times.push(ms); state = "shown";
        rd.textContent = Math.min(5, times.length + 1); av.textContent = "Ø " + Math.round(times.reduce((a, b) => a + b, 0) / times.length) + " ms";
        pad.className = "react"; pad.textContent = ms + " ms";
        if (times.length === 5) { dead = true; setTimeout(() => api.finish(Math.round(times.reduce((a, b) => a + b, 0) / 5), "Ø " + Math.round(times.reduce((a, b) => a + b, 0) / 5) + " ms"), 900); }
        else timer = setTimeout(wait, 1000);
      }
    });
    return () => { dead = true; clearTimeout(timer); };
  }
});

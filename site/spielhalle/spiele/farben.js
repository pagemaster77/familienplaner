/* Farbenspiel: Der Computer zeigt eine Reihenfolge aus Farben und Tönen. Du drückst sie nach. Jede Runde kommt eine Farbe dazu. */
ARCADE.register({
  id: "farben", name: "Farbenspiel", icon: "🎨", fmt: v => v + " Runden",
  desc: "Merke dir die Farben und tippe sie nach.",
  start(root, api) {
    const COL = [["#2fae6b", "#6cf0a8"], ["#d83a3f", "#ff8084"], ["#e8c21a", "#fff176"], ["#2f6fe0", "#7fb0ff"]], FREQ = [330, 262, 392, 196];
    root.innerHTML = `<div class="stage"><div class="hud"><span>🎨 Runde <span id="sc">0</span></span></div><div class="fb" id="fb">${COL.map((c, i) => `<button data-i="${i}" style="background:${c[0]}"></button>`).join("")}</div><div class="sub" id="msg" style="margin-top:12px;text-align:center;font-size:18px">Gleich geht’s los …</div></div>`;
    const btns = [...root.querySelectorAll("[data-i]")], msg = root.querySelector("#msg"), sc = root.querySelector("#sc");
    let seq = [], pos = 0, accept = false, dead = false, timers = [], ac = null;
    const later = (f, ms) => timers.push(setTimeout(f, ms));
    const beep = i => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = FREQ[i]; o.type = "sine"; g.gain.value = 0.15; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.25); } catch (e) {} };
    const flash = (i, ms = 380) => { btns[i].style.background = COL[i][1]; btns[i].style.transform = "scale(.96)"; beep(i); later(() => { btns[i].style.background = COL[i][0]; btns[i].style.transform = ""; }, ms); };
    const round = () => {
      accept = false; seq.push(Math.floor(Math.random() * 4)); pos = 0; msg.textContent = "Schau genau hin …";
      const gap = Math.max(260, 560 - seq.length * 22);
      seq.forEach((c, k) => later(() => flash(c, gap * 0.7), 700 + k * gap));
      later(() => { accept = true; msg.textContent = "Du bist dran!"; }, 700 + seq.length * gap);
    };
    const press = i => {
      if (!accept || dead) return; flash(i, 200);
      if (i !== seq[pos]) { dead = true; accept = false; msg.textContent = "Falsch!"; const s = seq.length - 1; later(() => { stop(); api.finish(s, s === 1 ? "1 Runde geschafft" : s + " Runden geschafft"); }, 700); return; }
      pos++;
      if (pos === seq.length) { accept = false; sc.textContent = seq.length; msg.textContent = "Richtig!"; later(round, 900); }
    };
    btns.forEach(b => b.addEventListener("pointerdown", e => { e.preventDefault(); press(+b.dataset.i); }));
    const key = e => { const k = { "1": 0, "2": 1, "3": 2, "4": 3 }[e.key]; if (k != null) press(k); };
    addEventListener("keydown", key);
    const stop = () => { timers.forEach(clearTimeout); removeEventListener("keydown", key); try { ac && ac.close(); } catch (e) {} };
    later(round, 600);
    return stop;
  }
});

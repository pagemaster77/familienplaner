/* Feier: Konfetti + Banner + Trompeten-Fanfare (alles selbst erzeugt, keine Audio-Dateien).
   Aufruf: celebrate(["Amy: „Kino“"]) oder celebrate("Text"); fanfare() spielt nur den Ton. */
(function () {
  let ctx = null;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);

  function audio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = ctx || new AC(); if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (_) { return null; }
  }
  // Beim ersten Antippen Ton freischalten (Browser erlauben Ton erst nach einer Berührung)
  const unlock = () => { audio(); };
  ["pointerdown", "keydown", "touchstart"].forEach(ev => window.addEventListener(ev, unlock, { once: true, passive: true }));

  function note(c, midi, t0, dur, vol) {
    const f = hz(midi), out = c.createGain(), lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 2;
    lp.frequency.setValueAtTime(f * 1.5, t0);                       // Trompeten-Ansatz: Klang öffnet sich schnell
    lp.frequency.exponentialRampToValueAtTime(Math.min(f * 7, 9000), t0 + 0.07);
    lp.frequency.exponentialRampToValueAtTime(f * 3.5, t0 + dur);
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
    out.gain.setValueAtTime(vol * 0.85, t0 + dur * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const lfo = c.createOscillator(), lg = c.createGain();          // leichtes Vibrato bei langen Tönen
    lfo.frequency.value = 5.5; lg.gain.value = dur > 0.5 ? f * 0.006 : 0; lfo.connect(lg);
    [["sawtooth", 0, 1], ["square", 0, 0.45], ["sawtooth", 4, 0.5]].forEach(([type, det, g]) => {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.value = f; o.detune.value = det; og.gain.value = g;
      lg.connect(o.frequency); o.connect(og); og.connect(lp); o.start(t0); o.stop(t0 + dur + 0.05);
    });
    lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    lp.connect(out); out.connect(c.destination);
  }

  window.fanfare = function () {
    const c = audio(); if (!c) return;
    const t = c.currentTime + 0.05, q = 0.16;
    // Ta-ta-ta-taaa, ta-ta-ta-ta-taaaa (G C E G)
    [[67, 0, q * 0.8], [67, q, q * 0.8], [67, 2 * q, q * 0.8], [72, 3 * q, q * 1.6],
     [67, 5 * q, q * 0.8], [72, 6 * q, q * 0.8], [76, 7 * q, q * 1.6], [79, 9 * q, 1.5]]
      .forEach(([m, at, d]) => note(c, m, t + at, d, 0.16));
  };

  function confetti(box) {
    const cv = document.createElement("canvas"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100001";
    document.body.appendChild(cv);
    const W = cv.width = innerWidth, H = cv.height = innerHeight, g = cv.getContext("2d");
    const cols = ["#ff5a5f", "#ffc107", "#4caf50", "#2196f3", "#e91e63", "#9c27b0", "#00bcd4"];
    const ps = Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H * 0.6, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, s: 6 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[(Math.random() * cols.length) | 0] }));
    const end = Date.now() + 6500; let raf = 0;
    (function tick() {
      g.clearRect(0, 0, W, H);
      ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6); g.restore(); });
      if (Date.now() < end && box.isConnected) raf = requestAnimationFrame(tick); else { cancelAnimationFrame(raf); cv.remove(); }
    })();
    return cv;
  }

  window.celebrate = function (text) {
    const lines = (Array.isArray(text) ? text : [text]).filter(Boolean);
    const old = document.querySelector(".feier"); if (old) old.remove();
    const el = document.createElement("div"); el.className = "feier";
    el.style.cssText = "position:fixed;left:0;right:0;top:18%;z-index:100002;display:flex;justify-content:center;padding:0 16px;cursor:pointer";
    el.innerHTML = `<div style="background:linear-gradient(135deg,#ffd34d,#ff9f1c);color:#3a2300;border-radius:22px;padding:22px 30px;text-align:center;box-shadow:0 12px 40px #0007;max-width:560px;font-family:system-ui,sans-serif">
      <div style="font-size:clamp(34px,6vw,64px)">🎉🎺🎉</div>
      <div style="font-size:clamp(20px,3.6vw,34px);font-weight:800;margin:6px 0">Belohnung erreicht!</div>
      ${lines.map(l => `<div style="font-size:clamp(16px,2.6vw,26px);font-weight:600">${esc(l)}</div>`).join("")}</div>`;
    document.body.appendChild(el);
    const cv = confetti(el); fanfare();
    const close = () => { el.remove(); if (cv) cv.remove(); };
    el.addEventListener("click", close); setTimeout(close, 8000);
  };
})();

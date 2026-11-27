/* Gemeinsame Hilfen für Spiele mit Zeichenfläche (Weltraum-Abwehr, Breakout 2). Wird vor den Spielen geladen. */
const KIT = (() => {
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } } };
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function frame(update) { let id, last = performance.now(), dead = false; const f = t => { if (dead) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; update(dt, t); id = requestAnimationFrame(f); }; id = requestAnimationFrame(f); return () => { dead = true; cancelAnimationFrame(id); }; }
  function shell(box, w, h) {
    box.innerHTML = `<div class="hud"><b id="hl"></b><b id="hr"></b></div><div class="kcvw" style="aspect-ratio:${w}/${h}"><canvas></canvas><div class="kov" hidden></div></div>`;
    const cv = box.querySelector("canvas"), dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); const ov = box.querySelector(".kov");
    return { cv, c, w, h, box,
      pos: e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * w / r.width, y: (e.clientY - r.top) * h / r.height }; },
      hud: (a, b) => { box.querySelector("#hl").innerHTML = a; box.querySelector("#hr").innerHTML = b; },
      overlay: (t, p, btn, cb) => { ov.hidden = false; ov.innerHTML = `<div class="kcard"><h2>${t}</h2><p>${p}</p><button class="kgo" type="button">${btn}</button></div>`; ov.querySelector(".kgo").onclick = () => { ov.hidden = true; cb(); }; } };
  }
  function burst(list, x, y, color, n, speed) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(0.3, 1) * speed; list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(0.4, 0.9), c: color, r: rnd(1.5, 3.5) }); } }
  function stepParts(c, list, dt, g) { for (let i = list.length - 1; i >= 0; i--) { const p = list[i]; p.life += dt; if (p.life > p.max) { list.splice(i, 1); continue; } p.vy += (g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; c.globalAlpha = 1 - p.life / p.max; c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); } c.globalAlpha = 1; }
  function stepTexts(c, list, dt) { for (let i = list.length - 1; i >= 0; i--) { const t = list[i]; t.life += dt; if (t.life > 0.9) { list.splice(i, 1); continue; } c.globalAlpha = 1 - t.life / 0.9; c.fillStyle = t.c; c.font = "700 " + (t.s || 20) + "px system-ui, sans-serif"; c.textAlign = "center"; c.fillText(t.t, t.x, t.y - t.life * 40); } c.globalAlpha = 1; }
  return { TAU, clamp, rnd, pick, store, rr, frame, shell, burst, stepParts, stepTexts };
})();

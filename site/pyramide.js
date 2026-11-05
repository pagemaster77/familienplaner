/* Versteckte Spielerei: "Gipfelstürmer".
   Jedes Familienmitglied klettert als Männchen mit dem Gesicht des Profilbilds eine Pyramide hoch.
   Alle 10 Punkte eine Stufe. Ab 100 Punkten sitzt das Männchen oben auf einem Thron (auch mehrere gleichzeitig).
   Aufruf: showPyramid([{ name, color, avatar, photo, points }, ...]) */
(function () {
  const CX = 400, GY = 540, STEP = 40, TOP = 10;
  const hw = k => 380 - 28 * k; // halbe Breite der Stufe k
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const okColor = c => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : "#4f8cff");
  const okPhoto = u => (typeof u === "string" && /^(data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+|https:\/\/[^\s"'<>]+)$/i.test(u) ? u : "");

  const CSS = `
  .pyr{position:fixed;inset:0;z-index:99999;background:linear-gradient(#14123a 0%,#3b2a6b 45%,#e08a5a 78%,#f1c27d 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:system-ui,sans-serif;-webkit-user-select:none;user-select:none;touch-action:manipulation}
  .pyr svg{width:100%;height:100%;max-width:1200px}
  .pyr h1{position:absolute;top:10px;left:0;right:0;margin:0;text-align:center;font-size:clamp(18px,3.2vw,34px);text-shadow:0 2px 8px #0008;pointer-events:none}
  .pyr h1 small{display:block;font-size:.45em;font-weight:400;opacity:.85}
  .pyr .pyr-x{position:absolute;top:10px;right:12px;border:0;border-radius:999px;width:42px;height:42px;font-size:22px;background:#0006;color:#fff;cursor:pointer}
  .pyr .star{animation:pyrtw 2.4s ease-in-out infinite alternate}
  .pyr .wob{animation:pyrwob 1.1s ease-in-out infinite alternate}
  .pyr .bob{animation:pyrbob 1.6s ease-in-out infinite alternate}
  .pyr .glow{animation:pyrglow 1.8s ease-in-out infinite alternate}
  .pyr .fig{transition:transform 2.4s cubic-bezier(.22,.8,.25,1)}
  @keyframes pyrtw{from{opacity:.2}to{opacity:1}}
  @keyframes pyrwob{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}
  @keyframes pyrbob{from{transform:translateY(0)}to{transform:translateY(-3px)}}
  @keyframes pyrglow{from{opacity:.35}to{opacity:.9}}`;

  function head(p, i, cy) {
    const photo = okPhoto(p.photo), col = okColor(p.color);
    const face = photo
      ? `<image href="${photo}" x="-16" y="${cy - 16}" width="32" height="32" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc${i})"/>`
      : `<text x="0" y="${cy + 7}" text-anchor="middle" font-size="22">${esc(p.avatar || "🙂")}</text>`;
    return `<defs><clipPath id="pc${i}"><circle cx="0" cy="${cy}" r="16"/></clipPath></defs>
      <circle cx="0" cy="${cy}" r="18" fill="${col}" stroke="#fff" stroke-width="2"/>
      <circle cx="0" cy="${cy}" r="16" fill="${photo ? "#fff" : col}"/>${face}`;
  }
  function climber(p, i) {
    const col = okColor(p.color);
    return `<g class="wob"><g stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M0 -28 L-9 0"/><path d="M0 -28 L13 -13 L10 0"/><path d="M0 -28 L0 -50"/>
      <path d="M0 -46 L-15 -36"/><path d="M0 -46 L15 -63"/></g>${head(p, i, -68)}</g>`;
  }
  function sitter(p, i) {
    const col = okColor(p.color);
    return `<g>
      <path d="M-30 0 V-104 Q0 -132 30 -104 V0 Z" fill="#c9971c" stroke="#7a5a00" stroke-width="3"/>
      <path d="M-22 -4 V-100 Q0 -122 22 -100 V-4 Z" fill="#a3262a" opacity=".85"/>
      <rect x="-36" y="-42" width="12" height="42" rx="4" fill="#c9971c" stroke="#7a5a00" stroke-width="2"/>
      <rect x="24" y="-42" width="12" height="42" rx="4" fill="#c9971c" stroke="#7a5a00" stroke-width="2"/>
      <rect x="-32" y="-24" width="64" height="24" rx="5" fill="#8c1d22" stroke="#5a1013" stroke-width="2"/>
      <g class="bob"><g stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <path d="M0 -30 L0 -64"/><path d="M0 -30 L20 -30 L20 -4"/><path d="M0 -58 L-20 -46"/><path d="M0 -58 L22 -48"/></g>
        ${head(p, i, -82)}
        <path d="M-14 -101 L-17 -121 L-7 -111 L0 -125 L7 -111 L17 -121 L14 -101 Z" fill="#ffd34d" stroke="#b8860b" stroke-width="2"/>
        <circle cx="0" cy="-107" r="3" fill="#e5484d"/></g></g>`;
  }

  window.showPyramid = function (people) {
    if (document.querySelector(".pyr")) return;
    const list = (people || []).map(p => ({ ...p, points: Math.max(0, Math.round(+p.points || 0)) })).sort((a, b) => b.points - a.points);
    const lvl = p => Math.min(TOP, Math.floor(p.points / 10));
    // Stufen der Pyramide
    let steps = "";
    for (let j = 0; j < TOP; j++) {
      const w = 2 * hw(j), y = GY - STEP * (j + 1);
      steps += `<rect x="${CX - hw(j)}" y="${y}" width="${w}" height="${STEP}" fill="${j % 2 ? "#d9a766" : "#e6b878"}" stroke="#a9763a" stroke-width="2"/>
        <rect x="${CX - hw(j)}" y="${y}" width="${w}" height="6" fill="#f6d9a6" opacity=".7"/>`;
    }
    // Gruppen je Stufe, damit sich Männchen nicht überdecken
    const groups = {}; list.forEach((p, i) => (groups[lvl(p)] = groups[lvl(p)] || []).push(i));
    // Reihenfolge von unten nach oben; Spalten wechseln, damit sich Männchen auf benachbarten Stufen nicht überdecken
    const seq = {}; [...list.keys()].sort((a, b) => lvl(list[a]) - lvl(list[b]) || a - b).forEach((i, n) => (seq[i] = n));
    const COLS = [-0.62, 0.3, -0.2, 0.66, 0.05, -0.45, 0.48];
    let figs = "";
    list.forEach((p, i) => {
      const k = lvl(p), g = groups[k], n = g.length, idx = g.indexOf(i); let x, scale = 1;
      if (k >= TOP) { // Thron
        const slot = 2 * hw(TOP - 1) / n; scale = Math.min(0.95, (slot - 6) / 72); x = CX - hw(TOP - 1) + slot * (idx + 0.5);
      } else if (n === 1) { x = CX + COLS[seq[i] % COLS.length] * hw(k); scale = 0.88; }
      else { x = CX - 0.7 * hw(k) + (1.4 * hw(k) * idx) / (n - 1); scale = 0.88; }
      const y = GY - STEP * k, name = esc((p.name || "?").trim().slice(0, 14));
      figs += `<g class="fig" data-x="${x.toFixed(1)}" data-y="${y}" data-d="${(i * 0.18).toFixed(2)}" style="transform:translate(${x.toFixed(1)}px,${GY + 6}px)">
        <g transform="scale(${scale.toFixed(2)})">${k >= TOP ? sitter(p, i) : climber(p, i)}</g>
        <text y="${(22 * Math.max(scale, 0.8)).toFixed(0)}" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" stroke="#000a" stroke-width="3" paint-order="stroke">${name}</text>
        <text y="${(38 * Math.max(scale, 0.8)).toFixed(0)}" text-anchor="middle" font-size="13" fill="#ffe9a8" stroke="#000a" stroke-width="3" paint-order="stroke">⭐ ${p.points}</text></g>`;
    });
    // Sterne
    let stars = ""; for (let s = 0; s < 40; s++) stars += `<circle class="star" cx="${(s * 197 % 800)}" cy="${(s * 83 % 230) + 8}" r="${1 + (s % 3) * 0.6}" fill="#fff" style="animation-delay:${(s % 7) * 0.3}s"/>`;
    const el = document.createElement("div"); el.className = "pyr";
    el.innerHTML = `<style>${CSS}</style><h1>🏔️ Gipfelstürmer<small>alle 10 Punkte eine Stufe · ab 100 Punkten auf den Thron 👑</small></h1>
      <button class="pyr-x" aria-label="Schließen">✕</button>
      <svg viewBox="0 -90 800 730" preserveAspectRatio="xMidYMid meet">${stars}
        <circle cx="690" cy="95" r="34" fill="#fff6c9" opacity=".95"/><circle class="glow" cx="690" cy="95" r="52" fill="#fff6c9" opacity=".3"/>
        <rect x="0" y="540" width="800" height="100" fill="#e7b96d"/><path d="M0 560 Q200 535 400 560 T800 555 V640 H0Z" fill="#d9a85a"/>
        ${steps}${figs}</svg>`;
    const close = () => { el.remove(); document.removeEventListener("keydown", onKey, true); };
    const onKey = e => { if (e.key === "Escape") close(); };
    el.addEventListener("click", e => { if (e.target.closest(".pyr-x") || e.target === el) close(); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(el);
    // Hochklettern starten
    requestAnimationFrame(() => requestAnimationFrame(() => el.querySelectorAll(".fig").forEach(f => {
      f.style.transitionDelay = f.dataset.d + "s"; f.style.transform = `translate(${f.dataset.x}px,${f.dataset.y}px)`;
    })));
  };

  /* Verstecktes Kommando: 5x schnell auf einen Auslöser tippen (z. B. Überschrift Punktestand, Uhr der Wandanzeige) */
  window.pyrTrigger = function (open) {
    let n = 0, t = 0;
    return () => { const now = Date.now(); n = now - t < 1500 ? n + 1 : 1; t = now; if (n >= 5) { n = 0; open(); } };
  };
})();

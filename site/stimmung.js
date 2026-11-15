/* Stimmung: Ring und Smiley um das Profilbild (App und Wandanzeige).
   good = bunter Farbverlauf, neutral = gelb, bad = rot, help = blinkender Ring + SOS ("ich möchte reden").
   Eine Stimmung gilt 24 Stunden, danach verschwindet sie von selbst. */
(function () {
  const MOODS = { good: ["😄", "Mir geht’s gut"], neutral: ["😐", "Geht so"], bad: ["😟", "Nicht so gut"], help: ["🆘", "Ich möchte reden"] };
  const TTL = 24 * 3600e3;
  window.MOODS = MOODS;
  window.moodOf = p => (p && MOODS[p.mood] && p.mood_at && Date.now() - new Date(p.mood_at) < TTL ? p.mood : null);
  window.moodWrap = (html, p, badge = true) => {
    const m = window.moodOf(p); if (!m) return html;
    return `<span class="mring m-${m}">${html}${badge ? `<i class="mj">${MOODS[m][0]}</i>` : ""}</span>`;
  };
  const st = document.createElement("style");
  st.textContent = `
  .mring{position:relative;display:inline-flex;flex:none;padding:6px;border-radius:50%;vertical-align:middle}
  .mring::before{content:"";position:absolute;inset:0;border-radius:50%;z-index:0}
  .mring>.avatar{position:relative;z-index:1}
  .mring .mj{position:absolute;right:-8px;bottom:-8px;z-index:2;font-style:normal;font-size:.8em;line-height:1;width:1.6em;height:1.6em;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0006}
  .m-good::before{background:conic-gradient(#ff5f6d,#ffc371,#ffe66d,#7bed9f,#4dd0e1,#6c8bff,#c77dff,#ff5f6d);animation:mspin 6s linear infinite}
  .m-neutral::before{background:#ffd23f}
  .m-bad::before{background:#e5252b}
  .m-help{padding:8px}
  .m-help::before{background:#e5252b;animation:mblink .8s ease-in-out infinite}
  .m-help .mj{animation:mpulse .8s ease-in-out infinite}
  @keyframes mspin{to{transform:rotate(360deg)}}
  @keyframes mblink{0%,100%{background:#e5252b;box-shadow:0 0 0 0 #e5252b99}50%{background:#fff;box-shadow:0 0 14px 6px #e5252bcc}}
  @keyframes mpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}`;
  document.head.appendChild(st);
})();

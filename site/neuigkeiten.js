/* Neuigkeiten-Fenster: zeigt nach einem Update einmal pro Gerät, was neu ist.
   Neue Version? -> oben in NEWS einen Eintrag einfügen (neueste zuerst). Der Rest läuft von selbst. */

const NEWS = [
  { v: "16", date: "15.11.2026", items: [
    "Neu: Tages-Chef! Jeden Tag ist reihum jemand dran: Amy, Elena, Sophie, Meggy, Sascha.",
    "Der Chef stellt ein Bild und/oder einen YouTube-Song des Tages ein und bekommt dafür 5 ⭐.",
    "Alle sehen das Bild und hören den Song auf der Startseite. Auf der Wand läuft das Bild als Bildschirmschoner.",
  ] },
  { v: "15.4", date: "15.11.2026", items: [
    "Neu: Für das Eintragen der Stimmung gibt es 5 ⭐ – aber nur einmal in 24 Stunden.",
    "Wer die Stimmung öfter ändert, bekommt dafür keine weiteren Punkte.",
  ] },
  { v: "15.3", date: "15.11.2026", items: [
    "Neu: Nach einem Update zeigt die App dieses Fenster mit den Änderungen.",
  ] },
  { v: "15", date: "15.11.2026", items: [
    "Neu: Stimmung. Auf der Startseite fragt die App „Wie geht’s dir heute?“.",
    "Ein Ring ums Profilbild zeigt die Stimmung: bunt = gut, gelb = geht so, rot = schlecht.",
    "Mit dem SOS-Smiley „Ich möchte reden“ bekommen die Eltern eine Meldung.",
  ] },
];

function checkNews() {
  if (!S.me || isDisplay() || document.getElementById("newsBox")) return;
  let seen = null;
  try { seen = localStorage.getItem("newsSeen"); } catch (_) { /* egal */ }
  const cur = NEWS[0].v;
  if (seen === cur) return;
  const idx = NEWS.findIndex(n => n.v === seen);
  // Unbekannter oder erster Start: nur den neuesten Eintrag zeigen; sonst alles seit dem letzten Mal (höchstens 5)
  const list = idx < 0 ? [NEWS[0]] : NEWS.slice(0, Math.min(idx, 5));
  const box = document.createElement("div");
  box.id = "newsBox";
  box.className = "news-back";
  box.innerHTML = `<div class="news-card" role="dialog" aria-modal="true" aria-labelledby="newsTitle">
    <h2 id="newsTitle">🎉 Was ist neu?</h2>
    ${list.map(n => `<h3>Version ${esc(n.v)} <span>${esc(n.date)}</span></h3><ul>${n.items.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`).join("")}
    <button class="news-ok" id="newsOk">Alles klar</button>
  </div>`;
  document.body.appendChild(box);
  const close = () => {
    try { localStorage.setItem("newsSeen", cur); } catch (_) { /* egal */ }
    box.remove();
  };
  document.getElementById("newsOk").onclick = close;
  box.addEventListener("click", e => { if (e.target === box) close(); });
}

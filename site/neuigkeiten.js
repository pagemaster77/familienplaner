/* Neuigkeiten-Fenster: zeigt nach einem Update einmal pro Gerät, was neu ist.
   Neue Version? -> oben in NEWS einen Eintrag einfügen (neueste zuerst). Der Rest läuft von selbst. */

const NEWS = [
  { v: "21.6", date: "17.11.2026", items: [
    "Jobs: Du kannst jetzt mehrere Mitglieder auf einmal antippen (auch aus verschiedenen Familien). Die Zahl am Namen zeigt die Reihenfolge. Jeder bekommt seinen eigenen Job. Bei mehreren Mitgliedern gibt es dafür keine Push-Meldung.",
  ] },
  { v: "21.5", date: "16.11.2026", items: [
    "Spielhalle: Ganz oben steht jetzt, wer gerade online ist und wer was spielt (🟢). Unter jedem Spiel steht außerdem, wer es zuletzt gespielt hat und wann.",
  ] },
  { v: "21.4", date: "16.11.2026", items: [
    "Admins: Auf der Seite ⚙️ Verwalten gibt es bei wartenden Aufgaben jetzt den Knopf „↩ Nicht ok“. Damit geht eine nicht richtig erledigte Aufgabe wieder auf offen. Das Kind bekommt keine Punkte.",
  ] },
  { v: "21.3", date: "16.11.2026", items: [
    "Stimmung: Die 5 ⭐ gibt es jetzt einmal pro Tag. Um 0 Uhr geht es von vorne los, du musst nicht mehr 24 Stunden warten.",
  ] },
  { v: "21.2", date: "16.11.2026", items: [
    "Chat: Der Zurück-Pfeil im Chatraum bleibt jetzt immer sichtbar oben stehen. Man muss nicht mehr hochscrollen, um zurückzukommen.",
  ] },
  { v: "21.1", date: "16.11.2026", items: [
    "Der Chat sieht jetzt aus wie WhatsApp: Zuerst kommt die Chat-Liste mit „Familie“ und „Alle Verbundenen“, mit letzter Nachricht und Zähler für Ungelesenes. Antippen öffnet den Raum mit Sprechblasen, Tagesangabe und Uhrzeit. Mit dem Pfeil oben links geht es zurück zur Liste.",
  ] },
  { v: "21.0", date: "16.11.2026", items: [
    "Chat mit zwei Räumen: Sobald eine Familie verbunden ist, kannst du im Chat zwischen „Eigene Familie“ und „Alle Verbundenen“ umschalten. Im Raum für alle schreiben die verbundenen Familien miteinander, der Familien-Chat bleibt privat.",
    "Der Text unter „Mit anderen Familien verbinden“ stimmt wieder: Verbunden heißt Wunschlisten, Chat, Jobs und Spielhalle.",
  ] },
  { v: "20.9", date: "16.11.2026", items: [
    "Spielhalle: Neues Spiel „Bonbon-Match“. Tausche Nachbar-Bonbons, 3 gleiche in einer Reihe verschwinden. 4er-Reihe = Streifen-Bonbon, 5er = Regenbogen, L- oder T-Form = Bombe. 25 Züge, Ketten geben mehr Punkte.",
  ] },
  { v: "20.8", date: "16.11.2026", items: [
    "Spielhalle: Siegertreppchen mit Animation für Familien und Einzelpersonen. Dazu die Wochen-Challenge mit Countdown, wie lange die Woche noch läuft. Die Woche beginnt jeden Montag um 0 Uhr bei Null.",
  ] },
  { v: "20.7", date: "16.11.2026", items: [
    "Spielhalle sieht jetzt aus wie eine Handy-App: Oben die Bestenliste mit Familien und Einzelpersonen (Woche oder Gesamt, auch pro Spiel), darunter die Spiele als App-Symbole, unten eine Leiste zum Umschalten.",
  ] },
  { v: "20.6", date: "16.11.2026", items: [
    "Spielhalle: Neues Spiel „Farbenspiel“. Der Computer zeigt eine Reihenfolge aus Farben und Tönen, du tippst sie nach. Jede Runde kommt eine Farbe dazu.",
  ] },
  { v: "20.5", date: "16.11.2026", items: [
    "Spielhalle: Die Pfeiltasten sind jetzt als Kreuz angeordnet. Hoch oben, links und rechts daneben, runter unten. Die Mitte bleibt frei, so drückt man seltener daneben.",
  ] },
  { v: "20.4", date: "16.11.2026", items: [
    "Spielhalle: Die Steuerungstasten sind jetzt viel größer und weiter auseinander. Pong hat jetzt auch zwei große Tasten links und rechts.",
  ] },
  { v: "20.3", date: "16.11.2026", items: [
    "Spielhalle auf der Startseite: Deine Spielpunkte und die Familien-Bestenliste der letzten 7 Tage stehen jetzt direkt in der App, weiter oben auf der Startseite.",
  ] },
  { v: "20.2", date: "16.11.2026", items: [
    "Spielhalle: 3 neue Spiele! Flappy (durch die Lücken fliegen), Frogger (Straße und Fluss überqueren) und Pong (gegen den Computer).",
  ] },
  { v: "20.1", date: "16.11.2026", items: [
    "Wandpanel: Das Bild des Tages ist kein Bildschirmschoner mehr. Es erscheint klein oben links im Kalender. Antippen zeigt es 3 Minuten groß, nochmal tippen schließt es. Der Kalender bleibt immer vorne.",
  ] },
  { v: "20.0", date: "16.11.2026", items: [
    "Neu: Spielhalle! Auf der Startseite gibt es den Button „Zur Spielhalle“ mit den Minispielen Snake, Memory und Reaktion.",
    "Es gibt Bestenlisten und einen Familien-Battle mit den verbundenen Familien. Die Spielpunkte haben nichts mit den Aufgaben-Punkten zu tun.",
  ] },
  { v: "19.0", date: "16.11.2026", items: [
    "Neu: Reiter „Jobs“. Admins vergeben Aufgaben mit Punkten an Mitglieder verbundener Familien. Die Eltern des Empfängers nehmen den Job an, nach dem Erledigen bestätigt der Auftraggeber und die Punkte werden gutgeschrieben.",
  ] },
  { v: "18.4", date: "16.11.2026", items: [
    "Punktekonto: Die Liste zeigt nur noch die letzten 10 Einträge. Admins können jeden Eintrag mit × aus der Liste ausblenden – die Punkte bleiben dabei erhalten.",
  ] },
  { v: "18.3", date: "15.11.2026", items: [
    "Im Termin-Formular wählst du oben „Termin“ oder „Geburtstag“. Ein Geburtstag ist automatisch ganztägig und jährlich, mit Geburtsjahr zeigt die App das Alter.",
  ] },
  { v: "18.2", date: "15.11.2026", items: [
    "Das Termin-Formular ist aufgeräumt: Titel, Datum, dann „Mehrere Tage“ und „Mit Uhrzeit“ zum Anhaken, danach „Wiederholen“. Felder wie „Bis“, Uhrzeit und Geburtsjahr erscheinen nur, wenn sie gebraucht werden.",
  ] },
  { v: "18.1", date: "15.11.2026", items: [
    "Termine über mehrere Tage: Beim Eintragen und Ändern gibt es jetzt „Letzter Tag“ (z. B. Urlaub oder Klassenfahrt). Der Termin erscheint an jedem Tag, mit „bis …“.",
  ] },
  { v: "18.0", date: "15.11.2026", items: [
    "Neu: Admins haben oben rechts ein ⚙️ „Verwalten“. Dort stehen Freigeben, Aufgaben-Punkte, Belohnungen, Punktekonto, Familie und Technik geordnet an einem Ort. Eine rote Zahl zeigt, was auf eine Freigabe wartet.",
    "Alle anderen Seiten sehen jetzt für alle gleich aus.",
  ] },
  { v: "17.1", date: "15.11.2026", items: [
    "Familien verbinden: Unter „Familie“ gibt es einen Verbindungs-Code. Gibt ein Admin den Code einer anderen Familie ein, sehen sich beide Familien die Wunschlisten und können „Gekauft“ abhaken.",
  ] },
  { v: "17.0", date: "15.11.2026", items: [
    "Neu: Reiter „Wünsche“. Jeder trägt Wünsche ein (mit Link, Preis, Anlass). Die anderen sehen sie und haken „Gekauft“ ab.",
    "Du selbst siehst die Haken bei deinen eigenen Wünschen nicht – so bleibt es eine Überraschung.",
  ] },
  { v: "16.3", date: "15.11.2026", items: [
    "Der Tages-Chef gibt es jetzt in jeder Familie. Die Reihenfolge richtet sich nach dem Beitritt, neue Mitglieder kommen automatisch dazu.",
  ] },
  { v: "16.2", date: "15.11.2026", items: [
    "Neu: „Passwort vergessen?“ bei der Anmeldung. Du bekommst per E-Mail einen Link für ein neues Passwort.",
    "Unter Familie gibt es außerdem „Passwort ändern“.",
  ] },
  { v: "16.1", date: "15.11.2026", items: [
    "Neu: Der Tages-Chef trägt jetzt eine Krone 👑 über seinem Profilbild (App und Wand).",
  ] },
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

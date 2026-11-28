/* Version 22: Ladebalken, Info-Symbole, rote Reiter, Sprung aus der Push-Meldung, Flammen,
   Weitergeben-Karte und Admin-Schalter für neue Funktionen.
   Diese Datei wird VOR app.js geladen. Sie benutzt S, q, sb, prof, LOAD, render ... aus app.js erst,
   wenn die Funktionen aufgerufen werden (nicht beim Laden). */

/* ---------- Ladebalken beim Start ---------- */
function viewLoading() {
  return `<div class="loadwrap"><div class="loadlogo">🏠</div><div class="loadbar"><i></i></div><div class="sub">Einen Moment, die App wird geladen …</div></div>`;
}

/* ---------- Info-Symbol (eingekreistes i) mit kurzer Anleitung ---------- */
const INFO = {
  mood: () => `<ul><li>Tippe an, wie es dir heute geht. Alle sehen dann einen Ring um dein Bild.</li><li>„Ich möchte reden“ schickt nur den Eltern eine Meldung.</li><li>Für den Eintrag gibt es 5 ⭐, aber nur einmal pro Tag. Um 0 Uhr geht es von vorne los.</li></ul>`,
  todo: () => `<ul><li>Setze den Haken, wenn die Aufgabe erledigt ist. Ein Admin schaut nach und gibt die Punkte frei.</li><li>Mit ✎ änderst du eine Aufgabe, mit × löschst du sie.</li><li>Nichts bei „Für wen?“ gewählt heißt: Die Aufgabe ist für alle.</li><li>Punkte vergibt ein Admin. Aufgaben, die die Kinder selbst anlegen, haben zuerst 0 Punkte.</li>${S.family && S.family.pass_on ? `<li>🃏 Weitergeben: Ist dir eine Aufgabe zugeteilt, kannst du sie für ${S.family.pass_price} ⭐ an jemand anderen abgeben, entweder an eine bestimmte Person oder offen für alle. Wer sie erledigt, bekommt die Punkte der Aufgabe.</li>` : ""}</ul>`,
  rewards: () => `<ul><li>Wer die Punktezahl erreicht, bekommt die Belohnung.</li><li>Ein Admin hakt sie mit „Übergeben“ ab, wenn sie ausgehändigt wurde.</li></ul>`,
  points: () => `<ul><li>Hier stehen die letzten 10 Einträge.</li><li>Mit × blendest du einen Eintrag aus der Liste aus. Die Punkte bleiben erhalten.</li><li>Die Punkte sinken nur, wenn eine Belohnung übergeben wird, eine Weitergeben-Karte benutzt wird oder ein Admin Punkte abzieht.</li></ul>`,
  shop: () => `<ul><li>Tippe ein, was fehlt, und speichere mit +.</li><li>Beim Einkaufen setzt du den Haken. „Erledigte löschen“ räumt die abgehakten Einträge weg.</li><li>Zutaten aus dem Essensplan setzt du dort mit einem Tipp auf die Liste.</li></ul>`,
  meals: () => `<ul><li>Füge einen Link von Chefkoch (oder einer anderen Rezeptseite) ein. Name, Bild und Zutaten werden übernommen.</li><li>Mit Datum kommt das Gericht in den Essensplan. Ohne Datum ist es nur ein Wunsch.</li><li>Unter „Zutaten“ setzt du alles, was fehlt, auf die Einkaufsliste.</li></ul>`,
  cal: () => `<ul><li>Trage unten einen neuen Termin ein.</li><li>Halte einen eigenen Termin lange gedrückt, dann kannst du ihn ändern oder löschen.</li><li>Nach links und rechts wischen blättert durch die Wochen.</li><li>Eigene Google- oder iCloud-Kalender hängst du unter „Familie“ an.</li></ul>`,
  wish: () => `<ul><li>Trag ein, was du dir wünschst. Mit Link und Preis ist es für die anderen leichter.</li><li>Die anderen sehen deine Wünsche und haken ab, was gekauft ist.</li><li>Du siehst diese Haken nicht, so bleibt es eine Überraschung. 🤫</li></ul>`,
  jobs: () => `<ul><li>Jobs vergeben nur Admins. Hier siehst du die Jobs, die für dich bestimmt sind.</li><li>Die Eltern des Empfängers müssen einen Job erst annehmen.</li><li>Die Punkte bekommt der Empfänger, wenn der Auftraggeber die Erledigung bestätigt.</li></ul>`,
  chat: () => `<ul><li>Antippen öffnet den Raum. „${esc(S.family.name)}“ ist nur für eure Familie.</li><li>„Alle Verbundenen“ lesen auch die verbundenen Familien.</li><li>Neue Nachrichten im Familien-Chat kommen als Meldung aufs Handy.</li></ul>`,
  link: () => `<ul><li>Verbundene Familien sehen gegenseitig ihre Wunschlisten und können „Gekauft“ abhaken.</li><li>Sie schreiben im Chat-Raum „Alle Verbundenen“ miteinander, vergeben Jobs und spielen in der Spielhalle gegeneinander.</li><li>Kalender, Aufgaben, Einkauf und der Familien-Chat bleiben privat.</li></ul>`,
  family: () => `<ul><li>Mit dem Einladungscode kommen neue Mitglieder in eure Familie.</li><li>Admins verwalten Punkte, Belohnungen und Einstellungen unter dem ⚙️ oben rechts.</li>${S.family && S.family.flame_on ? `<li>${flameSym()} Unter deinem Bild erscheinen Flammen: die 1. wenn du ${S.family.flame1_days} Tage hintereinander die App öffnest, die 2. wenn du ${S.family.flame2_days} Tage hintereinander etwas tust (Stimmung, Aufgabe, Chat, Spielen), die 3. wenn du ${S.family.flame3_tasks} Aufgaben pro Woche erledigst. Dann steht dein Bild in Flammen. Verpasst du etwas, geht nur die betroffene Flamme aus.</li>` : ""}</ul>`,
  profile: () => `<ul><li>Hier änderst du Name, Farbe und Profilbild.</li><li>Den Kalender-Link bekommst du bei Google (Kalender-Einstellungen → „Geheime Adresse im iCal-Format“) oder bei iCloud (Kalender teilen → „Öffentlicher Kalender“ → Link kopieren).</li></ul>`,
  display: () => `<ul><li>Für das Tablet oder den Bildschirm in der Küche: öffnet die große Übersicht, die sich von selbst aktualisiert.</li></ul>`,
  backup: () => `<ul><li>Jeden Sonntagmorgen wird automatisch eine Sicherung aller Familien-Daten auf dem Server gespeichert. Die letzten 12 bleiben erhalten.</li><li>Hier kannst du zusätzlich jederzeit eine Datei auf dieses Gerät laden.</li></ul>`,
  admin: () => `<ul><li>Diese Seite sehen nur Admins.</li><li>Unter „Freigeben“ bestätigst du erledigte Aufgaben. Erst dann gibt es die Punkte. Bei einer erreichten Belohnung hakst du mit „Übergeben“ ab, dass sie ausgehändigt wurde.</li><li>Tippe auf eine Punktezahl, um sie zu ändern. Aufgaben, die die anderen anlegen, haben zuerst 0 Punkte.</li><li>Chat-Nachrichten löschst du direkt im Chat mit dem kleinen ×.</li><li>Bei „Flammen, Karte &amp; Meldungen“ schaltest du neue Funktionen für eure Familie ein und aus.</li></ul>`,
};
function info(k) {
  const open = !!(S.infoOpen && S.infoOpen[k]); const t = INFO[k]; const txt = typeof t === "function" ? t() : (t || "");
  return `<button type="button" class="ib${open ? " on" : ""}" data-act="info" data-v="${k}" aria-label="Erklärung ${open ? "schließen" : "zeigen"}" title="Erklärung">i</button>${open ? `<div class="infobox"><b>So geht’s</b>${txt}</div>` : ""}`;
}

/* ---------- Roter Reiter bei Neuem ---------- */
const tabSeenKey = k => "tabseen_" + k;
function tabSeen(k) {
  try { const v = localStorage.getItem(tabSeenKey(k)); if (v) return +v; localStorage.setItem(tabSeenKey(k), String(Date.now())); return Date.now(); }
  catch (_e) { return Date.now(); }
}
/* "Neu"-Markierung innerhalb des Reiters: merkt sich beim Öffnen, seit wann etwas neu ist */
function newOpen(k) {
  let raw = null; try { const v = localStorage.getItem(tabSeenKey(k)); raw = v ? +v : null; } catch (_e) { /* egal */ }
  S.newSince = raw ? { [k]: raw } : {};
}
function isNewItem(k, created) {
  if (!S.newSince || S.newSince[k] == null || !S.family || !S.family.red_tabs_on || isDisplay()) return false;
  return tms(created) > S.newSince[k];
}
function tabMark(k) { try { localStorage.setItem(tabSeenKey(k), String(Date.now())); } catch (_e) { /* egal */ } }
const tms = x => new Date(x).getTime();
function tabNew(k) {
  if (!S.me || !S.family || !S.family.red_tabs_on || isDisplay() || k === "home" || k === "family" || k === "meals" || k === "wish") return false;
  const seen = tabSeen(k), me = S.me.id;
  if (k === "todo") return S.tasks.some(t => !t.done && t.created_by !== me && tms(t.created_at) > seen) || S.tasks.some(t => !t.done && t.passed_at && t.passed_by !== me && whoIds(t).includes(me) && tms(t.passed_at) > seen);
  if (k === "shop") return S.shop.some(i => !i.checked && tms(i.created_at) > seen);
  if (k === "chat") return S.msgs.some(m => m.author !== me && tms(m.created_at) > seen);
  if (k === "cal") return S.events.some(e => !e.meetup_id && e.owner !== me && tms(e.created_at) > seen);
  if (k === "jobs") return S.jobs.some(j => jobNeedsMe(j) && tms(j.updated_at || j.created_at) > seen) || S.meetups.some(m => meetNeedsMe(m) && tms(m.created_at) > seen);
  return false;
}

/* ---------- Sprung aus der Push-Meldung: richtiger Reiter, richtige Stelle, kurz blinkend ---------- */
const TAB_KEYS = ["home", "todo", "shop", "meals", "cal", "wish", "jobs", "chat", "family"];
async function goTo(tab, item) {
  if (tab === "duell") { location.href = "spielhalle/"; return; } /* Push "Duell-Einladung": direkt in die Spielhalle */
  if (!TAB_KEYS.includes(tab)) return;
  if (tab !== S.tab || !S.newSince) newOpen(tab);
  S.tab = tab; S.chatRoom = tab === "chat" ? "family" : null;
  S.focus = item || null; S.focusTries = 0;
  /* Termin-Push: Der Kalender zeigt nur eine Woche. Darum erst die Woche des Termins aufschlagen, sonst gibt es nichts zum Blinken. */
  if (tab === "cal" && item) {
    try { if (!(S.events || []).some(e => String(e.id) === String(item))) await LOAD.events(); } catch (_e) { /* egal */ }
    const ev = (S.events || []).find(e => String(e.id) === String(item));
    if (ev && ev.starts_at) { const a = startOfDay(new Date()), b = startOfDay(new Date(ev.starts_at)); S.cw = Math.floor(Math.round((b - a) / 864e5) / 7); }
  }
  render(); if (!item) window.scrollTo(0, 0);
}
function applyPending() {
  if (S.pending && S.me && !S.booting) { const p = S.pending; S.pending = null; goTo(p.tab, p.item); }
}
function applyFocus() {
  if (!S.focus) return;
  const el = document.querySelector(`[data-item="${CSS.escape(String(S.focus))}"]`);
  if (!el) { if (++S.focusTries > 4) S.focus = null; return; }
  S.focus = null;
  el.scrollIntoView({ block: "center" });
  if (S.family && S.family.push_blink_on) { el.classList.add("blinkme"); setTimeout(() => el.classList.remove("blinkme"), 10500); }
}

/* ---------- Zurück-Taste: erst zurück zum Home-Reiter ---------- */
let navPushed = false;
window.navSync = () => { if (S.me && S.tab !== "home" && !navPushed) { try { history.pushState({ fp: 1 }, ""); navPushed = true; } catch (_e) { /* egal */ } } };
window.addEventListener("popstate", () => {
  navPushed = false;
  if (!S.me || S.tab === "home") return;
  S.tab = "home"; S.chatRoom = null; S.mtView = null; S.passTask = null; S.focus = null;
  render(); window.scrollTo(0, 0);
});

/* ---------- Flammen ---------- */
const FLAME_SYMS = { flame: "🔥", heart: "❤️", poop: "💩" };
const flameSym = () => FLAME_SYMS[(S.family && S.family.flame_symbol) || "flame"] || "🔥";
function setFlameData() {
  window.FLAME = {
    cfg: S.family,
    st: Object.fromEntries((S.flames || []).map(r => [r.profile_id, r])),
    wk: Object.fromEntries((S.fweek || []).map(r => [r.profile_id, r.n])),
  };
}
function flameCount(p) {
  const F = window.FLAME; if (!F || !F.cfg || !F.cfg.flame_on || !p) return null;
  const s = F.st[p.id], now = Date.now(), H48 = 48 * 3600e3;
  const f1 = !!(s && s.open_at && now - tms(s.open_at) < H48 && s.open_streak >= F.cfg.flame1_days);
  const f2 = !!(s && s.act_at && now - tms(s.act_at) < H48 && s.act_streak >= F.cfg.flame2_days);
  const f3 = (F.wk[p.id] || 0) >= F.cfg.flame3_tasks;
  return { f1, f2, f3, n: (f1 ? 1 : 0) + (f2 ? 1 : 0) + (f3 ? 1 : 0) };
}
window.flameWrap = (html, p, big) => {
  const c = flameCount(p); if (!c || !c.n) return html;
  const key = window.FLAME.cfg.flame_symbol || "flame", sym = FLAME_SYMS[key] || "🔥";
  return `<span class="flw${big ? "" : " sm"}${c.n === 3 ? " fx fx-" + key : ""}" data-s="${sym}">${html}<span class="flr">${[c.f1, c.f2, c.f3].filter(Boolean).map(() => `<i>${sym}</i>`).join("")}</span></span>`;
};
/* Für die Pyramide u. ä.: Anzahl und Symbol der Flammen einer Person */
window.flameInfo = p => {
  const c = flameCount(p); if (!c || !c.n) return { n: 0, sym: "" };
  return { n: c.n, sym: FLAME_SYMS[window.FLAME.cfg.flame_symbol || "flame"] || "🔥" };
};
let flameAt = 0;
async function flameOpen() {
  if (isDisplay() || !S.me) return;
  flameAt = Date.now();
  try { await sb.rpc("flame_open"); await LOAD.flame_state(); render(); } catch (_e) { /* egal */ }
  duelCheck();
}

/* ---------- Weitergeben-Karte ---------- */
const canPass = t => !!(S.family && S.family.pass_on && !isDisplay() && !t.done && whoIds(t).includes(S.me.id));
const passBtn = t => (canPass(t) ? `<button class="x pass" data-act="passOpen" data-id="${t.id}" title="Weitergeben-Karte benutzen" aria-label="Weitergeben-Karte">🃏</button>` : "");
function passModal() {
  if (!S.passTask || !S.me || !S.family) return "";
  const t = S.tasks.find(x => x.id === S.passTask); if (!t) return "";
  const price = S.family.pass_price, bal = ptsOf(S.me), ok = bal >= price;
  const others = S.profiles.filter(p => p.id !== S.me.id);
  const pick = (v, label, on) => `<button type="button" class="pchip${on ? " on" : ""}" data-act="passPick" data-v="${v}">${label}</button>`;
  return `<div class="ovl"><div class="card passm">
    <div class="ucard"><span class="u-c">🃏</span><span class="u-w">Weitergeben</span><span class="u-p">${price} ⭐</span></div>
    <h2 style="text-align:center">${esc(t.title)}</h2>
    <div class="sub" style="text-align:center">Wer die Aufgabe erledigt, bekommt ${t.points ? t.points + " ⭐" : "keine Punkte"} dafür. Du hast ${bal} ⭐.</div>
    <div class="chips" style="justify-content:center">${pick("open", "🙋 Offen für alle", !S.passTo)}${others.map(p => pick(p.id, esc(p.name), S.passTo === p.id)).join("")}</div>
    <div class="sub" style="text-align:center">${S.passTo ? `${esc(prof(S.passTo)?.name || "?")} muss die Aufgabe übernehmen.` : "Alle anderen sehen die Aufgabe, wer will, erledigt sie."}</div>
    ${ok ? "" : `<div class="err" style="text-align:center">Dafür fehlen dir noch ${price - bal} ⭐.</div>`}
    <div class="add" style="justify-content:center;margin-top:10px"><button class="btn" data-act="passGo" ${ok ? "" : "disabled"}>Karte einsetzen (−${price} ⭐)</button><button class="btn ghost" data-act="passClose">Abbrechen</button></div>
  </div></div>`;
}

/* ---------- Admin: Farbwelt ---------- */
const THEMES = [
  ["standard", "Standard", "Blau und Orange", ["#4a90e2", "#f0a24a", "#10141c"]],
  ["spinne", "Spinnenheld", "Rot und Blau", ["#ff3050", "#5b8cff", "#0c1022"]],
  ["eisen", "Eisenheld", "Rot und Gold", ["#e23a3f", "#f5c02e", "#140d0b"]],
  ["gold", "Gold", "Gold und Champagner", ["#f0c040", "#ffe9a8", "#0e0c07"]],
  ["bronze", "Bronze", "Bronze und Kupfer", ["#d98a3d", "#f0b98a", "#130c07"]],
  ["ozean", "Ozean", "Blau und Hellblau", ["#3b8bff", "#7cc4ff", "#0a1226"]],
];
function applyTheme() {
  const t = (S.me && S.me.theme) || (S.family && S.family.theme) || "standard";
  document.documentElement.dataset.theme = THEMES.some(x => x[0] === t) ? t : "standard";
}
function cardTheme() {
  const cur = (S.me && S.me.theme) || (S.family && S.family.theme) || "standard";
  return `<div class="card"><h2>🎨 Meine Farbwelt</h2>
    <div class="sub" style="margin-bottom:10px">Gilt nur für dich, jeder in der Familie kann seine eigene wählen. Alle Farbwelten sind dunkel.</div>
    <div class="themes">${THEMES.map(([k, n, d, c]) => `<button type="button" class="${cur === k ? "on" : ""}" data-act="setTheme" data-v="${k}" aria-pressed="${cur === k}">
      <span class="sw">${c.map(x => `<i style="background:${x}"></i>`).join("")}</span><b>${n}</b><small>${d}</small></button>`).join("")}</div></div>`;
}

/* Farbwelt der Wandanzeige (getrennt von der App; Standard = die bisherige helle Wand) */
function wallThemes() {
  const cur = (S.family && S.family.wall_theme) || "standard";
  const list = THEMES.map(t => t[0] === "standard" ? ["standard", "Standard", "Hell, wie bisher", ["#2b6cb0", "#2e9d5b", "#eef2f8"]] : t);
  return `<h3 class="sh" style="margin-top:14px">🎨 Farbwelt der Wandanzeige</h3>
    <div class="sub" style="margin-bottom:10px">Gilt nur für das Display, nicht für die App.</div>
    <div class="themes">${list.map(([k, n, d, c]) => `<button type="button" class="${cur === k ? "on" : ""}" data-act="setWallTheme" data-v="${k}" aria-pressed="${cur === k}">
      <span class="sw">${c.map(x => `<i style="background:${x}"></i>`).join("")}</span><b>${n}</b><small>${d}</small></button>`).join("")}</div>`;
}

/* ---------- Admin: Schalter für neue Funktionen ---------- */
function cardSettings() {
  const f = S.family, chk = (n, label) => `<label class="srow"><input type="checkbox" name="${n}" ${f[n] ? "checked" : ""}><span>${label}</span></label>`;
  const num = (n, label, min, max) => `<label class="srow"><span>${label}</span><input class="pt" type="number" name="${n}" min="${min}" max="${max}" value="${f[n]}"></label>`;
  return `<div class="card"><h2>🔥 Flammen, Karte &amp; Meldungen</h2>
    <form data-form="famset">
      <h3 class="sh">Flammen unter dem Profilbild</h3>
      ${chk("flame_on", "Flammen anzeigen")}
      <label class="srow"><span>Symbol</span><select name="flame_symbol">${[["flame", "🔥 Flamme"], ["heart", "❤️ Herz"], ["poop", "💩 Haufen"]].map(([v, l]) => `<option value="${v}" ${f.flame_symbol === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      ${num("flame1_days", "1. Flamme: App öffnen, Tage hintereinander", 1, 30)}
      ${num("flame2_days", "2. Flamme: etwas tun (Stimmung, Aufgabe, Chat, Spielen), Tage hintereinander", 1, 30)}
      ${num("flame3_tasks", "3. Flamme (Bild in Flammen): erledigte Aufgaben pro Woche", 1, 50)}
      <h3 class="sh">🃏 Weitergeben-Karte</h3>
      ${chk("pass_on", "Karte einschalten")}
      ${num("pass_price", "Preis in Punkten", 0, 1000)}
      <h3 class="sh">Meldungen</h3>
      ${chk("red_tabs_on", "Reiter leuchtet rot, wenn es Neues gibt")}
      ${chk("push_blink_on", "Nach Antippen einer Push-Meldung blinkt der Eintrag")}
      <button class="btn block" style="margin-top:10px">Speichern</button>
    </form>
    <div class="sub" style="margin-top:6px">Gezählt wird in gleitenden 24 Stunden, nicht ab 0 Uhr. Eine Flamme geht aus, wenn man mehr als 48 Stunden nichts getan hat.</div></div>`;
}

/* ---------- Aktionen und Formulare (werden von app.js mit ACT/FORMS zusammen benutzt) ---------- */
const EXTRA_ACT = {
  async setTheme(d) {
    if (!THEMES.some(x => x[0] === d.v)) return;
    const was = S.me.theme; S.me = { ...S.me, theme: d.v }; applyTheme(); render();
    const rows = await sb.from("profiles").update({ theme: d.v }).eq("id", S.me.id).select();
    if (rows.error || !(rows.data || []).length) { S.me = { ...S.me, theme: was }; applyTheme(); render(); toast("Hat nicht geklappt"); }
    else toast("Farbwelt geändert 🎨");
  },
  async setWallTheme(d) {
    if (!THEMES.some(x => x[0] === d.v)) return;
    const was = S.family.wall_theme; S.family = { ...S.family, wall_theme: d.v }; render();
    const rows = await sb.from("families").update({ wall_theme: d.v }).eq("id", S.family.id).select();
    if (rows.error || !(rows.data || []).length) { S.family = { ...S.family, wall_theme: was }; render(); toast(rows.error ? "Hat nicht geklappt" : "Nur Admins dürfen das ändern"); }
    else toast("Wand-Farbwelt geändert 📺 (das Display zieht in ca. 30 Sekunden nach)");
  },
  info(d) { S.infoOpen[d.v] = !S.infoOpen[d.v]; render(); },
  passOpen(d) { S.passTask = d.id; S.passTo = null; render(); },
  passClose() { S.passTask = null; S.passTo = null; render(); },
  passPick(d) { S.passTo = d.v === "open" ? null : d.v; render(); },
  async passGo() {
    const id = S.passTask; if (!id) return;
    const to = S.passTo || null, name = to ? (prof(to) || {}).name : null;
    await q(sb.rpc("pass_task", { p_task: id, p_to: to })); // bei einem Fehler zeigt q() die Meldung
    S.passTask = null; S.passTo = null;
    await Promise.all([LOAD.tasks(), LOAD.point_log()]); render();
    toast(name ? `🃏 Weitergegeben an ${name}` : "🃏 Die Aufgabe ist jetzt für alle anderen offen");
  },
};
const EXTRA_FORMS = {
  async famset(f) {
    const n = (k, a, b, d) => { const v = parseInt(f.get(k), 10); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
    const patch = {
      flame_on: f.has("flame_on"), flame_symbol: ["flame", "heart", "poop"].includes(f.get("flame_symbol")) ? f.get("flame_symbol") : "flame",
      flame1_days: n("flame1_days", 1, 30, 3), flame2_days: n("flame2_days", 1, 30, 3), flame3_tasks: n("flame3_tasks", 1, 50, 3),
      pass_on: f.has("pass_on"), pass_price: n("pass_price", 0, 1000, 10),
      red_tabs_on: f.has("red_tabs_on"), push_blink_on: f.has("push_blink_on"),
    };
    const rows = await q(sb.from("families").update(patch).eq("id", S.family.id).select());
    if (!rows.length) return toast("Nur Admins dürfen das ändern");
    S.family = { ...S.family, ...patch }; setFlameData(); toast("Gespeichert ✔"); render();
  },
};

/* ---------- Duell-Einladung (Code knacken): Hinweis in der App, auch ausserhalb der Spielhalle ---------- */
let duelBar = null, duelTimer = 0;
async function duelCheck() {
  if (!S.me || S.booting || isDisplay()) return;
  let inv = [];
  try { const r = await sb.rpc("duel_poll"); inv = (r.data && r.data.invites) || []; } catch (_e) { return; }
  if (!duelBar) { duelBar = document.createElement("div"); duelBar.id = "duelnote"; document.body.appendChild(duelBar); }
  duelBar.hidden = !inv.length;
  duelBar.innerHTML = inv.slice(0, 1).map(i => `<div class="dn"><span>🔐 <b>${esc(i.name)}</b> (${esc(i.family)}) fordert dich bei <b>Code knacken</b> heraus!</span>
    <button class="btn" data-dn="go">Zur Spielhalle</button><button class="btn ghost" data-dn="no" data-id="${esc(i.id)}">Nein</button></div>`).join("");
  duelBar.onclick = async e => {
    const b = e.target.closest("[data-dn]"); if (!b) return;
    if (b.dataset.dn === "go") { location.href = "spielhalle/"; return; }
    try { await sb.rpc("duel_answer", { p_duel: b.dataset.id, p_accept: false }); } catch (_e) { /* egal */ }
    duelCheck();
  };
  clearTimeout(duelTimer); if (inv.length) duelTimer = setTimeout(duelCheck, 185000); /* Einladung gilt 3 Minuten */
}
window.duelCheck = duelCheck;

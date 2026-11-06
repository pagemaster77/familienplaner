/* Wandkalender – nur Ansicht. Zugang über die geheime Adresse (…/wand.html#k=TOKEN).
   Es wird nichts eingetragen oder geändert. Die Daten kommen von der Funktion "wall-data". */

const VERSION = "2 (4.11.)";
const $w = document.getElementById("wall");
const store = {
  get: k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ohne Speicher: nach Neustart neu koppeln */ } },
  del: k => { try { localStorage.removeItem(k); } catch (e) { /* egal */ } },
};
let TOKEN = (location.hash.match(/k=([0-9a-f]{32})/) || [])[1] || store.get("wallToken");
if (/^[0-9a-f]{32}$/.test(TOKEN)) store.set("wallToken", TOKEN); else TOKEN = "";
const W = { data: null, ical: [], view: "cal", wo: 0, live: true, touch: Date.now(), stale: false, pair: null };

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const prof = id => (W.data?.profiles || []).find(p => p.id === id);
const colorOf = c => (/^#[0-9a-fA-F]{6}$/.test(c || "") ? c : "#6b7488");
const safePhoto = u => (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u || "") ? u : "");
const safeUrl = u => (/^https:\/\//i.test(u || "") ? u : "");
function avatar(p, small) {
  if (!p) return `<span class="avatar${small ? " s" : ""}" style="background:#999">?</span>`;
  const ph = safePhoto(p.photo);
  return `<span class="avatar${small ? " s" : ""}" style="background:${colorOf(p.color)}">${ph ? `<img src="${ph}" alt="">` : esc(p.avatar || "🙂")}</span>`;
}

/* ---------- Kalender-Inhalte auswerten (gleiche Logik wie in der App) ---------- */
function parseIcal(text, owner) {
  const lines = text.replace(/\r/g, "").replace(/\n[ \t]/g, "").split("\n");
  const out = []; let ev = null;
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") ev = {};
    else if (l === "END:VEVENT") { if (ev && ev.DTSTART) out.push(ev); ev = null; }
    else if (ev) {
      const i = l.indexOf(":"); if (i < 0) continue;
      const key = l.slice(0, i).split(";")[0]; const val = l.slice(i + 1);
      const allDay = l.slice(0, i).includes("VALUE=DATE") && !l.slice(0, i).includes("DATE-TIME");
      if (key === "DTSTART") { ev.DTSTART = val; ev.allDay = allDay || val.length === 8; }
      else if (key === "DTEND") ev.DTEND = val;
      else if (key === "SUMMARY") ev.SUMMARY = val.replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\;/g, ";");
      else if (key === "RRULE") ev.RRULE = val;
    }
  }
  return out.map(e => ({ ...e, owner }));
}
function icalDate(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  if (m[7]) return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
  return new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}
function ruleMatches(rule, start, day) {
  const r = Object.fromEntries(rule.split(";").map(x => x.split("=")));
  const s0 = startOfDay(start);
  if (day < s0) return false;
  if (r.UNTIL) { const u = icalDate(r.UNTIL.slice(0, 8)); if (u && day > u) return false; }
  const n = +(r.INTERVAL || 1);
  const diff = Math.round((day - s0) / 864e5);
  const wd = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  switch (r.FREQ) {
    case "DAILY": return diff % n === 0;
    case "WEEKLY": {
      const days = r.BYDAY ? r.BYDAY.split(",").map(x => x.slice(-2)) : [wd[start.getDay()]];
      if (!days.includes(wd[day.getDay()])) return false;
      const monday = d => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
      return Math.round((monday(day) - monday(start)) / 6048e5) % n === 0;
    }
    case "MONTHLY": return day.getDate() === start.getDate() && ((day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth()) % n === 0;
    case "YEARLY": return day.getDate() === start.getDate() && day.getMonth() === start.getMonth() && (day.getFullYear() - start.getFullYear()) % n === 0;
  }
  return false;
}
function expandIcal(list, from, to) {
  const out = [];
  for (const e of list) {
    const start = icalDate(e.DTSTART); if (!start) continue;
    const end = e.DTEND ? icalDate(e.DTEND) : start;
    const len = end - start;
    const push = d => {
      const s = new Date(d); if (!e.allDay) s.setHours(start.getHours(), start.getMinutes());
      out.push({ title: e.SUMMARY || "(ohne Titel)", start: s, end: new Date(+s + len), allDay: e.allDay, owner: e.owner });
    };
    if (e.RRULE) {
      for (let d = startOfDay(from); d <= to; d.setDate(d.getDate() + 1)) if (ruleMatches(e.RRULE, start, d)) push(new Date(d));
    } else if (end >= from && start <= to) {
      out.push({ title: e.SUMMARY || "(ohne Titel)", start, end, allDay: e.allDay, owner: e.owner });
    }
  }
  return out;
}
function eventsInRange(from, to) {
  const own = [];
  for (const e of W.data?.events || []) {
    const s0 = new Date(e.starts_at); const len = e.ends_at ? new Date(e.ends_at) - s0 : null; const rec = e.recurrence || "none";
    const mk = st => ({ title: e.birth_year && st.getFullYear() > e.birth_year ? `${String(e.title).trim()} (${st.getFullYear() - e.birth_year})` : e.title, start: st, end: len ? new Date(+st + len) : null, owner: e.owner, allDay: !!e.all_day });
    if (rec === "none") { own.push(mk(s0)); continue; }
    for (let n = 0; n < 1200; n++) {
      let d;
      if (rec === "weekly") { d = new Date(s0); d.setDate(d.getDate() + 7 * n); }
      else {
        const months = rec === "monthly" ? n : 12 * n;
        const y = s0.getFullYear() + Math.floor((s0.getMonth() + months) / 12); const m = (s0.getMonth() + months) % 12;
        d = new Date(y, m, Math.min(s0.getDate(), new Date(y, m + 1, 0).getDate()), s0.getHours(), s0.getMinutes());
      }
      if (d > to) break;
      if ((len ? new Date(+d + len) : d) >= from) own.push(mk(d));
    }
  }
  const ical = expandIcal(W.ical.flatMap(c => parseIcal(c.text, c.owner)), from, to);
  return [...own, ...ical].filter(e => {
    const endEff = e.end && e.end > e.start ? e.end : null;
    return (endEff ? endEff > from : e.start >= from) && e.start <= to;
  }).sort((a, b) => (b.allDay - a.allDay) || (a.start - b.start));
}
function byDay(list) {
  const m = {};
  for (const e of list) {
    const last = startOfDay(e.end && e.end > e.start ? new Date(+e.end - 1) : e.start);
    for (let d = startOfDay(e.start), n = 0; d <= last && n < 31; d.setDate(d.getDate() + 1), n++) (m[dkey(d)] ||= []).push(e);
  }
  return m;
}

/* ---------- Daten holen ---------- */
async function post(body) {
  const r = await fetch(CONFIG.SUPABASE_URL + "/functions/v1/wall-data", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CONFIG.SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  if (r.status === 403) throw new Error("invalid");
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Fehler");
  return j;
}
const call = what => post({ token: TOKEN, what });
/* Die Adresse wurde ungültig gemacht (neue Adresse / ausgeschaltet): neu koppeln */
function lostAccess() { store.del("wallToken"); TOKEN = ""; W.data = null; W.ical = []; if (location.hash) history.replaceState(null, "", location.pathname); startPairing(); }
async function loadCore() {
  if (!TOKEN) return;
  try { W.data = await call("core"); W.stale = false; }
  catch (e) { if (e.message === "invalid") return lostAccess(); W.stale = true; }
  render();
}

/* Kopplung per Code: Display zeigt einen 6-stelligen Code, der Admin gibt ihn in der App ein */
function startPairing() {
  let nonce = store.get("wallNonce");
  if (!/^[0-9a-f]{32}$/.test(nonce)) { nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join(""); store.set("wallNonce", nonce); }
  W.pair = { code: "", msg: "" };
  clearInterval(startPairing.t);
  let first = true;
  const step = async () => {
    try {
      const r = await post({ what: first ? "pair_start" : "pair_poll", nonce }); first = false;
      if (r.status === "ok") { clearInterval(startPairing.t); TOKEN = r.token; store.set("wallToken", TOKEN); store.del("wallNonce"); W.pair = null; init(); return; }
      if (r.status === "expired") first = true; // abgelaufen: nächster Durchgang holt einen neuen Code
      W.pair.code = r.code || W.pair.code; W.pair.msg = "";
    } catch (e) { W.pair.msg = "Keine Verbindung – es wird weiter versucht …"; }
    render();
  };
  step(); startPairing.t = setInterval(step, 3000);
}
async function loadIcal() {
  if (!TOKEN) return;
  try { W.ical = (await call("ical")).ical || []; } catch (e) { if (e.message === "invalid") return lostAccess(); }
  render();
}

/* ---------- Ansichten ---------- */
const DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]; // nach getDay()
function weekStart() {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + W.wo * 7);
  return d;
}
/* Live-Ansicht: heute steht in der Mitte (3 Tage zurück, 3 Tage voraus). Wischen/Pfeile: Wochen Montag bis Sonntag. */
function rangeStart() {
  if (!W.live) return weekStart();
  const d = startOfDay(new Date()); d.setDate(d.getDate() - 3); return d;
}
function goCal(dir) { // dir: -1 / +1 = Woche zurück / vor, 0 = heute (Live-Ansicht)
  if (dir === 0) { W.live = true; W.wo = 0; return; }
  if (W.live) { W.live = false; W.wo = dir; return; }
  W.wo += dir; if (W.wo === 0) W.live = true;
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 864e5 + 1) / 7);
}
function chip(e, p) {
  const c = colorOf(p?.color);
  return `<div class="chip" style="--c:${c};--bg-c:${c}22">${e.allDay ? "" : `<b>${fmtTime(e.start)}</b>`}${esc(e.title)}</div>`;
}
function viewCal() {
  const mon = rangeStart();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return d; });
  const end = new Date(days[6]); end.setHours(23, 59, 59, 999);
  const map = byDay(eventsInRange(mon, end));
  const people = [...(W.data.profiles || [])];
  const known = new Set(people.map(p => p.id));
  const hasShared = Object.values(map).some(l => l.some(e => !known.has(e.owner)));
  const rows = hasShared ? [...people, { id: null, name: "Alle", color: "#6b7488", avatar: "👪" }] : people;
  const todayK = dkey(new Date());
  let html = `<div class="grid" style="grid-template-columns:minmax(7em,13%) repeat(7,minmax(0,1fr));grid-template-rows:auto repeat(${Math.max(rows.length, 1)},minmax(3.6em,1fr))">`;
  html += `<div class="corner"></div>`;
  days.forEach(d => {
    const k = dkey(d); const we = d.getDay() === 0 || d.getDay() === 6; const di = window.dayInfo ? dayInfo(d) : {};
    html += `<div class="dayh${k === todayK ? " today" : ""}${k < todayK ? " past" : ""}${we ? " we" : ""}${di.holiday ? " hol" : di.ferien ? " fer" : ""}"><span class="wd">${DAYS[d.getDay()]}</span><b class="dn">${d.getDate()}</b><small>${d.toLocaleDateString("de-DE", { month: "short" })}</small>${di.holiday ? `<small class="hn">${esc(di.holiday)}</small>` : ""}</div>`;
  });
  for (const p of rows) {
    html += `<div class="person">${avatar(p)}<span class="pn">${esc(p.name)}</span></div>`;
    for (const d of days) {
      const list = (map[dkey(d)] || []).filter(e => (p.id ? e.owner === p.id : !known.has(e.owner)));
      const shown = list.slice(0, 6);
      const k = dkey(d); const we = d.getDay() === 0 || d.getDay() === 6; const di = window.dayInfo ? dayInfo(d) : {};
      html += `<div class="cell${k === todayK ? " today" : ""}${k < todayK ? " past" : ""}${we ? " we" : ""}${di.holiday ? " hol" : di.ferien ? " fer" : ""}">${shown.map(e => chip(e, p)).join("")}${list.length > 6 ? `<div class="more">+${list.length - 6} weitere</div>` : ""}</div>`;
    }
  }
  if (days.some(d => dkey(d) === todayK)) html += `<div class="todaybox"></div>`; // dicker Rahmen um den heutigen Tag (Lage: placeTodayBox)
  return html + `</div>`;
}
function viewTodo() {
  const people = W.data.profiles; const tasks = W.data.tasks;
  const col = (title, p, list) => `<div class="card"><h2>${p ? avatar(p, true) : "👪"} ${esc(title)}${p ? ` <span class="pts">⭐ ${p.points}</span>` : ""}</h2>
    ${list.length ? list.map(t => `<div class="row"><span class="grow${t.done ? " done" : ""}">${esc(t.title)}</span>${t.done && !t.approved ? `<span class="pts">⏳</span>` : t.points ? `<span class="pts">+${t.points}</span>` : ""}</div>`).join("") : `<span class="muted">Nichts offen 🎉</span>`}</div>`;
  const known = new Set(people.map(p => p.id));
  // Eine Aufgabe kann mehreren Mitgliedern gehören (assignees); ältere Einträge nutzen assigned_to.
  const ids = t => (t.assignees && t.assignees.length ? t.assignees : t.assigned_to ? [t.assigned_to] : []);
  const shared = tasks.filter(t => !ids(t).some(id => known.has(id)));
  const cols = people.map(p => col(p.name, p, tasks.filter(t => ids(t).includes(p.id))));
  if (shared.length || !people.length) cols.push(col("Für alle", null, shared));
  return `<div class="cards">${cols.join("")}</div>`;
}
function viewShop() {
  const items = W.data.shopping;
  const open = items.filter(i => !i.checked), done = items.filter(i => i.checked);
  const li = i => `<div class="item${i.checked ? " done" : ""}">${i.checked ? "✔" : "☐"} ${esc(i.title)}${i.amount ? ` <span class="muted">· ${esc(i.amount)}</span>` : ""}</div>`;
  return `<div class="card" style="flex:1;min-height:0"><h2>🛒 Einkaufsliste <span class="muted">${open.length} offen</span></h2>
    <div class="cols">${open.length ? open.map(li).join("") : `<span class="muted">Alles erledigt 🎉</span>`}${done.map(li).join("")}</div></div>`;
}
function viewMeals() {
  const base = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(d.getDate() + i); return d; });
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const cards = days.map((d, i) => {
    const k = dkey(d); const m = W.data.meals.filter(x => x.plan_date === k);
    const body = m.length ? m.map(x => { const u = safeUrl(x.image_url);
      return `${u ? `<div class="img" style="background-image:url('${esc(u)}')"></div>` : ""}<div class="t">${esc(x.title)}</div>`; }).join("") : `<div class="empty">–</div>`;
    return `<div class="meal${i === 0 ? " today" : ""}"><div class="d">${wd[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.</div>${body}</div>`;
  }).join("");
  const wishes = W.data.meals.filter(x => !x.plan_date);
  return `<div class="meals">${cards}</div>${wishes.length ? `<div class="muted" style="margin-top:.5em">Wünsche: ${wishes.map(x => esc(x.title)).join(" · ")}</div>` : ""}`;
}
function viewChat() {
  const ms = W.data.messages.slice(-10);
  return `<div class="chat">${ms.length ? ms.map(m => { const p = prof(m.author); const d = new Date(m.created_at);
    return `<div class="msg">${avatar(p)}<div class="bubble"><small>${esc(p?.name || "?")} · ${d.getDate()}.${d.getMonth() + 1}. ${fmtTime(d)}</small>${esc(m.body)}</div></div>`; }).join("") : `<span class="muted">Noch keine Nachrichten.</span>`}</div>`;
}

const VIEWS = [["cal", "📅", "Kalender", viewCal], ["todo", "✅", "To-Do", viewTodo], ["shop", "🛒", "Einkauf", viewShop], ["meals", "🍽️", "Essen", viewMeals], ["chat", "💬", "Chat", viewChat]];

/* Nachtmodus: zwischen NIGHT_FROM und NIGHT_TO Uhr wird der Bildschirm dunkel, sobald 60 s niemand getippt hat. Antippen weckt ihn. */
const NIGHT_FROM = 22, NIGHT_TO = 6, NIGHT_IDLE = 60000;
const isNight = (d = new Date()) => d.getHours() >= NIGHT_FROM || d.getHours() < NIGHT_TO;
const nightActive = () => !!W.data && isNight() && Date.now() - W.touch > NIGHT_IDLE;

/* Belohnung erreicht -> Fanfare + Konfetti (einmal pro Belohnung); nachts still */
function checkRewards() {
  if (!W.data || !Array.isArray(W.data.rewards) || !window.celebrate) return;
  const pr = id => (W.data.profiles || []).find(p => p.id === id);
  const reached = W.data.rewards.filter(r => !r.claimed && pr(r.profile_id) && (pr(r.profile_id).points || 0) >= r.points);
  const ids = reached.map(r => r.id); let seen = null;
  try { seen = JSON.parse(store.get("rwSeen") || "null"); } catch (e) { /* egal */ }
  const keep = list => store.set("rwSeen", JSON.stringify(list));
  if (!Array.isArray(seen)) return keep(ids); // erster Start: nichts feiern
  const fresh = reached.filter(r => !seen.includes(r.id));
  keep(seen.filter(id => ids.includes(id)).concat(fresh.map(r => r.id)));
  if (fresh.length && !nightActive()) celebrate(fresh.map(r => `${pr(r.profile_id).name}: „${r.title}“`));
}

function render() {
  if (W.data && TOKEN && nightActive()) {
    W.night = true;
    const now = new Date();
    $w.innerHTML = `<div class="nightscr"><b>${fmtTime(now)}</b><span>${now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</span></div>`;
    return;
  }
  W.night = false;
  if (!TOKEN) {
    const c = W.pair?.code || "";
    $w.innerHTML = `<div class="center pair"><div><div class="muted">Wandkalender koppeln</div>
      <div class="code">${c ? esc(c.slice(0, 3) + " " + c.slice(3)) : "…"}</div>
      <p>In der Familien-App öffnen: <b>Familie → Wandanzeige</b><br>und diesen Code eingeben.</p>
      <p class="muted">${esc(W.pair?.msg || "Der Code ist 15 Minuten gültig und erneuert sich selbst.")}</p></div></div>`;
    return;
  }
  if (!W.data) { $w.innerHTML = `<div class="center">Lade …</div>`; return; }
  const now = new Date();
  const mon = rangeStart(); const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const kwOf = W.live ? startOfDay(now) : mon;
  const range = `KW ${isoWeek(kwOf)} · ${mon.getDate()}.${mon.getMonth() + 1}. – ${sun.getDate()}.${sun.getMonth() + 1}.${sun.getFullYear()}${W.live ? "" : " · Wochenansicht"}`;
  const cur = VIEWS.find(v => v[0] === W.view) || VIEWS[0];
  const nav = W.view === "cal" ? `<button class="btn nav" data-go="prev">‹</button><button class="btn nav" data-go="today">Heute</button><button class="btn nav" data-go="next">›</button>` : "";
  $w.innerHTML = `<div class="head">
      <div class="title">${esc(W.data.family?.name || "Familie")}</div>
      ${W.view === "cal" ? `<div class="range">${range}</div>` : ""}${nav}
      ${W.stale ? `<span class="stale">keine Verbindung</span>` : ""}
      <div class="grow"></div>
      <div class="buttons">${VIEWS.map(v => `<button class="btn${v[0] === W.view ? " on" : ""}" data-view="${v[0]}">${v[1]}<span class="lbl">${v[2]}</span></button>`).join("")}</div>
      <div class="clock"><b>${fmtTime(now)}</b><span>${now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</span></div>
    </div><div class="view">${cur[3]()}</div><div class="foot">Stand ${W.data.at ? fmtTime(new Date(W.data.at)) : ""} Uhr<span class="grow"></span><button class="btn fsb" data-fs>${document.fullscreenElement ? "Vollbild beenden" : "Vollbild"}</button></div>`;
  placeTodayBox();
  checkRewards();
}

/* Versteckt: 5x schnell auf die Uhr tippen -> Gipfelstürmer-Pyramide */
const pyrTap = pyrTrigger(() => showPyramid((W.data?.profiles || []).map(p => ({ name: p.name, color: colorOf(p.color), avatar: p.avatar, photo: safePhoto(p.photo), points: p.points }))));
document.addEventListener("click", e => { if (e.target.closest && e.target.closest(".clock")) pyrTap(); });
/* Vollbild: blendet Fenstertitel und Pi-Taskleiste aus. Einschalten und Beenden per Antippen (unten rechts).
   Nach einem Neustart genügt ein beliebiges Antippen, dann geht es wieder ins Vollbild (der Browser erlaubt es nur nach einer Berührung). */
const inFs = () => !!document.fullscreenElement;
async function fsOn() { store.set("wallFs", "1"); try { await document.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch (e) { /* nicht möglich */ } }
async function fsOff() { store.set("wallFs", "0"); try { if (inFs()) await document.exitFullscreen(); } catch (e) { /* egal */ } render(); }
document.addEventListener("fullscreenchange", () => { if (!inFs()) store.set("wallFs", "0"); render(); });
document.addEventListener("click", e => {
  if (e.target.closest && e.target.closest("[data-fs]")) return;
  if (store.get("wallFs") === "1" && !inFs()) fsOn();
}, true);

function placeTodayBox() {
  const box = document.querySelector(".todaybox"), h = document.querySelector(".dayh.today"), g = document.querySelector(".grid");
  if (!box || !h || !g) return;
  box.style.left = h.offsetLeft - 1 + "px"; box.style.top = "0px"; box.style.width = h.offsetWidth + 2 + "px"; box.style.height = g.clientHeight + "px";
}
window.addEventListener("resize", placeTodayBox);

/* Nur Umschalten der Ansicht (kein Eintragen). Nach 90 s ohne Berührung zurück zur Live-Ansicht. */
document.addEventListener("click", e => {
  W.touch = Date.now();
  if (e.target.closest("[data-fs]")) { inFs() ? fsOff() : fsOn(); return; }
  const v = e.target.closest("[data-view]"), g = e.target.closest("[data-go]");
  if (v) { W.view = v.dataset.view; render(); }
  if (g) { goCal(g.dataset.go === "today" ? 0 : g.dataset.go === "next" ? 1 : -1); render(); }
});
/* Wischen im Kalender: nach links = nächste Woche, nach rechts = vorherige Woche.
   Pointer-Events: funktionieren mit Touch, Stift und Maus – auch bei Touch-Monitoren, die sich wie eine Maus melden. */
let swp = null;
document.addEventListener("pointerdown", e => { const wasNight = W.night; W.touch = Date.now(); if (wasNight) { render(); return; } swp = W.view === "cal" && (e.isPrimary !== false) ? { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY } : null; }, true);
document.addEventListener("pointermove", e => { if (swp) { swp.lx = e.clientX; swp.ly = e.clientY; } }, true);
const swipeEnd = e => {
  if (!swp) return;
  const x = e.type === "pointercancel" ? swp.lx : e.clientX, y = e.type === "pointercancel" ? swp.ly : e.clientY;
  const dx = x - swp.x, dy = y - swp.y; swp = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) { W.touch = Date.now(); goCal(dx < 0 ? 1 : -1); render(); }
};
document.addEventListener("pointerup", swipeEnd, true);
document.addEventListener("pointercancel", swipeEnd, true);
/* Nach 90 s ohne Berührung zurück zur Live-Ansicht (Kalender, heute in der Mitte) */
setInterval(() => {
  if (W.data && (W.view !== "cal" || !W.live) && Date.now() - W.touch > 90000) { W.view = "cal"; W.wo = 0; W.live = true; render(); }
}, 3000);
setInterval(render, 30000);

function init() {
  loadCore().then(loadIcal);
  clearInterval(init.a); clearInterval(init.b);
  init.a = setInterval(loadCore, 30000);
  init.b = setInterval(loadIcal, 10 * 60 * 1000);
}
if (TOKEN) init(); else startPairing();
render();

/* Bildschirm anlassen */
async function keepAwake() { try { await navigator.wakeLock?.request("screen"); } catch (e) { /* nicht überall möglich */ } }
keepAwake();
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });

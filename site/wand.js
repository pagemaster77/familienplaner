/* Wandkalender – nur Ansicht. Zugang über die geheime Adresse (…/wand.html#k=TOKEN).
   Es wird nichts eingetragen oder geändert. Die Daten kommen von der Funktion "wall-data". */

const VERSION = "1 (29.10.)";
const $w = document.getElementById("wall");
const TOKEN = (location.hash.match(/k=([0-9a-f]{32})/) || [])[1] || "";
const W = { data: null, ical: [], view: "cal", wo: 0, touch: Date.now(), stale: false, bad: false };

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
  const own = (W.data?.events || []).map(e => ({ title: e.title, start: new Date(e.starts_at), end: e.ends_at ? new Date(e.ends_at) : null, owner: e.owner, allDay: false }));
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
async function call(what) {
  const r = await fetch(CONFIG.SUPABASE_URL + "/functions/v1/wall-data", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CONFIG.SUPABASE_ANON_KEY },
    body: JSON.stringify({ token: TOKEN, what }),
  });
  if (r.status === 403) { W.bad = true; throw new Error("invalid"); }
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Fehler");
  return j;
}
async function loadCore() {
  try { W.data = await call("core"); W.stale = false; }
  catch (e) { W.stale = true; }
  render();
}
async function loadIcal() {
  try { W.ical = (await call("ical")).ical || []; } catch (e) { /* alte Termine bleiben stehen */ }
  render();
}

/* ---------- Ansichten ---------- */
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
function weekStart() {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + W.wo * 7);
  return d;
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
  const mon = weekStart();
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
  days.forEach((d, i) => {
    html += `<div class="dayh${dkey(d) === todayK ? " today" : ""}${i > 4 ? " we" : ""}">${DAYS[i]}<small>${d.getDate()}.${d.getMonth() + 1}.</small></div>`;
  });
  for (const p of rows) {
    html += `<div class="person">${avatar(p)}<span class="pn">${esc(p.name)}</span></div>`;
    for (const d of days) {
      const list = (map[dkey(d)] || []).filter(e => (p.id ? e.owner === p.id : !known.has(e.owner)));
      const shown = list.slice(0, 6);
      html += `<div class="cell${dkey(d) === todayK ? " today" : ""}">${shown.map(e => chip(e, p)).join("")}${list.length > 6 ? `<div class="more">+${list.length - 6} weitere</div>` : ""}</div>`;
    }
  }
  return html + `</div>`;
}
function viewTodo() {
  const people = W.data.profiles; const tasks = W.data.tasks;
  const col = (title, p, list) => `<div class="card"><h2>${p ? avatar(p, true) : "👪"} ${esc(title)}${p ? ` <span class="pts">⭐ ${p.points}</span>` : ""}</h2>
    ${list.length ? list.map(t => `<div class="row"><span class="grow${t.done ? " done" : ""}">${esc(t.title)}</span>${t.points ? `<span class="pts">+${t.points}</span>` : ""}</div>`).join("") : `<span class="muted">Nichts offen 🎉</span>`}</div>`;
  const known = new Set(people.map(p => p.id));
  const shared = tasks.filter(t => !known.has(t.assigned_to));
  const cols = people.map(p => col(p.name, p, tasks.filter(t => t.assigned_to === p.id)));
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

function render() {
  if (!TOKEN || W.bad) { $w.innerHTML = `<div class="center">Dieser Link ist nicht (mehr) gültig.<br>Bitte in der Familien-App unter „Familie → Wandanzeige“ einen neuen Link holen.</div>`; return; }
  if (!W.data) { $w.innerHTML = `<div class="center">Lade …</div>`; return; }
  const now = new Date();
  const mon = weekStart(); const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const range = `KW ${isoWeek(mon)} · ${mon.getDate()}.${mon.getMonth() + 1}. – ${sun.getDate()}.${sun.getMonth() + 1}.${sun.getFullYear()}`;
  const cur = VIEWS.find(v => v[0] === W.view) || VIEWS[0];
  const nav = W.view === "cal" ? `<button class="btn nav" data-go="prev">‹</button><button class="btn nav" data-go="today">Heute</button><button class="btn nav" data-go="next">›</button>` : "";
  $w.innerHTML = `<div class="head">
      <div class="title">${esc(W.data.family?.name || "Familie")}</div>
      ${W.view === "cal" ? `<div class="range">${range}</div>` : ""}${nav}
      ${W.stale ? `<span class="stale">keine Verbindung</span>` : ""}
      <div class="grow"></div>
      <div class="buttons">${VIEWS.map(v => `<button class="btn${v[0] === W.view ? " on" : ""}" data-view="${v[0]}">${v[1]}<span class="lbl">${v[2]}</span></button>`).join("")}</div>
      <div class="clock"><b>${fmtTime(now)}</b><span>${now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</span></div>
    </div><div class="view">${cur[3]()}</div><div class="foot">Stand ${W.data.at ? fmtTime(new Date(W.data.at)) : ""} Uhr</div>`;
}

/* Nur Umschalten der Ansicht (kein Eintragen). Nach 90 s ohne Berührung zurück zum Wochenkalender. */
document.addEventListener("click", e => {
  W.touch = Date.now();
  const v = e.target.closest("[data-view]"), g = e.target.closest("[data-go]");
  if (v) { W.view = v.dataset.view; render(); }
  if (g) { W.wo = g.dataset.go === "today" ? 0 : W.wo + (g.dataset.go === "next" ? 1 : -1); render(); }
});
setInterval(() => {
  if (W.data && (W.view !== "cal" || W.wo !== 0) && Date.now() - W.touch > 90000) { W.view = "cal"; W.wo = 0; }
  render();
}, 30000);

if (TOKEN) {
  loadCore().then(loadIcal);
  setInterval(loadCore, 30000);
  setInterval(loadIcal, 10 * 60 * 1000);
}
render();

/* Bildschirm anlassen */
async function keepAwake() { try { await navigator.wakeLock?.request("screen"); } catch (e) { /* nicht überall möglich */ } }
keepAwake();
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });

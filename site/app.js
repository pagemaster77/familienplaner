/* Familienplaner – die ganze App in einer Datei.
   Aufbau: Hilfsfunktionen -> Daten laden -> Ansichten (Bildschirme) -> Aktionen -> Start */

const VERSION = "9 (29.10.)"; 
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $app = document.getElementById("app");

const COLORS = ["#4f8cff", "#e5484d", "#2f9e5b", "#d9822b", "#8e4ec6", "#12a594", "#e93d82", "#6b7488"];
const EMOJIS = ["🙂", "😎", "🦸", "👩", "👨", "👧", "👦", "👵", "👴", "🐶", "🐱", "🦊", "🐼", "🦁", "⚽", "🎸"];
const TABS = [
  ["home", "🏠", "Start"], ["todo", "✅", "To-Do"], ["shop", "🛒", "Einkauf"], ["meals", "🍽️", "Essen"],
  ["cal", "📅", "Termine"], ["chat", "💬", "Chat"], ["family", "👪", "Familie"],
];

const S = {
  user: null, me: null, family: null,
  profiles: [], tasks: [], shop: [], msgs: [], meals: [], events: [], ical: [],
  tab: "home", authMode: "login", err: "",
  ob: { mode: "new", color: COLORS[0], avatar: EMOJIS[0] },
  pe: null, mealOpen: false,
  bv: "month", bo: 0, // Tablet-Kalender: Ansicht (month/week) und Verschiebung
  open: {}, uncheck: {}, // merkt aufgeklappte Rezepte und abgewählte Zutaten
};

/* ---------- Hilfsfunktionen ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isDisplay = () => location.hash === "#display";
const pad = n => String(n).padStart(2, "0");
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDay = d => d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const prof = id => S.profiles.find(p => p.id === id);

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3500);
}
async function q(promise) {
  const { data, error } = await promise;
  if (error) { toast(error.message); throw error; }
  return data;
}
const safePhoto = u => (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u || "") ? u : "");
function avatar(p, size) {
  if (!p) return `<span class="avatar" style="background:#999">?</span>`;
  const ph = safePhoto(p.photo);
  return `<span class="avatar" style="background:${esc(p.color)};${size ? `width:${size}px;height:${size}px` : ""}">${ph ? `<img src="${ph}" alt="">` : esc(p.avatar)}</span>`;
}
/* Profilfoto: quadratisch zuschneiden und auf 128x128 verkleinern (ca. 5-8 KB) */
function avatarFromFile(file, size = 128) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const m = Math.min(img.width, img.height);
      const c = document.createElement("canvas"); c.width = c.height = size;
      c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
      res(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => rej(new Error("Das Bild konnte nicht gelesen werden"));
    img.src = URL.createObjectURL(file);
  });
}

/* Eingaben beim Neuzeichnen retten, damit nichts verloren geht, wenn jemand anderes etwas ändert */
function saveInputs() {
  const m = {};
  document.querySelectorAll("input[id],textarea[id],select[id]").forEach(el => {
    if (el.type !== "file") m[el.id] = el.value;
  });
  const a = document.activeElement;
  return { m, focus: a && a.id, pos: a && a.selectionStart };
}
function restoreInputs(s) {
  Object.entries(s.m).forEach(([id, v]) => { const el = document.getElementById(id); if (el && v !== "") el.value = v; });
  if (s.focus) {
    const el = document.getElementById(s.focus);
    if (el) { el.focus(); try { if (s.pos != null) el.setSelectionRange(s.pos, s.pos); } catch (e) {} }
  }
}

/* Foto verkleinern, damit Handy-Bilder nicht 5 MB groß hochgeladen werden */
function shrink(file, max = 1000) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => res(b || file), "image/jpeg", 0.82);
    };
    img.onerror = () => res(file);
    img.src = URL.createObjectURL(file);
  });
}

/* ---------- Kalender-Import (iCal-Link von Google / iCloud) ---------- */
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
      out.push({ title: e.SUMMARY || "(ohne Titel)", start: s, end: new Date(+s + len), allDay: e.allDay, owner: e.owner, src: "ical" });
    };
    if (e.RRULE) {
      for (let d = startOfDay(from); d <= to; d.setDate(d.getDate() + 1)) if (ruleMatches(e.RRULE, start, d)) push(new Date(d));
    } else if (end >= from && start <= to) {
      out.push({ title: e.SUMMARY || "(ohne Titel)", start, end, allDay: e.allDay, owner: e.owner, src: "ical" });
    }
  }
  return out;
}
async function loadIcal(force) {
  if (!force && S.icalAt && Date.now() - S.icalAt < 10 * 60 * 1000) return;
  S.icalAt = Date.now();
  const all = [];
  for (const p of S.profiles.filter(p => p.ical_url)) {
    try {
      const { data, error } = await sb.functions.invoke("ical-proxy", { body: { url: p.ical_url } });
      if (error) throw error;
      all.push(...parseIcal(typeof data === "string" ? data : await new Response(data).text(), p.id));
    } catch (e) { console.warn("Kalender von", p.name, "nicht ladbar", e); }
  }
  S.ical = all;
  render();
}
function allEvents(days = 14) {
  const from = startOfDay(new Date()); const to = new Date(+from + days * 864e5 - 1);
  const own = S.events.map(e => ({ id: e.id, title: e.title, start: new Date(e.starts_at), end: e.ends_at ? new Date(e.ends_at) : null, owner: e.owner, src: "own" }))
    .filter(e => e.start >= from && e.start <= to);
  return [...own, ...expandIcal(S.ical, from, to).filter(e => e.start >= from && e.start <= to)].sort((a, b) => a.start - b.start);
}
/* Alle Termine, die in einen Zeitraum fallen (auch mehrtägige) */
function allEventsRange(from, to) {
  const own = S.events.map(e => ({ id: e.id, title: e.title, start: new Date(e.starts_at), end: e.ends_at ? new Date(e.ends_at) : null, owner: e.owner, src: "own" }));
  return [...own, ...expandIcal(S.ical, from, to)].filter(e => {
    const endEff = e.end && e.end > e.start ? e.end : null;
    return (endEff ? endEff > from : e.start >= from) && e.start <= to;
  }).sort((a, b) => a.start - b.start);
}
/* Termine nach Tag sortieren: mehrtägige Termine erscheinen an jedem ihrer Tage */
function byDay(list) {
  const m = {};
  for (const e of list) {
    const last = startOfDay(e.end && e.end > e.start ? new Date(+e.end - 1) : e.start);
    for (let d = startOfDay(e.start), n = 0; d <= last && n < 31; d.setDate(d.getDate() + 1), n++) (m[dkey(d)] ||= []).push(e);
  }
  return m;
}

/* ---------- Daten laden ---------- */
const LOAD = {
  profiles: async () => {
    S.profiles = await q(sb.from("profiles").select("*").order("created_at"));
    const m = S.me && S.profiles.find(x => x.id === S.me.id);
    if (m) S.me = { ...S.me, ...m }; // eigene Admin-Rechte aktuell halten
    return S.profiles;
  },
  tasks: async () => (S.tasks = await q(sb.from("tasks").select("*").order("created_at", { ascending: false }))),
  shopping_items: async () => (S.shop = await q(sb.from("shopping_items").select("*").order("created_at"))),
  messages: async () => (S.msgs = (await q(sb.from("messages").select("*").order("created_at", { ascending: false }).limit(100))).reverse()),
  meals: async () => (S.meals = await q(sb.from("meals").select("*").order("plan_date", { ascending: true, nullsFirst: false }))),
  events: async () => {
    const from = new Date(Date.now() - 62 * 864e5).toISOString();
    S.events = await q(sb.from("events").select("*").gte("starts_at", from).order("starts_at"));
  },
};
async function loadAll() {
  const { data: me } = await sb.from("profiles").select("*").eq("id", S.user.id).maybeSingle();
  S.me = me;
  if (!me) return render();
  S.family = (await q(sb.from("families").select("*").eq("id", me.family_id).single()));
  await Promise.all(Object.values(LOAD).map(f => f()));
  S.pe = { color: me.color, avatar: me.avatar, photo: me.photo || null };
  await pushLoad();
  render();
  loadIcal(true);
  listen();
}
let channel = null;
function listen() {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel("familie")
    .on("postgres_changes", { event: "*", schema: "public" }, p => { if (LOAD[p.table]) LOAD[p.table]().then(render); })
    .subscribe();
}

/* ---------- Ansichten ---------- */
function viewAuth() {
  const login = S.authMode === "login";
  return `<div class="auth">
    <h1>🏠 Familienplaner</h1>
    <p>${login ? "Willkommen zurück! Bitte anmelden." : "Neues Konto anlegen."}</p>
    <form data-form="auth">
      <label class="field"><span>E-Mail</span><input id="em" name="email" type="email" autocomplete="email" required></label>
      <label class="field"><span>Passwort (mind. 6 Zeichen)</span><input id="pw" name="password" type="password" autocomplete="${login ? "current-password" : "new-password"}" minlength="6" required></label>
      ${S.err ? `<div class="err">${esc(S.err)}</div>` : ""}
      <button class="btn block">${login ? "Anmelden" : "Konto erstellen"}</button>
    </form>
    <button class="link" data-act="switchAuth">${login ? "Noch kein Konto? Hier registrieren" : "Schon ein Konto? Anmelden"}</button>
  </div>`;
}
function swatches(cur, act) { return `<div class="swatches">${COLORS.map(c => `<button type="button" class="${c === cur ? "on" : ""}" style="background:${c}" data-act="${act}" data-k="color" data-v="${c}"></button>`).join("")}</div>`; }
function emojis(cur, act) { return `<div class="emojis">${EMOJIS.map(e => `<button type="button" class="${e === cur ? "on" : ""}" data-act="${act}" data-k="avatar" data-v="${e}">${e}</button>`).join("")}</div>`; }

function viewOnboarding() {
  const o = S.ob; const nw = o.mode === "new";
  return `<div class="auth">
    <h1>Fast geschafft</h1>
    <p>Lege deine Familie an oder tritt mit einem Code einer bestehenden Familie bei.</p>
    <div class="add" style="margin:0 0 14px">
      <button class="btn ${nw ? "" : "ghost"}" data-act="obMode" data-v="new">Neue Familie</button>
      <button class="btn ${nw ? "ghost" : ""}" data-act="obMode" data-v="join">Mit Code beitreten</button>
    </div>
    <form data-form="onboard">
      ${nw ? `<label class="field"><span>Name der Familie</span><input id="famname" name="fam" required placeholder="z. B. Familie Müller"></label>`
           : `<label class="field"><span>Einladungscode</span><input id="famcode" name="code" required placeholder="8 Zeichen"></label>`}
      <label class="field"><span>Dein Name</span><input id="myname" name="name" required></label>
      <span class="sub">Deine Farbe</span>${swatches(o.color, "ob")}
      <span class="sub">Dein Symbol</span>${emojis(o.avatar, "ob")}
      <button class="btn block">Los geht's</button>
    </form>
    <button class="link" data-act="logout">Abmelden</button>
  </div>`;
}

function viewShell() {
  const body = { home: viewHome, todo: cardTodo, shop: cardShop, meals: viewMeals, cal: viewCal, chat: cardChat, family: viewFamily }[S.tab]();
  return `<div class="shell">
    <div class="top-wrap">
      <div class="top"><h1>${esc(S.family.name)}</h1><div class="who">${avatar(S.me, 28)} ${esc(S.me.name)}</div></div>
      <nav class="tabs">${TABS.map(([k, ic, l]) => `<button class="${S.tab === k ? "on" : ""}" data-act="tab" data-v="${k}"><span class="ic">${ic}</span>${l}</button>`).join("")}</nav>
    </div>
    <div class="main">${body}</div>
  </div>`;
}

function cardRank() {
  const pts = p => S.tasks.filter(t => t.done && t.done_by === p.id).reduce((a, t) => a + t.points, 0);
  const list = [...S.profiles].map(p => ({ p, n: pts(p) })).sort((a, b) => b.n - a.n);
  return `<div class="card"><h2>🏆 Punktestand</h2><div class="rank">${list.map(({ p, n }) =>
    `<div class="p">${avatar(p)}<b>${n}</b><small>${esc(p.name)}</small></div>`).join("")}</div></div>`;
}

function cardTodo(limit) {
  const open = S.tasks.filter(t => !t.done); const done = S.tasks.filter(t => t.done).slice(0, 8);
  const shown = limit ? open.slice(0, limit) : open;
  const row = t => `<div class="row ${t.done ? "done" : ""}">
    <button class="chk ${t.done ? "on" : ""}" data-act="toggleTask" data-id="${t.id}">${t.done ? "✓" : ""}</button>
    <div class="grow"><div class="t">${esc(t.title)}</div>
      <div class="sub">${t.assigned_to ? "für " + esc(prof(t.assigned_to)?.name || "?") : "für alle"}${t.done && t.done_by ? " · erledigt von " + esc(prof(t.done_by)?.name || "?") : ""}</div></div>
    ${S.me.is_admin && !limit && !isDisplay() ? `<button class="pts" data-act="editPts" data-id="${t.id}" title="Punkte ändern">${t.points} ⭐</button>` : `<span class="pts">${t.points ? t.points + " ⭐" : "ohne Punkte"}</span>`}
    ${limit || isDisplay() ? "" : `<button class="x" data-act="delTask" data-id="${t.id}">×</button>`}</div>`;
  const form = limit || isDisplay() ? "" : `<form class="add" data-form="task">
      <input id="tt" name="title" placeholder="Neue Aufgabe" required>
      ${S.me.is_admin ? `<input id="tp" class="pt" name="points" type="number" min="0" max="1000" value="5" title="Punkte">` : ""}
      <select id="ta" name="who" style="max-width:130px"><option value="">Für alle</option>${S.profiles.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>
      <button class="btn">+</button></form>`;
  return `${limit ? "" : cardRank()}<div class="card"><h2>✅ Gemeinsame Aufgaben</h2>
    ${shown.map(row).join("") || `<div class="empty">Alles erledigt 🎉</div>`}
    ${limit && open.length > limit ? `<div class="sub">… und ${open.length - limit} weitere</div>` : ""}
    ${form}${!S.me.is_admin && !limit && !isDisplay() ? `<div class="sub" style="margin-top:8px">Punkte vergibt ein Admin.</div>` : ""}</div>
    ${limit || !done.length ? "" : `<div class="card"><h2>Zuletzt erledigt</h2>${done.map(row).join("")}</div>`}`;
}

function cardShop(compact) {
  const open = S.shop.filter(i => !i.checked); const got = S.shop.filter(i => i.checked);
  const row = i => `<div class="row ${i.checked ? "done" : ""}">
    <button class="chk ${i.checked ? "on" : ""}" data-act="toggleShop" data-id="${i.id}">${i.checked ? "✓" : ""}</button>
    <div class="grow t">${esc(i.title)}${i.amount ? ` <span class="tag">${esc(i.amount)}</span>` : ""}</div>
    ${compact ? "" : `<button class="x" data-act="delShop" data-id="${i.id}">×</button>`}</div>`;
  const list = compact ? open.slice(0, 12) : [...open, ...got];
  return `<div class="card"><h2>🛒 Einkaufsliste ${got.length && !compact ? `<button class="btn small ghost" data-act="clearShop">Erledigte löschen</button>` : ""}</h2>
    ${list.map(row).join("") || `<div class="empty">Die Liste ist leer</div>`}
    ${compact && open.length > 12 ? `<div class="sub">… und ${open.length - 12} weitere</div>` : ""}
    ${compact ? "" : `<form class="add" data-form="shop"><input id="si" name="title" placeholder="Was fehlt?" required>
      <input id="sa" class="pt" name="amount" placeholder="Menge"><button class="btn">+</button></form>`}</div>`;
}

function cardChat(compact) {
  const list = compact ? S.msgs.slice(-4) : S.msgs;
  const adm = S.me.is_admin && !compact;
  return `<div class="card"><h2>💬 Nachrichten</h2><div class="chat">
    ${list.map(m => { const p = prof(m.author); const me = m.author === S.me.id;
      return `<div class="msg ${me ? "me" : ""}"><small>${esc(p?.name || "?")} · ${fmtTime(new Date(m.created_at))}</small>${esc(m.body)}${adm ? `<button class="mx" data-act="delMsg" data-id="${m.id}" title="Nachricht löschen">×</button>` : ""}</div>`; }).join("") || `<div class="empty">Noch keine Nachrichten</div>`}
    </div>${compact ? "" : `<form class="add" data-form="msg"><input id="mi" name="body" placeholder="Nachricht schreiben …" autocomplete="off" required><button class="btn">Senden</button></form>`}</div>`;
}

function cardToday() {
  const today = dkey(new Date());
  const ev = allEvents(1).filter(e => dkey(e.start) === today);
  const meal = S.meals.find(m => m.plan_date === today);
  return `<div class="card"><h2>📅 Heute</h2>
    ${ev.map(evRow).join("") || `<div class="empty">Keine Termine heute</div>`}
    <div class="row"><span style="font-size:22px">🍽️</span><div class="grow"><div class="t">${meal ? esc(meal.title) : "Noch kein Essen geplant"}</div></div></div></div>`;
}
function evRow(e) {
  const p = prof(e.owner);
  return `<div class="ev"><div class="time">${e.allDay ? "ganztags" : fmtTime(e.start)}</div><span class="dot" style="background:${esc(p?.color || "#999")};margin-top:6px"></span>
    <div class="grow">${esc(e.title)}<div class="sub">${esc(p?.name || "Familie")}</div></div>
    ${e.src === "own" && !isDisplay() ? `<button class="x" data-act="delEvent" data-id="${e.id}">×</button>` : ""}</div>`;
}

function viewHome() { return cardRank() + cardToday() + cardTodo(5) + cardShop(true) + cardChat(true); }

function viewCal() {
  const evs = allEvents(14); let last = "";
  const list = evs.map(e => { const k = dkey(e.start); const head = k !== last ? `<div class="day">${fmtDay(e.start)}</div>` : ""; last = k; return head + evRow(e); }).join("");
  return `<div class="card"><h2>📅 Nächste 14 Tage</h2>${list || `<div class="empty">Keine Termine</div>`}</div>
    <div class="card"><h2>Termin eintragen</h2><form data-form="event">
      <label class="field"><span>Titel</span><input id="et" name="title" required></label>
      <div class="add" style="margin:0 0 10px"><input id="ed" name="date" type="date" required value="${dkey(new Date())}"><input id="eh" name="time" type="time" value="12:00"></div>
      <button class="btn block">Speichern</button></form>
      <p class="sub">Eigene Google- oder iCloud-Kalender hängst du unter „Familie“ an.</p></div>`;
}

const safeUrl = u => (/^https?:\/\//i.test(u || "") ? u : "");

function viewMeals() {
  const today = startOfDay(new Date());
  const planned = S.meals.filter(m => m.plan_date && new Date(m.plan_date + "T00:00") >= today);
  const wishes = S.meals.filter(m => !m.plan_date);
  const card = m => { const w = prof(m.wished_by);
    const ings = (m.ingredients || "").split("\n").map(x => x.trim()).filter(Boolean);
    const link = safeUrl(m.source_url);
    return `<div class="card"><div class="meal">${m.image_url ? `<img src="${esc(m.image_url)}" alt="" referrerpolicy="no-referrer">` : `<div class="ph">🍲</div>`}
      <div class="grow"><b>${esc(m.title)}</b><div class="sub">${m.plan_date ? fmtDay(new Date(m.plan_date + "T00:00")) : "Wunsch"}${w ? " · von " + esc(w.name) : ""}</div>
      ${link ? `<a class="lnk" href="${esc(link)}" target="_blank" rel="noopener">🔗 Rezept ansehen</a>` : ""}
      ${m.plan_date ? "" : `<div class="add" style="margin-top:6px"><input id="pd-${m.id}" type="date" style="max-width:150px"><button class="btn small" data-act="planMeal" data-id="${m.id}">Einplanen</button></div>`}</div>
      <button class="x" data-act="delMeal" data-id="${m.id}">×</button></div>
      ${m.recipe || ings.length ? `<details class="recipe" data-id="${m.id}" ${S.open[m.id] ? "open" : ""}><summary>Zutaten${m.recipe ? " & Rezept" : ""}</summary>
        ${ings.length ? `<div class="ings">${ings.map((t, i) => `<label class="ing"><input type="checkbox" data-meal="${m.id}" data-i="${i}" ${S.uncheck[m.id + ":" + i] ? "" : "checked"}> <span>${esc(t)}</span></label>`).join("")}</div>
          <button class="btn small" data-act="mealToShop" data-id="${m.id}">🛒 Ausgewählte auf die Einkaufsliste</button>` : ""}
        ${m.recipe ? `<pre>${esc(m.recipe)}</pre>` : ""}</details>` : ""}</div>`; };
  return `<div class="card"><h2>🔗 Rezept per Link holen</h2>
    <div class="sub">Link von Chefkoch (oder einer anderen Rezeptseite) einfügen. Name, Bild und Zutaten werden übernommen.</div>
    <form class="add" data-form="import"><input id="ru" name="url" type="url" placeholder="https://www.chefkoch.de/rezepte/…" required>
      <input id="rd" name="date" type="date" style="max-width:150px" title="Datum (leer = nur Wunsch)"><button class="btn">Holen</button></form></div>
    <div class="card"><h2>🍽️ Essen planen <button class="btn small" data-act="toggleMealForm">${S.mealOpen ? "Schließen" : "+ Neu"}</button></h2>
    ${S.mealOpen ? `<form data-form="meal">
      <label class="field"><span>Gericht</span><input id="mt" name="title" required></label>
      <label class="field"><span>Datum (leer lassen = nur Wunsch)</span><input id="md" name="date" type="date"></label>
      <label class="field"><span>Foto</span><input id="mimg" name="img" type="file" accept="image/*"></label>
      <label class="field"><span>Link zum Rezept (optional)</span><input id="ms" name="source_url" type="url"></label>
      <label class="field"><span>Zutaten (eine pro Zeile, z. B. „500 g Nudeln“)</span><textarea id="mz" name="ingredients"></textarea></label>
      <label class="field"><span>Rezept</span><textarea id="mr" name="recipe"></textarea></label>
      <button class="btn block">Speichern</button></form>` : `<div class="sub">Wünsche und geplante Gerichte mit Foto und Rezept.</div>`}</div>
    ${planned.length ? `<div class="day">Geplant</div>${planned.map(card).join("")}` : ""}
    ${wishes.length ? `<div class="day">Wünsche</div>${wishes.map(card).join("")}` : ""}`;
}

function viewFamily() {
  const p = S.pe; const adm = S.me.is_admin;
  return `<div class="card"><h2>Familie</h2>
    ${adm ? `<div class="sub">Name der Familie:</div>
    <form class="add" data-form="famname" style="margin:4px 0 12px"><input id="fn" name="name" value="${esc(S.family.name)}" required maxlength="40" aria-label="Familienname"><button class="btn">Umbenennen</button></form>`
      : `<div style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(S.family.name)}</div>`}
    <div class="sub">Einladungscode zum Beitreten:</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:.1em;margin:4px 0 10px">${esc(S.family.invite_code)}</div>
    ${S.profiles.map(x => `<div class="row">${avatar(x)}<div class="grow">${esc(x.name)}${x.is_admin ? ` <span class="tag">Admin</span>` : ""}<div class="sub">${x.ical_url ? "Kalender verbunden" : "kein Kalender"}</div></div>
      ${adm && x.id !== S.me.id ? `<button class="btn small ghost" data-act="setAdmin" data-id="${x.id}" data-v="${x.is_admin ? 0 : 1}">${x.is_admin ? "Admin entziehen" : "Zum Admin machen"}</button>` : ""}</div>`).join("")}
    <p class="sub">${adm ? "Als Admin kannst du andere zu Admins machen, den Familiennamen ändern und Chat-Nachrichten löschen." : "Nur Admins können den Familiennamen ändern, Admin-Rechte vergeben und Chat-Nachrichten löschen."}</p></div>
    <div class="card"><h2>Mein Profil</h2><form data-form="profile">
      <label class="field"><span>Name</span><input id="pn" name="name" value="${esc(S.me.name)}" required></label>
      <span class="sub">Farbe</span>${swatches(p.color, "pe")}
      <span class="sub">Profilbild</span>
      <div class="photo-row">${avatar({ color: p.color, avatar: p.avatar, photo: p.photo }, 64)}
        <div><input id="pphoto" type="file" accept="image/*">${p.photo ? `<button type="button" class="link" data-act="photoRemove">Foto entfernen</button>` : ""}</div></div>
      <span class="sub">… oder ein Symbol</span>${emojis(p.avatar, "pe")}
      <label class="field"><span>Mein Kalender (iCal-Link)</span><input id="pi" name="ical" value="${esc(S.me.ical_url || "")}" placeholder="https://… oder webcal://…"></label>
      <p class="sub">Google: Kalender-Einstellungen → „Geheime Adresse im iCal-Format“. iCloud: Kalender teilen → „Öffentlicher Kalender“ → Link kopieren.</p>
      <button class="btn block">Speichern</button></form></div>
    <div class="card"><h2>Benachrichtigungen</h2>${pushCard()}</div>
    ${S.me.is_admin ? `<div class="card"><h2>Wandanzeige</h2>${wallCard()}</div>` : ""}
    <div class="card"><h2>Anzeige</h2>
      <p class="sub">Für das Tablet oder den Bildschirm in der Küche: öffnet die große Übersicht, die sich von selbst aktualisiert.</p>
      <a class="btn block" href="#display">📺 Tablet-Ansicht starten</a></div>
    <button class="btn ghost block" data-act="logout">Abmelden</button>
    <p class="sub" style="text-align:center;margin-top:14px">Version ${VERSION}</p>`;
}

/* Große Übersicht fürs Tablet / Display */
function boardRange() {
  const base = startOfDay(new Date());
  if (S.bv === "week") {
    const from = new Date(base); from.setDate(from.getDate() - ((from.getDay() + 6) % 7) + S.bo * 7);
    const to = new Date(from); to.setDate(to.getDate() + 6); to.setHours(23, 59, 59, 999);
    const f = d => d.toLocaleDateString("de-DE", { day: "numeric", month: "long" });
    return { from, to, title: `${f(from)} – ${f(to)} ${to.getFullYear()}` };
  }
  const first = new Date(base.getFullYear(), base.getMonth() + S.bo, 1);
  const from = new Date(first); from.setDate(1 - ((first.getDay() + 6) % 7));
  const lastOfMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const weeks = Math.ceil((Math.round((lastOfMonth - from) / 864e5) + 1) / 7);
  const to = new Date(from); to.setDate(to.getDate() + weeks * 7 - 1); to.setHours(23, 59, 59, 999);
  return { from, to, first, weeks, title: first.toLocaleDateString("de-DE", { month: "long", year: "numeric" }) };
}
function chip(e) {
  const c = prof(e.owner)?.color || "#6b7488";
  return `<div class="chip" style="background:${esc(c)}" title="${esc(e.title)}">${e.allDay ? "" : `<b>${fmtTime(e.start)}</b> `}${esc(e.title)}</div>`;
}
function calGrid() {
  const r = boardRange(); const week = S.bv === "week";
  const evs = byDay(allEventsRange(r.from, r.to)); const todayK = dkey(new Date());
  const heads = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => `<div class="wh">${d}</div>`).join("");
  const max = week ? 14 : 4; let cells = "";
  for (let i = 0; i < (week ? 7 : r.weeks * 7); i++) {
    const d = new Date(r.from); d.setDate(d.getDate() + i);
    const k = dkey(d); const list = evs[k] || [];
    const other = !week && d.getMonth() !== r.first.getMonth();
    cells += `<div class="cell ${k === todayK ? "today" : ""} ${other ? "other" : ""}"><div class="dn">${week ? d.toLocaleDateString("de-DE", { day: "numeric", month: "short" }) : d.getDate()}</div>${list.slice(0, max).map(chip).join("")}${list.length > max ? `<div class="more">+${list.length - max} weitere</div>` : ""}</div>`;
  }
  return { title: r.title, html: `<div class="calgrid ${week ? "week" : "month"}" style="--rows:${week ? 1 : r.weeks}">${heads}${cells}</div>` };
}
function viewBoard() {
  const now = new Date(); const cal = calGrid();
  const today = dkey(now); const meal = S.meals.find(m => m.plan_date === today);
  const legend = S.profiles.map(p => `<span class="lg"><span class="dot" style="background:${esc(p.color)}"></span>${esc(p.name)}</span>`).join("");
  return `<div class="bd">
    <div class="bd-main">
      <div class="bd-head"><h1>${esc(cal.title)}</h1>
        <div class="bd-ctl">
          <button class="btn small ghost" data-act="bNav" data-v="-1">‹</button>
          <button class="btn small ghost" data-act="bNav" data-v="0">Heute</button>
          <button class="btn small ghost" data-act="bNav" data-v="1">›</button>
          <button class="btn small ${S.bv === "month" ? "" : "ghost"}" data-act="bView" data-v="month">Monat</button>
          <button class="btn small ${S.bv === "week" ? "" : "ghost"}" data-act="bView" data-v="week">Woche</button>
        </div></div>
      <div class="legend">${legend}</div>
      ${cal.html}
    </div>
    <aside class="bd-side">
      <div class="side-head"><span class="clock" id="clock">${fmtTime(now)}</span><span class="sub">${esc(S.family.name)} · ${fmtDay(now)}</span><button class="x" data-act="exitBoard" title="Beenden">✕</button></div>
      ${cardRank()}
      <div class="card"><h2>🍽️ Heute gibt es</h2>${meal ? `<div class="meal">${meal.image_url ? `<img src="${esc(meal.image_url)}" alt="">` : ""}<div><b style="font-size:18px">${esc(meal.title)}</b></div></div>` : `<div class="empty">Noch nichts geplant</div>`}</div>
      ${cardTodo(6)}
      ${cardShop(true)}
      ${cardChat(true)}
    </aside></div>`;
}

/* ---------- Aktionen (Klicks) ---------- */
/* Push-Benachrichtigungen */
const VAPID_PUBLIC = "BDw5wyK1SkHw5bdt8PhS0GhOHrbhb2zzeTVnJRDdj_idFXdhY7kMLLMMp3B_tWXkxgAJcVCWF1AaSGZU8Gfg4_w";
const PUSH_KINDS = [["shop", "🛒 Einkaufsliste"], ["task", "✅ Neue Aufgaben"], ["msg", "💬 Chat-Nachrichten"], ["event", "📅 Neue Termine"]];
function pushSupported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
function b64ToBytes(b) { const p = "=".repeat((4 - b.length % 4) % 4); const r = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, c => c.charCodeAt(0)); }
function pushCard() {
  if (!pushSupported()) {
    const ios = /iphone|ipad/i.test(navigator.userAgent);
    return `<p class="sub">${ios ? "Auf dem iPhone geht das nur, wenn die App auf dem Home-Bildschirm liegt (Safari → Teilen → „Zum Home-Bildschirm“) und dort geöffnet wird." : "Dieses Gerät oder dieser Browser unterstützt keine Benachrichtigungen."}</p>`;
  }
  if (Notification.permission === "denied") return `<p class="sub">Benachrichtigungen sind in den Einstellungen des Handys für diese App blockiert. Dort bitte wieder erlauben.</p>`;
  if (!S.push) return `<p class="sub">Du bekommst eine Meldung aufs Handy, wenn jemand anderes etwas einträgt.</p><button class="btn block" data-act="pushOn">🔔 Benachrichtigungen aktivieren</button>`;
  const pr = S.push.prefs || {};
  return `<p class="sub">Auf diesem Gerät aktiv. Melden bei:</p>
    ${PUSH_KINDS.map(([k, l]) => `<label class="row" style="cursor:pointer"><input type="checkbox" data-act="pushPref" data-k="${k}" ${pr[k] !== false ? "checked" : ""}><span class="grow" style="margin-left:10px">${l}</span></label>`).join("")}
    <button class="btn small ghost" data-act="pushOff" style="margin-top:10px">Auf diesem Gerät ausschalten</button>`;
}
async function pushLoad() {
  if (!pushSupported() || !S.user) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) { S.push = null; return; }
    const { data } = await sb.from("push_subs").select("*").eq("endpoint", sub.endpoint).maybeSingle();
    S.push = data || null;
  } catch (_) { S.push = null; }
}

/* Wandanzeige: geheime Adresse zum reinen Ansehen, ohne Anmeldung (für das Display in der Wohnung) */
function wallUrl() {
  return location.origin + location.pathname.replace(/[^/]*$/, "") + "wand.html#k=" + S.family.wall_token;
}
function wallCard() {
  const on = !!S.family.wall_token;
  return `<p class="sub">Ein Display in der Wohnung zeigt Wochenkalender, To-Dos, Einkauf, Essen und Chat. Es kann nur anzeigen, nichts eintragen.</p>
    <p class="sub"><b>Display koppeln:</b> Auf dem Display die Adresse <b>${esc(location.origin + location.pathname.replace(/[^/]*$/, "") + "wand.html")}</b> öffnen. Dort erscheint ein Code, den du hier eingibst.</p>
    <form class="add" data-form="wallpair" style="margin:6px 0 10px"><input name="code" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="Code vom Display, z. B. 123 456" required aria-label="Code vom Display"><button class="btn">Koppeln</button></form>
    ${on ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn small ghost" data-act="wallNew">Alle Displays abmelden</button>
      <button class="btn small ghost" data-act="wallOff">Wandanzeige ausschalten</button></div>
    <details style="margin-top:10px"><summary class="sub" style="cursor:pointer">Erweitert: Direktlink</summary>
      <p class="sub">Alternative zum Code. Wer den Link kennt, kann die Familiendaten ansehen. Nicht weitergeben.</p>
      <input id="wallurl" readonly value="${esc(wallUrl())}" onclick="this.select()" style="font-size:13px">
      <button class="btn small" data-act="wallCopy" style="margin-top:8px">Link kopieren</button></details>` : ""}`;
}
const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
async function setWall(tok) {
  await q(sb.from("families").update({ wall_token: tok }).eq("id", S.family.id));
  S.family.wall_token = tok; render();
}

const ACT = {
    async wallNew() { if (confirm("Alle gekoppelten Displays werden abgemeldet und müssen neu gekoppelt werden. Fortfahren?")) await setWall(newToken()); },
  async wallOff() { if (confirm("Wandanzeige ausschalten? Alle Displays zeigen dann nichts mehr an.")) await setWall(null); },
  async wallCopy() {
    try { await navigator.clipboard.writeText(wallUrl()); toast("Adresse kopiert"); }
    catch (_) { const i = document.getElementById("wallurl"); if (i) { i.select(); toast("Bitte lange drücken und kopieren"); } }
  },
  async pushOn() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { render(); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
      const j = sub.toJSON();
      await q(sb.from("push_subs").upsert({ user_id: S.me.id, family_id: S.me.family_id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" }));
      await pushLoad(); render();
    } catch (e) { alert("Das hat nicht geklappt: " + e.message); }
  },
  async pushOff() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await sb.from("push_subs").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
    } catch (_) {}
    S.push = null; render();
  },
  async pushPref(d, el) {
    if (!S.push) return;
    const prefs = { ...(S.push.prefs || {}), [d.k]: el.checked };
    S.push.prefs = prefs;
    await q(sb.from("push_subs").update({ prefs }).eq("id", S.push.id));
  },
  async switchAuth() { S.authMode = S.authMode === "login" ? "signup" : "login"; S.err = ""; render(); },
  async logout() { await sb.auth.signOut(); },
  tab(d) { S.tab = d.v; render(); window.scrollTo(0, 0); },
  obMode(d) { S.ob.mode = d.v; render(); },
  ob(d) { S.ob[d.k] = d.v; render(); },
  pe(d) { S.pe[d.k] = d.v; render(); },
  exitBoard() { location.hash = ""; },
  bNav(d) { S.bo = +d.v === 0 ? 0 : S.bo + +d.v; render(); },
  bView(d) { S.bv = d.v; S.bo = 0; render(); },
  async toggleTask(d) {
    const t = S.tasks.find(x => x.id === d.id); const done = !t.done;
    t.done = done; render();
    await q(sb.from("tasks").update({ done, done_by: done ? S.me.id : null, done_at: done ? new Date().toISOString() : null }).eq("id", d.id));
    if (done && t.points) toast(`+${t.points} Punkte für ${S.me.name} ⭐`);
  },
  async editPts(d) {
    const t = S.tasks.find(x => x.id === d.id);
    const v = prompt(`Punkte für „${t.title}“:`, t.points);
    if (v === null) return;
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 0 || n > 1000) return toast("Bitte eine Zahl von 0 bis 1000 eingeben");
    await q(sb.from("tasks").update({ points: n }).eq("id", d.id));
  },
  photoRemove() { S.pe.photo = null; render(); },
  async delMsg(d) {
    if (!confirm("Nachricht wirklich löschen?")) return;
    await q(sb.from("messages").delete().eq("id", d.id));
  },
  async setAdmin(d) {
    const make = d.v === "1";
    const { error } = await sb.rpc("set_admin", { target: d.id, make_admin: make });
    if (error) return toast(error.message);
    await LOAD.profiles();
    toast(make ? "Admin-Rechte vergeben" : "Admin-Rechte entzogen"); render();
  },
  async delTask(d) { await q(sb.from("tasks").delete().eq("id", d.id)); },
  async toggleShop(d) { const i = S.shop.find(x => x.id === d.id); i.checked = !i.checked; render(); await q(sb.from("shopping_items").update({ checked: i.checked }).eq("id", d.id)); },
  async delShop(d) { await q(sb.from("shopping_items").delete().eq("id", d.id)); },
  async clearShop() { await q(sb.from("shopping_items").delete().eq("checked", true)); },
  async delEvent(d) { await q(sb.from("events").delete().eq("id", d.id)); },
  toggleMealForm() { S.mealOpen = !S.mealOpen; render(); },
  async delMeal(d) { if (confirm("Wirklich löschen?")) await q(sb.from("meals").delete().eq("id", d.id)); },
  async planMeal(d) {
    const v = document.getElementById("pd-" + d.id).value;
    if (!v) return toast("Bitte ein Datum wählen");
    await q(sb.from("meals").update({ plan_date: v }).eq("id", d.id));
  },
  async mealToShop(d) {
    const m = S.meals.find(x => x.id === d.id);
    const rows = (m.ingredients || "").split("\n").map(s => s.trim()).filter(Boolean)
      .filter((_, i) => !S.uncheck[d.id + ":" + i])
      .map(title => ({ family_id: S.me.family_id, title, meal_id: m.id }));
    if (!rows.length) return;
    await q(sb.from("shopping_items").insert(rows));
    toast(`${rows.length} Zutaten auf der Einkaufsliste`);
  },
};

const FORMS = {
  async wallpair(f) {
    await q(sb.rpc("wall_pair", { p_code: String(f.get("code") || "") }));
    S.family = await q(sb.from("families").select("*").eq("id", S.family.id).single());
    toast("Display gekoppelt ✔"); render();
  },
  async auth(f) {
    S.err = "";
    const email = f.get("email"), password = f.get("password");
    const { error } = S.authMode === "login" ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password });
    if (error) { S.err = error.message; render(); }
  },
  async onboard(f) {
    const o = S.ob;
    const { error } = o.mode === "new"
      ? await sb.rpc("create_family", { fam_name: f.get("fam"), my_name: f.get("name"), my_color: o.color, my_avatar: o.avatar })
      : await sb.rpc("join_family", { code: f.get("code").trim(), my_name: f.get("name"), my_color: o.color, my_avatar: o.avatar });
    if (error) return toast(error.message);
    await loadAll();
  },
  async task(f) {
    await q(sb.from("tasks").insert({ family_id: S.me.family_id, title: f.get("title"), points: S.me.is_admin ? Math.max(0, Math.min(1000, parseInt(f.get("points"), 10) || 0)) : 0, assigned_to: f.get("who") || null }));
  },
  async shop(f) { await q(sb.from("shopping_items").insert({ family_id: S.me.family_id, title: f.get("title"), amount: f.get("amount") || null })); },
  async msg(f) { await q(sb.from("messages").insert({ family_id: S.me.family_id, author: S.me.id, body: f.get("body") })); },
  async event(f) {
    const starts = new Date(`${f.get("date")}T${f.get("time") || "12:00"}`);
    await q(sb.from("events").insert({ family_id: S.me.family_id, title: f.get("title"), starts_at: starts.toISOString(), owner: S.me.id }));
  },
  async meal(f) {
    let image_url = null; const file = f.get("img");
    if (file && file.size) {
      const blob = await shrink(file);
      const path = `${S.me.family_id}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from("meal-images").upload(path, blob, { contentType: "image/jpeg" });
      if (error) return toast("Bild-Upload fehlgeschlagen: " + error.message);
      image_url = sb.storage.from("meal-images").getPublicUrl(path).data.publicUrl;
    }
    await q(sb.from("meals").insert({ family_id: S.me.family_id, title: f.get("title"), plan_date: f.get("date") || null, wished_by: S.me.id, image_url, recipe: f.get("recipe") || null, ingredients: f.get("ingredients") || null, source_url: f.get("source_url") || null }));
    S.mealOpen = false; render();
  },
  async import(f) {
    const url = (f.get("url") || "").trim(); if (!url) return;
    toast("Rezept wird geladen …");
    const { data, error } = await sb.functions.invoke("recipe-import", { body: { url } });
    if (error || !data || data.ok === false) return toast((data && data.error) || "Import nicht möglich. Ist die Funktion „recipe-import“ in Supabase angelegt?");
    // Bild: Der Helfer hat es heruntergeladen. Wir speichern es selbst (Chefkoch sperrt das direkte Anzeigen).
    let image_url = null;
    if (data.imageData) {
      try {
        const bin = atob(data.imageData); const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = await shrink(new Blob([arr], { type: data.imageType || "image/jpeg" }));
        const path = `${S.me.family_id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await sb.storage.from("meal-images").upload(path, blob, { contentType: "image/jpeg" });
        if (!upErr) image_url = sb.storage.from("meal-images").getPublicUrl(path).data.publicUrl;
        else console.warn("Bild-Upload:", upErr.message);
      } catch (err) { console.warn("Bild konnte nicht gespeichert werden", err); }
    }
    if (!image_url) image_url = safeUrl(data.image) || null;
    await q(sb.from("meals").insert({
      family_id: S.me.family_id, title: data.title, plan_date: f.get("date") || null, wished_by: S.me.id,
      image_url, ingredients: (data.ingredients || []).join("\n") || null, source_url: safeUrl(data.url) || url,
    }));
    const missing = [];
    if (!data.ingredients || !data.ingredients.length) missing.push("Zutaten");
    if (!image_url) missing.push("Bild");
    toast("Übernommen: " + data.title + (missing.length ? " (ohne " + missing.join(" und ") + " – auf der Seite nicht abrufbar)" : ""));
  },
  async famname(f) {
    const name = (f.get("name") || "").trim(); if (!name) return;
    const rows = await q(sb.from("families").update({ name }).eq("id", S.family.id).select());
    if (!rows.length) return toast("Nur Admins dürfen den Familiennamen ändern");
    S.family = { ...S.family, name }; toast("Familienname geändert"); render();
  },
  async profile(f) {
    const ical = (f.get("ical") || "").trim() || null;
    await q(sb.from("profiles").update({ name: f.get("name"), color: S.pe.color, avatar: S.pe.avatar, photo: S.pe.photo || null, ical_url: ical }).eq("id", S.me.id));
    S.me = { ...S.me, name: f.get("name"), color: S.pe.color, avatar: S.pe.avatar, photo: S.pe.photo || null, ical_url: ical };
    await LOAD.profiles(); toast("Gespeichert"); loadIcal(true);
  },
};

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  try { await ACT[b.dataset.act]?.(b.dataset, b); } catch (err) { console.error(err); }
});
document.addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target; const h = FORMS[form.dataset.form]; if (!h) return;
  const data = new FormData(form);
  if (form.dataset.form !== "profile" && form.dataset.form !== "onboard" && form.dataset.form !== "auth") form.reset();
  try { await h(data, form); } catch (err) { console.error(err); }
});
window.addEventListener("hashchange", render);
document.addEventListener("toggle", e => { const d = e.target; if (d.matches && d.matches("details.recipe")) S.open[d.dataset.id] = d.open; }, true);
document.addEventListener("change", async e => {
  const c = e.target;
  if (c.dataset && c.dataset.meal) S.uncheck[c.dataset.meal + ":" + c.dataset.i] = !c.checked;
  if (c.id === "pphoto" && c.files && c.files[0]) {
    try { S.pe.photo = await avatarFromFile(c.files[0]); render(); } catch (err) { toast(err.message); }
  }
});

/* ---------- Zeichnen & Start ---------- */
function render() {
  const saved = saveInputs();
  if (!S.user) $app.innerHTML = viewAuth();
  else if (!S.me) $app.innerHTML = viewOnboarding();
  else $app.innerHTML = isDisplay() ? viewBoard() : viewShell();
  restoreInputs(saved);
  if (S.me && !isDisplay() && S.tab === "chat") window.scrollTo(0, document.body.scrollHeight);
}

async function start() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  const { data } = await sb.auth.getSession();
  S.user = data.session?.user || null;
  render();
  if (S.user) await loadAll();
  sb.auth.onAuthStateChange(async (ev, session) => {
    const was = S.user?.id; S.user = session?.user || null;
    if (!S.user) { S.me = null; if (channel) sb.removeChannel(channel); render(); }
    else if (S.user.id !== was) await loadAll();
  });
  // Uhr und Kalender auf dem Tablet aktuell halten
  setInterval(() => { const c = document.getElementById("clock"); if (c) c.textContent = fmtTime(new Date()); }, 15000);
  setInterval(() => { if (S.me) loadIcal(false); }, 5 * 60 * 1000);
}
start();

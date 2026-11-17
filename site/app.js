/* Familienplaner – die ganze App in einer Datei.
   Aufbau: Hilfsfunktionen -> Daten laden -> Ansichten (Bildschirme) -> Aktionen -> Start */

const VERSION = "21.11 (17.11.)";
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $app = document.getElementById("app");

const COLORS = ["#4f8cff", "#e5484d", "#2f9e5b", "#d9822b", "#8e4ec6", "#12a594", "#e93d82", "#6b7488"];
const EMOJIS = ["🙂", "😎", "🦸", "👩", "👨", "👧", "👦", "👵", "👴", "🐶", "🐱", "🦊", "🐼", "🦁", "⚽", "🎸"];
const TABS = [
  ["home", "🏠", "Start"], ["todo", "✅", "To-Do"], ["shop", "🛒", "Einkauf"], ["meals", "🍽️", "Essen"],
  ["cal", "📅", "Termine"], ["wish", "🎁", "Wünsche"], ["jobs", "💼", "Jobs"], ["chat", "💬", "Chat"], ["family", "👪", "Familie"],
];

const S = {
  jobSel: [], mtSel: [], mtView: null, meetups: [],
  user: null, me: null, family: null,
  profiles: [], wishes: [], marks: [], links: [], lprof: [], jobs: [], arc: null, tasks: [], shop: [], msgs: [], chatRoom: null, meals: [], events: [], ical: [], rewards: [], pointlog: [], daily: [], dailyPhoto: {}, chefPhoto: null,
  editTask: null, editShop: null, editMeal: null, editReward: null, editEv: null, cw: 0, // cw = angezeigte Woche (0 = diese) // gerade bearbeiteter Eintrag
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
  const html = `<span class="avatar" style="background:${esc(p.color)};${size ? `width:${size}px;height:${size}px` : ""}">${ph ? `<img src="${ph}" alt="">` : esc(p.avatar)}</span>`;
  const big = !size || size >= 30;
  return window.crownWrap ? crownWrap(window.moodWrap ? moodWrap(html, p, big) : html, p, !big) : html;
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

/* Foto für das Tagesbild: längste Seite höchstens 1280 px, JPEG (ca. 150-300 KB) */
function photoFromFile(file, max = 1280) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      let qy = 0.82, out = c.toDataURL("image/jpeg", qy);
      while (out.length > 1000000 && qy > 0.4) { qy -= 0.1; out = c.toDataURL("image/jpeg", qy); }
      res(out);
    };
    img.onerror = () => rej(new Error("Das Bild konnte nicht gelesen werden"));
    img.src = URL.createObjectURL(file);
  });
}

/* Eingaben beim Neuzeichnen retten, damit nichts verloren geht, wenn jemand anderes etwas ändert */
function saveInputs() {
  const m = {}, c = {};
  document.querySelectorAll("input[id],textarea[id],select[id]").forEach(el => {
    if (el.type === "checkbox" || el.type === "radio") c[el.id] = el.checked;
    else if (el.type !== "file") m[el.id] = el.value;
  });
  const a = document.activeElement;
  return { m, c, focus: a && a.id, pos: a && a.selectionStart };
}
function restoreInputs(s) {
  Object.entries(s.m).forEach(([id, v]) => { const el = document.getElementById(id); if (el && v !== "") el.value = v; });
  Object.entries(s.c || {}).forEach(([id, v]) => { const el = document.getElementById(id); if (el && el.dataset.keep !== undefined) el.checked = v; });
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
/* Eigene Termine, auch mit Wiederholung (wöchentlich / monatlich / jährlich) */
function expandOwn(list, from, to) {
  const out = [];
  for (const e of list) {
    const s0 = new Date(e.starts_at); const len = e.ends_at ? new Date(e.ends_at) - s0 : null;
    const mk = st => ({ id: e.id, title: e.birth_year && st.getFullYear() > e.birth_year ? `${e.title.trim()} (${st.getFullYear() - e.birth_year})` : e.title, start: st, end: len ? new Date(+st + len) : null, owner: e.owner, src: "own", rec: e.recurrence || "none", allDay: !!e.all_day });
    const rec = e.recurrence || "none";
    if (rec === "none") { out.push(mk(s0)); continue; }
    for (let n = 0; n < 1200; n++) {
      let d;
      if (rec === "weekly") { d = new Date(s0); d.setDate(d.getDate() + 7 * n); }
      else {
        const months = rec === "monthly" ? n : 12 * n;
        const y = s0.getFullYear() + Math.floor((s0.getMonth() + months) / 12); const m = (s0.getMonth() + months) % 12;
        const last = new Date(y, m + 1, 0).getDate();
        d = new Date(y, m, Math.min(s0.getDate(), last), s0.getHours(), s0.getMinutes());
      }
      if (d > to) break;
      if ((len ? new Date(+d + len) : d) >= from) out.push(mk(d));
    }
  }
  return out;
}
function allEvents(days = 14) {
  const from = startOfDay(new Date()); const to = new Date(+from + days * 864e5 - 1);
  const own = expandOwn(S.events, from, to).filter(e => e.start >= from && e.start <= to);
  return [...own, ...expandIcal(S.ical, from, to).filter(e => e.start >= from && e.start <= to)].sort((a, b) => (dkey(a.start) === dkey(b.start) ? (!!b.allDay - !!a.allDay) : 0) || a.start - b.start);
}
/* Alle Termine, die in einen Zeitraum fallen (auch mehrtägige) */
function allEventsRange(from, to) {
  const own = expandOwn(S.events, from, to);
  return [...own, ...expandIcal(S.ical, from, to)].filter(e => {
    const endEff = e.end && e.end > e.start ? e.end : null;
    return (endEff ? endEff > from : e.start >= from) && e.start <= to;
  }).sort((a, b) => (dkey(a.start) === dkey(b.start) ? (!!b.allDay - !!a.allDay) : 0) || a.start - b.start);
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
  wishes: async () => (S.wishes = await q(sb.from("wishes").select("*").order("created_at"))),
  arcade: async () => { const { data } = await sb.rpc("arcade_me"); const r = data && data[0]; S.arc = r ? { total: Number(r.total), week: Number(r.week) } : null;
    const bt = await sb.rpc("arcade_battle", { p_days: 7 }); S.arcBat = (bt.data || []).slice(0, 4); },
  meetups: async () => (S.meetups = await q(sb.from("meetups").select("*, meetup_invites(*)").order("starts_at", { ascending: true }).limit(60))),
  meetup_invites: async () => LOAD.meetups(),
  jobs: async () => (S.jobs = await q(sb.from("jobs").select("*").order("created_at", { ascending: false }).limit(100))),
  family_links: async () => {
    S.links = await q(sb.from("family_links").select("*"));
    const { data } = await sb.rpc("linked_profiles"); S.lprof = data || [];
  },
  wish_marks: async () => (S.marks = await q(sb.from("wish_marks").select("*"))),
  rewards: async () => (S.rewards = await q(sb.from("rewards").select("*").order("points"))),
  daily_posts: async () => (S.daily = await q(sb.from("daily_posts").select("*").order("day", { ascending: false }).limit(14))),
  point_log: async () => (S.pointlog = await q(sb.from("point_log").select("*").order("created_at", { ascending: false }).limit(3000))),
  messages: async () => (S.msgs = (await q(sb.from("messages").select("*").order("created_at", { ascending: false }).limit(100))).reverse()),
  meals: async () => (S.meals = await q(sb.from("meals").select("*").order("plan_date", { ascending: true, nullsFirst: false }))),
  events: async () => {
    const from = new Date(Date.now() - 62 * 864e5).toISOString();
    S.events = await q(sb.from("events").select("*").or(`starts_at.gte.${from},recurrence.neq.none`).order("starts_at"));
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
  if (S.me.is_admin) await alexaLoad();
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
  if (S.recovery) return `<div class="auth"><h1>🔑 Neues Passwort</h1><p>Wähle ein neues Passwort für dein Konto.</p>
    <form data-form="newpw"><label class="field"><span>Neues Passwort (mind. 6 Zeichen)</span><input name="password" type="password" autocomplete="new-password" minlength="6" required></label>
    ${S.err ? `<div class="err">${esc(S.err)}</div>` : ""}<button class="btn block">Passwort speichern</button></form></div>`;
  if (S.authMode === "forgot") return `<div class="auth"><h1>🔑 Passwort vergessen?</h1><p>Gib deine E-Mail-Adresse ein. Du bekommst einen Link, mit dem du ein neues Passwort wählen kannst.</p>
    <form data-form="forgot"><label class="field"><span>E-Mail</span><input name="email" type="email" autocomplete="email" required></label>
    ${S.err ? `<div class="err">${esc(S.err)}</div>` : ""}${S.info ? `<div class="ok" style="margin:8px 0">${esc(S.info)}</div>` : ""}<button class="btn block">Link senden</button></form>
    <button class="link" data-act="backLogin">Zurück zur Anmeldung</button></div>`;
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
    ${login ? `<button class="link" data-act="forgotPw">Passwort vergessen?</button><br>` : ""}<button class="link" data-act="switchAuth">${login ? "Noch kein Konto? Hier registrieren" : "Schon ein Konto? Anmelden"}</button>
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

/* Termin-Formular (zum Eintragen und zum Ändern): Titel, Datum, [Mehrere Tage], [Mit Uhrzeit], Wiederholen, [Geburtsjahr nur bei „Jedes Jahr“] */
function evFields(p, v) {
  const rOpt = (k, l) => `<option value="${k}" ${v.rec === k ? "selected" : ""}>${l}</option>`;
  const bd = v.kind === "geburtstag";
  return `<div class="evopts">
      <label class="wchip"><input type="radio" data-keep id="${p}k1" name="kind" value="termin" ${bd ? "" : "checked"}><span>📅 Termin</span></label>
      <label class="wchip"><input type="radio" data-keep class="kind-bd" id="${p}k2" name="kind" value="geburtstag" ${bd ? "checked" : ""}><span>🎂 Geburtstag</span></label>
    </div>
    <label class="field"><span>${"Titel"}</span><input id="${p}t" name="title" value="${esc(v.title)}" required></label>
    <label class="field"><span>Datum</span><input id="${p}d" name="date" type="date" required value="${esc(v.date)}"></label>
    <div class="when-bd">
      <label class="field"><span>Geburtsjahr (zeigt das Alter an, leer = ohne Alter)</span><input id="${p}b" name="birth_year" type="number" min="1900" max="2100" placeholder="z. B. 2014" value="${esc(v.birth)}"></label>
      <p class="sub">Ein Geburtstag ist ganztägig und kommt jedes Jahr wieder.</p>
    </div>
    <div class="evopts when-termin">
      <label class="wchip"><input type="checkbox" class="cb-multi" data-keep id="${p}m" name="multi" ${v.multi ? "checked" : ""}><span>📅 Mehrere Tage</span></label>
      <label class="wchip"><input type="checkbox" class="cb-time" data-keep id="${p}w" name="withtime" ${v.withtime ? "checked" : ""}><span>🕒 Mit Uhrzeit</span></label>
    </div>
    <label class="field when-multi"><span>Bis (letzter Tag)</span><input id="${p}u" name="until" type="date" value="${esc(v.until)}"></label>
    <div class="evtimes when-time">
      <label class="field"><span>Uhrzeit</span><input id="${p}h" name="time" type="time" value="${esc(v.time)}"></label>
      <label class="field when-multitime"><span>Endet um</span><input id="${p}ut" name="until_time" type="time" value="${esc(v.until_time)}"></label>
    </div>
    <label class="field when-termin"><span>Wiederholen</span><select id="${p}r" name="recurrence" class="sel-rec">${rOpt("none", "Nein, nur einmal")}${rOpt("weekly", "Jede Woche")}${rOpt("monthly", "Jeden Monat")}${rOpt("yearly", "Jedes Jahr")}</select></label>`;
}
function evModal() {
  const e = S.events.find(x => x.id === S.editEv); if (!e) return "";
  const d = new Date(e.starts_at); const two = n => String(n).padStart(2, "0"); const ad = !!e.all_day;
  const rec = e.recurrence || "none";
  const en = e.ends_at ? new Date(e.ends_at) : null, multi = !!(en && dkey(new Date(+en - 1)) > dkey(d));
  const kind = !multi && (e.birth_year || (rec === "yearly" && ad)) ? "geburtstag" : "termin";
  return `<div class="ovl"><div class="card"><h2>✎ Termin ändern</h2><form data-form="eventedit" class="evf">
    ${evFields("eev-", { kind, title: e.title, date: dkey(d), multi, withtime: !ad, until: multi ? dkey(new Date(+en - 1)) : "", time: ad ? "" : two(d.getHours()) + ":" + two(d.getMinutes()), until_time: multi && !ad ? two(en.getHours()) + ":" + two(en.getMinutes()) : "", rec, birth: e.birth_year || "" })}
    ${rec !== "none" ? `<p class="sub">Änderungen gelten für alle Wiederholungen.</p>` : ""}
    <div class="add" style="margin:6px 0 0"><button class="btn">Speichern</button><button type="button" class="btn ghost" data-act="cancelEvEdit">Abbrechen</button><button type="button" class="btn danger" data-act="delEvent" data-id="${e.id}">Löschen</button></div></form></div></div>`;
}

/* Jobs: Admins vergeben Aufgaben mit Punkten an Mitglieder verbundener Familien.
   Ablauf: Anfrage -> Admin der Empfänger-Familie nimmt an -> Empfänger erledigt -> Auftraggeber bestätigt -> Punkte. */
const JOB_ST = { requested: "⏳ wartet auf Zusage", accepted: "🛠 läuft", done: "✔ erledigt – wartet auf Bestätigung", paid: "⭐ bezahlt", declined: "✗ abgelehnt", cancelled: "↩ zurückgezogen" };
const jobIsGiver = j => j.from_profile === S.me.id || (S.me.is_admin && j.from_family === S.me.family_id);
const jobIsTakerFam = j => S.me.is_admin && j.to_family === S.me.family_id;
const jobNeedsMe = j => (j.status === "requested" && jobIsTakerFam(j)) || (j.status === "accepted" && j.to_profile === S.me.id) || (j.status === "done" && jobIsGiver(j));
const meetNeedsMe = m => m.status === "open" && ((m.meetup_invites || []).some(i => i.profile_id === S.me.id && i.answer === "pending") || (meetIsHost(m) && new Date(m.starts_at) < new Date()));
const meetIsHost = m => m.from_profile === S.me.id || (S.me.is_admin && m.from_family === S.me.family_id);
const jobsNeedMe = () => S.jobs.filter(jobNeedsMe).length + S.meetups.filter(meetNeedsMe).length;
const fmtMeet = iso => new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + " Uhr";
function meetRow(m) { // kompakte Zeile, antippen öffnet das Fenster mit Details
  const inv = m.meetup_invites || [], mine = inv.find(i => i.profile_id === S.me.id), yes = inv.filter(i => i.answer === "yes").length, d = new Date(m.starts_at);
  const my = mine ? { yes: "✔", no: "✗", pending: "⏳" }[mine.answer] : "";
  return `<button class="mt ${meetNeedsMe(m) ? "hl" : ""} ${m.status !== "open" ? "past" : ""}" data-act="meetOpen" data-id="${m.id}">
    <span class="mdate"><b>${d.getDate()}</b><small>${d.toLocaleString("de-DE", { month: "short" })}</small></span>
    <span class="mbody"><b>${esc(m.title)}</b><small>${d.toLocaleString("de-DE", { weekday: "short" })} ${fmtTime(d)} Uhr${m.place ? " · " + esc(m.place) : ""}</small>
    <small>${m.status === "done" ? "✔ hat stattgefunden" : m.status === "cancelled" ? "↩ abgesagt" : yes + " von " + inv.length + " zugesagt"}</small></span>
    <span class="mmy">${m.status === "open" ? my : ""}</span><span class="mgo">›</span></button>`;
}
function meetModal() {
  if (!S.mtView) return "";
  if (S.mtView === "new") {
    const groups = [...new Set(S.lprof.map(p => p.family_id))].map(id => ({ name: (S.lprof.find(p => p.family_id === id) || {}).family_name, people: S.lprof.filter(p => p.family_id === id) }));
    const meetGroups = [{ name: S.family.name + " (wir)", people: S.profiles }, ...groups];
    return `<div class="ovl"><div class="card"><h2>🤝 Neues Treffen</h2><form data-form="meetup" class="evf">
      <input id="mtt" name="title" placeholder="Wofür treffen wir uns?" required maxlength="120">
      <div class="add" style="margin:0"><input id="mtd" name="date" type="date" required><input id="mtz" name="time" type="time" value="15:00" required></div>
      <input id="mtp" name="place" placeholder="Ort (optional)" maxlength="120">
      <div class="who"><span class="sub">Wer soll teilnehmen? Antippen – die Zahl zeigt die Reihenfolge.</span>
      ${meetGroups.map(g => `<div class="sub" style="margin:8px 0 2px"><b>${esc(g.name)}</b></div><div class="chips">${g.people.map(p => { const n = S.mtSel.indexOf(p.id) + 1; return `<button type="button" class="wchip jchip ${n ? "on" : ""}" data-act="meetPick" data-id="${p.id}"><span>${esc(p.name)}${n ? `<i class="jn">${n}</i>` : ""}</span></button>`; }).join("")}</div>`).join("")}</div>
      <p class="sub">Jeder bekommt eine Einladung. Wer zusagt, hat den Termin automatisch im Kalender. Wer teilnimmt, bekommt 10 ⭐, sobald du die Teilnahme bestätigst.</p>
      <div class="add" style="margin:6px 0 0"><button class="btn">Treffen anlegen</button><button type="button" class="btn ghost" data-act="meetClose">Abbrechen</button></div></form></div></div>`;
  }
  const m = S.meetups.find(x => x.id === S.mtView); if (!m) return "";
  const inv = m.meetup_invites || [], open = m.status === "open", yes = inv.filter(i => i.answer === "yes").length, f = wprof(m.from_profile), d = new Date(m.starts_at);
  const ic = { yes: "✔", no: "✗", pending: "⏳" };
  const canAns = i => open && !i.paid && (i.profile_id === S.me.id || (S.me.is_admin && i.family_id === S.me.family_id));
  const mkq = (i, v, label) => `<button class="mq ${i.answer !== "pending" && (i.answer === "yes") === (v === "1") ? "on " + (v === "1" ? "yes" : "no") : ""}" data-act="meetAnswer" data-id="${m.id}" data-p="${i.profile_id}" data-v="${v}" aria-label="${label}">${v === "1" ? "✔" : "✗"}</button>`;
  const people = inv.map(i => { const n = esc(wprof(i.profile_id)?.name || "?");
    return `<div class="mrow"><span class="mn">${n}</span>${canAns(i) ? `${mkq(i, "1", n + " kommt")}${mkq(i, "0", n + " kommt nicht")}` : `<span class="mst">${ic[i.answer]}</span>`}</div>`; }).join("");
  return `<div class="ovl"><div class="card mdet"><button class="mx2" data-act="meetClose" aria-label="Schließen">✕</button>
    <h2>🤝 ${esc(m.title)}</h2>
    <div class="mfacts"><div>📅 ${d.toLocaleString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}, ${fmtTime(d)} Uhr</div>${m.place ? `<div>📍 ${esc(m.place)}</div>` : ""}<div>👤 Eingeladen von ${esc(f ? f.name : "?")}</div><div>⭐ ${m.points} Punkte fürs Mitmachen</div>
      ${open ? "" : `<div><span class="tag">${m.status === "done" ? "✔ hat stattgefunden" : "↩ abgesagt"}</span></div>`}</div>
    <h3 class="mh">Wer kommt? <small>${yes} von ${inv.length} zugesagt</small></h3><div class="mlist">${people}</div>
    ${open && meetIsHost(m) ? (() => { const started = d <= new Date(); return `<div class="mhost">
      <button class="btn" data-act="meetFinish" data-id="${m.id}" ${started ? "" : "disabled"}>✔ Teilnahme bestätigen</button>
      <div class="sub" style="text-align:center">${started ? `${yes} Zusage${yes === 1 ? "" : "n"}: Jeder davon bekommt ${m.points} ⭐ für die Teilnahme.` : `Erst ab Beginn des Treffens möglich (${d.toLocaleString("de-DE", { weekday: "short" })} ${fmtTime(d)} Uhr).`}</div>
      <button class="btn ghost" data-act="meetCancel" data-id="${m.id}">Treffen absagen</button></div>`; })() : ""}
    </div></div>`;
}
function viewJobs() {
  const groups = [...new Set(S.lprof.map(p => p.family_id))].map(id => ({ id, name: (S.lprof.find(p => p.family_id === id) || {}).family_name, people: S.lprof.filter(p => p.family_id === id) }));
  const need = S.jobs.filter(jobNeedsMe), run = S.jobs.filter(j => !jobNeedsMe(j) && ["requested", "accepted", "done"].includes(j.status)), old = S.jobs.filter(j => ["paid", "declined", "cancelled"].includes(j.status)).slice(0, 8);
  const form = S.me.is_admin
    ? groups.length ? `<form class="add evf" data-form="job" style="flex-wrap:wrap">
        <div class="who" style="flex-basis:100%"><span class="sub">Für wen? Mitglieder antippen – mehrere gehen auch, die Zahl zeigt die Reihenfolge.</span>
          ${groups.map(g => `<div class="sub" style="margin:8px 0 2px"><b>${esc(g.name)}</b></div><div class="chips">${g.people.map(p => { const n = S.jobSel.indexOf(p.id) + 1; return `<button type="button" class="wchip jchip ${n ? "on" : ""}" data-act="jobPick" data-id="${p.id}"><span>${esc(p.name)}${n ? `<i class="jn">${n}</i>` : ""}</span></button>`; }).join("")}</div>`).join("")}</div>
        <input id="jt" name="title" placeholder="Was soll erledigt werden?" required maxlength="120">
        <input id="jn" name="note" placeholder="Notiz (optional)" maxlength="300">
        <label class="field" style="margin:0"><span>Punkte (0–20)</span><input id="jp" class="pt" name="points" type="number" min="0" max="20" value="5"></label>
        <button class="btn">Job vergeben</button></form>
        <div class="sub" style="margin-top:6px">Die Eltern des Empfängers müssen den Job erst annehmen. Die Punkte bekommt der Empfänger, wenn du die Erledigung bestätigst.</div>`
      : `<div class="empty">Noch keine Familie verbunden. Das geht unter „Familie → Mit anderen Familien verbinden“.</div>`
    : `<div class="sub">Jobs vergeben nur Admins. Hier siehst du Jobs, die für dich bestimmt sind.</div>`;
  const mOpen = S.meetups.filter(m => m.status === "open"), mOld = S.meetups.filter(m => m.status !== "open").slice(-5).reverse();
  return `<div class="card"><h2>💼 Jobs</h2>${form}</div>
    <div class="card"><div class="mhead"><h2>🤝 Treffen</h2>${S.me.is_admin ? `<button class="btn small" data-act="meetNew">+ Neues Treffen</button>` : ""}</div>
      ${mOpen.length ? mOpen.map(meetRow).join("") : `<div class="empty">Keine Treffen geplant</div>`}${mOld.length ? `<div class="sub" style="margin:10px 0 4px">Vergangene</div>${mOld.map(meetRow).join("")}` : ""}</div>
    ${need.length ? `<div class="card"><h2>👉 Wartet auf dich <span class="tag">${need.length}</span></h2>${need.map(jobRow).join("")}</div>` : ""}
    ${run.length ? `<div class="card"><h2>Laufende Jobs</h2>${run.map(jobRow).join("")}</div>` : ""}
    ${old.length ? `<div class="card"><h2>Abgeschlossen</h2>${old.map(jobRow).join("")}</div>` : ""}
    ${S.jobs.length ? "" : `<div class="card"><div class="empty">Noch keine Jobs</div></div>`}${meetModal()}`;
}

/* ⚙️ Verwalten: alles, was nur Admins tun – Freigeben, Punkte, Belohnungen, Familie, Technik */
const rewardsReached = () => S.rewards.filter(r => !r.claimed && prof(r.profile_id) && ptsOf(prof(r.profile_id)) >= r.points);
const adminOpenCount = () => S.tasks.filter(t => t.done && !t.approved).length + rewardsReached().length;
function viewAdmin() {
  const wait = S.tasks.filter(t => t.done && !t.approved), reached = rewardsReached();
  const open = S.tasks.filter(t => !t.done);
  const todoRow = t => `<div class="row"><div class="grow"><div class="t">${esc(t.title)}</div>
      <div class="sub">${whoIds(t).length ? "für " + whoIds(t).map(id => esc(prof(id)?.name || "?")).join(", ") : "für alle"}${t.done && t.done_by ? " · erledigt von " + esc(prof(t.done_by)?.name || "?") : ""}</div></div>
    <button class="pts" data-act="editPts" data-id="${t.id}" title="Punkte ändern">${t.points} ⭐</button></div>`;
  const people = S.profiles;
  return `<div class="card"><button class="btn ghost small" data-act="tab" data-v="home">← Zurück</button>
      <h2 style="margin-top:10px">⚙️ Verwalten</h2><p class="sub">Nur für Admins. Alle anderen sehen diese Seite nicht.</p></div>

    <div class="card"><h2>✔ Freigeben${wait.length + reached.length ? ` <span class="tag">${wait.length + reached.length}</span>` : ""}</h2>
      ${wait.map(t => `<div class="row"><div class="grow"><div class="t">${esc(t.title)}</div>
        <div class="sub">erledigt von ${esc(prof(t.done_by)?.name || "?")} · ⏳ wartet auf Freigabe</div></div>
        <button class="pts" data-act="editPts" data-id="${t.id}" title="Punkte ändern">${t.points} ⭐</button>
        <button class="btn small ghost" data-act="reopenTask" data-id="${t.id}" title="Nicht richtig erledigt – wieder auf offen setzen">↩ Nicht ok</button>
        <button class="btn small" data-act="approveTask" data-id="${t.id}">✔ Freigeben</button></div>`).join("")}
      ${reached.map(r => `<div class="row"><div class="grow"><div class="t">🎁 ${esc(r.title)}</div>
        <div class="sub">${esc(prof(r.profile_id)?.name || "?")} hat ${r.points} ⭐ erreicht</div></div>
        <button class="btn small" data-act="claimReward" data-id="${r.id}">✔ Übergeben</button></div>`).join("")}
      ${wait.length || reached.length ? "" : `<div class="empty">Nichts offen 🎉</div>`}
      <div class="sub" style="margin-top:6px">Erst nach „Freigeben“ gibt es die Punkte für eine erledigte Aufgabe. Bei einer erreichten Belohnung hakst du mit „Übergeben“ ab, dass sie ausgehändigt wurde.</div></div>

    <div class="card"><h2>⭐ Aufgaben &amp; Punkte</h2>
      <form class="add" data-form="admintask">
        <input id="atn" name="title" placeholder="Neue Aufgabe mit Punkten" required>
        <input id="atp" class="pt" name="points" type="number" min="0" max="1000" value="5" title="Punkte">
        <button class="btn">+</button>
        <div style="flex-basis:100%">${whoChips([])}</div></form>
      ${open.map(todoRow).join("") || `<div class="empty">Keine offenen Aufgaben</div>`}
      <div class="sub" style="margin-top:6px">Tippe auf die Punktezahl, um sie zu ändern. Aufgaben, die die anderen anlegen, haben zuerst 0 Punkte.</div></div>

    ${cardRewards(true)}
    ${cardPoints(true)}

    <div class="card"><h2>👪 Familie</h2>
      <div class="sub">Name der Familie:</div>
      <form class="add" data-form="famname" style="margin:4px 0 12px"><input id="fn" name="name" value="${esc(S.family.name)}" required maxlength="40" aria-label="Familienname"><button class="btn">Umbenennen</button></form>
      ${people.map(x => `<div class="row">${avatar(x)}<div class="grow">${esc(x.name)}${x.is_admin ? ` <span class="tag">Admin</span>` : ""}</div>
        ${x.id !== S.me.id ? `<button class="btn small ghost" data-act="setAdmin" data-id="${x.id}" data-v="${x.is_admin ? 0 : 1}">${x.is_admin ? "Admin entziehen" : "Zum Admin machen"}</button>` : ""}</div>`).join("")}
      <div class="sub" style="margin-top:6px">Chat-Nachrichten löschen kannst du direkt im Chat (kleines ×).</div></div>
    ${cardLink(true)}

    <div class="card"><h2>📺 Wandanzeige</h2>${wallCard()}</div>
    <div class="card"><h2>Alexa</h2>${alexaCard()}</div>
    <div class="card"><h2>💾 Datensicherung</h2>
      <p class="sub">Jeden Sonntagmorgen wird automatisch eine Sicherung aller Familien-Daten auf dem Server gespeichert (die letzten 12 bleiben erhalten). Hier kannst du zusätzlich jederzeit eine Datei auf dieses Gerät laden.</p>
      <button class="btn block" data-act="backupDownload">Sicherung jetzt herunterladen</button></div>`;
}

function viewShell() {
  const body = (S.tab === "admin" && S.me.is_admin ? viewAdmin : { home: viewHome, todo: cardTodo, shop: cardShop, meals: viewMeals, cal: viewCal, wish: viewWishes, jobs: viewJobs, chat: cardChat, family: viewFamily }[S.tab] || viewHome)();
  return `<div class="shell">
    <div class="top-wrap">
      <div class="top"><h1>${esc(S.family.name)}</h1><div class="who">${S.me.is_admin ? `<button class="gear ${S.tab === "admin" ? "on" : ""}" data-act="tab" data-v="admin" title="Verwalten" aria-label="Verwalten">⚙️${adminOpenCount() ? `<i>${adminOpenCount()}</i>` : ""}</button>` : ""}${avatar(S.me, 28)} ${esc(S.me.name)}</div></div>
      <nav class="tabs">${TABS.map(([k, ic, l]) => `<button class="${S.tab === k ? "on" : ""}" data-act="tab" data-v="${k}"><span class="ic">${ic}</span>${l}${k === "jobs" && jobsNeedMe() ? `<i class="tb">${jobsNeedMe()}</i>` : ""}</button>`).join("")}</nav>
    </div>
    <div class="main">${body}</div>
  </div>${evModal()}`;
}

/* Punktekonto: Summe aller Gutschriften und Abzüge (bleibt erhalten, auch wenn Aufgaben gelöscht werden) */
const parseBirth = v => { const n = parseInt(v, 10); return n >= 1900 && n <= 2100 ? n : null; };
const ptsOf = p => S.pointlog.filter(l => l.profile_id === p.id).reduce((a, l) => a + l.points, 0);
const fmtShort = d => new Date(d).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
function cardPoints(admin) {
  const adm = !!admin && S.me.is_admin && !isDisplay();
  const log = S.pointlog.filter(l => !l.hidden).slice(0, 10);
  const form = adm ? `<form class="add" data-form="pointadj" style="margin-bottom:10px">
      <select id="pjw" name="who" required style="max-width:130px"><option value="">Wer?</option>${S.profiles.map(p => `<option value="${p.id}">${esc(p.name)} (${ptsOf(p)})</option>`).join("")}</select>
      <select id="pjo" name="op" style="max-width:130px"><option value="-">Abziehen</option><option value="+">Gutschreiben</option></select>
      <input id="pjp" class="pt" name="points" type="number" min="1" max="100000" placeholder="Punkte" required>
      <input id="pjr" name="reason" placeholder="Grund (optional)" maxlength="120">
      <button class="btn">OK</button></form>` : "";
  return `<div class="card"><h2>📒 Punktekonto</h2>${form}
    ${log.map(l => `<div class="row"><div class="grow"><div class="t">${esc(prof(l.profile_id)?.name || "?")} · ${l.points > 0 ? "+" : ""}${l.points} ⭐</div>
      <div class="sub">${fmtShort(l.created_at)} · ${l.kind === "reward" ? "🎁 " : l.kind === "manual" ? "✎ " : "✅ "}${esc(l.reason || (l.kind === "task" ? "Aufgabe" : ""))}</div></div>
      ${adm ? `<button class="x" data-act="delPointLog" data-id="${l.id}" title="Aus der Liste ausblenden (Punkte bleiben)">×</button>` : ""}</div>`).join("") || `<div class="empty">Keine Einträge in der Liste</div>`}
    <div class="sub" style="margin-top:6px">Es werden nur die letzten 10 Einträge gezeigt. Mit × blendest du einen Eintrag aus der Liste aus – die Punkte bleiben erhalten. Sie sinken nur, wenn eine Belohnung übergeben wird oder ein Admin Punkte abzieht.</div></div>`;
}
// Für wen gilt die Aufgabe? (leer = für alle)
const whoIds = t => (t.assignees && t.assignees.length ? t.assignees : t.assigned_to ? [t.assigned_to] : []);
const whoChips = (sel = []) => `<div class="who"><span class="sub">Für wen? (nichts gewählt = für alle)</span><div class="chips">${S.profiles.map(p =>
  `<label class="wchip"><input type="checkbox" name="who" value="${p.id}" ${sel.includes(p.id) ? "checked" : ""}><span>${esc(p.name)}</span></label>`).join("")}</div></div>`;

function cardRank() {
  const list = [...S.profiles].map(p => ({ p, n: ptsOf(p) })).sort((a, b) => b.n - a.n);
  return `<div class="card"><h2>🏆 Punktestand</h2><div class="rank">${list.map(({ p, n }) =>
    `<div class="p">${avatar(p)}<b>${n}</b><small>${esc(p.name)}</small></div>`).join("")}</div></div>`;
}

function cardRewards(admin) {
  const adm = !!admin && S.me.is_admin && !isDisplay();
  const by = p => S.rewards.filter(r => r.profile_id === p.id).sort((a, b) => a.points - b.points);
  const people = S.profiles.filter(p => by(p).length);
  if (!people.length && !adm) return "";
  const row = (r, n) => {
    if (adm && S.editReward === r.id) return `<form class="add" data-form="rewardedit" style="margin:6px 0">
      <input id="rwt-${r.id}" name="title" value="${esc(r.title)}" required maxlength="120">
      <input id="rwn-${r.id}" class="pt" name="points" type="number" min="1" max="100000" value="${r.points}" required>
      <button class="btn">OK</button><button type="button" class="btn ghost" data-act="cancelEdit">×</button></form>`;
    const ok = n >= r.points;
    const st = r.claimed ? `<span class="tag">✔ erhalten</span>` : ok ? `<span class="pts">🎉 erreicht</span>` : `<span class="sub">noch ${r.points - n} ⭐</span>`;
    return `<div class="row ${r.claimed ? "done" : ""}"><div class="grow"><div class="t">🎁 ${esc(r.title)}</div><div class="sub">bei ${r.points} ⭐</div></div>${st}
      ${adm && ok && !r.claimed ? `<button class="btn small" data-act="claimReward" data-id="${r.id}">✔ Übergeben</button>` : ""}
      ${adm ? `<button class="x" data-act="editReward" data-id="${r.id}" title="Ändern">✎</button><button class="x" data-act="delReward" data-id="${r.id}" title="Löschen">×</button>` : ""}</div>`;
  };
  const form = adm ? `<form class="add" data-form="reward" style="margin-top:12px">
      <select id="rwp" name="who" required style="max-width:140px"><option value="">Wer?</option>${S.profiles.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>
      <input id="rwx" class="pt" name="points" type="number" min="1" max="100000" placeholder="Punkte" required>
      <input id="rwy" name="title" placeholder="Belohnung, z. B. Eis essen gehen" required maxlength="120">
      <button class="btn">+</button></form>
      <div class="sub" style="margin-top:6px">Wer die Punktezahl erreicht, bekommt die Belohnung. Ein Admin hakt sie mit „Übergeben“ ab.</div>` : "";
  return `<div class="card"><h2>🎁 Belohnungen</h2>
    ${people.map(p => { const n = ptsOf(p);
      return `<div class="rw"><div class="rwh">${avatar(p, 28)}<b>${esc(p.name)}</b><span class="sub">${n} ⭐</span></div>${by(p).map(r => row(r, n)).join("")}</div>`; }).join("") || `<div class="empty">Noch keine Belohnungen festgelegt</div>`}
    ${form}</div>`;
}

function cardTodo(limit) {
  const open = S.tasks.filter(t => !t.done); const done = S.tasks.filter(t => t.done && t.approved).slice(0, 8);
  const wait = S.tasks.filter(t => t.done && !t.approved);
  const adm = !!S.me.is_admin && !isDisplay();
  const shown = limit ? open.slice(0, limit) : open;
  const canEdit = !limit && !isDisplay();
  const row = t => {
    if (canEdit && S.editTask === t.id) return `<div class="row"><form class="grow" data-form="taskedit">
      <input id="tet-${t.id}" name="title" value="${esc(t.title)}" required style="width:100%">
      ${whoChips(whoIds(t))}
      <div class="add" style="margin:6px 0 0"><button class="btn">Speichern</button><button type="button" class="btn ghost" data-act="cancelEdit">Abbrechen</button></div></form></div>`;
    const ids = whoIds(t);
    return `<div class="row ${t.done ? "done" : ""}">
    <button class="chk ${t.done ? "on" : ""}" data-act="toggleTask" data-id="${t.id}">${t.done ? "✓" : ""}</button>
    <div class="grow"><div class="t">${esc(t.title)}</div>
      <div class="sub">${ids.length ? "für " + ids.map(id => esc(prof(id)?.name || "?")).join(", ") : "für alle"}${t.done && t.done_by ? " · erledigt von " + esc(prof(t.done_by)?.name || "?") : ""}${t.done && !t.approved ? " · ⏳ wartet auf Freigabe" : ""}</div></div>
    <span class="pts">${t.points ? t.points + " ⭐" : "ohne Punkte"}</span>
    ${canEdit ? `<button class="x" data-act="editTask" data-id="${t.id}" title="Ändern">✎</button><button class="x" data-act="delTask" data-id="${t.id}">×</button>` : ""}</div>`;
  };
  const form = limit || isDisplay() ? "" : `<form class="add" data-form="task">
      <input id="tt" name="title" placeholder="Neue Aufgabe" required>
      <button class="btn">+</button>
      <div style="flex-basis:100%">${whoChips([])}</div></form>`;
  const waitCard = wait.length ? `<div class="card"><h2>⏳ Wartet auf Freigabe</h2>${wait.map(row).join("")}<div class="sub" style="margin-top:6px">Ein Admin schaut nach, ob alles erledigt ist. Dann gibt es die Punkte.</div></div>` : "";
  return `${limit ? "" : cardRank()}${limit ? "" : cardRewards()}${limit ? "" : cardPoints()}${waitCard}<div class="card"><h2>✅ Gemeinsame Aufgaben</h2>
    ${shown.map(row).join("") || `<div class="empty">Alles erledigt 🎉</div>`}
    ${limit && open.length > limit ? `<div class="sub">… und ${open.length - limit} weitere</div>` : ""}
    ${form}${!limit && !isDisplay() ? `<div class="sub" style="margin-top:8px">Punkte vergibt ein Admin.</div>` : ""}</div>
    ${limit || !done.length ? "" : `<div class="card"><h2>Zuletzt erledigt</h2>${done.map(row).join("")}</div>`}`;
}

function cardShop(compact) {
  const open = S.shop.filter(i => !i.checked); const got = S.shop.filter(i => i.checked);
  const row = i => {
    if (!compact && S.editShop === i.id) return `<div class="row"><form class="add grow" data-form="shopedit" style="margin:0">
      <input id="set-${i.id}" name="title" value="${esc(i.title)}" required>
      <input id="sea-${i.id}" class="pt" name="amount" value="${esc(i.amount || "")}" placeholder="Menge">
      <button class="btn">${i.checked ? "Wieder auf die Liste" : "Speichern"}</button><button type="button" class="btn ghost" data-act="cancelEdit">×</button></form></div>`;
    return `<div class="row ${i.checked ? "done" : ""}">
    <button class="chk ${i.checked ? "on" : ""}" data-act="toggleShop" data-id="${i.id}">${i.checked ? "✓" : ""}</button>
    <div class="grow t">${esc(i.title)}${i.amount ? ` <span class="tag">${esc(i.amount)}</span>` : ""}</div>
    ${compact ? "" : `<button class="x" data-act="editShop" data-id="${i.id}" title="${i.checked ? "Wieder auf die Liste / ändern" : "Ändern"}">✎</button><button class="x" data-act="delShop" data-id="${i.id}">×</button>`}</div>`;
  };
  const list = compact ? open.slice(0, 12) : [...open, ...got];
  return `<div class="card"><h2>🛒 Einkaufsliste ${got.length && !compact ? `<button class="btn small ghost" data-act="clearShop">Erledigte löschen</button>` : ""}</h2>
    ${list.map(row).join("") || `<div class="empty">Die Liste ist leer</div>`}
    ${compact && open.length > 12 ? `<div class="sub">… und ${open.length - 12} weitere</div>` : ""}
    ${compact ? "" : `<form class="add" data-form="shop"><input id="si" name="title" placeholder="Was fehlt?" required>
      <input id="sa" class="pt" name="amount" placeholder="Menge"><button class="btn">+</button></form>`}</div>`;
}

/* Chat wie WhatsApp: Chat-Liste mit zwei Räumen ("family" = eigene Familie, "all" = alle verbundenen Familien),
   Antippen öffnet den Raum mit Sprechblasen. Ohne verbundene Familie gibt es nur einen Raum, der gleich offen ist.
   S.chatRoom: null = Liste, sonst der geöffnete Raum. Kompakt (Startseite) zeigt immer die letzten Nachrichten der eigenen Familie. */
const CHAT_ROOMS = { family: { ic: "👪", title: () => S.family.name || "Familie", sub: "Nur eure Familie" }, all: { ic: "🌍", title: () => "Alle Verbundenen", sub: "Alle verbundenen Familien" } };
const chatSeenKey = r => "chatseen_" + r;
function chatSeen(r) { try { return +localStorage.getItem(chatSeenKey(r)) || 0; } catch (_e) { return 0; } }
function chatMarkSeen(r) { try { localStorage.setItem(chatSeenKey(r), String(Date.now())); } catch (_e) { /* egal */ } }
const roomMsgs = r => S.msgs.filter(m => (m.scope || "family") === r);
function chatDay(d) {
  const k = dkey(d), t = new Date(), y = new Date(Date.now() - 864e5);
  return k === dkey(t) ? "Heute" : k === dkey(y) ? "Gestern" : d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });
}
function chatList() {
  return `<div class="card chatlist"><h2>💬 Chats</h2>${["family", "all"].map(r => {
    const ms = roomMsgs(r), last = ms[ms.length - 1], seen = chatSeen(r);
    const unread = ms.filter(m => m.author !== S.me.id && new Date(m.created_at).getTime() > seen).length;
    const who = last ? (last.author === S.me.id ? "Du" : (wprof(last.author)?.name || "?")) : "";
    return `<button class="crow" data-act="room" data-v="${r}"><span class="cav">${CHAT_ROOMS[r].ic}</span>
      <span class="cmid"><b>${esc(CHAT_ROOMS[r].title())}</b><span class="cprev ${unread ? "un" : ""}">${last ? esc(who) + ": " + esc(last.body) : esc(CHAT_ROOMS[r].sub)}</span></span>
      <span class="cside"><small>${last ? (dkey(new Date(last.created_at)) === dkey(new Date()) ? fmtTime(new Date(last.created_at)) : chatDay(new Date(last.created_at))) : ""}</small>${unread ? `<i class="cbadge">${unread}</i>` : ""}</span></button>`;
  }).join("")}</div>`;
}
function cardChat(compact) {
  const canAll = S.lprof.length > 0;
  if (compact) {
    const shown = roomMsgs("family").slice(-4);
    return `<div class="card"><h2>💬 Nachrichten</h2><div class="chat">
      ${shown.map(m => `<div class="msg ${m.author === S.me.id ? "me" : ""}"><small>${esc(prof(m.author)?.name || "?")} · ${fmtTime(new Date(m.created_at))}</small>${esc(m.body)}</div>`).join("") || `<div class="empty">Noch keine Nachrichten</div>`}
      </div></div>`;
  }
  if (canAll && !S.chatRoom) return chatList();
  const room = canAll && S.chatRoom === "all" ? "all" : "family";
  chatMarkSeen(room);
  const ms = roomMsgs(room);
  let lastDay = "", lastAuthor = "";
  const bubbles = ms.map(m => {
    const d = new Date(m.created_at), day = dkey(d), p = wprof(m.author), me = m.author === S.me.id;
    const sep = day !== lastDay ? `<div class="dsep"><span>${chatDay(d)}</span></div>` : "";
    const head = !me && (day !== lastDay || m.author !== lastAuthor)
      ? `<b class="who" style="color:${esc(p?.color || "inherit")}">${esc(p?.name || "?")}${room === "all" && p?.family_name ? ` <span class="sub">· ${esc(p.family_name)}</span>` : ""}</b>` : "";
    lastDay = day; lastAuthor = m.author;
    const del = S.me.is_admin && m.family_id === S.me.family_id;
    return `${sep}<div class="msg wa ${me ? "me" : ""}">${head}${esc(m.body)}<small class="tm">${fmtTime(d)}</small>${del ? `<button class="mx" data-act="delMsg" data-id="${m.id}" title="Nachricht löschen">×</button>` : ""}</div>`;
  }).join("") || `<div class="empty">Noch keine Nachrichten</div>`;
  return `<div class="chatview"><div class="chathead">${canAll ? `<button class="cback" data-act="room" data-v="list" aria-label="Zurück zu den Chats">‹</button>` : ""}
      <span class="cav">${CHAT_ROOMS[room].ic}</span><span class="cmid"><b>${esc(CHAT_ROOMS[room].title())}</b><small>${esc(CHAT_ROOMS[room].sub)}</small></span></div>
    <div class="chat wachat">${bubbles}</div>
    <form class="add chatbar" data-form="msg"><input id="mi" name="body" placeholder="${room === "all" ? "An alle verbundenen Familien …" : "Nachricht schreiben …"}" autocomplete="off" required><button class="btn">Senden</button></form></div>`;
}

function cardToday() {
  const today = dkey(new Date());
  const ev = allEvents(1).filter(e => dkey(e.start) === today);
  const meal = S.meals.find(m => m.plan_date === today);
  return `<div class="card"><h2>📅 Heute</h2>
    ${ev.map(evRow).join("") || `<div class="empty">Keine Termine heute</div>`}
    <div class="row"><span style="font-size:22px">🍽️</span><div class="grow"><div class="t">${meal ? esc(meal.title) : "Noch kein Essen geplant"}</div></div></div></div>`;
}
/* Mehrtägige Termine: letzter Tag (Ende zählt exklusiv) und Eingabe "bis" */
const evMulti = e => !!(e.end && e.end > e.start && dkey(new Date(+e.end - 1)) > dkey(e.start));
const evUntil = e => (evMulti(e) ? new Date(+e.end - 1).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) : "");
function untilDate(f, starts, allDay) {
  if (f.get("multi") !== "on") return null;
  const u = String(f.get("until") || ""); if (!u || u <= dkey(starts)) return null;
  return new Date(`${u}T${allDay ? "23:59" : f.get("until_time") || "23:59"}`);
}
function evRow(e) {
  const p = prof(e.owner);
  const lp = e.src === "own" && !isDisplay();
  return `<div class="ev${lp ? " lp" : ""}"${lp ? ` data-ev="${e.id}"` : ""}><div class="time">${e.allDay ? "ganztags" : fmtTime(e.start)}</div><span class="dot" style="background:${esc(p?.color || "#999")};margin-top:6px"></span>
    <div class="grow">${esc(e.title)}<div class="sub">${esc(p?.name || "Familie")}${evMulti(e) ? " · bis " + evUntil(e) : ""}</div></div></div>`;
}

/* ---------- Tages-Chef: jeden Tag ist reihum jemand dran (Bild + YouTube-Song) ---------- */
const CHEF_START = Date.UTC(2026, 10, 15); // an diesem Tag ist die erste Person der Reihenfolge dran
function chefFor(d) {
  /* Reihenfolge: erst die in chef_order genannten, dann alle anderen Mitglieder nach Beitritt (gilt so für jede Familie) */
  const ids = S.profiles.map(p => p.id), fo = ((S.family && S.family.chef_order) || []).filter(id => ids.includes(id));
  const o = fo.concat(ids.filter(id => !fo.includes(id))); if (!o.length) return null;
  const days = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - CHEF_START) / 864e5);
  return prof(o[((days % o.length) + o.length) % o.length]) || null;
}
function ytId(s) {
  const m = String(s || "").trim().match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/) || String(s || "").trim().match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : "";
}
const todayPost = () => S.daily.find(p => p.day === dkey(new Date()));
function ensurePhoto(post) {
  if (!post || !post.has_photo || S.dailyPhoto[post.id] !== undefined) return;
  S.dailyPhoto[post.id] = null; // wird geladen
  sb.from("daily_photos").select("data").eq("post_id", post.id).maybeSingle().then(({ data }) => { S.dailyPhoto[post.id] = data ? safePhoto(data.data) : ""; render(); });
}
function cardChef() {
  if (!S.me || isDisplay()) return "";
  const t = new Date(), chef = chefFor(t); if (!chef) return "";
  const n = new Date(t); n.setDate(n.getDate() + 1); const next = chefFor(n);
  const post = todayPost(), mine = chef.id === S.me.id; ensurePhoto(post);
  const ph = post && S.dailyPhoto[post.id];
  const show = post ? `${post.has_photo ? (ph ? `<img class="chefimg" src="${ph}" alt="Bild des Tages" data-act="chefPhotoOpen">` : `<div class="sub">Bild wird geladen …</div>`) : ""}
      ${post.yt_id ? `<div class="chefsong"><img src="https://i.ytimg.com/vi/${post.yt_id}/hqdefault.jpg" alt=""><button class="btn" data-act="ytPlay" data-v="${post.yt_id}">▶ Song des Tages anhören</button></div>` : ""}` : "";
  const form = mine ? `<form data-form="chef" style="margin-top:10px">
      <div class="sub">${post ? "Du kannst dein Bild oder deinen Song noch ändern." : "Du bist heute dran! Stell ein Bild und/oder einen YouTube-Song ein und bekomme <b>5 Punkte</b>."}</div>
      <label class="field"><span>Bild des Tages</span><input id="chefimg" type="file" accept="image/*"></label>
      ${S.chefPhoto ? `<img class="chefimg" src="${S.chefPhoto}" alt="Vorschau">` : ""}
      <label class="field"><span>YouTube-Link (Song des Tages)</span><input id="chefyt" name="yt" placeholder="https://www.youtube.com/watch?v=…" value="${post && post.yt_id ? `https://youtu.be/${post.yt_id}` : ""}"></label>
      <button class="btn block">${post ? "Speichern" : "Einstellen (+5 Punkte)"}</button></form>` : (post ? "" : `<div class="sub">${esc(chef.name)} hat heute noch nichts eingestellt.</div>`);
  return `<div class="card chefcard"><h2>👑 Tages-Chef heute: ${avatar(chef, 30)} ${esc(chef.name)}</h2>${show}${form}
    ${next ? `<div class="sub" style="margin-top:8px">Morgen ist ${esc(next.name)} dran.</div>` : ""}</div>`;
}

/* Stimmung: jeder stellt für sich ein, wie es ihm geht (gilt 24 Stunden) */
function cardMood() {
  if (!S.me || isDisplay()) return "";
  const cur = moodOf(S.me);
  return `<div class="card"><h2>Wie geht’s dir heute?</h2><div class="moods">${Object.entries(MOODS).map(([k, [e, l]]) =>
    `<button class="mbtn${cur === k ? " on" : ""}${k === "help" ? " help" : ""}" data-act="mood" data-v="${k}"><span class="me">${e}</span><span>${l}</span></button>`).join("")}</div>
    <div class="sub" style="margin-top:6px">Alle sehen einen Ring um dein Bild. „Ich möchte reden“ schickt nur den Eltern eine Meldung. Für den Eintrag gibt es 5 ⭐, aber nur einmal pro Tag (um 0 Uhr geht es von vorne los).${cur ? ` <a href="#" data-act="mood" data-v="clear">Zurücksetzen</a>` : ""}</div></div>`;
}
/* Spielhalle: eigene Seite (spielhalle/). Spielpunkte haben nichts mit den Aufgaben-Punkten zu tun. */
function cardArcade() {
  if (isDisplay()) return "";
  const a = S.arc;
  return `<div class="card"><h2>🎮 Spielhalle</h2>
    <p class="sub" style="margin:0 0 8px">${a ? `Deine Spielpunkte: <b>${a.total}</b> ⭐ · diese Woche <b>${a.week}</b>` : "Minispiele und Bestenlisten mit den verbundenen Familien."}</p>
    ${(S.arcBat && S.arcBat.length) ? `<div class="sub" style="margin:0 0 4px"><b>🏆 Familien-Bestenliste (7 Tage)</b></div>${S.arcBat.map((f, i) => `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${["🥇", "🥈", "🥉", "4."][i]} ${esc(f.family_name)}</span><b>${Number(f.pts)} ⭐</b></div>`).join("")}<div style="height:8px"></div>` : ""}
    <a class="btn block" href="spielhalle/" style="display:block;text-align:center;text-decoration:none">Zur Spielhalle</a></div>`;
}
function viewHome() { return cardMood() + cardChef() + cardRank() + cardToday() + cardTodo(5) + cardArcade() + cardShop(true) + cardChat(true); }

/* Ansicht: 7 Tage ab HEUTE (heute steht oben); Wischen oder Pfeile springen 7 Tage vor/zurück */
function weekInfo(off) {
  const from = startOfDay(new Date()); from.setDate(from.getDate() + off * 7);
  const to = new Date(from); to.setDate(to.getDate() + 6); to.setHours(23, 59, 59, 999);
  const th = new Date(from); th.setDate(th.getDate() + 3); // Donnerstag bestimmt die Kalenderwoche
  const jan4 = new Date(th.getFullYear(), 0, 4); const kw = 1 + Math.round(((th - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  const f = d => d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  return { from, to, kw, title: `${f(from)} – ${f(to)}` };
}
function viewCal() {
  const w = weekInfo(S.cw); const map = byDay(allEventsRange(w.from, w.to)); const todayK = dkey(new Date());
  let days = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(w.from); d.setDate(d.getDate() + i); const k = dkey(d); const list = map[k] || [];
    const di = window.dayInfo ? dayInfo(d) : {};
    days += `<div class="day${k === todayK ? " today" : ""}${di.holiday ? " hol" : di.ferien ? " fer" : ""}">${k === todayK ? `<span class="todaybadge">HEUTE</span> ` : ""}${fmtDay(d)}${di.holiday ? " · " + esc(di.holiday) : di.ferien ? " · " + esc(di.ferien) : ""}</div>${list.map(evRow).join("") || `<div class="sub" style="padding:2px 0 6px">–</div>`}`;
  }
  return `<div class="card calweek"><div class="wk"><button class="btn small ghost" data-act="calNav" data-v="-1">‹</button>
      <div class="wkt"><b>${S.cw === 0 ? "Ab heute" : S.cw < 0 ? "Rückblick" : "Vorschau"}</b><span class="sub">${esc(w.title)}</span></div>
      <button class="btn small ghost" data-act="calNav" data-v="1">›</button></div>
    ${S.cw !== 0 ? `<button class="btn small ghost block" data-act="calNav" data-v="0" style="margin-bottom:4px">Zurück zu heute</button>` : ""}
    ${days}
    <div class="sub" style="margin-top:10px;text-align:center">← vor · zurück wischen für Rückblick →${S.events.length ? "<br>Eigenen Termin lange gedrückt halten zum Ändern oder Löschen." : ""}</div></div>
    <div class="card"><h2>Termin eintragen</h2><form data-form="event" class="evf">
      ${evFields("e", { kind: "termin", title: "", date: dkey(new Date()), multi: false, withtime: false, until: "", time: "12:00", until_time: "", rec: "none", birth: "" })}
      <button class="btn block">Speichern</button></form>
      <p class="sub">Eigene Google- oder iCloud-Kalender hängst du unter „Familie“ an.</p></div>`;
}

const safeUrl = u => (/^https?:\/\//i.test(u || "") ? u : "");

function viewMeals() {
  const today = startOfDay(new Date());
  const planned = S.meals.filter(m => m.plan_date && new Date(m.plan_date + "T00:00") >= today);
  const wishes = S.meals.filter(m => !m.plan_date);
  const card = m => { const w = prof(m.wished_by);
    if (S.editMeal === m.id) return `<div class="card"><h2>✎ Gericht ändern</h2><form data-form="mealedit">
      <label class="field"><span>Gericht</span><input id="met-${m.id}" name="title" value="${esc(m.title)}" required></label>
      <label class="field"><span>Datum (leer lassen = nur Wunsch)</span><input id="med-${m.id}" name="date" type="date" value="${esc(m.plan_date || "")}"></label>
      <label class="field"><span>Neues Foto (leer lassen = Foto behalten)</span><input name="img" type="file" accept="image/*"></label>
      <label class="field"><span>Link zum Rezept</span><input id="mes-${m.id}" name="source_url" type="url" value="${esc(m.source_url || "")}"></label>
      <label class="field"><span>Zutaten (eine pro Zeile)</span><textarea id="mez-${m.id}" name="ingredients">${esc(m.ingredients || "")}</textarea></label>
      <label class="field"><span>Rezept</span><textarea id="mer-${m.id}" name="recipe">${esc(m.recipe || "")}</textarea></label>
      <div class="add" style="margin:0"><button class="btn">Speichern</button><button type="button" class="btn ghost" data-act="cancelEdit">Abbrechen</button></div></form></div>`;
    const ings = (m.ingredients || "").split("\n").map(x => x.trim()).filter(Boolean);
    const link = safeUrl(m.source_url);
    return `<div class="card"><div class="meal">${m.image_url ? `<img src="${esc(m.image_url)}" alt="" referrerpolicy="no-referrer">` : `<div class="ph">🍲</div>`}
      <div class="grow"><b>${esc(m.title)}</b><div class="sub">${m.plan_date ? fmtDay(new Date(m.plan_date + "T00:00")) : "Wunsch"}${w ? " · von " + esc(w.name) : ""}</div>
      ${link ? `<a class="lnk" href="${esc(link)}" target="_blank" rel="noopener">🔗 Rezept ansehen</a>` : ""}
      ${m.plan_date ? "" : `<div class="add" style="margin-top:6px"><input id="pd-${m.id}" type="date" style="max-width:150px"><button class="btn small" data-act="planMeal" data-id="${m.id}">Einplanen</button></div>`}</div>
      <button class="x" data-act="editMeal" data-id="${m.id}" title="Ändern">✎</button><button class="x" data-act="delMeal" data-id="${m.id}">×</button></div>
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

/* Wunschliste: jeder sieht die Wünsche der anderen und kann "gekauft" abhaken.
   Der Wünschende sieht den Haken NICHT (das erzwingt die Datenbank, nicht nur die Anzeige). */
const OCC = ["Geburtstag", "Weihnachten", "Sonstiges"], OCC_IC = { Geburtstag: "🎂", Weihnachten: "🎄", Sonstiges: "🎁" };
const wishUrl = u => { try { const t = String(u).trim(); if (/\s/.test(t)) return ""; const x = new URL(t); return (x.protocol === "https:" || x.protocol === "http:") && x.hostname.includes(".") ? x.toString() : ""; } catch (_) { return ""; } };
const wprof = id => prof(id) || S.lprof.find(x => x.id === id);
function wishRow(w, mine) {
  const mk = S.marks.find(m => m.wish_id === w.id), by = mk && wprof(mk.by_profile), u = wishUrl(w.url);
  const own = w.family_id === S.me.family_id, can = mine || (S.me.is_admin && own);
  const status = mine ? "" : mk
    ? `<span class="tag">✔ gekauft${by ? " von " + esc(by.name) : ""}</span>${mk.by_profile === S.me.id || (S.me.is_admin && prof(mk.by_profile)) ? `<button class="x" data-act="unbuy" data-id="${w.id}" title="Haken entfernen">↺</button>` : ""}`
    : `<button class="btn small" data-act="buy" data-id="${w.id}">✔ Gekauft</button>`;
  return `<div class="row ${mk ? "done" : ""}"><div class="grow"><div class="t">${OCC_IC[w.occasion] || "🎁"} ${esc(w.title)}${w.price ? ` <span class="sub">· ${esc(w.price)}</span>` : ""}</div>
    ${u ? `<div class="sub"><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">🔗 Link öffnen</a></div>` : ""}
    ${w.note ? `<div class="sub">${esc(w.note)}</div>` : ""}</div>${status}
    ${can ? `<button class="x" data-act="delWish" data-id="${w.id}" title="Wunsch löschen">×</button>` : ""}</div>`;
}
function viewWishes() {
  const mine = S.wishes.filter(w => w.owner === S.me.id);
  const others = S.profiles.filter(p => p.id !== S.me.id);
  const form = `<form class="add" data-form="wish" style="flex-wrap:wrap">
    <input id="wt" name="title" placeholder="Was wünschst du dir?" required maxlength="120">
    <input id="wu" name="url" placeholder="Link (optional)" maxlength="600" inputmode="url">
    <input id="wp" class="pt" name="price" placeholder="Preis" maxlength="30" style="max-width:90px">
    <select id="wo" name="occasion" aria-label="Anlass">${OCC.map(o => `<option>${o}</option>`).join("")}</select>
    ${S.me.is_admin ? `<select id="wf" name="owner" aria-label="Für wen"><option value="">für mich</option>${others.map(p => `<option value="${p.id}">für ${esc(p.name)}</option>`).join("")}</select>` : ""}
    <input id="wn" name="note" placeholder="Notiz (Größe, Farbe …)" maxlength="300">
    <button class="btn">Wunsch speichern</button></form>`;
  return `<div class="card"><h2>🎁 Meine Wünsche</h2>${form}
    ${mine.map(w => wishRow(w, true)).join("") || `<div class="empty">Noch keine Wünsche eingetragen</div>`}
    <div class="sub" style="margin-top:6px">Die anderen sehen deine Wünsche und haken ab, was gekauft ist. Du siehst diese Haken nicht – so bleibt es eine Überraschung. 🤫</div></div>
    ${others.map(p => { const l = S.wishes.filter(w => w.owner === p.id); return `<div class="card"><h2>${esc(p.name)}</h2>${l.map(w => wishRow(w, false)).join("") || `<div class="empty">Noch keine Wünsche</div>`}</div>`; }).join("")}
    ${S.lprof.map(p => { const l = S.wishes.filter(w => w.owner === p.id); return `<div class="card"><h2>${esc(p.name)} <span class="sub">· ${esc(p.family_name)}</span></h2>${l.map(w => wishRow(w, false)).join("") || `<div class="empty">Noch keine Wünsche</div>`}</div>`; }).join("")}`;
}

function cardLink(admin) {
  const adm = !!admin && S.me.is_admin, code = String(S.family.link_code || ""), nice = code.slice(0, 5) + "-" + code.slice(5);
  const names = [...new Set(S.lprof.map(p => p.family_id))].map(id => ({ id, name: (S.lprof.find(p => p.family_id === id) || {}).family_name }));
  return `<div class="card"><h2>🔗 Mit anderen Familien verbinden</h2>
    <p class="sub">Verbundene Familien sehen gegenseitig ihre Wunschlisten und können „Gekauft“ abhaken, schreiben im Chat-Raum „Alle Verbundenen“ miteinander, vergeben Jobs und spielen in der Spielhalle gegeneinander. Kalender, Aufgaben, Einkauf und der Familien-Chat bleiben privat.</p>
    ${names.map(f => `<div class="row"><div class="grow"><div class="t">${esc(f.name)}</div><div class="sub">verbunden</div></div>${adm ? `<button class="btn small ghost" data-act="unlink" data-id="${f.id}">Trennen</button>` : ""}</div>`).join("") || `<div class="empty">Noch mit keiner Familie verbunden</div>`}
    ${adm ? `<div class="sub" style="margin-top:10px">Euer Verbindungs-Code (den gebt ihr der anderen Familie):</div>
    <div style="font-size:24px;font-weight:700;letter-spacing:.1em;margin:4px 0 6px">${esc(nice)}</div>
    <button class="btn small ghost" data-act="newCode">Neuen Code erzeugen</button>
    <div class="sub" style="margin-top:12px">Code einer anderen Familie eingeben:</div>
    <form class="add" data-form="link" style="margin-top:4px"><input id="lc" name="code" placeholder="XXXXX-XXXXX" maxlength="14" autocomplete="off" required><button class="btn">Verbinden</button></form>` : ""}</div>`;
}

function viewFamily() {
  const p = S.pe;
  return `<div class="card"><h2>Familie</h2>
    <div style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(S.family.name)}</div>
    <div class="sub">Einladungscode zum Beitreten:</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:.1em;margin:4px 0 10px">${esc(S.family.invite_code)}</div>
    ${S.profiles.map(x => `<div class="row">${avatar(x)}<div class="grow">${esc(x.name)}${x.is_admin ? ` <span class="tag">Admin</span>` : ""}<div class="sub">${x.ical_url ? "Kalender verbunden" : "kein Kalender"}</div></div></div>`).join("")}
    <p class="sub">Admins verwalten Punkte, Belohnungen und Einstellungen unter dem ⚙️ oben rechts.</p></div>
    ${cardLink(false)}
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
    <div class="card"><h2>🔑 Passwort ändern</h2><form data-form="changepw"><label class="field"><span>Neues Passwort (mind. 6 Zeichen)</span><input name="password" type="password" autocomplete="new-password" minlength="6" required></label><button class="btn block">Passwort ändern</button></form></div>
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

/* Alexa-Skill: Einkaufsliste per Sprache */
function alexaCard() {
  const n = S.alexaN || 0;
  return `<p class="sub">Mit dem Alexa-Skill „Familien Planer“ setzen alle per Sprache Artikel auf die Einkaufsliste: „Alexa, sag Familien Planer, setze Kaffee auf die Einkaufsliste.“</p>
    <p class="sub"><b>Alexa koppeln:</b> „Alexa, öffne Familien Planer“ sagen, Alexa nennt einen Code, der hier eingegeben wird.</p>
    <form class="add" data-form="alexapair" style="margin:6px 0 10px"><input name="code" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="Code von Alexa, z. B. 123 456" required aria-label="Code von Alexa"><button class="btn">Koppeln</button></form>
    <p class="sub">${n ? `${n} Alexa-Gerät${n > 1 ? "e" : ""} gekoppelt.` : "Noch kein Alexa-Gerät gekoppelt."}</p>
    ${n ? `<button class="btn small ghost" data-act="alexaOff">Alle Alexa-Geräte abmelden</button>` : ""}`;
}
async function alexaLoad() { try { const { data } = await sb.rpc("alexa_count"); S.alexaN = data || 0; } catch (_) {} }

const ACT = {
  async alexaOff() { if (confirm("Alle Alexa-Geräte abmelden? Sie müssen danach neu gekoppelt werden.")) { await q(sb.rpc("alexa_unlink_all")); S.alexaN = 0; render(); } },
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
  forgotPw() { S.authMode = "forgot"; S.err = ""; S.info = ""; render(); },
  backLogin() { S.authMode = "login"; S.err = ""; S.info = ""; render(); },
  async switchAuth() { S.authMode = S.authMode === "login" ? "signup" : "login"; S.err = ""; render(); },
  async logout() { await sb.auth.signOut(); },
  tab(d) { if (d.v === "chat" && S.tab !== "chat") S.chatRoom = null; S.tab = d.v; render(); window.scrollTo(0, 0); },
  room(d) { S.chatRoom = d.v === "all" ? "all" : d.v === "family" ? "family" : null; render(); window.scrollTo(0, S.chatRoom ? document.body.scrollHeight : 0); },
  obMode(d) { S.ob.mode = d.v; render(); },
  ob(d) { S.ob[d.k] = d.v; render(); },
  pe(d) { S.pe[d.k] = d.v; render(); },
  exitBoard() { location.hash = ""; },
  bNav(d) { S.bo = +d.v === 0 ? 0 : S.bo + +d.v; render(); },
  bView(d) { S.bv = d.v; S.bo = 0; render(); },
  async toggleTask(d) {
    const t = S.tasks.find(x => x.id === d.id); const done = !t.done;
    if (!S.me.is_admin && t.approved) return toast("Freigegebene Aufgaben kann nur ein Admin zurücknehmen");
    await q(sb.from("tasks").update({ done }).eq("id", d.id)); // Datenbank setzt Erledigt-von und Freigabe
    await LOAD.tasks(); render();
    if (done) toast(S.me.is_admin ? (t.points ? `+${t.points} Punkte für ${S.me.name} ⭐` : "Erledigt ✔") : "Erledigt – ein Admin muss noch die Punkte freigeben ⏳");
  },
  meetOpen(d) { S.mtView = d.id; render(); },
  meetNew() { S.mtView = "new"; S.mtSel = []; render(); },
  meetClose() { S.mtView = null; render(); },
  meetPick(d) { const i = S.mtSel.indexOf(d.id); if (i >= 0) S.mtSel.splice(i, 1); else S.mtSel.push(d.id); render(); },
  async meetAnswer(d) { await q(sb.rpc("answer_meetup", { p_id: d.id, p_profile: d.p, p_yes: d.v === "1" })); await Promise.all([LOAD.meetups(), LOAD.events()]); render(); toast(d.v === "1" ? "Zusage gespeichert – steht jetzt im Kalender 📅" : "Absage gespeichert"); },
  async meetFinish(d) { const mm = S.meetups.find(x => x.id === d.id); if (mm && new Date(mm.starts_at) > new Date()) return toast("Erst ab Beginn des Treffens möglich"); if (!confirm("Hat das Treffen stattgefunden? Alle mit Zusage bekommen die Punkte.")) return; const n = await q(sb.rpc("finish_meetup", { p_id: d.id })); S.mtView = null; await Promise.all([LOAD.meetups(), LOAD.point_log()]); render(); toast(`Punkte vergeben an ${n} Teilnehmer ⭐`); },
  async meetCancel(d) { if (!confirm("Treffen wirklich absagen? Alle Eingeladenen bekommen eine Meldung.")) return; await q(sb.rpc("cancel_meetup", { p_id: d.id })); S.mtView = null; await Promise.all([LOAD.meetups(), LOAD.events()]); render(); toast("Treffen abgesagt"); },
  jobPick(d) { const i = S.jobSel.indexOf(d.id); if (i >= 0) S.jobSel.splice(i, 1); else S.jobSel.push(d.id); render(); },
  async reopenTask(d) {
    if (!S.me.is_admin) return;
    const t = S.tasks.find(x => x.id === d.id);
    await q(sb.from("tasks").update({ done: false }).eq("id", d.id)); // Datenbank nimmt Erledigt-von, Freigabe und evtl. Punkte zurück
    await LOAD.tasks(); render();
    toast(`„${t?.title || "Aufgabe"}“ ist wieder offen ↩`);
  },
  async approveTask(d) {
    if (!S.me.is_admin) return;
    const t = S.tasks.find(x => x.id === d.id);
    await q(sb.from("tasks").update({ approved: true }).eq("id", d.id));
    await LOAD.tasks(); render();
    toast(`Freigegeben: +${t?.points || 0} Punkte für ${esc(prof(t?.done_by)?.name || "?")} ⭐`);
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
  async buy(d) { const w = S.wishes.find(x => x.id === d.id); if (!w) return; await q(sb.from("wish_marks").insert({ wish_id: d.id, family_id: w.family_id, by_profile: S.me.id })); await LOAD.wish_marks(); render(); },
  async unbuy(d) { await q(sb.from("wish_marks").delete().eq("wish_id", d.id)); await LOAD.wish_marks(); render(); },
  async delWish(d) { if (!confirm("Wunsch wirklich löschen?")) return; await q(sb.from("wishes").delete().eq("id", d.id)); await LOAD.wishes(); render(); },
  async unlink(d) {
    const f = S.lprof.find(p => p.family_id === d.id);
    if (!confirm(`Verbindung mit „${f ? f.family_name : "dieser Familie"}“ wirklich trennen? Die Wunschlisten sind dann nicht mehr gegenseitig sichtbar.`)) return;
    await q(sb.rpc("unlink_family", { p_fam: d.id })); await LOAD.family_links(); render();
  },
  async newCode() {
    if (!confirm("Neuen Code erzeugen? Der alte Code funktioniert danach nicht mehr (bestehende Verbindungen bleiben).")) return;
    S.family.link_code = await q(sb.rpc("new_link_code")); render();
  },
  async jobAnswer(d) { await q(sb.rpc("answer_job", { p_id: d.id, p_accept: d.v === "1" })); await LOAD.jobs(); render(); toast(d.v === "1" ? "Job angenommen ✔" : "Job abgelehnt"); },
  async jobDone(d) { await q(sb.rpc("finish_job", { p_id: d.id })); await LOAD.jobs(); render(); toast("Als erledigt gemeldet ✔"); },
  async jobPay(d) { await q(sb.rpc("pay_job", { p_id: d.id })); await LOAD.jobs(); render(); toast("Bestätigt – Punkte gutgeschrieben ⭐"); },
  async jobReopen(d) { await q(sb.rpc("reopen_job", { p_id: d.id })); await LOAD.jobs(); render(); },
  async jobCancel(d) { if (!confirm("Job wirklich zurückziehen?")) return; await q(sb.rpc("cancel_job", { p_id: d.id })); await LOAD.jobs(); render(); },
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
  editTask(d) { S.editTask = d.id; render(); },
  editShop(d) { S.editShop = d.id; render(); },
  editMeal(d) { S.editMeal = d.id; render(); },
  editReward(d) { S.editReward = d.id; render(); },
  cancelEdit() { S.editTask = S.editShop = S.editMeal = S.editReward = null; render(); },
  async claimReward(d) {
    const r = S.rewards.find(x => x.id === d.id); if (!r || r.claimed || !S.me.is_admin) return;
    const who = prof(r.profile_id); const bal = ptsOf(who || { id: r.profile_id });
    if (bal < r.points) return toast("Noch nicht genug Punkte");
    if (!confirm(`„${r.title}“ übergeben? Dafür werden ${r.points} Punkte von ${who?.name || "?"} abgezogen.`)) return;
    await q(sb.from("point_log").insert({ family_id: S.me.family_id, profile_id: r.profile_id, points: -r.points, kind: "reward", reason: r.title, created_by: S.me.id }));
    await q(sb.from("rewards").update({ claimed: true, claimed_at: new Date().toISOString() }).eq("id", d.id));
    await Promise.all([LOAD.point_log(), LOAD.rewards()]); render(); toast(`Übergeben ✔ (−${r.points} Punkte)`);
  },
  async backupDownload() {
    if (!S.me.is_admin) return;
    toast("Sicherung wird erstellt …");
    const dump = { created_at: new Date().toISOString(), note: "Familienplaner Sicherung", tables: {} };
    for (const t of ["profiles", "tasks", "shopping_items", "events", "meals", "messages", "rewards", "point_log"]) dump.tables[t] = await q(sb.from(t).select("*").limit(20000));
    const blob = new Blob([JSON.stringify(dump)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `familienplaner-sicherung-${dkey(new Date())}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast("Sicherung gespeichert ✔");
  },
  chefPhotoOpen() {
    const p = todayPost(), src = p && S.dailyPhoto[p.id]; if (!src) return;
    const el = document.createElement("div"); el.className = "overlay-img"; el.innerHTML = `<img src="${src}" alt="">`; el.onclick = () => el.remove(); document.body.appendChild(el);
  },
  ytPlay(d) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(d.v)) return;
    const el = document.createElement("div"); el.className = "overlay-img yt";
    el.innerHTML = `<div class="ytbox"><iframe src="https://www.youtube-nocookie.com/embed/${d.v}?autoplay=1&rel=0&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><button class="btn">Schließen</button></div>`;
    el.onclick = e => { if (e.target === el || e.target.closest("button")) el.remove(); }; document.body.appendChild(el);
  },
  async mood(d) {
    const v = d.v === "clear" ? null : d.v; if (v && !MOODS[v]) return;
    if (v === "help" && !confirm("Die Eltern bekommen eine Meldung, dass du reden möchtest. Okay?")) return;
    const before = prof(S.me.id)?.mood_points_at || null;
    await q(sb.from("profiles").update({ mood: v, mood_at: v ? new Date().toISOString() : null }).eq("id", S.me.id));
    await Promise.all([LOAD.profiles(), LOAD.point_log()]);
    const got = (prof(S.me.id)?.mood_points_at || null) !== before; /* Punkte vergibt die Datenbank: 5 ⭐ höchstens 1x in 24 Std. */
    render(); toast(v === "help" ? "Die Eltern wissen Bescheid 💛" : v ? (got ? "Gespeichert · +5 Punkte ⭐" : "Gespeichert") : "Zurückgesetzt");
  },
  async delPointLog(d) { if (S.me.is_admin) { await q(sb.from("point_log").update({ hidden: true }).eq("id", d.id)); await LOAD.point_log(); render(); toast("Ausgeblendet – Punkte bleiben"); } },
  async delReward(d) { if (confirm("Belohnung wirklich löschen?")) await q(sb.from("rewards").delete().eq("id", d.id)); },
  async delTask(d) { await q(sb.from("tasks").delete().eq("id", d.id)); },
  async toggleShop(d) { const i = S.shop.find(x => x.id === d.id); i.checked = !i.checked; render(); await q(sb.from("shopping_items").update({ checked: i.checked }).eq("id", d.id)); },
  async delShop(d) { await q(sb.from("shopping_items").delete().eq("id", d.id)); },
  async clearShop() { await q(sb.from("shopping_items").delete().eq("checked", true)); },
  async delEvent(d) {
    const e = S.events.find(x => x.id === d.id);
    const rep = e && e.recurrence && e.recurrence !== "none";
    if (!confirm(rep ? "Dieser Termin wiederholt sich. Alle Wiederholungen löschen?" : "Termin wirklich löschen?")) return;
    S.editEv = null;
    await q(sb.from("events").delete().eq("id", d.id));
    await LOAD.events(); render();
  },
  calNav(d) { S.cw = +d.v === 0 ? 0 : S.cw + +d.v; render(); window.scrollTo(0, 0); },
  cancelEvEdit() { S.editEv = null; render(); },
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
  async alexapair(f) {
    await q(sb.rpc("alexa_pair", { p_code: String(f.get("code") || "") }));
    await alexaLoad(); toast("Alexa gekoppelt ✔"); render();
  },
  async wallpair(f) {
    await q(sb.rpc("wall_pair", { p_code: String(f.get("code") || "") }));
    S.family = await q(sb.from("families").select("*").eq("id", S.family.id).single());
    toast("Display gekoppelt ✔"); render();
  },
  async forgot(f) {
    S.err = ""; S.info = "";
    const { error } = await sb.auth.resetPasswordForEmail(String(f.get("email") || "").trim(), { redirectTo: location.origin + location.pathname.replace(/[^/]*$/, "") });
    if (error) S.err = error.message; else S.info = "Fertig. Wenn die Adresse bekannt ist, kommt in ein paar Minuten eine E-Mail (auch im Spam-Ordner nachsehen).";
    render();
  },
  async newpw(f) {
    S.err = "";
    const { error } = await sb.auth.updateUser({ password: String(f.get("password") || "") });
    if (error) { S.err = error.message; return render(); }
    S.recovery = false; history.replaceState(null, "", location.pathname); toast("Neues Passwort gespeichert ✔");
    if (S.user && !S.me) await loadAll(); else render();
  },
  async changepw(f) {
    const pw = String(f.get("password") || "");
    const { error } = await sb.auth.updateUser({ password: pw });
    toast(error ? error.message : "Passwort geändert ✔");
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
    await q(sb.from("tasks").insert({ family_id: S.me.family_id, title: f.get("title"), points: S.me.is_admin ? Math.max(0, Math.min(1000, parseInt(f.get("points"), 10) || 0)) : 0, assignees: f.getAll("who"), assigned_to: f.getAll("who").length === 1 ? f.getAll("who")[0] : null }));
  },
  async taskedit(f) {
    const ids = f.getAll("who"); const title = (f.get("title") || "").trim(); if (!title) return;
    const patch = { title, assignees: ids, assigned_to: ids.length === 1 ? ids[0] : null };
    if (S.me.is_admin && f.get("points") !== null) patch.points = Math.max(0, Math.min(1000, parseInt(f.get("points"), 10) || 0));
    await q(sb.from("tasks").update(patch).eq("id", S.editTask));
    S.editTask = null; await LOAD.tasks(); render();
  },
  async shopedit(f) {
    const title = (f.get("title") || "").trim(); if (!title) return;
    const i = S.shop.find(x => x.id === S.editShop);
    const patch = { title, amount: (f.get("amount") || "").trim() || null };
    if (i && i.checked) patch.checked = false; // abgehakt -> wieder auf die Liste, mit neuer Menge
    await q(sb.from("shopping_items").update(patch).eq("id", S.editShop));
    S.editShop = null; await LOAD.shopping_items(); render();
  },
  async mealedit(f) {
    const title = (f.get("title") || "").trim(); if (!title) return;
    const patch = { title, plan_date: f.get("date") || null, source_url: f.get("source_url") || null, ingredients: f.get("ingredients") || null, recipe: f.get("recipe") || null };
    const file = f.get("img");
    if (file && file.size) {
      const blob = await shrink(file);
      const path = `${S.me.family_id}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from("meal-images").upload(path, blob, { contentType: "image/jpeg" });
      if (error) return toast("Bild-Upload fehlgeschlagen: " + error.message);
      patch.image_url = sb.storage.from("meal-images").getPublicUrl(path).data.publicUrl;
    }
    await q(sb.from("meals").update(patch).eq("id", S.editMeal));
    S.editMeal = null; await LOAD.meals(); render();
  },
  async chef(f) {
    const yt = ytId(f.get("yt")), raw = (f.get("yt") || "").trim();
    if (raw && !yt) return toast("Das ist kein gültiger YouTube-Link");
    if (!S.chefPhoto && !yt) return toast("Bitte ein Bild oder einen YouTube-Link angeben");
    const { data, error } = await sb.rpc("post_daily", { p_photo: S.chefPhoto || null, p_yt: yt || null });
    if (error) return toast(error.message);
    S.chefPhoto = null; S.dailyPhoto = {};
    await Promise.all([LOAD.daily_posts(), LOAD.point_log()]); render();
    toast(data && data.points ? `Eingestellt – +${data.points} Punkte 🎉` : "Gespeichert");
  },
  async pointadj(f) {
    const n = parseInt(f.get("points"), 10); if (!f.get("who") || !(n >= 1)) return toast("Bitte Mitglied und Punkte angeben");
    const minus = f.get("op") !== "+"; const who = prof(f.get("who"));
    if (minus && !confirm(`${n} Punkte von ${who?.name || "?"} abziehen?`)) return;
    await q(sb.from("point_log").insert({ family_id: S.me.family_id, profile_id: f.get("who"), points: minus ? -n : n, kind: "manual", reason: (f.get("reason") || "").trim() || (minus ? "Punkte abgezogen" : "Punkte gutgeschrieben"), created_by: S.me.id }));
    await LOAD.point_log(); render(); toast(minus ? `−${n} Punkte` : `+${n} Punkte`);
  },
  async reward(f) {
    const points = parseInt(f.get("points"), 10); const title = (f.get("title") || "").trim();
    if (!f.get("who") || !title || !(points >= 1)) return toast("Bitte Mitglied, Punkte und Belohnung ausfüllen");
    await q(sb.from("rewards").insert({ family_id: S.me.family_id, profile_id: f.get("who"), points, title }));
    await LOAD.rewards(); render();
  },
  async rewardedit(f) {
    const points = parseInt(f.get("points"), 10); const title = (f.get("title") || "").trim();
    if (!title || !(points >= 1)) return;
    await q(sb.from("rewards").update({ title, points }).eq("id", S.editReward));
    S.editReward = null; await LOAD.rewards(); render();
  },
  async shop(f) { await q(sb.from("shopping_items").insert({ family_id: S.me.family_id, title: f.get("title"), amount: f.get("amount") || null })); },
  async wish(f) {
    const title = String(f.get("title") || "").trim(); if (!title) return;
    const raw = String(f.get("url") || "").trim(), url = raw ? wishUrl(/^https?:\/\//i.test(raw) ? raw : "https://" + raw) : "";
    if (raw && !url) return toast("Der Link sieht nicht richtig aus");
    const owner = S.me.is_admin && f.get("owner") ? f.get("owner") : S.me.id;
    await q(sb.from("wishes").insert({ family_id: S.me.family_id, owner, title, url: url || null, price: String(f.get("price") || "").trim() || null, note: String(f.get("note") || "").trim() || null, occasion: OCC.includes(f.get("occasion")) ? f.get("occasion") : "Sonstiges" }));
    await LOAD.wishes(); render(); toast("Wunsch gespeichert 🎁");
  },
  async link(f) {
    try { const n = await q(sb.rpc("link_family", { p_code: String(f.get("code") || "") })); await LOAD.family_links(); render(); toast(`Verbunden mit „${n}“ ✔`); }
    catch (_) { /* q() hat die Meldung schon gezeigt */ }
  },
  async admintask(f) {
    const title = String(f.get("title") || "").trim(); if (!title) return;
    const who = f.getAll("who");
    await q(sb.from("tasks").insert({ family_id: S.me.family_id, title, points: Math.max(0, Math.min(1000, parseInt(f.get("points"), 10) || 0)), assignees: who, assigned_to: who.length === 1 ? who[0] : null }));
    toast("Aufgabe angelegt ✔");
  },
  async meetup(f) {
    if (!S.mtSel.length) return toast("Bitte erst Teilnehmer antippen 👆");
    const starts = new Date(`${f.get("date")}T${f.get("time") || "15:00"}`);
    await q(sb.rpc("create_meetup", { p_to: S.mtSel, p_title: String(f.get("title") || ""), p_place: String(f.get("place") || ""), p_note: "", p_starts: starts.toISOString() }));
    S.mtSel = []; S.mtView = null; await Promise.all([LOAD.meetups(), LOAD.events()]); render(); toast("Treffen angelegt – die Eingeladenen bekommen eine Meldung 🤝");
  },
  async job(f) {
    const to = S.jobSel.filter(id => S.lprof.some(p => p.id === id));
    if (!to.length) return toast("Bitte erst mindestens ein Mitglied antippen 👆");
    await q(sb.rpc("create_jobs", { p_to: to, p_title: String(f.get("title") || ""), p_note: String(f.get("note") || ""), p_points: Math.max(0, Math.min(20, parseInt(f.get("points"), 10) || 0)) }));
    S.jobSel = [];
    await LOAD.jobs(); render(); toast(to.length > 1 ? `${to.length} Jobs vergeben – die Eltern der Empfänger müssen sie annehmen 💼` : "Job vergeben – die Eltern des Empfängers müssen ihn annehmen 💼");
  },
  async msg(f) { await q(sb.from("messages").insert({ family_id: S.me.family_id, author: S.me.id, body: f.get("body"), scope: S.chatRoom === "all" && S.lprof.length ? "all" : "family" })); },
  async event(f) {
    const bd = f.get("kind") === "geburtstag", allDay = bd || f.get("withtime") !== "on";
    const starts = new Date(`${f.get("date")}T${allDay ? "12:00" : f.get("time") || "12:00"}`);
    const until = bd ? null : untilDate(f, starts, allDay);
    if (!bd && f.get("multi") === "on" && !until) return toast("Bitte den letzten Tag eintragen (er muss nach dem ersten liegen)");
    await q(sb.from("events").insert({ family_id: S.me.family_id, title: f.get("title"), starts_at: starts.toISOString(), ends_at: until ? until.toISOString() : null, owner: S.me.id, all_day: allDay, birth_year: bd ? parseBirth(f.get("birth_year")) : null, recurrence: bd ? "yearly" : ["weekly", "monthly", "yearly"].includes(f.get("recurrence")) ? f.get("recurrence") : "none" }));
  },
  async eventedit(f) {
    const e = S.events.find(x => x.id === S.editEv); if (!e) return;
    const title = (f.get("title") || "").trim(); if (!title) return;
    const bd = f.get("kind") === "geburtstag", allDay = bd || f.get("withtime") !== "on";
    const starts = new Date(`${f.get("date")}T${allDay ? "12:00" : f.get("time") || "12:00"}`);
    const wasMulti = !!(e.ends_at && dkey(new Date(+new Date(e.ends_at) - 1)) > dkey(new Date(e.starts_at)));
    const len = e.ends_at && !wasMulti ? new Date(e.ends_at) - new Date(e.starts_at) : null;
    const until = bd ? null : untilDate(f, starts, allDay);
    if (!bd && f.get("multi") === "on" && !until) return toast("Bitte den letzten Tag eintragen (er muss nach dem ersten liegen)");
    const patch = { title, all_day: allDay, birth_year: bd ? parseBirth(f.get("birth_year")) : null, starts_at: starts.toISOString(), recurrence: bd ? "yearly" : ["weekly", "monthly", "yearly"].includes(f.get("recurrence")) ? f.get("recurrence") : "none" };
    if (bd) patch.ends_at = null;
    else if (until) patch.ends_at = until.toISOString();
    else if (wasMulti) patch.ends_at = null;
    else if (len !== null) patch.ends_at = new Date(+starts + len).toISOString();
    await q(sb.from("events").update(patch).eq("id", S.editEv));
    S.editEv = null; await LOAD.events(); render();
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
/* Termin lange gedrückt halten = ändern oder löschen */
let lpTimer = null;
const lpStop = () => { clearTimeout(lpTimer); lpTimer = null; };
document.addEventListener("pointerdown", e => {
  const el = e.target.closest && e.target.closest("[data-ev]"); if (!el) return;
  lpStop();
  lpTimer = setTimeout(() => { lpTimer = null; S.editEv = el.dataset.ev; if (navigator.vibrate) try { navigator.vibrate(30); } catch (_) {} render(); }, 600);
});
["pointerup", "pointercancel", "pointerleave", "scroll", "touchmove"].forEach(t => document.addEventListener(t, lpStop, true));
document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest("[data-ev]")) e.preventDefault(); });
/* Versteckt: 5x schnell auf die Überschrift "Punktestand" tippen -> Gipfelstürmer-Pyramide */
const pyrTap = pyrTrigger(() => showPyramid(S.profiles.map(p => ({ name: p.name, color: p.color, avatar: p.avatar, photo: safePhoto(p.photo), points: ptsOf(p) }))));
document.addEventListener("click", e => { const h = e.target.closest && e.target.closest("h2"); if (h && h.textContent.includes("Punktestand")) pyrTap(); });
/* Wischen im Kalender: links = nächste Woche, rechts = vorherige */
let sw = null;
document.addEventListener("touchstart", e => { const el = e.target.closest && e.target.closest(".calweek"); sw = el && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
document.addEventListener("touchend", e => {
  if (!sw) return; const t = e.changedTouches[0]; const dx = t.clientX - sw.x, dy = t.clientY - sw.y; sw = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) ACT.calNav({ v: dx < 0 ? 1 : -1 });
}, { passive: true });
window.addEventListener("hashchange", render);
document.addEventListener("toggle", e => { const d = e.target; if (d.matches && d.matches("details.recipe")) S.open[d.dataset.id] = d.open; }, true);
document.addEventListener("change", async e => {
  const c = e.target;
  if (c.name === "allday" && c.form) { const t = c.form.querySelector('input[name="time"]'); if (t) t.disabled = c.checked; }
  if (c.dataset && c.dataset.meal) S.uncheck[c.dataset.meal + ":" + c.dataset.i] = !c.checked;
  if (c.id === "chefimg" && c.files && c.files[0]) {
    try { S.chefPhoto = await photoFromFile(c.files[0]); render(); } catch (err) { toast(err.message); }
  }
  if (c.id === "pphoto" && c.files && c.files[0]) {
    try { S.pe.photo = await avatarFromFile(c.files[0]); render(); } catch (err) { toast(err.message); }
  }
});

/* ---------- Zeichnen & Start ---------- */
/* Belohnung erreicht -> Konfetti + Fanfare (einmal pro Belohnung und Gerät) */
function checkRewards() {
  if (!S.me || isDisplay() || !S.rewards.length || !S.profiles.length) return;
  const reached = S.rewards.filter(r => !r.claimed && prof(r.profile_id) && ptsOf(prof(r.profile_id)) >= r.points);
  const ids = reached.map(r => r.id); let seen = null;
  try { const raw = localStorage.getItem("rwSeen"); seen = raw ? JSON.parse(raw) : null; } catch (_) { /* egal */ }
  if (!Array.isArray(seen)) { try { localStorage.setItem("rwSeen", JSON.stringify(ids)); } catch (_) { /* egal */ } return; } // erster Start: nichts feiern
  const fresh = reached.filter(r => !seen.includes(r.id));
  try { localStorage.setItem("rwSeen", JSON.stringify(seen.filter(id => ids.includes(id)).concat(fresh.map(r => r.id)))); } catch (_) { /* egal */ }
  if (fresh.length && window.celebrate) celebrate(fresh.map(r => `${prof(r.profile_id).name}: „${r.title}“`));
}

function render() {
  window.CHEF_ID = (chefFor(new Date()) || {}).id || null;
  const saved = saveInputs();
  if (!S.user || S.recovery) $app.innerHTML = viewAuth();
  else if (!S.me) $app.innerHTML = viewOnboarding();
  else $app.innerHTML = isDisplay() ? viewBoard() : viewShell();
  restoreInputs(saved);
  { const tw = document.querySelector(".top-wrap"); document.documentElement.style.setProperty("--twh", (tw ? tw.offsetHeight : 0) + "px"); }
  setTimeout(checkRewards, 0);
  setTimeout(() => { if (window.checkNews) checkNews(); }, 0);
  if (S.me && !isDisplay() && S.tab === "chat" && (S.chatRoom || !S.lprof.length)) window.scrollTo(0, document.body.scrollHeight);
}

async function start() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  const { data } = await sb.auth.getSession();
  S.user = data.session?.user || null;
  render();
  if (S.user) await loadAll();
  sb.auth.onAuthStateChange(async (ev, session) => {
    if (ev === "PASSWORD_RECOVERY") S.recovery = true;
    const was = S.user?.id; S.user = session?.user || null;
    if (!S.user) { S.me = null; if (channel) sb.removeChannel(channel); render(); }
    else if (S.user.id !== was) await loadAll();
  });
  // Uhr und Kalender auf dem Tablet aktuell halten
  setInterval(() => { const c = document.getElementById("clock"); if (c) c.textContent = fmtTime(new Date()); }, 15000);
  setInterval(() => { if (S.me) loadIcal(false); }, 5 * 60 * 1000);
}
start();

// Einfacher Offline-Speicher: die App-Dateien werden gemerkt, Daten kommen immer frisch aus dem Netz.
const CACHE = "familie-v78";
const FILES = ["./", "index.html", "styles.css", "app.js", "config.js", "ferien.js", "pyramide.js", "feier.js", "stimmung.js", "neuigkeiten.js", "extra.js", "icon.svg", "spielhalle/", "spielhalle/index.html", "spielhalle/spielhalle.css", "spielhalle/spielhalle.js", "spielhalle/spiele/snake.js", "spielhalle/spiele/memory.js", "spielhalle/spiele/reaktion.js", "spielhalle/spiele/flappy.js", "spielhalle/spiele/frogger.js", "spielhalle/spiele/pong.js", "spielhalle/spiele/farben.js", "spielhalle/spiele/bonbon.js", "spielhalle/spiele/code.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Supabase & Co. nie aus dem Cache
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Familienplaner", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Familienplaner", {
    body: d.body || "", tag: d.tag || "familie", icon: "icon.svg", badge: "icon.svg", renotify: true, data: { tab: d.tab || null, item: d.item || null }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const d = e.notification.data || {};
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) { if (d.tab) c.postMessage({ type: "go", tab: d.tab, item: d.item || null }); return c.focus(); }
    const q = d.tab ? "?go=" + encodeURIComponent(d.tab) + (d.item ? "&item=" + encodeURIComponent(d.item) : "") : "";
    return self.clients.openWindow("./" + q);
  }));
});

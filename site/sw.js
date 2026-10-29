// Einfacher Offline-Speicher: die App-Dateien werden gemerkt, Daten kommen immer frisch aus dem Netz.
const CACHE = "familie-v6";
const FILES = ["./", "index.html", "styles.css", "app.js", "config.js", "icon.svg"];

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

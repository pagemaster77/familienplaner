// Holt einen Kalender-Link (iCal) im Auftrag der App.
// Nötig, weil Google und iCloud den Abruf direkt aus dem Browser nicht erlauben.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { url } = await req.json();
    let target = String(url || "").trim().replace(/^webcal:\/\//i, "https://");
    const u = new URL(target);
    const host = u.hostname.toLowerCase();
    const privat = host === "localhost" || host.endsWith(".local") || /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":");
    if (u.protocol !== "https:" || privat) {
      return new Response("Nur öffentliche https-Links erlaubt", { status: 400, headers: cors });
    }
    const r = await fetch(u.toString(), { redirect: "follow" });
    if (!r.ok) return new Response("Kalender nicht erreichbar: " + r.status, { status: 502, headers: cors });
    const text = await r.text();
    if (!text.includes("BEGIN:VCALENDAR")) {
      return new Response("Das ist kein Kalender-Link", { status: 422, headers: cors });
    }
    return new Response(text, { headers: { ...cors, "Content-Type": "text/calendar; charset=utf-8" } });
  } catch (e) {
    return new Response("Fehler: " + (e as Error).message, { status: 400, headers: cors });
  }
});

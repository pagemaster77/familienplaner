// Schickt Push-Nachrichten an die Handys der Familie.
// Wird nur von der Datenbank aufgerufen (geheimer Schlüssel im Header).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req: Request) => {
  try {
    const { data: cfg } = await db.from("push_config").select("key,value");
    const c: Record<string, string> = Object.fromEntries((cfg ?? []).map((r: any) => [r.key, r.value]));
    if (!c.hook_secret || req.headers.get("x-hook-secret") !== c.hook_secret) {
      return new Response("forbidden", { status: 403 });
    }
    const { kind, family_id, actor, title, body, admins_only, user_ids, tab, item } = await req.json();
    webpush.setVapidDetails("mailto:familienplaner@example.com", c.vapid_public, c.vapid_private);

    let q = db.from("push_subs").select("id,endpoint,p256dh,auth,prefs,user_id").eq("family_id", family_id);
    if (actor) q = q.neq("user_id", actor);
    let { data: subs } = await q;
    if (admins_only) { // nur an Erwachsene (Admins), z. B. bei "Ich möchte reden"
      const { data: ad } = await db.from("profiles").select("id").eq("family_id", family_id).eq("is_admin", true);
      const ids = new Set((ad ?? []).map((p: any) => p.id));
      subs = (subs ?? []).filter((s: any) => ids.has(s.user_id));
    }
    if (Array.isArray(user_ids)) subs = (subs ?? []).filter((s: any) => user_ids.includes(s.user_id)); // nur bestimmte Personen (z. B. bei Jobs)
    // Ziel beim Antippen: Reiter (und Eintrag), damit die App direkt an die richtige Stelle springt
    const KIND_TAB: Record<string, string> = { shop: "shop", task: "todo", msg: "chat", event: "cal" };
    let goTab: string | null = tab || KIND_TAB[kind] || null;
    if (!tab && /Job|Treffen/i.test(String(title ?? ""))) goTab = "jobs";
    const payload = JSON.stringify({ title, body, tag: kind, tab: goTab, item: item || null });
    let sent = 0;
    await Promise.all((subs ?? []).filter((s: any) => s.prefs?.[kind] !== false).map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("id", s.id);
      }
    }));
    return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});

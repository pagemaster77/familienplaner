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
    const { kind, family_id, actor, title, body } = await req.json();
    webpush.setVapidDetails("mailto:familienplaner@example.com", c.vapid_public, c.vapid_private);

    let q = db.from("push_subs").select("id,endpoint,p256dh,auth,prefs,user_id").eq("family_id", family_id);
    if (actor) q = q.neq("user_id", actor);
    const { data: subs } = await q;
    const payload = JSON.stringify({ title, body, tag: kind });
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

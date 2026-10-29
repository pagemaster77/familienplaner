// Liefert die Daten für die Wandanzeige (nur lesen).
// Der Zugang läuft über eine geheime Adresse (Token), die Admins in der App erzeugen.
// Die privaten Kalender-Links verlassen den Server nie: nur der Kalender-Inhalt wird weitergegeben.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

function isPrivateHost(h: string) {
  h = h.toLowerCase();
  return h === "localhost" || h.endsWith(".local") || /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(":");
}

async function fetchIcal(url: string): Promise<string | null> {
  try {
    const u = new URL(String(url).trim().replace(/^webcal:\/\//i, "https://"));
    if (u.protocol !== "https:" || isPrivateHost(u.hostname)) return null;
    const r = await fetch(u.toString(), { redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const t = await r.text();
    return t.includes("BEGIN:VCALENDAR") && t.length < 3_000_000 ? t : null;
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { token, what, nonce } = await req.json();

    // Kopplung per kurzem Code (für Displays ohne Tastatur)
    if (what === "pair_start" || what === "pair_poll") {
      if (typeof nonce !== "string" || !/^[0-9a-f]{32}$/.test(nonce)) return json({ ok: false, error: "invalid" }, 400);
      await db.from("wall_pairings").delete().lt("created_at", new Date(Date.now() - 15 * 60000).toISOString());
      const { data: row } = await db.from("wall_pairings").select("code,token").eq("nonce", nonce).maybeSingle();
      if (row?.token) {
        await db.from("wall_pairings").delete().eq("nonce", nonce);
        return json({ ok: true, status: "ok", token: row.token });
      }
      if (row) return json({ ok: true, status: "wait", code: row.code });
      if (what === "pair_poll") return json({ ok: true, status: "expired" });
      const { count } = await db.from("wall_pairings").select("code", { count: "exact", head: true });
      if ((count ?? 0) > 100) return json({ ok: false, error: "busy" }, 429);
      for (let i = 0; i < 5; i++) {
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
        const { error } = await db.from("wall_pairings").insert({ code, nonce });
        if (!error) return json({ ok: true, status: "wait", code });
      }
      return json({ ok: false, error: "busy" }, 429);
    }

    if (typeof token !== "string" || !/^[0-9a-f]{32}$/.test(token)) return json({ ok: false, error: "invalid" }, 403);
    const { data: fam } = await db.from("families").select("id,name").eq("wall_token", token).maybeSingle();
    if (!fam) return json({ ok: false, error: "invalid" }, 403);

    // Kalender von Google/iCloud (seltener abgerufen)
    if (what === "ical") {
      const { data: ps } = await db.from("profiles").select("id,ical_url").eq("family_id", fam.id).not("ical_url", "is", null);
      const list = await Promise.all((ps ?? []).filter((p: any) => p.ical_url).map(async (p: any) => {
        const text = await fetchIcal(p.ical_url);
        return text ? { owner: p.id, text } : null;
      }));
      return json({ ok: true, ical: list.filter(Boolean) });
    }

    const now = Date.now();
    const from = new Date(now - 2 * 864e5).toISOString();
    const to = new Date(now + 70 * 864e5).toISOString();
    const today = new Date(now - 864e5).toISOString().slice(0, 10);
    const [pr, tk, sh, ev, ml, ms] = await Promise.all([
      db.from("profiles").select("id,name,color,avatar,photo,is_admin").eq("family_id", fam.id).order("created_at"),
      db.from("tasks").select("id,title,points,assigned_to,done,done_by,done_at,created_at").eq("family_id", fam.id).limit(2000),
      db.from("shopping_items").select("id,title,amount,checked").eq("family_id", fam.id).order("created_at").limit(300),
      db.from("events").select("id,title,starts_at,ends_at,owner").eq("family_id", fam.id).gte("starts_at", from).lte("starts_at", to).order("starts_at").limit(500),
      db.from("meals").select("id,title,plan_date,image_url,wished_by").eq("family_id", fam.id).or(`plan_date.gte.${today},plan_date.is.null`).order("plan_date", { nullsFirst: false }).limit(60),
      db.from("messages").select("id,author,body,created_at").eq("family_id", fam.id).order("created_at", { ascending: false }).limit(20),
    ]);
    const tasks = tk.data ?? [];
    const pts: Record<string, number> = {};
    for (const t of tasks) if (t.done && t.done_by) pts[t.done_by] = (pts[t.done_by] ?? 0) + (t.points ?? 0);
    const recent = now - 864e5;
    return json({
      ok: true,
      family: { name: fam.name },
      profiles: (pr.data ?? []).map((p: any) => ({ ...p, points: pts[p.id] ?? 0 })),
      tasks: tasks.filter((t: any) => !t.done || (t.done_at && new Date(t.done_at).getTime() > recent)),
      shopping: sh.data ?? [],
      events: ev.data ?? [],
      meals: ml.data ?? [],
      messages: (ms.data ?? []).reverse(),
      at: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

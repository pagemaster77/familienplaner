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
    const { token, what, nonce, etag: etag_in } = await req.json();

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
    const { data: fam } = await db.from("families").select("id,name,chef_order,flame_on,flame_symbol,flame1_days,flame2_days,flame3_tasks").eq("wall_token", token).maybeSingle();
    if (!fam) return json({ ok: false, error: "invalid" }, 403);

    // Datum in Berlin, Tages-Chef (Reihenfolge rotiert taeglich)
    const berlin = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date()); // YYYY-MM-DD
    const [by, bm, bd] = berlin.split("-").map(Number);
    const dd = Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(2026, 10, 15)) / 864e5);

    // Bild des Tages (einmal abgeholt, nur wenn sich etwas geaendert hat)
    if (what === "daily_photo") {
      const { data: post } = await db.from("daily_posts").select("id,updated_at").eq("family_id", fam.id).eq("day", berlin).maybeSingle();
      if (!post) return json({ ok: true, id: null });
      const { data: ph } = await db.from("daily_photos").select("data").eq("post_id", post.id).maybeSingle();
      return json({ ok: true, id: post.id, updated_at: post.updated_at, data: ph?.data ?? null });
    }

    // Profilfotos (einmal abgeholt, nur wenn sich ein Foto geaendert hat). Sonst wuerde jede Abfrage alle Fotos mitschleppen.
    if (what === "photos") {
      const { data: ps } = await db.from("profiles").select("id,photo").eq("family_id", fam.id);
      const photos: Record<string, string> = {};
      for (const p of ps ?? []) if (p.photo) photos[p.id] = p.photo;
      return json({ ok: true, photos });
    }

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
    const [pr, tk, sh, ev, ml, ms, pl, rw, dp, fs, wk] = await Promise.all([
      db.from("profiles").select("id,name,color,avatar,photo,is_admin,mood,mood_at").eq("family_id", fam.id).order("created_at"),
      db.from("tasks").select("id,title,points,assigned_to,assignees,done,done_by,done_at,approved,created_at").eq("family_id", fam.id).limit(2000),
      db.from("shopping_items").select("id,title,amount,checked").eq("family_id", fam.id).order("created_at").limit(300),
      db.from("events").select("id,title,starts_at,ends_at,owner,recurrence,all_day,birth_year").eq("family_id", fam.id).lte("starts_at", to).or(`starts_at.gte.${from},recurrence.neq.none`).order("starts_at").limit(500),
      db.from("meals").select("id,title,plan_date,image_url,wished_by").eq("family_id", fam.id).or(`plan_date.gte.${today},plan_date.is.null`).order("plan_date", { nullsFirst: false }).limit(60),
      db.from("messages").select("id,author,body,created_at").eq("family_id", fam.id).eq("scope", "family").order("created_at", { ascending: false }).limit(20),
      db.from("point_log").select("profile_id,points").eq("family_id", fam.id).limit(20000),
      db.from("rewards").select("id,profile_id,points,title,claimed").eq("family_id", fam.id).limit(200),
      db.from("daily_posts").select("id,author,yt_id,has_photo,updated_at").eq("family_id", fam.id).eq("day", berlin).maybeSingle(),
      db.from("flame_state").select("profile_id,open_streak,open_at,act_streak,act_at").eq("family_id", fam.id),
      db.from("point_log").select("profile_id").eq("family_id", fam.id).eq("kind", "task").gt("created_at", new Date(now - 7 * 864e5).toISOString()).limit(5000),
    ]);
    // Reihenfolge: erst die in chef_order genannten, dann alle anderen nach Beitritt (jede Familie)
    const ids: string[] = (pr.data ?? []).map((p: any) => p.id);
    const fo: string[] = (fam.chef_order ?? []).filter((id: string) => ids.includes(id));
    const order = [...fo, ...ids.filter((id) => !fo.includes(id))];
    const chef = order.length ? order[((dd % order.length) + order.length) % order.length] : null;
    const tasks = tk.data ?? [];
    const pts: Record<string, number> = {};
    for (const l of pl.data ?? []) pts[l.profile_id] = (pts[l.profile_id] ?? 0) + (l.points ?? 0); // Punktekonto
    const recent = now - 864e5;
    // Flammen (wie in der App): Aufgaben der letzten 7 Tage = freigegebene (point_log) + noch wartende
    const week: Record<string, number> = {};
    for (const l of wk.data ?? []) week[l.profile_id] = (week[l.profile_id] ?? 0) + 1;
    for (const t of tasks) if (t.done && !t.approved && t.done_by && t.done_at && new Date(t.done_at).getTime() > now - 7 * 864e5) week[t.done_by] = (week[t.done_by] ?? 0) + 1;
    const flames = fam.flame_on
      ? { cfg: { flame_on: true, flame_symbol: fam.flame_symbol, flame1_days: fam.flame1_days, flame2_days: fam.flame2_days, flame3_tasks: fam.flame3_tasks }, st: fs.data ?? [], wk: week }
      : null;
    const payload = {
      ok: true,
      family: { name: fam.name },
      profiles: (pr.data ?? []).map((p: any) => { const { photo, ...rest } = p; return { ...rest, photo_v: photo ? photo.length + ":" + photo.slice(-24) : "", points: pts[p.id] ?? 0 }; }),
      tasks: tasks.filter((t: any) => !t.done || !t.approved || (t.done_at && new Date(t.done_at).getTime() > recent)),
      shopping: sh.data ?? [],
      events: ev.data ?? [],
      meals: ml.data ?? [],
      messages: (ms.data ?? []).reverse(),
      rewards: rw.data ?? [],
      chef,
      daily: dp.data ?? null,
      flames,
    };
    // Unveraendert? Dann nur ein kurzes "same" zurueckschicken (spart Datenvolumen: die Wand fragt alle 30 s)
    const txt = JSON.stringify(payload);
    const dig = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(txt)));
    const etag = Array.from(dig).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (typeof etag_in === "string" && etag_in === etag) return json({ ok: true, same: true });
    return json({ ...payload, etag, at: new Date().toISOString() });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

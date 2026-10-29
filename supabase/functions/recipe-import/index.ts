// Liest ein Rezept von einer Internetseite (z. B. Chefkoch) aus:
// Name, Bild, Zutaten. Die meisten Rezeptseiten legen diese Daten
// maschinenlesbar in der Seite ab ("JSON-LD", Schema.org Recipe).
// Neu: Das Bild wird hier heruntergeladen und der App mitgegeben, weil viele
// Seiten (z. B. Chefkoch) das Anzeigen ihrer Bilder auf fremden Seiten sperren.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function decode(s: any) {
  return String(s ?? "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function findRecipe(node: any): any {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findRecipe(n); if (r) return r; }
    return null;
  }
  if (typeof node === "object") {
    const t = node["@type"];
    if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return node;
    if (node["@graph"]) return findRecipe(node["@graph"]);
  }
  return null;
}

function firstImage(img: any): any {
  if (!img) return null;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return firstImage(img[0]);
  if (typeof img === "object") return img.url || img.contentUrl || null;
  return null;
}

function meta(html: any, prop: any) {
  const a = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]+content=["\']([^"\']+)["\']', "i"));
  const b = html.match(new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' + prop + '["\']', "i"));
  return (a && a[1]) || (b && b[1]) || null;
}

function parseRecipe(html: any) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const r = findRecipe(JSON.parse(b[1].trim()));
      if (r) {
        const ing = Array.isArray(r.recipeIngredient) ? r.recipeIngredient : [];
        const y = Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield;
        return {
          title: decode(r.name),
          image: firstImage(r.image) || meta(html, "og:image"),
          ingredients: ing.map(decode).filter(Boolean).slice(0, 80),
          servings: y ? decode(y) : null,
        };
      }
    } catch (_e) { /* nächsten Block versuchen */ }
  }
  // Notlösung: nur Titel und Bild aus den Seiten-Infos
  const title = meta(html, "og:title");
  if (title) return { title: decode(title), image: meta(html, "og:image"), ingredients: [], servings: null };
  return null;
}

function isPrivateHost(host: string) {
  const h = host.toLowerCase();
  return h === "localhost" || h.endsWith(".local") || /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(":");
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  const n = 0x8000;
  for (let i = 0; i < bytes.length; i += n) s += String.fromCharCode(...bytes.subarray(i, i + n));
  return btoa(s);
}

// Lädt das Bild herunter (mit der Rezeptseite als Absender, wie ein Browser es tut)
async function fetchImage(src: string, pageUrl: string) {
  try {
    const u = new URL(src, pageUrl);
    if (u.protocol === "http:") u.protocol = "https:";
    if (u.protocol !== "https:" || isPrivateHost(u.hostname)) return null;
    const r = await fetch(u.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        "Referer": new URL(pageUrl).origin + "/",
        "Accept": "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8",
      },
    });
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length === 0 || buf.length > 3_000_000) return null;
    return { data: toBase64(buf), type, url: u.toString() };
  } catch (_e) {
    return null;
  }
}

function reply(obj: any) {
  return new Response(JSON.stringify(obj), { headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { url } = await req.json();
    const u = new URL(String(url || "").trim());
    if (u.protocol !== "https:" || isPrivateHost(u.hostname)) {
      return reply({ ok: false, error: "Bitte einen https-Link einer Rezeptseite einfügen" });
    }
    const r = await fetch(u.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "de-DE,de;q=0.9",
      },
    });
    if (!r.ok) return reply({ ok: false, error: "Die Seite hat den Abruf abgelehnt (Fehler " + r.status + ")" });
    const pageUrl = r.url || u.toString();
    const rec = parseRecipe(await r.text());
    if (!rec || !rec.title) return reply({ ok: false, error: "Auf dieser Seite wurde kein Rezept gefunden" });
    const img = rec.image ? await fetchImage(String(rec.image), pageUrl) : null;
    return reply({
      ok: true,
      ...rec,
      image: img ? img.url : rec.image,
      imageData: img ? img.data : null,
      imageType: img ? img.type : null,
      url: pageUrl,
    });
  } catch (e) {
    return reply({ ok: false, error: "Fehler: " + (e as Error).message });
  }
});

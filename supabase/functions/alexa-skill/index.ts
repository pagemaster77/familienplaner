// Alexa-Skill "Familien Planer": Artikel per Sprache auf die Einkaufsliste setzen und vorlesen.
// Jede Anfrage wird auf Echtheit geprüft (kommt wirklich von Amazon). Zuordnung zur Familie per Kopplungscode.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyAlexa } from "./verify.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function reply(ssml: string, end = true, card?: string) {
  const out: any = { version: "1.0", response: { outputSpeech: { type: "SSML", ssml: `<speak>${ssml}</speak>` }, shouldEndSession: end } };
  if (card) out.response.card = { type: "Simple", title: "Familien Planer", content: card };
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
}
const clean = (s: string) => s.replace(/[<>&"]/g, " ").trim();

async function pairingCode(uid: string): Promise<string> {
  await db.from("alexa_pairings").delete().lt("created_at", new Date(Date.now() - 15 * 60000).toISOString());
  const { data: ex } = await db.from("alexa_pairings").select("code").eq("alexa_user_id", uid).maybeSingle();
  if (ex) return ex.code;
  for (let i = 0; i < 6; i++) {
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const { error } = await db.from("alexa_pairings").insert({ code, alexa_user_id: uid });
    if (!error) return code;
  }
  throw new Error("code");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("ok");
  const raw = await req.text();
  if (!(await verifyAlexa(raw, req.headers))) return new Response("forbidden", { status: 400 });
  try {
    const body = JSON.parse(raw);
    const uid: string = body?.session?.user?.userId ?? body?.context?.System?.user?.userId ?? "";
    const r = body?.request ?? {};
    if (!uid) return reply("Es ist ein Fehler aufgetreten.");
    if (r.type === "SessionEndedRequest") return new Response("{}", { headers: { "Content-Type": "application/json" } });

    const { data: link } = await db.from("alexa_links").select("family_id").eq("alexa_user_id", uid).maybeSingle();
    if (!link) {
      const code = await pairingCode(uid);
      const digits = code.split("").join(" ");
      return reply(`Dieses Gerät ist noch nicht mit deiner Familie verbunden. Öffne in der Familien App den Bereich Familie, dann Alexa, und gib diesen Code ein: <say-as interpret-as="digits">${code}</say-as>. Ich wiederhole: <say-as interpret-as="digits">${code}</say-as>. Danach kannst du mich nutzen.`,
        true, `Code zum Verbinden: ${code.slice(0, 3)} ${code.slice(3)}\nIn der App: Familie → Alexa`);
    }
    const fam = link.family_id as string;

    if (r.type === "LaunchRequest") {
      return reply("Familien Planer. Sag zum Beispiel: setze Kaffee auf die Einkaufsliste. Oder: was steht auf der Einkaufsliste.", false);
    }
    if (r.type === "IntentRequest") {
      const name = r.intent?.name;
      if (name === "AddItemIntent") {
        const val: string = clean(r.intent?.slots?.item?.value ?? "");
        const items = val.split(/\s*(?:,| und )\s*/i).map((x) => x.trim()).filter(Boolean).slice(0, 10);
        if (!items.length) return reply("Das habe ich nicht verstanden. Was soll auf die Einkaufsliste?", false);
        const rows = items.map((t) => ({ family_id: fam, title: t.charAt(0).toUpperCase() + t.slice(1, 80) }));
        const { error } = await db.from("shopping_items").insert(rows);
        if (error) return reply("Das hat leider nicht geklappt. Bitte versuche es später noch einmal.");
        return reply(items.length === 1 ? `Okay, ${items[0]} steht auf der Einkaufsliste.` : `Okay, ${items.join(", ")} stehen auf der Einkaufsliste.`);
      }
      if (name === "ReadListIntent") {
        const { data } = await db.from("shopping_items").select("title,amount").eq("family_id", fam).eq("checked", false).order("created_at").limit(25);
        if (!data?.length) return reply("Die Einkaufsliste ist leer.");
        const list = data.map((i: any) => clean(i.title + (i.amount ? " " + i.amount : "")));
        return reply(`Auf der Einkaufsliste stehen ${list.length} Einträge: ${list.join(", ")}.`, true, list.join("\n"));
      }
      if (name === "AMAZON.HelpIntent") return reply("Sag zum Beispiel: setze Kaffee auf die Einkaufsliste. Oder: was steht auf der Einkaufsliste.", false);
      if (name === "AMAZON.CancelIntent" || name === "AMAZON.StopIntent" || name === "AMAZON.NavigateHomeIntent") return reply("Bis bald.");
      return reply("Das kenne ich nicht. Sag zum Beispiel: setze Kaffee auf die Einkaufsliste.", false);
    }
    return reply("Das kenne ich nicht.");
  } catch (_e) {
    return reply("Es ist ein Fehler aufgetreten. Bitte versuche es später noch einmal.");
  }
});

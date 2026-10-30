// Prüft, dass eine Anfrage wirklich von Amazon Alexa kommt (Zertifikat + Signatur + Zeitstempel).
// Regeln: https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-a-web-service.html
// Läuft bewusst ohne die Zertifikats-Felder von X509Certificate (fehlen in älteren Deno-Versionen):
// Name und Gültigkeit werden direkt aus dem Zertifikat gelesen.
import { createPublicKey, createVerify, X509Certificate } from "node:crypto";

export function certUrlOk(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && x.hostname.toLowerCase() === "s3.amazonaws.com" &&
      x.pathname.startsWith("/echo.api/") && (x.port === "" || x.port === "443");
  } catch (_e) { return false; }
}

const no = (why: string) => { console.error("alexa-verify:", why); return false; };

function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
const ascii = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; };

/** Liest die zwei Zeitangaben "gültig von / bis" aus dem Zertifikat (UTCTime 0x17 bzw. GeneralizedTime 0x18). */
function validity(der: Uint8Array): [number, number] | null {
  const out: number[] = [];
  for (let i = 0; i < der.length - 2 && out.length < 2; i++) {
    const tag = der[i], len = der[i + 1];
    if ((tag === 0x17 && len === 13) || (tag === 0x18 && len === 15)) {
      const s = ascii(der.subarray(i + 2, i + 2 + len));
      const m = tag === 0x17 ? s.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/) : s.match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/);
      if (!m) continue;
      let y = +m[1]; if (tag === 0x17) y += y >= 50 ? 1900 : 2000;
      out.push(Date.UTC(y, +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
      i += 1 + len;
    }
  }
  return out.length === 2 ? [out[0], out[1]] : null;
}

const cache = new Map<string, { pems: string[]; at: number }>();

async function loadPems(url: string, fetcher: (u: string) => Promise<string>): Promise<string[]> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 3600_000) return hit.pems;
  const text = await fetcher(url);
  const pems = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  if (pems.length) cache.set(url, { pems, at: Date.now() });
  return pems;
}

export async function verifyAlexa(
  raw: string,
  headers: { get(n: string): string | null },
  fetcher: (u: string) => Promise<string> = async (u) => {
    const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error("cert http " + r.status);
    return await r.text();
  },
  now = Date.now(),
): Promise<boolean> {
  try {
    const url = headers.get("signaturecertchainurl") ?? "";
    const sig = headers.get("signature-256") ?? "";
    if (!certUrlOk(url)) return no("cert url not ok: " + url);
    if (!sig) return no("no signature-256 header");
    const body = JSON.parse(raw);
    const ts = Date.parse(body?.request?.timestamp ?? "");
    if (!ts || Math.abs(now - ts) > 150_000) return no("timestamp: " + body?.request?.timestamp);

    const pems = await loadPems(url, fetcher);
    if (!pems.length) return no("empty chain");
    const leafPem = pems[0];
    const der = pemToDer(leafPem);

    // 1) Name: echo-api.amazon.com muss im Zertifikat stehen (als Klartext im Namensfeld)
    if (!ascii(der).includes("echo-api.amazon.com")) return no("name echo-api.amazon.com not in certificate");

    // 2) Gültigkeit
    const v = validity(der);
    if (!v) return no("validity not readable");
    if (now < v[0] || now > v[1]) return no("certificate not valid now");

    // 3) Kette (wenn die Laufzeit es kann)
    try {
      for (let i = 0; i < pems.length - 1; i++) {
        const a: any = new X509Certificate(pems[i]), b: any = new X509Certificate(pems[i + 1]);
        if (typeof a.verify === "function" && b.publicKey && !a.verify(b.publicKey)) return no("chain link " + i + " not verified");
      }
    } catch (e) { console.error("alexa-verify: chain check skipped:", String(e)); }

    // 4) Signatur über den Anfragetext
    const attempts: Array<() => unknown> = [
      () => { const s = createVerify("RSA-SHA256"); s.update(raw); return s.verify(leafPem, sig, "base64"); },
      () => { const s = createVerify("RSA-SHA256"); s.update(raw); return s.verify(createPublicKey(leafPem), sig, "base64"); },
      () => { const s = createVerify("RSA-SHA256"); s.update(raw); return s.verify((new X509Certificate(leafPem) as any).publicKey, sig, "base64"); },
    ];
    const errs: string[] = [];
    for (const f of attempts) {
      try { const ok = f(); if (ok === true) return true; errs.push("false"); } catch (e) { errs.push(String(e).slice(0, 80)); }
    }
    return no("signature not verified: " + errs.join(" | "));
  } catch (e) {
    return no("exception: " + e);
  }
}

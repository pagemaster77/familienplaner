// Prüft, dass eine Anfrage wirklich von Amazon Alexa kommt (Zertifikat + Signatur + Zeitstempel).
// Regeln: https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-a-web-service.html
import { createVerify, X509Certificate } from "node:crypto";

export function certUrlOk(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && x.hostname.toLowerCase() === "s3.amazonaws.com" &&
      x.pathname.startsWith("/echo.api/") && (x.port === "" || x.port === "443");
  } catch (_e) { return false; }
}

const cache = new Map<string, { certs: X509Certificate[]; at: number }>();

async function loadChain(url: string, fetcher: (u: string) => Promise<string>): Promise<X509Certificate[]> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 3600_000) return hit.certs;
  const pem = await fetcher(url);
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  const certs = blocks.map((b) => new X509Certificate(b));
  if (certs.length) cache.set(url, { certs, at: Date.now() });
  return certs;
}

export async function verifyAlexa(
  raw: string,
  headers: { get(n: string): string | null },
  fetcher: (u: string) => Promise<string> = async (u) => {
    const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error("cert");
    return await r.text();
  },
  now = Date.now(),
): Promise<boolean> {
  try {
    const url = headers.get("signaturecertchainurl") ?? "";
    const sig = headers.get("signature-256") ?? "";
    if (!certUrlOk(url) || !sig) return false;
    const body = JSON.parse(raw);
    const ts = Date.parse(body?.request?.timestamp ?? "");
    if (!ts || Math.abs(now - ts) > 150_000) return false;
    const chain = await loadChain(url, fetcher);
    if (!chain.length) return false;
    const leaf = chain[0];
    if (now < Date.parse(leaf.validFrom) || now > Date.parse(leaf.validTo)) return false;
    if (!(leaf.subjectAltName ?? "").includes("echo-api.amazon.com")) return false;
    for (let i = 0; i < chain.length - 1; i++) if (!chain[i].verify(chain[i + 1].publicKey)) return false;
    const v = createVerify("RSA-SHA256");
    v.update(raw);
    return v.verify(leaf.publicKey, sig, "base64");
  } catch (_e) {
    return false;
  }
}

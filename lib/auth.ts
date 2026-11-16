// Läuft sowohl im Proxy als auch in Route Handlers (nur Web Crypto, kein Node-Modul).

export const SESSION_COOKIE = "wc_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function config() {
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) return null;
  return { password, secret };
}

/** Token hängt vom Passwort ab: Passwort ändern = alle Logins ungültig. */
export async function expectedToken(): Promise<string | null> {
  const cfg = config();
  return cfg ? hmac(cfg.secret, `session:${cfg.password}`) : null;
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await expectedToken();
  return expected !== null && safeEqual(token, expected);
}

export async function checkPassword(input: string): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  // Beide Seiten hashen, damit der Vergleich gleich lang und zeitkonstant ist.
  const [a, b] = await Promise.all([hmac(cfg.secret, input), hmac(cfg.secret, cfg.password)]);
  return safeEqual(a, b);
}

export function isConfigured(): boolean {
  return config() !== null;
}

/* ---------- OBS-Overlay ---------- */

/** Nur-Lese-Schlüssel pro Challenge, damit OBS das Overlay ohne Login laden kann. */
export async function overlayKey(challengeId: string): Promise<string | null> {
  const cfg = config();
  return cfg ? (await hmac(cfg.secret, `overlay:${challengeId}`)).slice(0, 32) : null;
}

export async function isValidOverlayKey(challengeId: string, key: string | null): Promise<boolean> {
  if (!key) return false;
  const expected = await overlayKey(challengeId);
  return expected !== null && safeEqual(key, expected);
}

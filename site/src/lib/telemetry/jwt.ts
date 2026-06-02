
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < view.length; i += 1) {
    bin += String.fromCharCode(view[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): Uint8Array {
  const pad = (4 - (input.length % 4)) % 4;
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let keyPromise: Promise<CryptoKey> | null = null;
let cachedSecret = "";

async function getKey(secret: string): Promise<CryptoKey> {
  if (!keyPromise || cachedSecret !== secret) {
    cachedSecret = secret;
    keyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return keyPromise;
}

export interface TelemetryTokenClaims {
  install_id: string;
  iat: number;
  exp: number;
}

const DEFAULT_DEV_SECRET = "macondo-utils-dev-telemetry-secret-change-me";

export function getTelemetrySecret(): string {
  const s = process.env.TELEMETRY_JWT_SECRET;
  if (s && s.length >= 24) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("TELEMETRY_JWT_SECRET must be set in production");
  }
  return DEFAULT_DEV_SECRET;
}

export async function signTelemetryToken(
  claims: Omit<TelemetryTokenClaims, "iat" | "exp">,
  options: { ttlSeconds?: number } = {},
): Promise<string> {
  const ttl = options.ttlSeconds ?? 60 * 60 * 24 * 30;
  const now = Math.floor(Date.now() / 1000);
  const payload: TelemetryTokenClaims = { ...claims, iat: now, exp: now + ttl };
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const key = await getKey(getTelemetrySecret());
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return `${headerB64}.${payloadB64}.${base64UrlEncode(sig)}`;
}

export async function verifyTelemetryToken(token: string): Promise<TelemetryTokenClaims | null> {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  if (!h || !p || !s) return null;
  try {
    const data = encoder.encode(`${h}.${p}`);
    const key = await getKey(getTelemetrySecret());
    const sig = base64UrlDecode(s);
    const sigBuffer = sig.buffer.slice(sig.byteOffset, sig.byteOffset + sig.byteLength) as ArrayBuffer;
    const dataBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const ok = await crypto.subtle.verify("HMAC", key, sigBuffer, dataBuffer);
    if (!ok) return null;
    const payload = JSON.parse(decoder.decode(base64UrlDecode(p))) as TelemetryTokenClaims;
    if (typeof payload.install_id !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

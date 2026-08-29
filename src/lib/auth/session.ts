import { SESSION_MAX_AGE_SECONDS, type SessionPayload } from "@/lib/auth/config";

export function timingSafeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length === rightBytes.length ? 0 : 1;

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftBytes[index] ?? 0;
    const rightValue = rightBytes[index] ?? 0;
    mismatch |= leftValue ^ rightValue;
  }

  return mismatch === 0;
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (padded.length % 4)) % 4;
    const binary = atob(`${padded}${"=".repeat(padLength)}`);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return new Uint8Array(signature);
}

export async function createSessionToken(
  email: string,
  secret: string,
): Promise<string> {
  const payload: SessionPayload = {
    sub: "admin",
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await hmacSha256(secret, encodedPayload);
  return `${encodedPayload}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, encodedSignature] = parts;
  const expected = await hmacSha256(secret, encodedPayload);
  const actual = base64UrlToBytes(encodedSignature);
  if (!actual) return null;

  if (!timingSafeEqual(bytesToBase64Url(expected), bytesToBase64Url(actual))) {
    return null;
  }

  try {
    const payloadBytes = base64UrlToBytes(encodedPayload);
    if (!payloadBytes) return null;
    const json = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(json) as SessionPayload;
    if (payload.sub !== "admin" || typeof payload.email !== "string") {
      return null;
    }
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function credentialsMatch(
  email: string,
  password: string,
  config: { adminEmail: string; adminPassword: string },
): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const expectedEmail = config.adminEmail.trim().toLowerCase();
  const emailOk = timingSafeEqual(normalizedEmail, expectedEmail);
  const passwordOk = timingSafeEqual(password, config.adminPassword);
  return emailOk && passwordOk;
}

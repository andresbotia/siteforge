import { createHmac, timingSafeEqual } from "node:crypto";
import { asRecord } from "@/lib/json";

export type ResendWebhookEvent = {
  id: string;
  type: string;
  emailId: string | null;
  to: string | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
};

const SUPPORTED_EVENTS = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.complained",
  "email.bounced",
  "email.opened",
  "email.clicked",
  "email.suppressed",
]);

export function verifyResendWebhookSignature(input: {
  payload: string;
  headers: Headers | Record<string, string | null | undefined>;
  secret: string | null | undefined;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): boolean {
  if (!input.secret) return false;
  const id = getHeader(input.headers, "svix-id");
  const timestamp = getHeader(input.headers, "svix-timestamp");
  const signature = getHeader(input.headers, "svix-signature");
  if (!id || !timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 5 * 60;
  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) return false;

  const key = decodeSvixSecret(input.secret);
  if (!key) return false;
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${input.payload}`)
    .digest("base64");

  return signature
    .split(" ")
    .some((part) => constantTimeEqual(part.replace(/^v\d+,/, ""), expected));
}

export function parseResendWebhookEvent(payload: unknown): ResendWebhookEvent | null {
  const event = asRecord(payload);
  const type = typeof event.type === "string" ? event.type : "";
  if (!SUPPORTED_EVENTS.has(type)) return null;
  const data = asRecord(event.data);
  const to = firstString(data.to) ?? firstString(data.recipient) ?? firstString(data.email);
  return {
    id: String(event.id || data.id || ""),
    type,
    emailId: typeof data.email_id === "string" ? data.email_id : typeof data.id === "string" ? data.id : null,
    to,
    createdAt: typeof event.created_at === "string" ? event.created_at : null,
    raw: event,
  };
}

function getHeader(
  headers: Headers | Record<string, string | null | undefined>,
  name: string,
): string | null {
  if (headers instanceof Headers) return headers.get(name);
  return headers[name] ?? headers[name.toLowerCase()] ?? null;
}

function decodeSvixSecret(secret: string): Buffer | null {
  const trimmed = secret.trim();
  const encoded = trimmed.startsWith("whsec_") ? trimmed.slice("whsec_".length) : trimmed;
  try {
    return Buffer.from(encoded, "base64");
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function firstString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? first : null;
  }
  return null;
}

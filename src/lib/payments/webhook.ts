import { createHmac, timingSafeEqual } from "node:crypto";

export type NormalizedCheckoutCompleted = {
  eventId: string;
  eventType: "checkout.session.completed";
  checkoutSessionId: string;
  customerId: string | null;
  paymentIntentId: string | null;
  subscriptionId: string | null;
  amountTotalCents: number | null;
  currency: string | null;
  metadata: Record<string, string>;
};

export function verifyStripeWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string | undefined;
  toleranceSeconds?: number;
}): boolean {
  if (!input.signatureHeader || !input.secret) return false;
  const parts = Object.fromEntries(
    input.signatureHeader.split(",").flatMap((part) => {
      const [key, value] = part.split("=");
      return key && value ? [[key, value]] : [];
    }),
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) return false;
  const tolerance = input.toleranceSeconds ?? 300;
  if (Math.abs(Date.now() / 1000 - timestamp) > tolerance) return false;

  const expected = createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringMap(value: unknown): Record<string, string> {
  const row = asObject(value);
  return Object.fromEntries(
    Object.entries(row).flatMap(([key, val]) =>
      typeof val === "string" ? [[key, val]] : [],
    ),
  );
}

export function normalizeStripeWebhookEvent(
  payload: unknown,
): NormalizedCheckoutCompleted | null {
  const event = asObject(payload);
  if (event.type !== "checkout.session.completed") return null;
  const data = asObject(event.data);
  const object = asObject(data.object);
  if (object.object !== "checkout.session") return null;
  const id = typeof object.id === "string" ? object.id : "";
  const eventId = typeof event.id === "string" ? event.id : "";
  if (!id || !eventId) return null;

  return {
    eventId,
    eventType: "checkout.session.completed",
    checkoutSessionId: id,
    customerId: typeof object.customer === "string" ? object.customer : null,
    paymentIntentId:
      typeof object.payment_intent === "string" ? object.payment_intent : null,
    subscriptionId:
      typeof object.subscription === "string" ? object.subscription : null,
    amountTotalCents:
      typeof object.amount_total === "number" &&
      Number.isSafeInteger(object.amount_total)
        ? object.amount_total
        : null,
    currency: typeof object.currency === "string" ? object.currency : null,
    metadata: asStringMap(object.metadata),
  };
}

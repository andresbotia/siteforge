import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Hand-rolled HMAC verification matching Stripe's publicly documented
 * signing scheme (https://stripe.com/docs/webhooks/signatures). Kept as a
 * standalone, dependency-free utility -- useful for tests and for the
 * mock-mode code path -- but the real (non-mock) webhook route uses the
 * official Stripe SDK's `stripe.webhooks.constructEvent()` instead (see
 * src/app/api/stripe/webhook/route.ts), since that is Stripe's own
 * canonical, actively-maintained implementation for a security-critical,
 * real-money verification path. This function's own correctness is still
 * directly tested below.
 */
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

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Minimal, deliberately narrow event model -- the events Scout V1.1's
 * predecessor sessions' pattern of "only what SiteForge actually acts on"
 * is followed here too. Every other Stripe event type normalizes to
 * `{ kind: "ignored" }`, which the caller acknowledges (200) without
 * further action, per Stripe's own guidance to always return 2xx for
 * events you do not need to handle.
 */
export type NormalizedStripeWebhookEvent =
  | {
      kind: "checkout_completed";
      eventId: string;
      eventType: string;
      checkoutSessionId: string;
      customerId: string | null;
      paymentIntentId: string | null;
      subscriptionId: string | null;
      amountTotalCents: number | null;
      currency: string | null;
      metadata: Record<string, string>;
    }
  | {
      kind: "checkout_async_payment_failed";
      eventId: string;
      eventType: string;
      checkoutSessionId: string;
    }
  | {
      kind: "subscription_updated";
      eventId: string;
      eventType: string;
      subscriptionId: string;
      customerId: string | null;
      status: string;
    }
  | {
      kind: "subscription_deleted";
      eventId: string;
      eventType: string;
      subscriptionId: string;
      customerId: string | null;
    }
  | {
      kind: "invoice_paid";
      eventId: string;
      eventType: string;
      subscriptionId: string | null;
      customerId: string | null;
      periodStart: string | null;
      periodEnd: string | null;
      amountPaidCents: number | null;
      currency: string | null;
    }
  | {
      kind: "invoice_payment_failed";
      eventId: string;
      eventType: string;
      subscriptionId: string | null;
      customerId: string | null;
    }
  | { kind: "ignored"; eventId: string | null; eventType: string };

/** Backward-compatible alias for the previously exported single-shape type. */
export type NormalizedCheckoutCompleted = Extract<NormalizedStripeWebhookEvent, { kind: "checkout_completed" }>;

function isoFromUnixSeconds(value: unknown): string | null {
  const seconds = asNumber(value);
  return seconds === null ? null : new Date(seconds * 1000).toISOString();
}

export function normalizeStripeWebhookEvent(payload: unknown): NormalizedStripeWebhookEvent {
  const event = asObject(payload);
  const eventType = asString(event.type) ?? "";
  const eventId = asString(event.id);
  const data = asObject(event.data);
  const object = asObject(data.object);

  if (!eventId) return { kind: "ignored", eventId: null, eventType };

  if (
    (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") &&
    object.object === "checkout.session"
  ) {
    const checkoutSessionId = asString(object.id);
    if (!checkoutSessionId) return { kind: "ignored", eventId, eventType };
    return {
      kind: "checkout_completed",
      eventId,
      eventType,
      checkoutSessionId,
      customerId: asString(object.customer),
      paymentIntentId: asString(object.payment_intent),
      subscriptionId: asString(object.subscription),
      amountTotalCents: asNumber(object.amount_total),
      currency: asString(object.currency),
      metadata: asStringMap(object.metadata),
    };
  }

  if (eventType === "checkout.session.async_payment_failed" && object.object === "checkout.session") {
    const checkoutSessionId = asString(object.id);
    if (!checkoutSessionId) return { kind: "ignored", eventId, eventType };
    return { kind: "checkout_async_payment_failed", eventId, eventType, checkoutSessionId };
  }

  if (eventType === "customer.subscription.updated" && object.object === "subscription") {
    const subscriptionId = asString(object.id);
    const status = asString(object.status);
    if (!subscriptionId || !status) return { kind: "ignored", eventId, eventType };
    return { kind: "subscription_updated", eventId, eventType, subscriptionId, customerId: asString(object.customer), status };
  }

  if (eventType === "customer.subscription.deleted" && object.object === "subscription") {
    const subscriptionId = asString(object.id);
    if (!subscriptionId) return { kind: "ignored", eventId, eventType };
    return { kind: "subscription_deleted", eventId, eventType, subscriptionId, customerId: asString(object.customer) };
  }

  if (eventType === "invoice.paid" && object.object === "invoice") {
    return {
      kind: "invoice_paid",
      eventId,
      eventType,
      subscriptionId: asString(object.subscription),
      customerId: asString(object.customer),
      periodStart: isoFromUnixSeconds(object.period_start),
      periodEnd: isoFromUnixSeconds(object.period_end),
      amountPaidCents: asNumber(object.amount_paid),
      currency: asString(object.currency),
    };
  }

  if (eventType === "invoice.payment_failed" && object.object === "invoice") {
    return {
      kind: "invoice_payment_failed",
      eventId,
      eventType,
      subscriptionId: asString(object.subscription),
      customerId: asString(object.customer),
    };
  }

  // customer.subscription.created and any other Stripe event type: safely
  // acknowledged, not separately handled. Subscription creation is already
  // recorded from checkout_completed processing; a redundant handler here
  // would not add new information.
  return { kind: "ignored", eventId, eventType };
}

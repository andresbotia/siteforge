import Stripe from "stripe";
import { processStripeWebhookPayload } from "@/data/payments";

export const dynamic = "force-dynamic";

/**
 * Real (non-mock) webhook verification uses the official Stripe SDK's
 * `stripe.webhooks.constructEvent()` -- Stripe's own canonical
 * implementation -- rather than the hand-rolled HMAC check in
 * src/lib/payments/webhook.ts (which remains available and tested, and is
 * what the mock-mode test path exercises). Verification always runs
 * against the raw request body read via `request.text()`, never a
 * re-serialized JSON.parse/stringify round-trip, as Stripe requires.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const isMock = request.headers.get("x-siteforge-mock-stripe") === "true";

  let payload: unknown;

  if (isMock) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }
  } else {
    if (process.env.STRIPE_ALLOW_LIVE_PAYMENTS !== "true") {
      return Response.json({ ok: false, error: "live_stripe_webhooks_disabled" }, { status: 403 });
    }
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const signatureHeader = request.headers.get("stripe-signature");
    if (!webhookSecret || !signatureHeader) {
      return Response.json({ ok: false, error: "invalid_signature" }, { status: 400 });
    }
    try {
      // constructEventAsync avoids Stripe's default Node crypto API, which
      // is unavailable in some edge runtimes; this route runs in the
      // standard Node runtime, but the async form works either way and
      // performs the same HMAC verification against the raw body.
      payload = await Stripe.webhooks.constructEventAsync(rawBody, signatureHeader, webhookSecret);
    } catch {
      return Response.json({ ok: false, error: "invalid_signature" }, { status: 400 });
    }
  }

  const result = await processStripeWebhookPayload({ payload });
  if (!result.ok) {
    return Response.json(result, { status: 500 });
  }
  return Response.json(result);
}

import { processStripeWebhookPayload } from "@/data/payments";
import { verifyStripeWebhookSignature } from "@/lib/payments/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const isMock = request.headers.get("x-siteforge-mock-stripe") === "true";

  if (!isMock) {
    if (process.env.STRIPE_ALLOW_LIVE_PAYMENTS !== "true") {
      return Response.json({ ok: false, error: "live_stripe_webhooks_disabled" }, { status: 403 });
    }
    const verified = verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: request.headers.get("stripe-signature"),
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    if (!verified) {
      return Response.json({ ok: false, error: "invalid_signature" }, { status: 400 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const result = await processStripeWebhookPayload({ payload });
  if (!result.ok) {
    return Response.json(result, { status: 500 });
  }
  return Response.json(result);
}

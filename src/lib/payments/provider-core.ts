import { createHash } from "node:crypto";
import Stripe from "stripe";
import {
  DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
  DEFAULT_SETUP_AMOUNT_CENTS,
  PAYMENT_PROVIDER_MOCK,
  PAYMENT_PROVIDER_STRIPE,
} from "@/lib/payments/limits";
import { getStripeSecretConfigFromEnv, type StripeSecretConfig } from "@/lib/payments/config";

export type CheckoutSessionRequest = {
  offerId: string;
  leadId: string;
  currency: string;
  setupAmountCents: number;
  managedMonthlyAmountCents: number | null;
  managedPlanSelected: boolean;
  description: string;
  /** SiteForge-controlled absolute URLs (see checkout-urls.ts) -- never a client-supplied redirect target. */
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSessionResult = {
  provider: "mock" | "stripe";
  checkoutSessionId: string;
  customerId: string | null;
  paymentIntentId: string | null;
  subscriptionId: string | null;
  checkoutUrl: string;
  mode: "payment" | "subscription";
  amountTotalCents: number;
  currency: string;
  expiresAt: string | null;
};

export type PaymentProvider = {
  id: "mock" | "stripe";
  createCheckoutSession(input: CheckoutSessionRequest): Promise<CheckoutSessionResult>;
};

function stableId(prefix: string, input: string): string {
  return `${prefix}_${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

export class MockStripeProvider implements PaymentProvider {
  id = PAYMENT_PROVIDER_MOCK as "mock";

  async createCheckoutSession(input: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    const seed = JSON.stringify(input);
    const sessionId = stableId("cs_mock", seed);
    return {
      provider: "mock",
      checkoutSessionId: sessionId,
      customerId: stableId("cus_mock", input.leadId),
      paymentIntentId: stableId("pi_mock", input.offerId),
      subscriptionId: input.managedPlanSelected ? stableId("sub_mock", input.offerId) : null,
      checkoutUrl: `https://checkout.stripe.test/${sessionId}`,
      mode: input.managedPlanSelected ? "subscription" : "payment",
      amountTotalCents: input.setupAmountCents,
      currency: input.currency,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}

/**
 * Real Stripe Checkout via the official Stripe Node SDK. Card entry always
 * happens on Stripe-hosted Checkout -- SiteForge never receives raw card
 * data.
 *
 * Checkout modeling (see HANDOFF.md for the full write-up): a website-only
 * purchase uses mode:"payment" with a single one-time Price line item. A
 * website+managed purchase uses mode:"subscription" with BOTH the one-time
 * setup Price and the recurring monthly Price as line items in the SAME
 * Checkout Session -- this is Stripe's own documented pattern for adding a
 * one-time fee to a new subscription (the one-time price is billed once on
 * the first invoice; the recurring price is what renews monthly). No
 * staged/multi-session flow was needed.
 *
 * Price authority: this class NEVER sends a client- or offer-supplied
 * dollar amount to Stripe. It always references the two fixed, configured
 * Price IDs, and it refuses to proceed at all (throws) if the calling
 * offer's own recorded amounts have drifted from the locked first-campaign
 * price ($99 / $39 per month) -- see AGENTS.md/HANDOFF.md: pricing must
 * never change without explicit operator approval, and this is the last
 * checkpoint before real money would move.
 */
/** The narrow slice of the Stripe client this provider actually calls -- lets tests inject a fake without a real API key or network access. */
export type StripeCheckoutClient = {
  checkout: { sessions: { create: (params: Stripe.Checkout.SessionCreateParams) => Promise<Stripe.Checkout.Session> } };
};

export class LiveStripeProvider implements PaymentProvider {
  id = PAYMENT_PROVIDER_STRIPE as "stripe";

  constructor(
    private readonly config: StripeSecretConfig,
    private readonly stripeFactory: (secretKey: string) => StripeCheckoutClient = (secretKey) => new Stripe(secretKey),
  ) {}

  async createCheckoutSession(input: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    if (!this.config.secretKey) throw new Error("stripe_secret_key_missing");
    if (!this.config.setupPriceId) throw new Error("stripe_setup_price_id_missing");
    if (input.managedPlanSelected && !this.config.managedMonthlyPriceId) {
      throw new Error("stripe_managed_monthly_price_id_missing");
    }
    if (input.setupAmountCents !== DEFAULT_SETUP_AMOUNT_CENTS) {
      throw new Error("stripe_setup_amount_does_not_match_locked_price");
    }
    if (input.managedPlanSelected && input.managedMonthlyAmountCents !== DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS) {
      throw new Error("stripe_managed_amount_does_not_match_locked_price");
    }

    const stripe = this.stripeFactory(this.config.secretKey);
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: this.config.setupPriceId, quantity: 1 }];
    if (input.managedPlanSelected && this.config.managedMonthlyPriceId) {
      lineItems.push({ price: this.config.managedMonthlyPriceId, quantity: 1 });
    }

    const metadata = {
      offer_id: input.offerId,
      lead_id: input.leadId,
      purchase_option: input.managedPlanSelected ? "website_plus_managed" : "website_only",
    };

    const session = await stripe.checkout.sessions.create({
      mode: input.managedPlanSelected ? "subscription" : "payment",
      line_items: lineItems,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.leadId,
      metadata,
      subscription_data: input.managedPlanSelected ? { metadata } : undefined,
    });

    return {
      provider: "stripe",
      checkoutSessionId: session.id,
      customerId: typeof session.customer === "string" ? session.customer : null,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      subscriptionId: typeof session.subscription === "string" ? session.subscription : null,
      checkoutUrl: session.url ?? "",
      mode: session.mode === "subscription" ? "subscription" : "payment",
      amountTotalCents: session.amount_total ?? input.setupAmountCents,
      currency: session.currency ?? input.currency,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    };
  }
}

/**
 * STRIPE_ALLOW_LIVE_PAYMENTS is the existing Milestone 9 live-payments gate
 * (documented in AGENTS.md) and is unchanged: unset/not "true" always means
 * mock, regardless of any other Stripe env var being present, so tests and
 * local development never require live Stripe. When enabled, a missing
 * secret key fails closed immediately (same error string as before this
 * session, so the existing test asserting it keeps passing) -- there is no
 * silent fallback from live to mock in production.
 */
export function createPaymentProviderFromEnv(env: NodeJS.ProcessEnv): PaymentProvider {
  if (env.STRIPE_ALLOW_LIVE_PAYMENTS === "true") {
    const config = getStripeSecretConfigFromEnv(env);
    if (!config) {
      throw new Error("stripe_live_payments_enabled_without_secret_key");
    }
    return new LiveStripeProvider(config);
  }
  return new MockStripeProvider();
}

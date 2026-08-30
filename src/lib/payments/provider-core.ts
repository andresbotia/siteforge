import { createHash } from "node:crypto";
import {
  PAYMENT_PROVIDER_MOCK,
  PAYMENT_PROVIDER_STRIPE,
} from "@/lib/payments/limits";

export type CheckoutSessionRequest = {
  offerId: string;
  leadId: string;
  currency: string;
  setupAmountCents: number;
  managedMonthlyAmountCents: number | null;
  managedPlanSelected: boolean;
  description: string;
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

export class LiveStripeProvider implements PaymentProvider {
  id = PAYMENT_PROVIDER_STRIPE as "stripe";

  constructor(private readonly secretKey: string) {}

  async createCheckoutSession(): Promise<CheckoutSessionResult> {
    if (!this.secretKey) {
      throw new Error("stripe_secret_key_missing");
    }
    throw new Error("live_stripe_checkout_not_enabled_for_milestone_9");
  }
}

export function createPaymentProviderFromEnv(env: NodeJS.ProcessEnv): PaymentProvider {
  if (env.STRIPE_ALLOW_LIVE_PAYMENTS === "true") {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("stripe_live_payments_enabled_without_secret_key");
    }
    return new LiveStripeProvider(env.STRIPE_SECRET_KEY);
  }
  return new MockStripeProvider();
}

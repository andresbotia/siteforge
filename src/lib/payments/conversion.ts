import type { LeadStatus } from "@/types";
import type { PaymentEnvironment } from "@/types";

export function resolveCustomerPlan(input: {
  managedPlanSelected: boolean;
}): "website_only" | "managed" {
  return input.managedPlanSelected ? "managed" : "website_only";
}

export function shouldCreateManagedSubscription(input: {
  managedPlanSelected: boolean;
  managedMonthlyAmountCents: number | null;
}): boolean {
  return input.managedPlanSelected && input.managedMonthlyAmountCents !== null;
}

/**
 * Maps Stripe's own subscription status vocabulary
 * (active/trialing/past_due/unpaid/canceled/incomplete/incomplete_expired/paused)
 * onto SiteForge's subscriptions.status column. `canceled` (Stripe's
 * spelling) maps to the pre-existing `cancelled` value SiteForge's mock
 * flow already used, rather than introducing a second, differently-spelled
 * terminal state. Rare/edge Stripe statuses this session does not act on
 * differently (incomplete, incomplete_expired, paused) fall through to
 * `inactive` rather than growing the accepted-value list further.
 */
export function mapStripeSubscriptionStatus(stripeStatus: string): "active" | "trialing" | "past_due" | "unpaid" | "cancelled" | "inactive" {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
      return "cancelled";
    default:
      return "inactive";
  }
}

export function nextLeadStatusAfterCheckout(current: LeadStatus): LeadStatus {
  if (current === "rejected") return current;
  return "customer";
}

export function inferPaymentEnvironment(input: {
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionProviderId?: string | null;
  sessionProvider?: string | null;
}): PaymentEnvironment {
  if (input.sessionProvider === "mock") return "mock";
  if (
    input.stripeCustomerId?.startsWith("cus_mock_") ||
    input.stripeCheckoutSessionId?.startsWith("cs_mock_") ||
    input.stripePaymentIntentId?.startsWith("pi_mock_") ||
    input.stripeSubscriptionId?.startsWith("sub_mock_") ||
    input.subscriptionProviderId?.startsWith("sub_mock_")
  ) {
    return "mock";
  }
  if (
    input.sessionProvider === "stripe" ||
    input.stripeCustomerId?.startsWith("cus_") ||
    input.stripeCheckoutSessionId?.startsWith("cs_") ||
    input.stripePaymentIntentId?.startsWith("pi_") ||
    input.stripeSubscriptionId?.startsWith("sub_") ||
    input.subscriptionProviderId?.startsWith("sub_")
  ) {
    return "live";
  }
  return "unknown";
}

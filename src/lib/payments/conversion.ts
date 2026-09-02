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

/**
 * M9.7 fix: previously this function only distinguished mock vs. "live"
 * (anything real-Stripe-shaped and non-mock was called "live"), which
 * silently miscounted every M9.6 Sandbox TEST-mode payment as real
 * revenue -- exactly the bug this milestone's own requirements ("do not
 * count Stripe TEST payments as real revenue") call out. Stripe Checkout
 * Session IDs are the one Stripe object ID that reliably encodes its own
 * mode in the ID text itself (cs_test_... vs cs_live_...); customer/
 * payment-intent/subscription IDs do not. When a checkout session ID is
 * available, its own prefix is authoritative. When it is not (an older
 * record, or a customer joined only by customer/subscription ID), the
 * residual "real Stripe object, mode unknown" bucket now defaults to
 * "test" rather than "live" -- the conservative choice, since overclaiming
 * revenue is the more harmful failure mode than underclaiming it.
 */
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
  if (input.stripeCheckoutSessionId?.startsWith("cs_test_")) return "test";
  if (input.stripeCheckoutSessionId?.startsWith("cs_live_")) return "live";
  if (
    input.sessionProvider === "stripe" ||
    input.stripeCustomerId?.startsWith("cus_") ||
    input.stripePaymentIntentId?.startsWith("pi_") ||
    input.stripeSubscriptionId?.startsWith("sub_") ||
    input.subscriptionProviderId?.startsWith("sub_")
  ) {
    return "test";
  }
  return "unknown";
}

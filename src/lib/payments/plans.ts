import {
  DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
  DEFAULT_SETUP_AMOUNT_CENTS,
} from "@/lib/payments/limits";

/**
 * M9.9 offer amount lock.
 *
 * Before this milestone `/offers/[id]` accepted an arbitrary typed cent
 * amount. `LiveStripeProvider` independently refuses to create a session
 * when an offer's recorded amounts have drifted from the configured Stripe
 * Price IDs (see provider-core.ts), so an operator could draft, approve and
 * publish an offer that hard-failed the instant a customer clicked buy.
 *
 * This module is the single source of the only two purchasable
 * configurations. The offer-drafting server action derives amounts from a
 * plan key here and never trusts a client-supplied amount, so drift cannot
 * be introduced through the UI in the first place.
 *
 * The provider-side price-lock check is deliberately NOT weakened or
 * removed by this: it stays the last line of defense before real money
 * moves, and it independently re-checks the same two amounts. Both layers
 * read the same DEFAULT_* constants, so there is one place to change price.
 */
export type OfferPlanKey = "website_only" | "website_plus_managed";

export type OfferPlan = {
  key: OfferPlanKey;
  label: string;
  description: string;
  setupAmountCents: number;
  /** Non-null only when the plan actually includes the recurring managed service. */
  managedMonthlyAmountCents: number | null;
  managedPlanSelected: boolean;
};

export const OFFER_PLANS: readonly OfferPlan[] = [
  {
    key: "website_only",
    label: "Website only",
    description: "One-time website setup.",
    setupAmountCents: DEFAULT_SETUP_AMOUNT_CENTS,
    managedMonthlyAmountCents: DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
    managedPlanSelected: false,
  },
  {
    key: "website_plus_managed",
    label: "Website + managed",
    description: "One-time website setup plus the optional monthly managed plan.",
    setupAmountCents: DEFAULT_SETUP_AMOUNT_CENTS,
    managedMonthlyAmountCents: DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
    managedPlanSelected: true,
  },
] as const;

export function isOfferPlanKey(value: string): value is OfferPlanKey {
  return OFFER_PLANS.some((plan) => plan.key === value);
}

export function resolveOfferPlan(key: string): OfferPlan {
  return OFFER_PLANS.find((plan) => plan.key === key) ?? OFFER_PLANS[0];
}

/**
 * Which configured plan an existing offer row corresponds to, or null when
 * its recorded amounts have drifted away from both configured options (an
 * offer drafted before M9.9, or edited directly in the database). A null
 * here is exactly the state that would make LiveStripeProvider throw.
 */
export function offerPlanKeyFromAmounts(input: {
  setupAmountCents: number;
  managedMonthlyAmountCents: number | null;
  managedPlanSelected: boolean;
}): OfferPlanKey | null {
  if (input.setupAmountCents !== DEFAULT_SETUP_AMOUNT_CENTS) return null;
  if (input.managedPlanSelected) {
    return input.managedMonthlyAmountCents === DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS
      ? "website_plus_managed"
      : null;
  }
  if (
    input.managedMonthlyAmountCents !== null &&
    input.managedMonthlyAmountCents !== DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS
  ) {
    return null;
  }
  return "website_only";
}

/**
 * Mirrors LiveStripeProvider's own price-lock predicate without importing
 * the provider (which pulls in the Stripe SDK). Used by the M9.9 follow-up
 * send-eligibility check so an operator is told the offer would be refused
 * BEFORE an email goes out, instead of after a customer clicks a dead link.
 */
export function offerAmountsMatchConfiguredPrices(input: {
  setupAmountCents: number;
  managedMonthlyAmountCents: number | null;
  managedPlanSelected: boolean;
}): boolean {
  return offerPlanKeyFromAmounts(input) !== null;
}

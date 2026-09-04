import { inferPaymentEnvironment } from "@/lib/payments/conversion";

/**
 * M10.6 Task 1. Pure classification logic for `scripts/archive-stale-leads.ts`.
 * No I/O here -- the script does the reading/writing; this module is what
 * decides, and is unit-tested on its own.
 *
 * Three categories, exactly as scoped by the operator brief. Deliberately
 * narrow: a lead that matches none of these is left alone, never archived by
 * inference or "looks fake" heuristics.
 */
export type ArchiveCategory =
  | "seed_fixture"
  | "scout_never_advanced"
  | "mock_stripe_customer";

export type ArchivableLead = {
  id: string;
  businessName: string;
  source: string | null;
  status: string;
};

export type ArchivableLeadCustomer = {
  stripeCustomerId: string | null;
  /**
   * The value stored in customers.conversion_metadata.checkout_session_id.
   * Only trusted as a Stripe checkout session id when it is actually
   * Stripe-shaped (`cs_...`) -- the mock provider stores a plain UUID there,
   * which must not be misread as a `cs_live_`/`cs_test_` id.
   */
  checkoutSessionId: string | null;
};

export type ArchiveClassification = {
  leadId: string;
  businessName: string;
  category: ArchiveCategory;
  reason: string;
};

export const ARCHIVE_CATEGORY_LABEL: Record<ArchiveCategory, string> = {
  seed_fixture: "Seed / fixture",
  scout_never_advanced: "Scout experiment, never advanced",
  mock_stripe_customer: "Customer conversion used mock Stripe identifiers",
};

/** `leads.source` is null for the earliest seed rows and "seed" for later ones -- both mean the same thing. */
const SEED_SOURCE_VALUES = new Set<string | null>([null, "", "seed"]);

/**
 * Classify one lead for archival. Returns null when the lead has real
 * provenance and should be left alone -- this is the function real-provenance
 * leads (manual public prospects, anything not matching a rule) fall through.
 */
export function classifyLeadForArchival(
  lead: ArchivableLead,
  customer: ArchivableLeadCustomer | null,
): ArchiveClassification | null {
  if (SEED_SOURCE_VALUES.has(lead.source)) {
    return {
      leadId: lead.id,
      businessName: lead.businessName,
      category: "seed_fixture",
      reason:
        "Seed/fixture data (leads.source is seed or unset): a fictional business inserted for development, not a real prospect.",
    };
  }

  if (lead.source === "scout" && lead.status === "discovered") {
    return {
      leadId: lead.id,
      businessName: lead.businessName,
      category: "scout_never_advanced",
      reason:
        'Scout-discovered lead that never advanced past "discovered": an experiment row, not qualified or worked.',
    };
  }

  if (customer) {
    const environment = inferPaymentEnvironment({
      stripeCustomerId: customer.stripeCustomerId,
      stripeCheckoutSessionId: customer.checkoutSessionId?.startsWith("cs_")
        ? customer.checkoutSessionId
        : null,
    });
    if (environment === "mock") {
      return {
        leadId: lead.id,
        businessName: lead.businessName,
        category: "mock_stripe_customer",
        reason:
          "Customer conversion used mock Stripe identifiers (cus_mock_/cs_mock_): a smoke-test checkout, not a real payment.",
      };
    }
  }

  return null;
}

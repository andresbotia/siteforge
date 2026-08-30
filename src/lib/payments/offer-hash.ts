import { createHash } from "node:crypto";
import { COMMERCIAL_OFFER_VERSION } from "@/lib/payments/limits";

export type OfferContentFingerprintInput = {
  leadId: string;
  generatedWebsiteId: string | null;
  outreachId: string | null;
  currency: string;
  setupAmountCents: number;
  managedMonthlyAmountCents: number | null;
  managedPlanSelected: boolean;
  description: string;
  contentVersion?: string;
};

function normalize(input: OfferContentFingerprintInput) {
  return {
    content_version: input.contentVersion ?? COMMERCIAL_OFFER_VERSION,
    currency: input.currency.toLowerCase(),
    description: input.description.trim(),
    generated_website_id: input.generatedWebsiteId,
    lead_id: input.leadId,
    managed_monthly_amount_cents: input.managedMonthlyAmountCents,
    managed_plan_selected: input.managedPlanSelected,
    outreach_id: input.outreachId,
    setup_amount_cents: input.setupAmountCents,
  };
}

export function computeCommercialOfferContentHash(
  input: OfferContentFingerprintInput,
): string {
  return createHash("sha256")
    .update(JSON.stringify(normalize(input)))
    .digest("hex");
}

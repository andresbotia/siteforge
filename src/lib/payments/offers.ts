import {
  COMMERCIAL_OFFER_VERSION,
  DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
  DEFAULT_SETUP_AMOUNT_CENTS,
} from "@/lib/payments/limits";
import { computeCommercialOfferContentHash } from "@/lib/payments/offer-hash";
import { isPaymentCurrency, validateAmountCents, type PaymentCurrency } from "@/lib/payments/money";
import type { Lead, Outreach } from "@/types";

export type CommercialOfferStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "checkout_created"
  | "paid"
  | "expired"
  | "cancelled";

export type CommercialOfferInput = {
  leadId: string;
  generatedWebsiteId: string | null;
  outreachId: string | null;
  currency: string;
  setupAmountCents: number;
  managedMonthlyAmountCents: number | null;
  managedPlanSelected: boolean;
  description: string;
};

export type CommercialOfferDraft = CommercialOfferInput & {
  contentVersion: string;
  contentHash: string;
};

export function buildDefaultCommercialOffer(input: {
  lead: Pick<Lead, "id" | "businessName" | "industry">;
  generatedWebsiteId?: string | null;
  outreach?: Pick<Outreach, "id" | "previewDeploymentId"> | null;
}): CommercialOfferDraft {
  const description = [
    `Website rebuild offer for ${input.lead.businessName}.`,
    `Includes a one-time implementation payment and optional managed monthly support.`,
    `Source industry: ${input.lead.industry}.`,
  ].join(" ");

  return buildCommercialOfferDraft({
    leadId: input.lead.id,
    generatedWebsiteId: input.generatedWebsiteId ?? null,
    outreachId: input.outreach?.id ?? null,
    currency: "usd",
    setupAmountCents: DEFAULT_SETUP_AMOUNT_CENTS,
    managedMonthlyAmountCents: DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
    managedPlanSelected: false,
    description,
  });
}

export function buildCommercialOfferDraft(
  input: CommercialOfferInput,
): CommercialOfferDraft {
  const currency = input.currency.trim().toLowerCase();
  const description = input.description.trim();
  const draft = {
    ...input,
    currency,
    description,
    contentVersion: COMMERCIAL_OFFER_VERSION,
  };

  return {
    ...draft,
    contentHash: computeCommercialOfferContentHash(draft),
  };
}

export function validateCommercialOfferInput(
  input: CommercialOfferInput,
): { ok: true; currency: PaymentCurrency } | { ok: false; error: string } {
  if (!input.leadId) return { ok: false, error: "A lead is required." };
  if (!isPaymentCurrency(input.currency)) {
    return { ok: false, error: "Unsupported currency." };
  }
  const setup = validateAmountCents(input.setupAmountCents, "Setup payment");
  if (!setup.ok) return setup;
  if (input.managedPlanSelected && input.managedMonthlyAmountCents === null) {
    return { ok: false, error: "Managed plan requires a monthly amount." };
  }
  if (input.managedMonthlyAmountCents !== null) {
    const monthly = validateAmountCents(input.managedMonthlyAmountCents, "Managed monthly payment");
    if (!monthly.ok) return monthly;
  }
  if (!input.description.trim()) return { ok: false, error: "Offer description is required." };
  return { ok: true, currency: input.currency };
}

export function canCreateCheckoutForOffer(input: {
  status: string;
  currentContentHash: string;
  approvedContentHash: string | null;
  expiresAt: string | null;
  hasCompletedCheckout: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (input.status !== "approved") {
    return { ok: false, error: "Offer must be approved before checkout can be created." };
  }
  if (input.expiresAt && new Date(input.expiresAt) <= new Date()) {
    return { ok: false, error: "Offer has expired." };
  }
  if (input.hasCompletedCheckout) {
    return { ok: false, error: "This offer already has a completed checkout." };
  }
  if (!input.approvedContentHash || input.currentContentHash !== input.approvedContentHash) {
    return { ok: false, error: "Approved offer content no longer matches." };
  }
  return { ok: true };
}

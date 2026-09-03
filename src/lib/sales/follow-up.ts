import { centsToUsd } from "@/lib/payments/money";
import { offerAmountsMatchConfiguredPrices } from "@/lib/payments/plans";
import {
  COMMERCIAL_TERMS_HEADING,
  commercialTermsLines,
} from "./commercial-terms";
import { computeFollowUpContentHash } from "./content-hash";
import type { SalesEvidenceItem } from "./types";

/**
 * M9.9 payment follow-up email.
 *
 * Deterministic and $0, exactly like the cold draft: no paid AI, no invented
 * facts, no claim that is not derived from the approved offer row itself.
 * The copy states what is being purchased, the price, the optional managed
 * plan when the offer selected it, where to pay, and what happens after
 * payment -- plus the same opt-out language the cold path requires before a
 * real send is allowed.
 *
 * The purchase URL is NOT stored in the draft. The body carries the
 * {{PURCHASE_LINK}} placeholder and the raw link is supplied at send time,
 * mirroring how the cold path handles its sfo_ link. This preserves the M9.7
 * invariant that a raw sfb_ purchase token is shown to the operator once, at
 * publish time, and is never persisted -- only its hash is, and that hash is
 * what the approval binds.
 */
export const FOLLOW_UP_LINK_PLACEHOLDER = "{{PURCHASE_LINK}}";
export const FOLLOW_UP_CONTENT_VERSION = "sales-follow-up.v1";

export type FollowUpOfferInput = {
  id: string;
  businessName: string;
  setupAmountCents: number;
  managedMonthlyAmountCents: number | null;
  managedPlanSelected: boolean;
  purchaseTokenHash: string;
};

export type FollowUpDraft = {
  subject: string;
  body: string;
  recipientEmail: string;
  senderName: string;
  senderEmail: string;
  contentHash: string;
  commercialOfferId: string;
  purchaseTokenHash: string;
  evidence: SalesEvidenceItem[];
};

function money(cents: number): string {
  const usd = centsToUsd(cents);
  return Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;
}

export function composeFollowUpDraft(
  offer: FollowUpOfferInput,
  options: { recipientEmail: string; senderName?: string; senderEmail?: string },
): FollowUpDraft {
  const senderName = options.senderName || "Andres Botia";
  const senderEmail = options.senderEmail || "outreach@siteforge.agency";
  const recipientEmail = options.recipientEmail.trim();
  const businessName = offer.businessName.trim();

  const evidence: SalesEvidenceItem[] = [
    {
      type: "business_fact",
      text: `Approved commercial offer ${offer.id} for ${businessName}`,
      source: "commercial_offers",
    },
    {
      type: "preview_link",
      text: "Purchase link bound by token hash; the raw link is supplied at send time and never stored.",
      source: "commercial_offers.purchase_token_hash",
    },
  ];

  const subject = `Your website for ${businessName} — how to get started`;

  const body = [
    `Hi ${businessName} team,`,
    "",
    `Thanks for your interest. Here is everything you need to move forward.`,
    "",
    `What you're purchasing: a website setup for ${money(offer.setupAmountCents)} one time. We build and set up your website, then hand it over ready to use.`,
    "",
    COMMERCIAL_TERMS_HEADING,
    ...commercialTermsLines(businessName),
    "",
    `You can pay securely here:`,
    FOLLOW_UP_LINK_PLACEHOLDER,
    "",
    `Payment is handled by Stripe — we never see your card details.`,
    "",
    `What happens after payment:`,
    `- You get a confirmation immediately.`,
    `- Your order moves into our setup queue and we prepare your site for the next step.`,
    `- We follow up with you directly. Nothing else is needed from you right away.`,
    "",
    `If you have any questions, just reply to this email.`,
    "",
    `Best,`,
    `${senderName}`,
    `SiteForge`,
    "",
    `If you would prefer not to hear from us, reply with "unsubscribe" and we will not contact you again.`,
  ].join("\n");

  return {
    subject,
    body,
    recipientEmail,
    senderName,
    senderEmail,
    commercialOfferId: offer.id,
    purchaseTokenHash: offer.purchaseTokenHash,
    contentHash: computeFollowUpContentHash({
      subject,
      body,
      recipient: recipientEmail,
      commercialOfferId: offer.id,
      purchaseTokenHash: offer.purchaseTokenHash,
    }),
    evidence,
  };
}

export type FollowUpEligibilityInput = {
  leadStatus: string;
  offer: {
    status: string;
    setupAmountCents: number;
    managedMonthlyAmountCents: number | null;
    managedPlanSelected: boolean;
    purchaseTokenHash: string | null;
    purchaseLinkRevokedAt: string | null;
  } | null;
};

export type FollowUpEligibilityCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

/**
 * Send-eligibility conditions specific to a payment follow-up. These are
 * ADDITIONAL to (never a replacement for) the shared checks every outreach
 * send already runs: valid recipient, exact-content approval, suppression,
 * duplicate send, provider readiness / live-email gate, and opt-out
 * language.
 */
export function evaluateFollowUpEligibility(
  input: FollowUpEligibilityInput,
): { ok: boolean; checks: FollowUpEligibilityCheck[] } {
  const { offer } = input;
  const leadInterested = input.leadStatus === "interested";
  const offerApproved = offer?.status === "approved";
  const linkActive = Boolean(offer?.purchaseTokenHash) && !offer?.purchaseLinkRevokedAt;
  const pricesMatch = offer
    ? offerAmountsMatchConfiguredPrices({
        setupAmountCents: offer.setupAmountCents,
        managedMonthlyAmountCents: offer.managedMonthlyAmountCents,
        managedPlanSelected: offer.managedPlanSelected,
      })
    : false;

  const checks: FollowUpEligibilityCheck[] = [
    {
      id: "lead_interested",
      label: "Lead is interested",
      ok: leadInterested,
      detail: leadInterested
        ? "Lead status is interested."
        : `A payment follow-up requires lead status "interested" (currently "${input.leadStatus}").`,
    },
    {
      id: "offer_approved",
      label: "Offer approved",
      ok: offerApproved,
      detail: offerApproved
        ? "The bound commercial offer is approved."
        : offer
          ? `The bound offer is "${offer.status}", not approved.`
          : "No commercial offer is bound to this follow-up.",
    },
    {
      id: "purchase_link_active",
      label: "Purchase link published",
      ok: linkActive,
      detail: linkActive
        ? "The offer has an active, non-revoked purchase link."
        : "The offer needs a published purchase link that has not been revoked.",
    },
    {
      id: "price_lock",
      label: "Offer amounts match configured prices",
      ok: pricesMatch,
      detail: pricesMatch
        ? "Offer amounts match the configured Stripe Prices."
        : "Offer amounts have drifted from the configured Stripe Prices; Stripe would refuse this checkout.",
    },
  ];

  return { ok: checks.every((check) => check.ok), checks };
}

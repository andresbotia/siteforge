import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDuplicateSendBlocked,
  verifyApprovedOutreachContent,
} from "@/lib/email/delivery-policy";
import {
  DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
  DEFAULT_SETUP_AMOUNT_CENTS,
} from "@/lib/payments/limits";
import {
  offerAmountsMatchConfiguredPrices,
  offerPlanKeyFromAmounts,
  OFFER_PLANS,
  resolveOfferPlan,
} from "@/lib/payments/plans";
import type { ApprovalRow, OutreachRow } from "@/types/database";
import { computeOutreachBindingHash } from "./content-hash";
import {
  composeFollowUpDraft,
  evaluateFollowUpEligibility,
  FOLLOW_UP_CONTENT_VERSION,
  FOLLOW_UP_LINK_PLACEHOLDER,
} from "./follow-up";
import { OUTREACH_APPROVAL_ACTION } from "./kinds";

const PURCHASE_TOKEN_HASH = "a".repeat(64);
const OFFER_ID = "offer-abc";

const offerInput = {
  id: OFFER_ID,
  businessName: "Atlantic Drain Plumbing",
  setupAmountCents: DEFAULT_SETUP_AMOUNT_CENTS,
  managedMonthlyAmountCents: DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
  managedPlanSelected: true,
  purchaseTokenHash: PURCHASE_TOKEN_HASH,
};

function draftRow(overrides: Partial<OutreachRow> = {}): OutreachRow {
  const draft = composeFollowUpDraft(offerInput, { recipientEmail: "owner@example.test" });
  return {
    kind: "follow_up",
    subject: draft.subject,
    body: draft.body,
    recipient_email: draft.recipientEmail,
    preview_deployment_id: null,
    attribution_token_hash: null,
    commercial_offer_id: OFFER_ID,
    purchase_token_hash: PURCHASE_TOKEN_HASH,
    content_version: FOLLOW_UP_CONTENT_VERSION,
    ...overrides,
  } as OutreachRow;
}

function approvalFor(row: OutreachRow, payloadOverrides: Record<string, unknown> = {}): ApprovalRow {
  const contentHash = computeOutreachBindingHash({
    kind: "follow_up",
    subject: row.subject ?? "",
    body: row.body ?? "",
    recipient: row.recipient_email ?? "",
    commercialOfferId: row.commercial_offer_id,
    purchaseTokenHash: row.purchase_token_hash,
  });
  return {
    status: "approved",
    approval_type: "external_email",
    payload: {
      action: OUTREACH_APPROVAL_ACTION.follow_up,
      outreach_kind: "follow_up",
      content_hash: contentHash,
      content_version: row.content_version,
      commercial_offer_id: row.commercial_offer_id,
      purchase_token_hash: row.purchase_token_hash,
      ...payloadOverrides,
    },
  } as unknown as ApprovalRow;
}

describe("payment follow-up draft", () => {
  it("is deterministic: the same offer and recipient always produce the same content hash", () => {
    const a = composeFollowUpDraft(offerInput, { recipientEmail: "owner@example.test" });
    const b = composeFollowUpDraft(offerInput, { recipientEmail: "owner@example.test" });
    assert.equal(a.contentHash, b.contentHash);
    assert.equal(a.body, b.body);
  });

  it("states what is purchased, the price, the optional managed plan, and what happens after payment", () => {
    const draft = composeFollowUpDraft(offerInput, { recipientEmail: "owner@example.test" });
    assert.match(draft.body, /Website setup: \$99 one time/);
    assert.match(draft.body, /Managed website: \$39 per month, optional/);
    assert.match(draft.body, /What happens after payment/);
    assert.match(draft.body, /setup queue/);
  });

  it("says the monthly plan is absent when the offer did not select it", () => {
    const draft = composeFollowUpDraft(
      { ...offerInput, managedPlanSelected: false },
      { recipientEmail: "owner@example.test" },
    );
    assert.match(draft.body, /No monthly plan is included/);
    assert.doesNotMatch(draft.body, /Managed website: \$39 per month/);
  });

  it("includes the same opt-out language the cold path requires before a real send", () => {
    const draft = composeFollowUpDraft(offerInput, { recipientEmail: "owner@example.test" });
    assert.match(draft.body, /\b(unsubscribe|opt[-\s]?out|do not contact)\b/i);
  });

  it("carries a link placeholder and never the raw purchase token", () => {
    const draft = composeFollowUpDraft(offerInput, { recipientEmail: "owner@example.test" });
    assert.ok(draft.body.includes(FOLLOW_UP_LINK_PLACEHOLDER));
    assert.doesNotMatch(draft.body, /sfb_/);
    assert.equal(draft.purchaseTokenHash, PURCHASE_TOKEN_HASH);
  });
});

describe("follow-up approval binding", () => {
  it("binds recipient, subject, body, commercial offer id, and purchase token hash", () => {
    const row = draftRow();
    assert.equal(verifyApprovedOutreachContent(row, approvalFor(row)).ok, true);
  });

  for (const [field, mutated] of [
    ["recipient", { recipient_email: "someone.else@example.test" }],
    ["subject", { subject: "Different subject" }],
    ["body", { body: `Edited copy ${FOLLOW_UP_LINK_PLACEHOLDER}` }],
    ["commercial offer id", { commercial_offer_id: "offer-other" }],
    ["purchase token hash", { purchase_token_hash: "b".repeat(64) }],
  ] as Array<[string, Partial<OutreachRow>]>) {
    it(`invalidates the approval when the bound ${field} changes`, () => {
      const original = draftRow();
      const approval = approvalFor(original);
      const edited = draftRow(mutated);
      assert.equal(verifyApprovedOutreachContent(edited, approval).ok, false);
    });
  }

  it("invalidates the approval when the content version changes", () => {
    const original = draftRow();
    const approval = approvalFor(original);
    assert.equal(
      verifyApprovedOutreachContent(draftRow({ content_version: "sales-follow-up.v2" }), approval).ok,
      false,
    );
  });

  it("refuses an approval granted for the cold path (different payload action)", () => {
    const row = draftRow();
    const coldApproval = approvalFor(row, { action: "send_outreach_email" });
    assert.equal(verifyApprovedOutreachContent(row, coldApproval).ok, false);
  });

  it("refuses an approval that is not in an approved state", () => {
    const row = draftRow();
    const pending = { ...approvalFor(row), status: "pending" } as ApprovalRow;
    assert.equal(verifyApprovedOutreachContent(row, pending).ok, false);
    assert.equal(verifyApprovedOutreachContent(row, null).ok, false);
  });

  it("cannot be satisfied by a cold-email hash: the two kinds hash into separate domains", () => {
    const row = draftRow();
    const coldHash = computeOutreachBindingHash({
      kind: "cold_outreach",
      subject: row.subject ?? "",
      body: row.body ?? "",
      recipient: row.recipient_email ?? "",
      previewDeploymentId: null,
      attributionTokenHash: null,
    });
    const followUpHash = computeOutreachBindingHash({
      kind: "follow_up",
      subject: row.subject ?? "",
      body: row.body ?? "",
      recipient: row.recipient_email ?? "",
      commercialOfferId: row.commercial_offer_id,
      purchaseTokenHash: row.purchase_token_hash,
    });
    assert.notEqual(coldHash, followUpHash);
  });
});

describe("duplicate-send blocking is per outreach kind", () => {
  const lead = "lead-1";
  const followUp = { id: "o-follow", lead_id: lead, kind: "follow_up", status: "approved" } as OutreachRow;
  const sentCold = { id: "o-cold", lead_id: lead, kind: "cold_outreach", status: "sent" } as OutreachRow;

  it("does not block a follow-up because a cold email was already sent to the same lead", () => {
    const result = isDuplicateSendBlocked({ outreach: followUp, siblings: [sentCold, followUp] });
    assert.equal(result.blocked, false);
  });

  it("blocks a second follow-up when one was already sent to the same lead", () => {
    const sentFollowUp = { ...followUp, id: "o-follow-earlier", status: "sent" } as OutreachRow;
    const result = isDuplicateSendBlocked({
      outreach: followUp,
      siblings: [sentCold, sentFollowUp, followUp],
    });
    assert.equal(result.blocked, true);
    assert.match(result.reason, /follow-up/i);
  });

  it("still blocks re-sending the very same outreach row", () => {
    const alreadySent = { ...followUp, status: "sent" } as OutreachRow;
    assert.equal(isDuplicateSendBlocked({ outreach: alreadySent, siblings: [] }).blocked, true);
  });

  it("does not block a cold email because another lead was sent one", () => {
    const otherLead = { id: "o-other", lead_id: "lead-2", kind: "cold_outreach", status: "sent" } as OutreachRow;
    const cold = { id: "o-cold-2", lead_id: lead, kind: "cold_outreach", status: "approved" } as OutreachRow;
    assert.equal(isDuplicateSendBlocked({ outreach: cold, siblings: [otherLead] }).blocked, false);
  });

  it("treats a row with no kind value as cold outreach", () => {
    const legacy = { id: "o-legacy", lead_id: lead, kind: "", status: "sent" } as OutreachRow;
    const cold = { id: "o-new", lead_id: lead, kind: "cold_outreach", status: "approved" } as OutreachRow;
    assert.equal(isDuplicateSendBlocked({ outreach: cold, siblings: [legacy] }).blocked, true);
  });
});

describe("follow-up send eligibility", () => {
  const eligibleOffer = {
    status: "approved",
    setupAmountCents: DEFAULT_SETUP_AMOUNT_CENTS,
    managedMonthlyAmountCents: DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
    managedPlanSelected: true,
    purchaseTokenHash: PURCHASE_TOKEN_HASH,
    purchaseLinkRevokedAt: null,
  };

  it("passes when the lead is interested, the offer is approved and published, and prices match", () => {
    const result = evaluateFollowUpEligibility({ leadStatus: "interested", offer: eligibleOffer });
    assert.equal(result.ok, true);
  });

  it("refuses when the lead is not interested", () => {
    for (const status of ["contacted", "website_built", "customer", "archived", "rejected", ""]) {
      const result = evaluateFollowUpEligibility({ leadStatus: status, offer: eligibleOffer });
      assert.equal(result.ok, false, `lead status ${status} must not be eligible`);
      const check = result.checks.find((item) => item.id === "lead_interested");
      assert.equal(check?.ok, false);
      assert.match(check?.detail ?? "", /interested/);
    }
  });

  it("refuses when the offer is not approved", () => {
    const result = evaluateFollowUpEligibility({
      leadStatus: "interested",
      offer: { ...eligibleOffer, status: "draft" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.checks.find((item) => item.id === "offer_approved")?.ok, false);
  });

  it("refuses when no purchase link is published, or it was revoked", () => {
    const unpublished = evaluateFollowUpEligibility({
      leadStatus: "interested",
      offer: { ...eligibleOffer, purchaseTokenHash: null },
    });
    assert.equal(unpublished.checks.find((item) => item.id === "purchase_link_active")?.ok, false);

    const revoked = evaluateFollowUpEligibility({
      leadStatus: "interested",
      offer: { ...eligibleOffer, purchaseLinkRevokedAt: new Date().toISOString() },
    });
    assert.equal(revoked.checks.find((item) => item.id === "purchase_link_active")?.ok, false);
  });

  it("refuses when offer amounts have drifted from the configured Stripe Prices", () => {
    const result = evaluateFollowUpEligibility({
      leadStatus: "interested",
      offer: { ...eligibleOffer, setupAmountCents: 12_300 },
    });
    assert.equal(result.ok, false);
    assert.equal(result.checks.find((item) => item.id === "price_lock")?.ok, false);
  });

  it("refuses when no offer is bound at all", () => {
    const result = evaluateFollowUpEligibility({ leadStatus: "interested", offer: null });
    assert.equal(result.ok, false);
  });
});

describe("offer amount lock", () => {
  it("offers exactly two configured plans, both at the locked setup price", () => {
    assert.equal(OFFER_PLANS.length, 2);
    for (const plan of OFFER_PLANS) {
      assert.equal(plan.setupAmountCents, DEFAULT_SETUP_AMOUNT_CENTS);
    }
    assert.deepEqual(
      OFFER_PLANS.map((plan) => plan.key),
      ["website_only", "website_plus_managed"],
    );
  });

  it("resolves an unknown or absent plan key to a configured plan, never to a typed amount", () => {
    assert.equal(resolveOfferPlan("").key, "website_only");
    assert.equal(resolveOfferPlan("free_website").setupAmountCents, DEFAULT_SETUP_AMOUNT_CENTS);
    assert.equal(resolveOfferPlan("website_plus_managed").managedPlanSelected, true);
  });

  it("detects an offer whose amounts drifted away from both configured plans", () => {
    assert.equal(
      offerPlanKeyFromAmounts({
        setupAmountCents: DEFAULT_SETUP_AMOUNT_CENTS,
        managedMonthlyAmountCents: DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
        managedPlanSelected: false,
      }),
      "website_only",
    );
    assert.equal(
      offerPlanKeyFromAmounts({
        setupAmountCents: 4_900,
        managedMonthlyAmountCents: null,
        managedPlanSelected: false,
      }),
      null,
    );
    assert.equal(
      offerPlanKeyFromAmounts({
        setupAmountCents: DEFAULT_SETUP_AMOUNT_CENTS,
        managedMonthlyAmountCents: 1_900,
        managedPlanSelected: true,
      }),
      null,
    );
  });

  it("agrees with the provider-side price lock on what is acceptable", () => {
    // LiveStripeProvider throws unless setup === 9900 and, when managed is
    // selected, monthly === 3900. This predicate must never say "fine" to
    // something the provider would reject.
    assert.equal(
      offerAmountsMatchConfiguredPrices({
        setupAmountCents: DEFAULT_SETUP_AMOUNT_CENTS,
        managedMonthlyAmountCents: DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
        managedPlanSelected: true,
      }),
      true,
    );
    assert.equal(
      offerAmountsMatchConfiguredPrices({
        setupAmountCents: 9_901,
        managedMonthlyAmountCents: DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
        managedPlanSelected: true,
      }),
      false,
    );
    assert.equal(
      offerAmountsMatchConfiguredPrices({
        setupAmountCents: DEFAULT_SETUP_AMOUNT_CENTS,
        managedMonthlyAmountCents: 3_901,
        managedPlanSelected: true,
      }),
      false,
    );
  });
});

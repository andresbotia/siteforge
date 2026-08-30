import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  inferPaymentEnvironment,
  nextLeadStatusAfterCheckout,
  resolveCustomerPlan,
  shouldCreateManagedSubscription,
} from "@/lib/payments/conversion";
import { computeCommercialOfferContentHash } from "@/lib/payments/offer-hash";
import { buildCommercialOfferDraft, buildDefaultCommercialOffer, canCreateCheckoutForOffer, validateCommercialOfferInput } from "@/lib/payments/offers";
import { MockStripeProvider, createPaymentProviderFromEnv } from "@/lib/payments/provider-core";
import { parseCents, validateAmountCents } from "@/lib/payments/money";
import { normalizeStripeWebhookEvent, verifyStripeWebhookSignature } from "@/lib/payments/webhook";
import type { Lead } from "@/types";

const lead: Lead = {
  id: "lead-1",
  businessName: "Atlantic Drain Plumbing",
  industry: "Plumbing",
  location: "Fort Lauderdale, FL",
  city: "Fort Lauderdale",
  phone: "",
  email: "",
  website: "",
  rating: 4.7,
  reviewCount: 81,
  websiteScore: 38,
  leadScore: 87,
  status: "contacted",
  createdAt: "2026-08-30T00:00:00.000Z",
  qualificationTier: "high_priority",
  businessStrengthScore: 90,
  websiteOpportunityScore: 70,
  overallQualificationScore: 87,
  qualificationReasons: [],
  discoverySource: null,
  lastScoutRunId: null,
  inspectionSummary: null,
};

describe("commercial offer content binding", () => {
  it("hashes identical offer content deterministically", () => {
    const input = {
      leadId: "lead-1",
      generatedWebsiteId: "site-1",
      outreachId: "outreach-1",
      currency: "USD",
      setupAmountCents: 9900,
      managedMonthlyAmountCents: 3900,
      managedPlanSelected: true,
      description: "Offer",
    };
    assert.equal(
      computeCommercialOfferContentHash(input),
      computeCommercialOfferContentHash({ ...input, currency: "usd" }),
    );
  });

  it("changes the hash when pricing changes", () => {
    const draft = buildCommercialOfferDraft({
      leadId: "lead-1",
      generatedWebsiteId: "site-1",
      outreachId: null,
      currency: "usd",
      setupAmountCents: 9900,
      managedMonthlyAmountCents: null,
      managedPlanSelected: false,
      description: "Offer",
    });
    const edited = buildCommercialOfferDraft({ ...draft, setupAmountCents: 10900 });
    assert.notEqual(draft.contentHash, edited.contentHash);
  });

  it("changes the hash when description changes", () => {
    const draft = buildCommercialOfferDraft({
      leadId: "lead-1",
      generatedWebsiteId: "site-1",
      outreachId: null,
      currency: "usd",
      setupAmountCents: 9900,
      managedMonthlyAmountCents: null,
      managedPlanSelected: false,
      description: "Offer A",
    });
    assert.notEqual(
      draft.contentHash,
      buildCommercialOfferDraft({ ...draft, description: "Offer B" }).contentHash,
    );
  });

  it("builds the default offer at the documented M9 prices", () => {
    const draft = buildDefaultCommercialOffer({ lead, generatedWebsiteId: "site-1" });
    assert.equal(draft.setupAmountCents, 9900);
    assert.equal(draft.managedMonthlyAmountCents, 3900);
    assert.equal(draft.managedPlanSelected, false);
    assert.match(draft.description, /Atlantic Drain Plumbing/);
  });
});

describe("commercial offer validation", () => {
  it("accepts a website-only USD offer", () => {
    const result = validateCommercialOfferInput({
      leadId: "lead-1",
      generatedWebsiteId: null,
      outreachId: null,
      currency: "usd",
      setupAmountCents: 9900,
      managedMonthlyAmountCents: null,
      managedPlanSelected: false,
      description: "Offer",
    });
    assert.equal(result.ok, true);
  });

  it("rejects unsupported currencies", () => {
    assert.equal(
      validateCommercialOfferInput({
        leadId: "lead-1",
        generatedWebsiteId: null,
        outreachId: null,
        currency: "eur",
        setupAmountCents: 9900,
        managedMonthlyAmountCents: null,
        managedPlanSelected: false,
        description: "Offer",
      }).ok,
      false,
    );
  });

  it("rejects non-positive setup cents", () => {
    assert.equal(validateAmountCents(0, "Setup payment").ok, false);
  });

  it("rejects unsafe large setup cents", () => {
    assert.equal(validateAmountCents(1_000_001, "Setup payment").ok, false);
  });

  it("requires monthly cents when managed is selected", () => {
    assert.equal(
      validateCommercialOfferInput({
        leadId: "lead-1",
        generatedWebsiteId: null,
        outreachId: null,
        currency: "usd",
        setupAmountCents: 9900,
        managedMonthlyAmountCents: null,
        managedPlanSelected: true,
        description: "Offer",
      }).ok,
      false,
    );
  });

  it("parses whole cents from forms only", () => {
    assert.equal(parseCents("9900"), 9900);
    assert.equal(parseCents("99.00"), null);
    assert.equal(parseCents("-1"), null);
  });
});

describe("checkout approval policy", () => {
  it("allows only approved matching content", () => {
    assert.equal(
      canCreateCheckoutForOffer({
        status: "approved",
        currentContentHash: "abc",
        approvedContentHash: "abc",
        expiresAt: null,
        hasCompletedCheckout: false,
      }).ok,
      true,
    );
  });

  it("blocks draft offers", () => {
    assert.equal(
      canCreateCheckoutForOffer({
        status: "draft",
        currentContentHash: "abc",
        approvedContentHash: "abc",
        expiresAt: null,
        hasCompletedCheckout: false,
      }).ok,
      false,
    );
  });

  it("blocks edited offers after approval", () => {
    assert.equal(
      canCreateCheckoutForOffer({
        status: "approved",
        currentContentHash: "abc",
        approvedContentHash: "def",
        expiresAt: null,
        hasCompletedCheckout: false,
      }).ok,
      false,
    );
  });

  it("blocks completed checkout duplicates", () => {
    assert.equal(
      canCreateCheckoutForOffer({
        status: "approved",
        currentContentHash: "abc",
        approvedContentHash: "abc",
        expiresAt: null,
        hasCompletedCheckout: true,
      }).ok,
      false,
    );
  });

  it("blocks expired offers", () => {
    assert.equal(
      canCreateCheckoutForOffer({
        status: "approved",
        currentContentHash: "abc",
        approvedContentHash: "abc",
        expiresAt: "2020-01-01T00:00:00.000Z",
        hasCompletedCheckout: false,
      }).ok,
      false,
    );
  });
});

describe("mock stripe provider", () => {
  it("creates deterministic mock checkout sessions", async () => {
    const provider = new MockStripeProvider();
    const request = {
      offerId: "offer-1",
      leadId: "lead-1",
      currency: "usd",
      setupAmountCents: 9900,
      managedMonthlyAmountCents: null,
      managedPlanSelected: false,
      description: "Offer",
    };
    const a = await provider.createCheckoutSession(request);
    const b = await provider.createCheckoutSession(request);
    assert.equal(a.checkoutSessionId, b.checkoutSessionId);
    assert.equal(a.provider, "mock");
    assert.match(a.checkoutUrl, /^https:\/\/checkout\.stripe\.test\/cs_mock_/);
  });

  it("uses subscription mode for managed offers", async () => {
    const session = await new MockStripeProvider().createCheckoutSession({
      offerId: "offer-1",
      leadId: "lead-1",
      currency: "usd",
      setupAmountCents: 9900,
      managedMonthlyAmountCents: 3900,
      managedPlanSelected: true,
      description: "Offer",
    });
    assert.equal(session.mode, "subscription");
    assert.ok(session.subscriptionId);
  });

  it("defaults to mock payments without live Stripe opt-in", () => {
    assert.equal(createPaymentProviderFromEnv({}).id, "mock");
  });

  it("fails closed when live payments are enabled without a secret", () => {
    assert.throws(
      () => createPaymentProviderFromEnv({ STRIPE_ALLOW_LIVE_PAYMENTS: "true" }),
      /stripe_live_payments_enabled_without_secret_key/,
    );
  });
});

describe("stripe webhook parsing and verification", () => {
  it("verifies Stripe-style HMAC signatures", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    const timestamp = Math.floor(Date.now() / 1000);
    const secret = "test_webhook_secret";
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    assert.equal(
      verifyStripeWebhookSignature({
        rawBody,
        signatureHeader: `t=${timestamp},v1=${signature}`,
        secret,
      }),
      true,
    );
  });

  it("rejects missing webhook secrets", () => {
    assert.equal(
      verifyStripeWebhookSignature({
        rawBody: "{}",
        signatureHeader: "t=1,v1=abc",
        secret: undefined,
      }),
      false,
    );
  });

  it("normalizes checkout completion payloads", () => {
    const normalized = normalizeStripeWebhookEvent({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          object: "checkout.session",
          id: "cs_test_1",
          customer: "cus_1",
          payment_intent: "pi_1",
          amount_total: 9900,
          currency: "usd",
          metadata: { commercial_offer_id: "offer-1" },
        },
      },
    });
    assert.equal(normalized?.checkoutSessionId, "cs_test_1");
    assert.equal(normalized?.metadata.commercial_offer_id, "offer-1");
  });

  it("ignores unsupported event types", () => {
    assert.equal(normalizeStripeWebhookEvent({ id: "evt_1", type: "invoice.paid" }), null);
  });
});

describe("customer conversion helpers", () => {
  it("maps managed offers to managed customers", () => {
    assert.equal(resolveCustomerPlan({ managedPlanSelected: true }), "managed");
  });

  it("maps one-time offers to website-only customers", () => {
    assert.equal(resolveCustomerPlan({ managedPlanSelected: false }), "website_only");
  });

  it("creates managed subscription records only when monthly pricing exists", () => {
    assert.equal(
      shouldCreateManagedSubscription({
        managedPlanSelected: true,
        managedMonthlyAmountCents: 3900,
      }),
      true,
    );
    assert.equal(
      shouldCreateManagedSubscription({
        managedPlanSelected: true,
        managedMonthlyAmountCents: null,
      }),
      false,
    );
  });

  it("advances active leads to customer", () => {
    assert.equal(nextLeadStatusAfterCheckout("interested"), "customer");
  });

  it("does not overwrite rejected leads", () => {
    assert.equal(nextLeadStatusAfterCheckout("rejected"), "rejected");
  });

  it("identifies mock checkout-derived customers", () => {
    assert.equal(
      inferPaymentEnvironment({
        stripeCustomerId: "cus_mock_123",
        stripeCheckoutSessionId: "cs_mock_123",
        subscriptionProviderId: "sub_mock_123",
      }),
      "mock",
    );
  });

  it("identifies live Stripe-derived customers", () => {
    assert.equal(
      inferPaymentEnvironment({
        stripeCustomerId: "cus_123",
        stripeCheckoutSessionId: "cs_live_123",
        subscriptionProviderId: "sub_123",
        sessionProvider: "stripe",
      }),
      "live",
    );
  });

  it("keeps missing payment provenance unknown", () => {
    assert.equal(inferPaymentEnvironment({}), "unknown");
  });
});

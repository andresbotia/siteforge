import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  inferPaymentEnvironment,
  mapStripeSubscriptionStatus,
  nextLeadStatusAfterCheckout,
  resolveCustomerPlan,
  shouldCreateManagedSubscription,
} from "@/lib/payments/conversion";
import { buildCheckoutCancelUrl, buildCheckoutSuccessUrl, resolveAppOrigin } from "@/lib/payments/checkout-urls";
import { classifyStripeKeyMode, getStripeConfigStatus, getStripeSecretConfigFromEnv } from "@/lib/payments/config";
import { DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS, DEFAULT_SETUP_AMOUNT_CENTS } from "@/lib/payments/limits";
import { computeCommercialOfferContentHash } from "@/lib/payments/offer-hash";
import { buildCommercialOfferDraft, buildDefaultCommercialOffer, canCreateCheckoutForOffer, validateCommercialOfferInput } from "@/lib/payments/offers";
import { isPublicCheckoutStatusPath } from "@/lib/payments/routes";
import { LiveStripeProvider, MockStripeProvider, createPaymentProviderFromEnv, type StripeCheckoutClient } from "@/lib/payments/provider-core";
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

  it("safely acknowledges an event type it does not act on, rather than returning null", () => {
    const normalized = normalizeStripeWebhookEvent({ id: "evt_1", type: "payment_method.attached" });
    assert.equal(normalized.kind, "ignored");
    assert.equal(normalized.eventId, "evt_1");
  });

  it("never crashes on a malformed/incomplete payload -- falls through to ignored", () => {
    assert.equal(normalizeStripeWebhookEvent({}).kind, "ignored");
    assert.equal(normalizeStripeWebhookEvent(null).kind, "ignored");
    assert.equal(normalizeStripeWebhookEvent({ id: "evt_1", type: "invoice.paid" }).kind, "ignored");
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

describe("mapStripeSubscriptionStatus", () => {
  it("maps Stripe's real subscription statuses onto SiteForge's schema", () => {
    assert.equal(mapStripeSubscriptionStatus("active"), "active");
    assert.equal(mapStripeSubscriptionStatus("trialing"), "trialing");
    assert.equal(mapStripeSubscriptionStatus("past_due"), "past_due");
    assert.equal(mapStripeSubscriptionStatus("unpaid"), "unpaid");
    assert.equal(mapStripeSubscriptionStatus("canceled"), "cancelled");
  });

  it("falls back to inactive for edge Stripe statuses it does not act on differently", () => {
    assert.equal(mapStripeSubscriptionStatus("incomplete"), "inactive");
    assert.equal(mapStripeSubscriptionStatus("incomplete_expired"), "inactive");
    assert.equal(mapStripeSubscriptionStatus("paused"), "inactive");
    assert.equal(mapStripeSubscriptionStatus("some_future_stripe_status"), "inactive");
  });
});

describe("Stripe mode/config status", () => {
  it("is mock whenever the live gate is not exactly \"true\", regardless of other Stripe env vars being set", () => {
    assert.equal(getStripeConfigStatus({}).mode, "mock");
    assert.equal(getStripeConfigStatus({ STRIPE_SECRET_KEY: "sk_live_x" }).mode, "mock");
    assert.equal(getStripeConfigStatus({ STRIPE_ALLOW_LIVE_PAYMENTS: "yes" }).mode, "mock");
  });

  it("classifies test vs live from the secret key's own prefix, not a separate hand-set variable", () => {
    assert.equal(classifyStripeKeyMode("sk_test_abc"), "test");
    assert.equal(classifyStripeKeyMode("sk_live_abc"), "live");
    assert.equal(classifyStripeKeyMode("not_a_stripe_key"), "unknown");
  });

  it("is test mode when the live gate is enabled with a test-prefixed key", () => {
    const status = getStripeConfigStatus({ STRIPE_ALLOW_LIVE_PAYMENTS: "true", STRIPE_SECRET_KEY: "sk_test_abc" });
    assert.equal(status.mode, "test");
    assert.equal(status.secretKeyMode, "test");
  });

  it("is live mode only when the live gate is enabled with a live-prefixed key", () => {
    const status = getStripeConfigStatus({ STRIPE_ALLOW_LIVE_PAYMENTS: "true", STRIPE_SECRET_KEY: "sk_live_abc" });
    assert.equal(status.mode, "live");
  });

  it("reports readiness only once webhook secret and both price IDs are present for a non-mock mode", () => {
    const partial = getStripeConfigStatus({ STRIPE_ALLOW_LIVE_PAYMENTS: "true", STRIPE_SECRET_KEY: "sk_test_abc" });
    assert.equal(partial.ready, false);
    const full = getStripeConfigStatus({
      STRIPE_ALLOW_LIVE_PAYMENTS: "true",
      STRIPE_SECRET_KEY: "sk_test_abc",
      STRIPE_WEBHOOK_SECRET: "whsec_abc",
      STRIPE_SITE_SETUP_PRICE_ID: "price_setup",
      STRIPE_MANAGED_MONTHLY_PRICE_ID: "price_managed",
    });
    assert.equal(full.ready, true);
  });

  it("mock mode is always ready (nothing further required to test the flow)", () => {
    assert.equal(getStripeConfigStatus({}).ready, true);
  });

  it("getStripeConfigStatus never returns the secret key value itself, only presence/mode", () => {
    const status = getStripeConfigStatus({ STRIPE_SECRET_KEY: "sk_test_should_never_appear" }) as Record<string, unknown>;
    assert.equal(JSON.stringify(status).includes("should_never_appear"), false);
  });

  it("getStripeSecretConfigFromEnv returns null when the secret key is absent", () => {
    assert.equal(getStripeSecretConfigFromEnv({}), null);
  });
});

describe("checkout success/cancel URL construction", () => {
  it("resolves a local origin by default, honors SITEFORGE_APP_URL, and falls back to VERCEL_URL", () => {
    assert.equal(resolveAppOrigin({}), "http://localhost:3000");
    assert.equal(resolveAppOrigin({ SITEFORGE_APP_URL: "https://siteforge.example.com/" }), "https://siteforge.example.com");
    assert.equal(resolveAppOrigin({ VERCEL_URL: "siteforge-abc123.vercel.app" }), "https://siteforge-abc123.vercel.app");
  });

  it("builds a success URL bound to the offer id, preserving Stripe's literal session-id template token", () => {
    const url = buildCheckoutSuccessUrl("https://siteforge.example.com", "offer-123");
    assert.equal(url, "https://siteforge.example.com/checkout/success?offer=offer-123&session_id={CHECKOUT_SESSION_ID}");
  });

  it("builds a cancel URL bound to the offer id", () => {
    assert.equal(buildCheckoutCancelUrl("https://siteforge.example.com", "offer-123"), "https://siteforge.example.com/checkout/cancel?offer=offer-123");
  });

  it("URL-encodes the offer id so it cannot be used to inject an arbitrary query/path", () => {
    const url = buildCheckoutSuccessUrl("https://siteforge.example.com", "abc?evil=1&x=2");
    assert.doesNotMatch(url, /offer=abc\?evil/);
  });
});

describe("checkout status public route allowlist", () => {
  it("only matches the two exact checkout status paths", () => {
    assert.equal(isPublicCheckoutStatusPath("/checkout/success"), true);
    assert.equal(isPublicCheckoutStatusPath("/checkout/cancel"), true);
    assert.equal(isPublicCheckoutStatusPath("/checkout/success/extra"), false);
    assert.equal(isPublicCheckoutStatusPath("/offers"), false);
    assert.equal(isPublicCheckoutStatusPath("/api/stripe/webhook"), false);
  });
});

function fakeStripeClient(create: StripeCheckoutClient["checkout"]["sessions"]["create"]): StripeCheckoutClient {
  return { checkout: { sessions: { create } } };
}

const liveConfig = {
  secretKey: "sk_test_fake",
  webhookSecret: "whsec_fake",
  setupPriceId: "price_setup_123",
  managedMonthlyPriceId: "price_managed_123",
};

const baseRequest = {
  offerId: "offer-1",
  leadId: "lead-1",
  currency: "usd",
  setupAmountCents: DEFAULT_SETUP_AMOUNT_CENTS,
  managedMonthlyAmountCents: null as number | null,
  managedPlanSelected: false,
  description: "Website rebuild",
  successUrl: "https://siteforge.example.com/checkout/success?offer=offer-1",
  cancelUrl: "https://siteforge.example.com/checkout/cancel?offer=offer-1",
};

describe("LiveStripeProvider: price authority and Checkout modeling", () => {
  it("website-only uses mode:payment with a single line item referencing the configured setup Price ID -- never a raw amount", async () => {
    let capturedParams: unknown;
    const provider = new LiveStripeProvider(liveConfig, () =>
      fakeStripeClient(async (params) => {
        capturedParams = params;
        return { id: "cs_test_1", customer: "cus_1", payment_intent: "pi_1", subscription: null, url: "https://checkout.stripe.com/cs_test_1", mode: "payment", amount_total: 9900, currency: "usd", expires_at: 1893456000 } as never;
      }),
    );
    const result = await provider.createCheckoutSession(baseRequest);
    assert.equal(result.provider, "stripe");
    assert.equal(result.mode, "payment");
    const params = capturedParams as { mode: string; line_items: Array<{ price: string }> };
    assert.equal(params.mode, "payment");
    assert.equal(params.line_items.length, 1);
    assert.equal(params.line_items[0].price, "price_setup_123");
  });

  it("website+managed uses mode:subscription with BOTH the one-time setup Price and the recurring monthly Price as line items in one session", async () => {
    let capturedParams: unknown;
    const provider = new LiveStripeProvider(liveConfig, () =>
      fakeStripeClient(async (params) => {
        capturedParams = params;
        return { id: "cs_test_2", customer: "cus_1", payment_intent: null, subscription: "sub_1", url: "https://checkout.stripe.com/cs_test_2", mode: "subscription", amount_total: 9900, currency: "usd", expires_at: null } as never;
      }),
    );
    const result = await provider.createCheckoutSession({
      ...baseRequest,
      managedPlanSelected: true,
      managedMonthlyAmountCents: DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
    });
    assert.equal(result.mode, "subscription");
    assert.equal(result.subscriptionId, "sub_1");
    const params = capturedParams as { mode: string; line_items: Array<{ price: string }> };
    assert.equal(params.mode, "subscription");
    assert.deepEqual(
      params.line_items.map((item) => item.price),
      ["price_setup_123", "price_managed_123"],
    );
  });

  it("the optional managed plan remains optional -- website-only checkout never includes the managed price", async () => {
    let capturedParams: unknown;
    const provider = new LiveStripeProvider(liveConfig, () => fakeStripeClient(async (params) => {
      capturedParams = params;
      return { id: "cs_test_3", customer: null, payment_intent: "pi_2", subscription: null, url: "https://checkout.stripe.com/cs_test_3", mode: "payment", amount_total: 9900, currency: "usd", expires_at: null } as never;
    }));
    await provider.createCheckoutSession(baseRequest);
    const params = capturedParams as { line_items: Array<{ price: string }> };
    assert.equal(params.line_items.some((item) => item.price === "price_managed_123"), false);
  });

  it("binds trusted server-side metadata (offer id, lead id, purchase option) to the session", async () => {
    let capturedParams: unknown;
    const provider = new LiveStripeProvider(liveConfig, () => fakeStripeClient(async (params) => {
      capturedParams = params;
      return { id: "cs_test_4", customer: null, payment_intent: "pi_3", subscription: null, url: "https://checkout.stripe.com/cs_test_4", mode: "payment", amount_total: 9900, currency: "usd", expires_at: null } as never;
    }));
    await provider.createCheckoutSession(baseRequest);
    const params = capturedParams as { metadata: Record<string, string>; client_reference_id: string; success_url: string; cancel_url: string };
    assert.equal(params.metadata.offer_id, "offer-1");
    assert.equal(params.metadata.lead_id, "lead-1");
    assert.equal(params.metadata.purchase_option, "website_only");
    assert.equal(params.client_reference_id, "lead-1");
    assert.equal(params.success_url, baseRequest.successUrl);
    assert.equal(params.cancel_url, baseRequest.cancelUrl);
  });

  it("refuses to create a session when the offer's setup amount has drifted from the locked $99 price -- browser/offer input never becomes the authoritative charge", async () => {
    const provider = new LiveStripeProvider(liveConfig, () => fakeStripeClient(async () => {
      throw new Error("must not call Stripe when the price is not locked");
    }));
    await assert.rejects(
      () => provider.createCheckoutSession({ ...baseRequest, setupAmountCents: 4900 }),
      /stripe_setup_amount_does_not_match_locked_price/,
    );
  });

  it("refuses to create a managed session when the monthly amount has drifted from the locked $39 price", async () => {
    const provider = new LiveStripeProvider(liveConfig, () => fakeStripeClient(async () => {
      throw new Error("must not call Stripe when the price is not locked");
    }));
    await assert.rejects(
      () =>
        provider.createCheckoutSession({
          ...baseRequest,
          managedPlanSelected: true,
          managedMonthlyAmountCents: 999,
        }),
      /stripe_managed_amount_does_not_match_locked_price/,
    );
  });

  it("fails closed when the setup Price ID is not configured", async () => {
    const provider = new LiveStripeProvider({ ...liveConfig, setupPriceId: null }, () => fakeStripeClient(async () => {
      throw new Error("must not call Stripe without a configured price");
    }));
    await assert.rejects(() => provider.createCheckoutSession(baseRequest), /stripe_setup_price_id_missing/);
  });

  it("fails closed when the managed monthly Price ID is not configured but the managed plan was selected", async () => {
    const provider = new LiveStripeProvider({ ...liveConfig, managedMonthlyPriceId: null }, () => fakeStripeClient(async () => {
      throw new Error("must not call Stripe without a configured price");
    }));
    await assert.rejects(
      () => provider.createCheckoutSession({ ...baseRequest, managedPlanSelected: true, managedMonthlyAmountCents: DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS }),
      /stripe_managed_monthly_price_id_missing/,
    );
  });
});

describe("stripe webhook event normalization: new event kinds", () => {
  it("normalizes checkout.session.async_payment_succeeded the same way as checkout.session.completed", () => {
    const normalized = normalizeStripeWebhookEvent({
      id: "evt_2",
      type: "checkout.session.async_payment_succeeded",
      data: { object: { object: "checkout.session", id: "cs_test_2", customer: "cus_1" } },
    });
    assert.equal(normalized.kind, "checkout_completed");
  });

  it("normalizes checkout.session.async_payment_failed", () => {
    const normalized = normalizeStripeWebhookEvent({
      id: "evt_3",
      type: "checkout.session.async_payment_failed",
      data: { object: { object: "checkout.session", id: "cs_test_3" } },
    });
    assert.deepEqual(normalized, { kind: "checkout_async_payment_failed", eventId: "evt_3", eventType: "checkout.session.async_payment_failed", checkoutSessionId: "cs_test_3" });
  });

  it("normalizes customer.subscription.updated with its status", () => {
    const normalized = normalizeStripeWebhookEvent({
      id: "evt_4",
      type: "customer.subscription.updated",
      data: { object: { object: "subscription", id: "sub_1", customer: "cus_1", status: "past_due" } },
    });
    assert.deepEqual(normalized, { kind: "subscription_updated", eventId: "evt_4", eventType: "customer.subscription.updated", subscriptionId: "sub_1", customerId: "cus_1", status: "past_due" });
  });

  it("normalizes customer.subscription.deleted", () => {
    const normalized = normalizeStripeWebhookEvent({
      id: "evt_5",
      type: "customer.subscription.deleted",
      data: { object: { object: "subscription", id: "sub_1", customer: "cus_1" } },
    });
    assert.equal(normalized.kind, "subscription_deleted");
  });

  it("normalizes invoice.paid with period and amount", () => {
    const normalized = normalizeStripeWebhookEvent({
      id: "evt_6",
      type: "invoice.paid",
      data: {
        object: {
          object: "invoice",
          subscription: "sub_1",
          customer: "cus_1",
          period_start: 1893456000,
          period_end: 1896134400,
          amount_paid: 3900,
          currency: "usd",
        },
      },
    });
    assert.equal(normalized.kind, "invoice_paid");
    if (normalized.kind === "invoice_paid") {
      assert.equal(normalized.amountPaidCents, 3900);
      assert.equal(normalized.periodStart, new Date(1893456000 * 1000).toISOString());
    }
  });

  it("normalizes invoice.payment_failed", () => {
    const normalized = normalizeStripeWebhookEvent({
      id: "evt_7",
      type: "invoice.payment_failed",
      data: { object: { object: "invoice", subscription: "sub_1", customer: "cus_1" } },
    });
    assert.equal(normalized.kind, "invoice_payment_failed");
  });

  it("safely ignores customer.subscription.created -- not separately handled, since checkout_completed already creates the subscription record", () => {
    const normalized = normalizeStripeWebhookEvent({
      id: "evt_8",
      type: "customer.subscription.created",
      data: { object: { object: "subscription", id: "sub_1", customer: "cus_1", status: "active" } },
    });
    assert.equal(normalized.kind, "ignored");
  });

  it("every normalized event carries no card/PAN/CVC-shaped fields", () => {
    const normalized = normalizeStripeWebhookEvent({
      id: "evt_9",
      type: "checkout.session.completed",
      data: { object: { object: "checkout.session", id: "cs_test_9", customer: "cus_1" } },
    });
    const serialized = JSON.stringify(normalized).toLowerCase();
    for (const forbidden of ["card_number", "cvc", "pan", "cardnumber"]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  });
});

describe("boundary isolation (source scans, matching the existing repo pattern)", () => {
  function readSource(...segments: string[]): string {
    return readFileSync(join(process.cwd(), ...segments), "utf8");
  }

  it("Scout cannot invoke payments -- no Scout module imports payments code", () => {
    const scoutDir = join(process.cwd(), "src", "lib", "scout");
    function scan(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
          continue;
        }
        if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
        const source = readFileSync(full, "utf8");
        assert.doesNotMatch(source, /@\/(lib\/payments|data\/payments)/, `${full} must not import payments code`);
      }
    }
    scan(scoutDir);
  });

  it("Sales cannot change pricing -- no Sales module imports the offers/pricing seam", () => {
    const salesSource = readSource("src", "lib", "sales", "run.ts");
    assert.doesNotMatch(salesSource, /@\/(lib\/payments|data\/payments)/);
  });

  it("no refund-creating code exists anywhere in the payments module (no autonomous refund path to gate)", () => {
    for (const file of ["provider-core.ts", "conversion.ts", "webhook.ts", "offers.ts"]) {
      const source = readSource("src", "lib", "payments", file);
      assert.doesNotMatch(source, /refunds\.create|\.refund\(/i);
    }
  });

  it("the webhook route verifies against the raw request body, never a re-parsed/re-serialized JSON round-trip, before trusting the payload", () => {
    const routeSource = readSource("src", "app", "api", "stripe", "webhook", "route.ts");
    assert.match(routeSource, /request\.text\(\)/);
    // Real (non-mock) verification must run on the raw text, not JSON.parse output.
    const realBranchIndex = routeSource.indexOf("constructEventAsync");
    assert.ok(realBranchIndex > -1);
    assert.match(routeSource.slice(0, realBranchIndex), /rawBody/);
  });

  it("the checkout success page never treats a query parameter as proof of payment -- only the looked-up offer status", () => {
    const pageSource = readSource("src", "app", "checkout", "success", "page.tsx");
    assert.doesNotMatch(pageSource, /searchParams\.session_id/);
    assert.match(pageSource, /getPublicCheckoutStatus/);
  });

  it("checkout success/cancel URLs are only ever constructed from the trusted app origin, never from client-supplied form/query input", () => {
    const dataSource = readSource("src", "data", "payments.ts");
    assert.match(dataSource, /resolveAppOrigin\(\)/);
    assert.doesNotMatch(dataSource, /formData\.get\(["']success_url["']\)/);
    assert.doesNotMatch(dataSource, /formData\.get\(["']cancel_url["']\)/);
  });

  it("checkout creation still runs behind the existing admin-session-gated data helpers, not a bypass path", () => {
    const dataSource = readSource("src", "data", "payments.ts");
    assert.match(dataSource, /export async function createCheckoutForApprovedOffer/);
    // createCheckoutForApprovedOffer reads the offer via readTable and persists via mutateTable,
    // both of which call requireAdminSession() internally (src/lib/supabase/server.ts) -- this
    // module was not changed to bypass that gate.
    assert.doesNotMatch(dataSource, /SITEFORGE_.*_WORKER.*true/);
  });

  it("no deployment/DNS/production-site code is invoked from webhook payment processing", () => {
    const dataSource = readSource("src", "data", "payments.ts");
    assert.doesNotMatch(dataSource, /deployToVercel|updateDns|createProductionDeployment/i);
  });
});

describe("Settings UI wiring for Stripe runtime status", () => {
  function readSource(...segments: string[]): string {
    return readFileSync(join(process.cwd(), ...segments), "utf8");
  }

  it("the Settings page calls getStripeConfigStatus() server-side and passes it into SettingsView", () => {
    const pageSource = readSource("src", "app", "settings", "page.tsx");
    assert.match(pageSource, /import\s*\{\s*getStripeConfigStatus\s*\}\s*from\s*"@\/lib\/payments\/config"/);
    assert.match(pageSource, /stripeStatus=\{getStripeConfigStatus\(\)\}/);
  });

  it("SettingsView declares a typed stripeStatus prop using StripeConfigStatus, not an ad hoc shape", () => {
    const viewSource = readSource("src", "components", "settings", "settings-view.tsx");
    assert.match(viewSource, /import type \{ StripeConfigStatus \} from "@\/lib\/payments\/config"/);
    assert.match(viewSource, /stripeStatus:\s*StripeConfigStatus/);
  });

  it("SettingsView renders every required Stripe status field", () => {
    const viewSource = readSource("src", "components", "settings", "settings-view.tsx");
    for (const field of [
      "stripeStatus.mode",
      "stripeStatus.ready",
      "stripeStatus.secretKeyPresent",
      "stripeStatus.secretKeyMode",
      "stripeStatus.webhookSecretPresent",
      "stripeStatus.setupPriceIdPresent",
      "stripeStatus.managedMonthlyPriceIdPresent",
    ]) {
      assert.match(viewSource, new RegExp(field.replace(".", "\\.")), `expected SettingsView to render ${field}`);
    }
  });

  it("LIVE mode is visually distinguished from TEST/MOCK (a dedicated danger-styled branch, not shared styling)", () => {
    const viewSource = readSource("src", "components", "settings", "settings-view.tsx");
    const liveBranch = viewSource.match(/stripeStatus\.mode === "live"[\s\S]{0,80}/);
    assert.ok(liveBranch);
    assert.match(liveBranch![0], /danger/);
  });

  it("TEST + ready renders the exact \"TEST -- Ready\" label", () => {
    const viewSource = readSource("src", "components", "settings", "settings-view.tsx");
    assert.match(viewSource, /TEST -- Ready/);
  });

  it("no Stripe secret/key/price value is ever interpolated into the settings view -- only the presence/mode fields from StripeConfigStatus", () => {
    const viewSource = readSource("src", "components", "settings", "settings-view.tsx");
    assert.doesNotMatch(viewSource, /secretKey\b/);
    assert.doesNotMatch(viewSource, /webhookSecret\b(?!Present)/);
    assert.doesNotMatch(viewSource, /\bsetupPriceId\b(?!Present)/);
    assert.doesNotMatch(viewSource, /\bmanagedMonthlyPriceId\b(?!Present)/);
    assert.doesNotMatch(viewSource, /sk_(test|live)_/);
  });

  it("this change does not touch Stripe provider/checkout/webhook behavior files", () => {
    // Source-scan guard: the settings page/view are the only files this
    // change should touch beyond tests. Confirms payments runtime code is
    // untouched by checking it still contains the exact behavior markers
    // from the M9.6 session, unmodified.
    const providerSource = readSource("src", "lib", "payments", "provider-core.ts");
    assert.match(providerSource, /stripe_setup_amount_does_not_match_locked_price/);
    const webhookSource = readSource("src", "app", "api", "stripe", "webhook", "route.ts");
    assert.match(webhookSource, /constructEventAsync/);
  });
});

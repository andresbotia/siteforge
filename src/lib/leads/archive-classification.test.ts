import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyLeadForArchival } from "./archive-classification";

function lead(overrides: Partial<Parameters<typeof classifyLeadForArchival>[0]> = {}) {
  return {
    id: "L1",
    businessName: "Test Co",
    source: "manual_public_prospect",
    status: "audited",
    ...overrides,
  };
}

describe("classifyLeadForArchival", () => {
  it("classifies a null-source lead as seed_fixture", () => {
    const result = classifyLeadForArchival(lead({ source: null }), null);
    assert.equal(result?.category, "seed_fixture");
  });

  it('classifies source "seed" as seed_fixture regardless of status', () => {
    const result = classifyLeadForArchival(lead({ source: "seed", status: "customer" }), null);
    assert.equal(result?.category, "seed_fixture");
  });

  it("classifies a scout lead stuck at discovered as scout_never_advanced", () => {
    const result = classifyLeadForArchival(lead({ source: "scout", status: "discovered" }), null);
    assert.equal(result?.category, "scout_never_advanced");
  });

  it("does NOT classify a scout lead that advanced past discovered", () => {
    for (const status of ["qualified", "audited", "contacted", "interested", "customer", "rejected"]) {
      const result = classifyLeadForArchival(lead({ source: "scout", status }), null);
      assert.equal(result, null, status);
    }
  });

  it("classifies a customer whose stripe_customer_id is mock-prefixed as mock_stripe_customer", () => {
    const result = classifyLeadForArchival(lead({ source: "scout", status: "customer" }), {
      stripeCustomerId: "cus_mock_abc123",
      checkoutSessionId: "2cffa4f4-4e64-4e07-a84b-07801508f9b4",
    });
    assert.equal(result?.category, "mock_stripe_customer");
  });

  it("classifies mock_stripe_customer regardless of lead source (real-looking source does not exempt a smoke-test checkout)", () => {
    const result = classifyLeadForArchival(lead({ source: "manual_public_prospect", status: "customer" }), {
      stripeCustomerId: "cus_mock_zzz",
      checkoutSessionId: null,
    });
    assert.equal(result?.category, "mock_stripe_customer");
  });

  it("does NOT classify a real-provenance lead with no customer row", () => {
    const result = classifyLeadForArchival(
      lead({ source: "manual_public_prospect", status: "website_built" }),
      null,
    );
    assert.equal(result, null);
  });

  it("does NOT classify a Stripe TEST-mode customer as mock (test is a real rehearsal, not a smoke test)", () => {
    const result = classifyLeadForArchival(lead({ source: "manual_public_prospect", status: "customer" }), {
      stripeCustomerId: "cus_VBPPA4dRuK3W8F",
      checkoutSessionId: "cs_test_abc",
    });
    assert.equal(result, null);
  });

  it("does not misread a mock provider's plain-UUID conversion_metadata checkout id as a Stripe session id", () => {
    // The mock provider stores a random UUID in conversion_metadata, not a
    // cs_-prefixed id. Passing it through unchecked would risk inferring
    // "live"/"test" from a UUID that happens not to start with cs_mock_.
    const result = classifyLeadForArchival(lead({ source: "manual_public_prospect", status: "customer" }), {
      stripeCustomerId: null,
      checkoutSessionId: "2cffa4f4-4e64-4e07-a84b-07801508f9b4",
    });
    assert.equal(result, null);
  });

  it("real provenance always beats a coincidental match: manual source, advanced status, no customer -> never archived", () => {
    const result = classifyLeadForArchival(
      lead({ source: "manual_public_prospect", status: "discovered" }),
      null,
    );
    // Even at status "discovered", a manual_public_prospect is not "scout";
    // the scout_never_advanced rule is source-scoped and must not widen.
    assert.equal(result, null);
  });
});

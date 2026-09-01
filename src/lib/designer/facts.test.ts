import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { businessFactsFromLead, emptyImageryManifest, fingerprintFacts, fixtureBusinessFacts } from "./facts";

describe("designer facts sanitization", () => {
  it("builds fixture facts that carry no sourced identity beyond what was passed in", () => {
    const facts = fixtureBusinessFacts({
      businessName: "Fixture HVAC Co.",
      industry: "HVAC",
      city: "Fort Lauderdale",
      region: "FL",
    });
    assert.equal(facts.businessName, "Fixture HVAC Co.");
    assert.equal(facts.snapshot.rating, null);
    assert.equal(facts.snapshot.websiteStatus, "unknown");
    assert.deepEqual(facts.snapshot.approvedAssetUrls, []);
  });

  it("derives a verified fact snapshot from a lead row without inventing fields", () => {
    const facts = businessFactsFromLead({
      business_name: "Atlantic Drain Plumbing",
      industry: "Plumbing",
      city: "Boca Raton",
      state: "FL",
      address: "123 Main St",
      phone: "5555550100",
      website_url: null,
      google_rating: 4.7,
      review_count: 82,
      inspection_summary: {},
    });
    assert.equal(facts.businessName, "Atlantic Drain Plumbing");
    assert.equal(facts.snapshot.rating, 4.7);
    assert.equal(facts.snapshot.reviewCount, 82);
    assert.equal(facts.snapshot.menuUrl, null);
  });

  it("produces a deterministic fingerprint for identical facts and a different one for changed facts", () => {
    const a = fixtureBusinessFacts({ businessName: "A", industry: "HVAC", city: "X", region: "FL" });
    const b = fixtureBusinessFacts({ businessName: "A", industry: "HVAC", city: "X", region: "FL" });
    const c = fixtureBusinessFacts({ businessName: "A", industry: "HVAC", city: "Y", region: "FL" });
    assert.equal(fingerprintFacts(a), fingerprintFacts(b));
    assert.notEqual(fingerprintFacts(a), fingerprintFacts(c));
  });

  it("defaults to a no-imagery policy that forbids inventing photos", () => {
    const manifest = emptyImageryManifest();
    assert.deepEqual(manifest.images, []);
    assert.match(manifest.policy, /do not source, scrape, rehost, or invent/i);
  });
});

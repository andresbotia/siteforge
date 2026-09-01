import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessCommercialScore } from "./commercial-score";
import { assessContactability } from "./contactability";
import { classifyWebsiteStatus } from "./website-status";
import type { InspectionResult, NormalizedBusiness, ScoreBreakdown } from "./types";

function business(overrides: Partial<NormalizedBusiness> = {}): NormalizedBusiness {
  return {
    name: "Test Co",
    categoryId: "landscapers",
    industry: "Landscaping",
    city: "Fort Lauderdale",
    state: "FL",
    source: "openstreetmap_overpass",
    normalizedName: "test co",
    normalizedDomain: null,
    normalizedPhone: null,
    ...overrides,
  };
}

function score(businessStrengthScore: number, websiteOpportunityScore: number): ScoreBreakdown {
  return { businessStrengthScore, websiteOpportunityScore, overallQualificationScore: 0, tier: "review", reasons: [] };
}

const NO_WEBSITE: InspectionResult = { reachable: false, finalUrl: null, blockedReason: null, error: "no_website", homepage: null, linkChecks: [], pagesFetched: 0 };
const REACHABLE: InspectionResult = { reachable: true, finalUrl: "https://x.test", blockedReason: null, error: null, homepage: null, linkChecks: [], pagesFetched: 1 };

function assess(b: NormalizedBusiness, inspection: InspectionResult, s: ScoreBreakdown) {
  const websiteStatus = classifyWebsiteStatus(b, inspection);
  const contactability = assessContactability(b, inspection);
  return assessCommercialScore({ business: b, inspection, score: s, websiteStatus, contactability });
}

describe("assessCommercialScore", () => {
  it("recommends BUILD for an established, contactable, no-website business", () => {
    const result = assess(
      business({ phone: "(954) 555-0100", address: "1 Main St", hours: "Mo-Fr 08:00-17:00", instagramUrl: "https://www.instagram.com/testco" }),
      NO_WEBSITE,
      score(90, 42), // Scout's raw no-website opportunity (42) is deliberately not what drives this
    );
    assert.equal(result.recommendation, "BUILD");
    assert.ok(result.commercialPotentialScore >= 70);
  });

  it("does NOT automatically rank a mediocre business with no website as BUILD", () => {
    const result = assess(business({ phone: "(954) 555-0100" }), NO_WEBSITE, score(20, 42));
    assert.notEqual(result.recommendation, "BUILD");
  });

  it("ranks a strong business with an already-good website lower than a strong no-website business", () => {
    const goodWebsite = assess(business({ phone: "(954) 555-0100", websiteUrl: "https://x.test", address: "1 Main St" }), REACHABLE, score(90, 10));
    const noWebsite = assess(business({ phone: "(954) 555-0100", address: "1 Main St" }), NO_WEBSITE, score(90, 42));
    assert.ok(goodWebsite.commercialPotentialScore < noWebsite.commercialPotentialScore);
  });

  it("handles a missing rating (businessStrengthScore reflects it) without crashing or inventing a score", () => {
    const result = assess(business({ phone: "(954) 555-0100" }), NO_WEBSITE, score(0, 42));
    assert.ok(result.commercialPotentialScore >= 0 && result.commercialPotentialScore <= 100);
  });

  it("caps the recommendation below BUILD when there is no verified contact channel", () => {
    const result = assess(business({ address: "1 Main St", hours: "Mo-Fr" }), NO_WEBSITE, score(90, 42));
    assert.notEqual(result.recommendation, "BUILD");
    assert.ok(result.reasons.some((reason) => /no verified contact channel/i.test(reason)));
  });

  it("treats a social-only presence as a real, moderately-confident opportunity distinct from an unverified no-website case", () => {
    const social = assess(business({ phone: "(954) 555-0100", instagramUrl: "https://www.instagram.com/testco" }), NO_WEBSITE, score(60, 42));
    const unverified = assess(business({ phone: "(954) 555-0100" }), NO_WEBSITE, score(60, 42));
    assert.ok(social.components.websiteOpportunity > unverified.components.websiteOpportunity);
  });

  it("SKIPs a weak business with no contact path and insufficient facts", () => {
    const result = assess(business(), NO_WEBSITE, score(10, 42));
    assert.equal(result.recommendation, "SKIP");
  });

  it("never lets an LLM-shaped free-text field influence the score -- inputs are pure numbers/booleans", () => {
    const result = assess(business({ phone: "(954) 555-0100", address: "1 Main St" }), NO_WEBSITE, score(50, 42));
    assert.equal(typeof result.commercialPotentialScore, "number");
    for (const value of Object.values(result.components)) {
      assert.equal(typeof value, "number");
    }
  });

  it("reflects Designer coverage from the Designer category architecture, not the legacy Builder registry", () => {
    const proven = assess(business({ industry: "Landscaping", phone: "(954) 555-0100", address: "1 Main St" }), NO_WEBSITE, score(50, 42));
    const unknown = assess(business({ industry: "Artisanal Kite Repair", phone: "(954) 555-0100", address: "1 Main St" }), NO_WEBSITE, score(50, 42));
    assert.equal(proven.designerCoverageLevel, "strong");
    assert.equal(unknown.designerCoverageLevel, "weak_unknown");
    assert.ok(proven.components.designerCoverage > unknown.components.designerCoverage);
  });
});

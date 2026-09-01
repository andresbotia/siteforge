import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessCommercialPotential } from "./commercial-potential";

describe("commercial potential assessment", () => {
  it("recommends BUILD for a strong business, strong opportunity, contactable lead with template coverage", () => {
    const result = assessCommercialPotential({
      industry: "Plumbing",
      businessStrengthScore: 85,
      websiteOpportunityScore: 80,
      hasVerifiedEmail: true,
      hasVerifiedPhone: true,
      hasVerifiedSocialProfile: false,
      sourcedFactCount: 5,
    });
    assert.equal(result.tier, "high");
    assert.equal(result.templateCoverage, "approved_master_available");
    assert.equal(result.recommendedAction, "build");
    assert.equal(result.designerAiRequired, false);
    assert.equal(result.estimatedAdditionalCashCostUsd, 0);
  });

  it("recommends CREATE_DESIGNER_JOB when the same strong lead has no template coverage", () => {
    const result = assessCommercialPotential({
      industry: "an industry with no registered template family at all",
      businessStrengthScore: 85,
      websiteOpportunityScore: 80,
      hasVerifiedEmail: true,
      hasVerifiedPhone: false,
      hasVerifiedSocialProfile: false,
      sourcedFactCount: 5,
    });
    assert.equal(result.templateCoverage, "missing");
    assert.equal(result.recommendedAction, "create_designer_job");
    assert.equal(result.designerAiRequired, true);
  });

  it("does not reward a lead merely for a bad website when the business itself is weak", () => {
    const result = assessCommercialPotential({
      industry: "Plumbing",
      businessStrengthScore: 15,
      websiteOpportunityScore: 95,
      hasVerifiedEmail: true,
      hasVerifiedPhone: true,
      hasVerifiedSocialProfile: false,
      sourcedFactCount: 5,
    });
    assert.notEqual(result.tier, "high");
    assert.equal(result.businessStrength, "weak");
    assert.equal(result.reasons.some((reason) => reason.includes("unlikely to change commercial outcomes")), true);
  });

  it("skips a lead with no verified contact channel regardless of scores", () => {
    const result = assessCommercialPotential({
      industry: "Plumbing",
      businessStrengthScore: 90,
      websiteOpportunityScore: 90,
      hasVerifiedEmail: false,
      hasVerifiedPhone: false,
      hasVerifiedSocialProfile: false,
      sourcedFactCount: 5,
    });
    assert.equal(result.contactability.verified, false);
    assert.equal(result.recommendedAction, "skip");
  });

  it("skips a lead with too few sourced facts even if scores are strong", () => {
    const result = assessCommercialPotential({
      industry: "Plumbing",
      businessStrengthScore: 90,
      websiteOpportunityScore: 90,
      hasVerifiedEmail: true,
      hasVerifiedPhone: true,
      hasVerifiedSocialProfile: true,
      sourcedFactCount: 1,
    });
    assert.equal(result.factsCompleteness, "insufficient");
    assert.equal(result.recommendedAction, "skip");
  });

  it("treats unknown scores as unknown, not as zero or as strong", () => {
    const result = assessCommercialPotential({
      industry: "Plumbing",
      businessStrengthScore: null,
      websiteOpportunityScore: null,
      hasVerifiedEmail: true,
      hasVerifiedPhone: true,
      hasVerifiedSocialProfile: false,
      sourcedFactCount: 4,
    });
    assert.equal(result.businessStrength, "unknown");
    assert.equal(result.websiteOpportunity, "unknown");
    assert.notEqual(result.tier, "high");
  });

  it("never estimates a nonzero cash cost", () => {
    const result = assessCommercialPotential({
      industry: "Plumbing",
      businessStrengthScore: 90,
      websiteOpportunityScore: 90,
      hasVerifiedEmail: true,
      hasVerifiedPhone: true,
      hasVerifiedSocialProfile: true,
      sourcedFactCount: 6,
    });
    assert.equal(result.estimatedAdditionalCashCostUsd, 0);
  });
});

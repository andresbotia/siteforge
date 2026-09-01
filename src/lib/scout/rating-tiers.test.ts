import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyRatingTier, classifyReviewVolumeTier } from "./rating-tiers";

describe("classifyReviewVolumeTier", () => {
  it("classifies every documented boundary correctly", () => {
    assert.equal(classifyReviewVolumeTier(0), "EMERGING");
    assert.equal(classifyReviewVolumeTier(24), "EMERGING");
    assert.equal(classifyReviewVolumeTier(25), "ESTABLISHED");
    assert.equal(classifyReviewVolumeTier(99), "ESTABLISHED");
    assert.equal(classifyReviewVolumeTier(100), "STRONG");
    assert.equal(classifyReviewVolumeTier(499), "STRONG");
    assert.equal(classifyReviewVolumeTier(500), "VERY_STRONG");
    assert.equal(classifyReviewVolumeTier(999), "VERY_STRONG");
    assert.equal(classifyReviewVolumeTier(1000), "MAJOR_LOCAL_PRESENCE");
    assert.equal(classifyReviewVolumeTier(5000), "MAJOR_LOCAL_PRESENCE");
  });

  it("treats a missing review count as UNKNOWN, never as zero", () => {
    assert.equal(classifyReviewVolumeTier(null), "UNKNOWN");
  });

  it("treats an explicit zero as a real, reportable EMERGING fact, not UNKNOWN", () => {
    assert.equal(classifyReviewVolumeTier(0), "EMERGING");
  });
});

describe("classifyRatingTier", () => {
  it("classifies every documented boundary correctly", () => {
    assert.equal(classifyRatingTier(5.0), "EXCELLENT");
    assert.equal(classifyRatingTier(4.5), "EXCELLENT");
    assert.equal(classifyRatingTier(4.49), "STRONG");
    assert.equal(classifyRatingTier(4.0), "STRONG");
    assert.equal(classifyRatingTier(3.99), "VIABLE");
    assert.equal(classifyRatingTier(3.5), "VIABLE");
    assert.equal(classifyRatingTier(3.49), "LOWER_PRIORITY");
    assert.equal(classifyRatingTier(3.0), "LOWER_PRIORITY");
    assert.equal(classifyRatingTier(2.99), "WEAK");
    assert.equal(classifyRatingTier(1.0), "WEAK");
  });

  it("treats a missing rating as UNKNOWN, never as zero stars", () => {
    assert.equal(classifyRatingTier(null), "UNKNOWN");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inspectWebsite, createMockHttpClient } from "./inspector";
import { normalizeBusinessName, normalizeDomain, normalizePhone } from "./normalize";
import { classifyTier, scoreBusinessStrength, scoreCandidate, SCORING } from "./scoring";
import type { InspectionResult, NormalizedBusiness } from "./types";

function business(
  overrides: Partial<NormalizedBusiness> & Pick<NormalizedBusiness, "name" | "categoryId">,
): NormalizedBusiness {
  const websiteUrl = overrides.websiteUrl ?? "https://example.test";
  return {
    industry: "Plumbing",
    city: "Fort Lauderdale",
    state: "FL",
    source: "test",
    rating: 4.8,
    reviewCount: 200,
    ...overrides,
    normalizedName: normalizeBusinessName(overrides.name),
    normalizedDomain: normalizeDomain(websiteUrl),
    normalizedPhone: normalizePhone(overrides.phone),
    websiteUrl,
  };
}

const unreachable: InspectionResult = {
  reachable: false,
  finalUrl: null,
  blockedReason: null,
  error: "network",
  homepage: null,
  linkChecks: [],
  pagesFetched: 0,
};

describe("qualification scoring", () => {
  it("good business + bad website is qualified or high priority", () => {
    const result = scoreCandidate(
      business({ name: "Atlantic Drain Plumbing", categoryId: "plumbers" }),
      unreachable,
    );
    assert.ok(result.tier === "qualified" || result.tier === "high_priority");
    assert.ok(result.businessStrengthScore >= SCORING.overall.businessQualified);
    assert.ok(result.websiteOpportunityScore >= SCORING.overall.opportunityQualified);
  });

  it("weak business + bad website is not automatically high priority", () => {
    const result = scoreCandidate(
      business({
        name: "Tiny Leak Bros",
        categoryId: "plumbers",
        rating: 3.4,
        reviewCount: 6,
      }),
      unreachable,
    );
    assert.notEqual(result.tier, "high_priority");
  });
});

describe("restaurant-specific scoring", () => {
  it("treats missing/broken menu and reservation links as opportunity", async () => {
    const http = createMockHttpClient({
      "https://mangrovetable.example.test": {
        body: `<html><head><meta name="viewport" content="width=device-width"><title>Mangrove Table</title></head><body><h1>Mangrove</h1><nav></nav><p>Dinner menu and reservations. Order online tonight.</p><a href="/menu">Menu</a><a href="/reserve">Reserve a table</a><a href="/order">Order online</a><form></form></body></html>`,
      },
      "https://mangrovetable.example.test/menu": { status: 404, body: "no" },
      "https://mangrovetable.example.test/reserve": { status: 404, body: "no" },
      "https://mangrovetable.example.test/order": { status: 404, body: "no" },
    });
    const inspection = await inspectWebsite("https://mangrovetable.example.test", http);
    const result = scoreCandidate(
      business({
        name: "Mangrove Table",
        categoryId: "restaurants",
        industry: "Restaurant",
        websiteUrl: "https://mangrovetable.example.test",
      }),
      inspection,
    );
    assert.ok(result.websiteOpportunityScore >= 40);
    assert.ok(result.reasons.some((line) => /menu|reservation|ordering/i.test(line)));
  });

  it("does not penalize a cafe for lacking reservations it does not advertise", async () => {
    const http = createMockHttpClient({
      "https://breezeoven.example.test": {
        body: `<html><head><meta name="viewport" content="width=device-width"><title>Breeze Oven</title><meta name="description" content="Coffee"></head><body><nav></nav><h1>Cafe</h1><h2>Hours</h2><a href="tel:1">Call</a><form></form></body></html>`,
      },
    });
    const inspection = await inspectWebsite("https://breezeoven.example.test", http);
    const result = scoreCandidate(
      business({
        name: "Breeze Oven Cafe",
        categoryId: "cafes",
        industry: "Cafe",
        websiteUrl: "https://breezeoven.example.test",
      }),
      inspection,
    );
    assert.equal(result.reasons.some((line) => /reservation/i.test(line)), false);
  });
});

describe("scoreBusinessStrength: Google rating/review evidence quality", () => {
  it("gives 4.6 stars / 487 reviews stronger establishment evidence than 4.9 stars / 11 reviews, all else equal", () => {
    const strongVolume = scoreBusinessStrength(business({ name: "A", categoryId: "landscapers", rating: 4.6, reviewCount: 487 }));
    const thinVolume = scoreBusinessStrength(business({ name: "B", categoryId: "landscapers", rating: 4.9, reviewCount: 11 }));
    assert.ok(strongVolume.score > thinVolume.score, `expected ${strongVolume.score} > ${thinVolume.score}`);
  });

  it("does not implement a simplistic rating times reviews formula -- review count alone can outrank a slightly higher rating", () => {
    // 487 reviews clears the "reviewsStrong" bar for full review points even
    // though the rating (4.6) is below the "ratingStrong" bar for full
    // rating points -- the two dimensions are evaluated independently.
    const result = scoreBusinessStrength(business({ name: "A", categoryId: "landscapers", rating: 4.6, reviewCount: 487 }));
    assert.ok(result.reasons.some((r) => /487 reviews/.test(r)));
    assert.ok(result.reasons.some((r) => /STRONG tier/.test(r) || /VERY_STRONG tier/.test(r)));
  });

  it("downranks a sub-3.0 rating relative to a strong rating with comparable review volume", () => {
    const weak = scoreBusinessStrength(business({ name: "A", categoryId: "landscapers", rating: 2.6, reviewCount: 300 }));
    const strong = scoreBusinessStrength(business({ name: "B", categoryId: "landscapers", rating: 4.7, reviewCount: 300 }));
    assert.ok(weak.score < strong.score);
    assert.ok(weak.reasons.some((r) => /WEAK tier/.test(r)));
  });

  it("treats a missing rating as unavailable, never as zero stars", () => {
    const result = scoreBusinessStrength(business({ name: "A", categoryId: "landscapers", rating: null, reviewCount: 50 }));
    assert.ok(result.reasons.some((r) => r === "Google rating unavailable"));
    assert.ok(!result.reasons.some((r) => /0\.0/.test(r)));
  });

  it("treats a missing review count as unavailable, never as zero reviews", () => {
    const result = scoreBusinessStrength(business({ name: "A", categoryId: "landscapers", rating: 4.5, reviewCount: null }));
    assert.ok(result.reasons.some((r) => r === "Google review count unavailable"));
  });

  it("treats an explicit zero review count as a real EMERGING fact, distinct from unavailable", () => {
    const result = scoreBusinessStrength(business({ name: "A", categoryId: "landscapers", rating: 4.5, reviewCount: 0 }));
    assert.ok(result.reasons.some((r) => /0 reviews \(EMERGING tier\)/.test(r)));
    assert.ok(!result.reasons.some((r) => r === "Google review count unavailable"));
  });

  it("never crashes when Google data is entirely absent", () => {
    assert.doesNotThrow(() => scoreBusinessStrength(business({ name: "A", categoryId: "landscapers", rating: null, reviewCount: null })));
  });

  it("does not penalize an operational or status-unknown business, but caps a permanently closed one hard", () => {
    const unknown = scoreBusinessStrength(business({ name: "A", categoryId: "landscapers", rating: 4.8, reviewCount: 500 }));
    const operational = scoreBusinessStrength(business({ name: "B", categoryId: "landscapers", rating: 4.8, reviewCount: 500, businessStatus: "OPERATIONAL" }));
    const closed = scoreBusinessStrength(business({ name: "C", categoryId: "landscapers", rating: 4.8, reviewCount: 500, businessStatus: "CLOSED_PERMANENTLY" }));
    assert.ok(operational.score >= unknown.score);
    assert.ok(closed.score <= 10);
    assert.ok(closed.reasons.some((r) => /permanently closed/.test(r)));
  });

  it("moderately reduces score for a temporarily closed business without a hard floor", () => {
    const open = scoreBusinessStrength(business({ name: "A", categoryId: "landscapers", rating: 4.8, reviewCount: 500 }));
    const temp = scoreBusinessStrength(business({ name: "B", categoryId: "landscapers", rating: 4.8, reviewCount: 500, businessStatus: "CLOSED_TEMPORARILY" }));
    assert.ok(temp.score < open.score);
    assert.ok(temp.reasons.some((r) => /temporarily closed/.test(r)));
  });
});

describe("tier thresholds", () => {
  it("keeps high priority for strong business and strong opportunity only", () => {
    assert.equal(classifyTier(80, 70), "high_priority");
    assert.equal(classifyTier(40, 70), "review");
    assert.equal(classifyTier(20, 80), "reject");
  });
});

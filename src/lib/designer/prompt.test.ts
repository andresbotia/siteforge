import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyImageryManifest, fixtureBusinessFacts } from "./facts";
import { DESIGNER_WORKER_SYSTEM_PROMPT, buildDesignerUserPrompt } from "./prompt";

// The system prompt is hand-wrapped prose; assertions on multi-word phrases
// normalize whitespace first so a line-wrap tweak can't silently break a
// safety-relevant test.
const NORMALIZED_PROMPT = DESIGNER_WORKER_SYSTEM_PROMPT.replace(/\s+/g, " ").toLowerCase();

function includesPhrase(phrase: string): boolean {
  return NORMALIZED_PROMPT.includes(phrase.replace(/\s+/g, " ").toLowerCase());
}

describe("designer worker system prompt", () => {
  it("hard-excludes every named legacy Builder visual reference", () => {
    for (const forbidden of [
      "local-business-v2",
      "Home Services Builder",
      "Professional Services Builder",
      "Restaurant Builder",
      "Builder design preset",
      "legacy Builder CSS",
      "Claude-generated HVAC candidate",
    ]) {
      assert.ok(includesPhrase(forbidden), `expected the hard visual isolation rule to name "${forbidden}"`);
    }
  });

  it("frames the approved reference as principles, not a template to copy", () => {
    assert.ok(includesPhrase("Do NOT copy that experiment's specific business, palette, copy, or layout"));
    assert.ok(includesPhrase("A restaurant should not look like an HVAC company"));
  });

  it("lists every hard-forbidden invented claim category", () => {
    for (const claim of [
      "ratings",
      "review counts",
      "testimonials",
      "prices",
      "awards",
      "certifications",
      "years in business",
      "warranties",
      "guarantees",
      "financing offers",
      "emergency availability",
      "response times",
      "same-day service",
      "24/7 service",
      "no-dispatch-fee claims",
      "upfront-pricing policies",
      "same-technician",
      "subcontractor policies",
    ]) {
      assert.ok(includesPhrase(claim), `expected claim-safety list to include "${claim}"`);
    }
  });

  it("names all five imagery provenance categories and forbids scraping named sources", () => {
    for (const category of ["customer_supplied", "operator_verified", "licensed", "generated", "template_illustrative"]) {
      assert.ok(includesPhrase(category));
    }
    for (const source of ["Google", "Google Maps", "Yelp", "Instagram", "Facebook", "TikTok"]) {
      assert.ok(includesPhrase(source));
    }
  });

  it("requires a functional, non-API Google Maps directions link built only from the verified address", () => {
    assert.ok(includesPhrase("maps/dir/?api=1&destination="));
    assert.ok(includesPhrase("never invent latitude/longitude"));
    assert.ok(includesPhrase("never require any paid mapping dependency"));
  });

  it("includes a local SEO checklist covering title, one H1, robots, structured data, and OG metadata", () => {
    for (const item of ["noindex, nofollow", "<h1>", "JSON-LD", "Open Graph", "meta description"]) {
      assert.ok(includesPhrase(item));
    }
  });

  it("never asks for a live API key or paid AI provider", () => {
    assert.doesNotMatch(DESIGNER_WORKER_SYSTEM_PROMPT, /ANTHROPIC_API_KEY/);
    assert.doesNotMatch(DESIGNER_WORKER_SYSTEM_PROMPT, /XAI_API_KEY/);
  });
});

describe("buildDesignerUserPrompt", () => {
  const facts = fixtureBusinessFacts({
    businessName: "Cypress & Coast Landscape Co.",
    industry: "Landscaping",
    city: "Delray Beach",
    region: "FL",
    phone: "(561) 555-0173",
    address: "2240 S Federal Hwy, Delray Beach, FL 33483",
  });

  it("marks fixture jobs explicitly so the worker never treats them as a real prospect", () => {
    const prompt = buildDesignerUserPrompt({
      jobId: "job-1",
      mode: "new_master",
      templateFamily: null,
      reason: "smoke test",
      facts,
      imagery: emptyImageryManifest(),
      designBriefText: "brief",
      isFixture: true,
    });
    assert.match(prompt, /Fixture\/test job: yes -- synthetic business, never a real prospect/);
    assert.doesNotMatch(prompt, /REVISION REQUESTED/);
  });

  it("omits the revision section when there is no revision feedback", () => {
    const prompt = buildDesignerUserPrompt({
      jobId: "job-1",
      mode: "new_master",
      templateFamily: null,
      reason: "smoke test",
      facts,
      imagery: emptyImageryManifest(),
      designBriefText: "brief",
      isFixture: true,
      revisionNotes: "   ",
    });
    assert.doesNotMatch(prompt, /REVISION REQUESTED/);
  });

  it("includes human reviewer feedback verbatim when this is a revision pass", () => {
    const prompt = buildDesignerUserPrompt({
      jobId: "job-1",
      mode: "new_master",
      templateFamily: null,
      reason: "smoke test",
      facts,
      imagery: emptyImageryManifest(),
      designBriefText: "brief",
      isFixture: false,
      revisionNotes: "Make the hero stronger and simplify the service-area section.",
    });
    assert.match(prompt, /REVISION REQUESTED/);
    assert.match(prompt, /Make the hero stronger and simplify the service-area section\./);
    assert.ok(prompt.replace(/\s+/g, " ").includes("read your previous workspace/site/ files first"));
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyImageryManifest, fixtureBusinessFacts } from "./facts";
import { DESIGNER_WORKER_SYSTEM_PROMPT, buildDesignerUserPrompt } from "./prompt";
import type { DesignerReference } from "./reference";

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

  it("states the commercial bar explicitly and a flexible, non-rigid page-anatomy framework", () => {
    assert.ok(includesPhrase("would a human reviewer confidently send this url to the business owner"));
    assert.ok(includesPhrase("COMMERCIAL PAGE ANATOMY"));
    assert.ok(includesPhrase("a strong closing conversion section"));
    assert.ok(includesPhrase("not a fixed template or a required section order"));
  });

  it("requires an explicit image-mode strategy decision (PHOTO_RICH/PHOTO_LIGHT/PHOTO_ABSENT)", () => {
    for (const mode of ["PHOTO_RICH", "PHOTO_LIGHT", "PHOTO_ABSENT"]) {
      assert.ok(includesPhrase(mode));
    }
  });

  it("requires a self-critique pass before the worker finishes", () => {
    assert.ok(includesPhrase("SELF-CRITIQUE BEFORE YOU FINISH"));
    assert.ok(includesPhrase("mobile check"));
    assert.ok(includesPhrase("selfCritique"));
  });

  it("states that verified business facts always override a DESIGN.md reference, with no exception", () => {
    assert.ok(includesPhrase("DESIGN REFERENCE VS. VERIFIED BUSINESS FACTS"));
    assert.ok(includesPhrase("never authoritative about the business you are building for"));
    assert.ok(includesPhrase("always win over anything in a DESIGN.md, with no exception"));
    for (const claim of ["rating", "review count", "testimonial", "award", "credential", "years in business", "staff name", "price", "guarantee", "hours", "address", "phone number", "email", "social account", "customer count"]) {
      assert.ok(includesPhrase(claim), `expected the DESIGN.md fact-safety rule to name "${claim}"`);
    }
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

  it("derives and states the category context and image mode from the job's own facts/imagery", () => {
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
    assert.match(prompt, /Category: Landscaping \/ outdoor services/);
    assert.match(prompt, /Image mode for this job: PHOTO_ABSENT/);
    assert.match(prompt, /Reference: /);
  });

  it("omits the DESIGN REFERENCE section entirely when no reference carries a DESIGN.md", () => {
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
    assert.doesNotMatch(prompt, /DESIGN REFERENCE/);
    assert.doesNotMatch(prompt, /<design-reference/);
  });

  it("renders a bounded, clearly-fenced DESIGN REFERENCE section when an approved reference carries a DESIGN.md, kept separate from business facts", () => {
    const reference: DesignerReference = {
      kind: "category_reference",
      id: "test-reference-id",
      title: "Test Reference",
      category: "landscaping",
      label: "Category reference: Test Reference",
      designMarkdown: "# Design intent\n\nEditorial, restrained, no fabricated Test Business claims.",
      approval: { reviewedBy: "test-reviewer", approvedAt: "2026-01-01" },
    };
    const prompt = buildDesignerUserPrompt({
      jobId: "job-1",
      mode: "new_master",
      templateFamily: null,
      reason: "smoke test",
      facts,
      imagery: emptyImageryManifest(),
      designBriefText: "brief",
      isFixture: true,
      reference,
    });
    assert.match(prompt, /DESIGN REFERENCE/);
    assert.match(prompt, /<design-reference source="test-reference-id">/);
    assert.match(prompt, /Do not treat it as business facts\. Verified business facts supplied separately are authoritative\./);
    assert.match(prompt, /Editorial, restrained, no fabricated Test Business claims\./);

    // The DESIGN.md block must never be wrapped in the same fence used for
    // untrusted prospect data, and the verified-facts block must never be
    // wrapped in the design-reference fence -- they stay two distinct
    // trust boundaries.
    const designBlockStart = prompt.indexOf("<design-reference");
    const designBlockEnd = prompt.indexOf("</design-reference>");
    const factsBlockStart = prompt.indexOf('<untrusted-data source="verified_business_facts">');
    assert.ok(designBlockStart > -1 && designBlockEnd > designBlockStart);
    assert.ok(factsBlockStart > -1 && (factsBlockStart < designBlockStart || factsBlockStart > designBlockEnd));
    assert.doesNotMatch(prompt.slice(designBlockStart, designBlockEnd), /verified_business_facts/);
  });
});

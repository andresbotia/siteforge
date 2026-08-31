import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VERIFIED_PUBLIC_FACT_SOURCE,
  buildVerifiedPublicFactsInspectionSummary,
  readVerifiedPublicFacts,
  validateVerifiedPublicFacts,
} from "./verified-public-facts";
import type { DnsLookup } from "@/lib/http/ssrf";

const publicLookup: DnsLookup = async () => ["93.184.216.34"];
const privateLookup: DnsLookup = async () => ["10.0.0.4"];

describe("verified public facts", () => {
  it("validates bounded public facts with source provenance", async () => {
    const result = await validateVerifiedPublicFacts(
      {
        sourceUrl: "example.com/source",
        description: "  Salvadoran restaurant with counter service.  ",
        cuisine: "salvadoran",
        hours: " Mon-Sat 10 AM - 8 PM ",
        rating: "4.6",
        reviewCount: "123",
        socialUrl: "https://social.example.test/antojitos",
        menuUrl: "https://menu.example.test/antojitos",
        orderUrl: "https://order.example.test/antojitos",
        reservationUrl: "https://reserve.example.test/antojitos",
      },
      { verifiedAt: "2026-08-30T12:00:00.000Z", lookup: publicLookup },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.summary.source_type, VERIFIED_PUBLIC_FACT_SOURCE);
    assert.equal(result.summary.source_url, "https://example.com/source");
    assert.equal(result.summary.facts.description, "Salvadoran restaurant with counter service.");
    assert.equal(result.summary.facts.rating, 4.6);
    assert.equal(result.summary.facts.reviewCount, 123);
    assert.equal(
      result.summary.provenance.description?.source_url,
      "https://example.com/source",
    );
    assert.equal(
      result.summary.provenance.menuUrl?.source_url,
      "https://menu.example.test/antojitos",
    );
  });

  it("persists the enrichment shape in inspection summary", async () => {
    const result = await validateVerifiedPublicFacts(
      {
        sourceUrl: "https://public.example.test/profile",
        cuisine: "Latin American",
        hours: "Daily 11 AM - 9 PM",
        menuUrl: "https://public.example.test/menu",
      },
      { verifiedAt: "2026-08-30T12:00:00.000Z", lookup: publicLookup },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const merged = buildVerifiedPublicFactsInspectionSummary(
      { no_standalone_website: true },
      result.summary,
    );
    assert.equal(merged.no_standalone_website, true);
    assert.equal(merged.cuisine, "Latin American");
    assert.equal(merged.public_hours, "Daily 11 AM - 9 PM");
    assert.equal(merged.menu_link, "https://public.example.test/menu");
    assert.deepEqual(readVerifiedPublicFacts(merged), result.summary);
  });

  it("rejects malformed ratings, review counts, and unsafe text", async () => {
    assert.deepEqual(
      await validateVerifiedPublicFacts({ rating: "5.1" }, { lookup: publicLookup }),
      { ok: false, error: "Rating must be between 0 and 5.", field: "rating" },
    );
    assert.deepEqual(
      await validateVerifiedPublicFacts({ reviewCount: "1.5" }, { lookup: publicLookup }),
      {
        ok: false,
        error: "Review count must be a non-negative whole number.",
        field: "reviewCount",
      },
    );
    assert.deepEqual(
      await validateVerifiedPublicFacts(
        { description: "Great <script>alert(1)</script>" },
        { lookup: publicLookup },
      ),
      { ok: false, error: "Use plain public text only.", field: "description" },
    );
  });

  it("keeps SSRF-safe URL validation for enrichment URLs", async () => {
    assert.deepEqual(
      await validateVerifiedPublicFacts(
        { sourceUrl: "https://127.0.0.1/profile" },
        { lookup: publicLookup },
      ),
      { ok: false, error: "Enter a public http or https URL.", field: "sourceUrl" },
    );
    assert.deepEqual(
      await validateVerifiedPublicFacts(
        { menuUrl: "javascript:alert(1)" },
        { lookup: publicLookup },
      ),
      { ok: false, error: "Enter a public http or https URL.", field: "menuUrl" },
    );
    assert.deepEqual(
      await validateVerifiedPublicFacts(
        { orderUrl: "https://orders.example.test" },
        { lookup: privateLookup },
      ),
      { ok: false, error: "Enter a public http or https URL.", field: "orderUrl" },
    );
  });
});

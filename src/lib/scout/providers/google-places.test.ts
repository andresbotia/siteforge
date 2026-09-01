import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { inspectWebsite } from "../inspector";
import { classifyWebsiteStatus } from "../website-status";
import type { InspectionResult } from "../types";
import {
  buildGoogleTextSearchQuery,
  createGooglePlacesDiscoveryProvider,
  GOOGLE_PLACES_FIELD_MASK,
  parseCityStateFromFormattedAddress,
  parseGooglePlace,
  type GoogleFetchResult,
  type GooglePlace,
} from "./google-places";

function jsonResult(body: unknown, status = 200): GoogleFetchResult {
  return { status, body: JSON.stringify(body) };
}

const parseConfig = { categoryId: "landscapers" as const, industry: "Landscaping", query: "Landscapers in Broward County, Florida", retrievedAt: "2026-01-01T00:00:00Z", fallbackCity: "Fort Lauderdale", fallbackState: "FL" };

describe("GOOGLE_PLACES_FIELD_MASK", () => {
  it("is an explicit, minimal list -- never a wildcard", () => {
    assert.doesNotMatch(GOOGLE_PLACES_FIELD_MASK, /\*/);
    for (const field of ["places.id", "places.displayName", "places.formattedAddress", "places.businessStatus", "places.rating", "places.userRatingCount", "places.websiteUri", "places.nationalPhoneNumber", "places.location", "places.primaryType"]) {
      assert.ok(GOOGLE_PLACES_FIELD_MASK.includes(field), `expected field mask to include ${field}`);
    }
  });

  it("never requests review text, photos, or generative-summary fields", () => {
    for (const forbidden of ["reviews", "photos", "editorialSummary", "generativeSummary", "regularOpeningHours"]) {
      assert.doesNotMatch(GOOGLE_PLACES_FIELD_MASK, new RegExp(forbidden));
    }
  });
});

describe("buildGoogleTextSearchQuery", () => {
  it("builds a natural-language query from category and location", () => {
    assert.equal(buildGoogleTextSearchQuery("Landscapers", "Broward County, FL"), "Landscapers in Broward County, FL");
  });
});

describe("parseCityStateFromFormattedAddress", () => {
  it("extracts city/state from a typical Google formatted address", () => {
    const result = parseCityStateFromFormattedAddress("1234 Main St, Fort Lauderdale, FL 33301, USA", { city: "fallback", state: "ZZ" });
    assert.equal(result.city, "Fort Lauderdale");
    assert.equal(result.state, "FL");
  });

  it("falls back to the searched location (a real fact) rather than inventing a value when parsing fails", () => {
    const result = parseCityStateFromFormattedAddress("not a real address format", { city: "Fort Lauderdale", state: "FL" });
    assert.deepEqual(result, { city: "Fort Lauderdale", state: "FL" });
    assert.deepEqual(parseCityStateFromFormattedAddress(null, { city: "Fort Lauderdale", state: "FL" }), { city: "Fort Lauderdale", state: "FL" });
  });
});

describe("parseGooglePlace", () => {
  it("returns null for a place with no display name -- never invents one", () => {
    assert.equal(parseGooglePlace({ id: "x" }, parseConfig), null);
  });

  it("extracts only fields Google directly provided, with null for anything absent", () => {
    const place: GooglePlace = { id: "ChIJabc123", displayName: { text: "Some Business" }, formattedAddress: "1 Main St, Fort Lauderdale, FL 33301, USA" };
    const business = parseGooglePlace(place, parseConfig);
    assert.ok(business);
    assert.equal(business!.name, "Some Business");
    assert.equal(business!.placeId, "ChIJabc123");
    assert.equal(business!.rating, null);
    assert.equal(business!.reviewCount, null);
    assert.equal(business!.websiteUrl, null);
    assert.equal(business!.businessStatus, null);
    assert.equal(business!.source, "google_places");
    assert.equal(business!.sourceUrl, "https://www.google.com/maps/place/?q=place_id:ChIJabc123");
  });

  it("ignores an unrecognized businessStatus value rather than trusting it blindly", () => {
    const place: GooglePlace = { displayName: { text: "X" }, businessStatus: "SOMETHING_NEW_GOOGLE_ADDED" };
    const business = parseGooglePlace(place, parseConfig);
    assert.equal(business!.businessStatus, null);
  });
});

// ---------------------------------------------------------------------
// Regression fixtures: the exact three businesses that exposed the Scout
// V1 false-opportunity failure. Production parsing logic (parseGooglePlace,
// createGooglePlacesDiscoveryProvider) is completely generic -- it has no
// business-name-specific branches anywhere. These tests only supply the
// three real names/websites as MOCK response data to prove the generic
// logic resolves them correctly; the URLs are never hardcoded into
// production code (grep-checked below).
// ---------------------------------------------------------------------

const REGRESSION_PLACES: Record<string, GooglePlace> = {
  "Perfect Choice Nursery": {
    id: "place-perfect-choice-nursery",
    displayName: { text: "Perfect Choice Nursery" },
    formattedAddress: "123 Nursery Rd, Davie, FL 33314, USA",
    businessStatus: "OPERATIONAL",
    rating: 4.6,
    userRatingCount: 210,
    websiteUri: "https://perfectchoicenursery.com/",
    nationalPhoneNumber: "(954) 555-0111",
  },
  "The Time Is Now Design & Build": {
    id: "place-time-is-now",
    displayName: { text: "The Time Is Now Design & Build" },
    formattedAddress: "456 Design Ave, Davie, FL 33314, USA",
    businessStatus: "OPERATIONAL",
    rating: 4.8,
    userRatingCount: 340,
    websiteUri: "https://www.thetimeisnowdesignandbuild.com/",
    nationalPhoneNumber: "(954) 555-0122",
  },
  "Verdant Lyfe": {
    id: "place-verdant-lyfe",
    displayName: { text: "Verdant Lyfe" },
    formattedAddress: "789 Green Way, Coral Springs, FL 33065, USA",
    businessStatus: "OPERATIONAL",
    rating: 4.9,
    userRatingCount: 95,
    websiteUri: "https://www.verdantlyfe.com/",
    nationalPhoneNumber: "(954) 555-0133",
  },
};

const REACHABLE: InspectionResult = { reachable: true, finalUrl: "https://x.test", blockedReason: null, error: null, homepage: null, linkChecks: [], pagesFetched: 1 };
const UNREACHABLE: InspectionResult = { reachable: false, finalUrl: null, blockedReason: null, error: "timeout", homepage: null, linkChecks: [], pagesFetched: 0 };

describe("regression: the three real Scout V1 false opportunities", () => {
  for (const [name, place] of Object.entries(REGRESSION_PLACES)) {
    it(`${name}: website resolves from Google data via the generic parser, and inspection (not omission) drives website status`, () => {
      const business = parseGooglePlace(place, parseConfig);
      assert.ok(business, `expected ${name} to parse`);
      assert.equal(business!.websiteUrl, place.websiteUri);

      // The core V1 bug: a missing provider website field being treated as
      // "no website". Here the website IS present (from Google), so status
      // must be driven by real inspection, never defaulted to a no-website
      // bucket merely because a DIFFERENT, earlier source (OSM) once lacked it.
      const reachableStatus = classifyWebsiteStatus(
        { ...business!, normalizedName: name.toLowerCase(), normalizedDomain: null, normalizedPhone: null },
        REACHABLE,
      );
      assert.equal(reachableStatus, "working_standalone_website");

      const unreachableStatus = classifyWebsiteStatus(
        { ...business!, normalizedName: name.toLowerCase(), normalizedDomain: null, normalizedPhone: null },
        UNREACHABLE,
      );
      assert.equal(unreachableStatus, "website_unreachable");
      assert.notEqual(unreachableStatus, "no_standalone_website_unverified");
    });
  }

  it("end-to-end via the provider: all three resolve through one mocked Text Search response, with generic dedupe by Place ID", async () => {
    const provider = createGooglePlacesDiscoveryProvider({
      env: { GOOGLE_PLACES_API_KEY: "test-key" },
      fetcher: async () => jsonResult({ places: Object.values(REGRESSION_PLACES) }),
    });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.equal(result.businesses.length, 3);
    const byName = new Map(result.businesses.map((b) => [b.name, b]));
    assert.equal(byName.get("Perfect Choice Nursery")?.websiteUrl, "https://perfectchoicenursery.com/");
    assert.equal(byName.get("The Time Is Now Design & Build")?.websiteUrl, "https://www.thetimeisnowdesignandbuild.com/");
    assert.equal(byName.get("Verdant Lyfe")?.websiteUrl, "https://www.verdantlyfe.com/");
  });

  it("a Google-sourced websiteUri still goes through real SSRF validation -- it is never trusted blindly", async () => {
    const business = parseGooglePlace({ id: "x", displayName: { text: "Malicious Test Co" }, websiteUri: "http://169.254.169.254/latest/meta-data" }, parseConfig);
    assert.ok(business);
    const inspection = await inspectWebsite(business!.websiteUrl, { fetch: async () => assert.fail("must never reach the network for a blocked URL") });
    assert.equal(inspection.reachable, false);
    assert.equal(inspection.blockedReason, "blocked_metadata");
  });

  it("production discovery/resolution source contains no hardcoded regression business name or URL", () => {
    const source = readFileSync(join(process.cwd(), "src", "lib", "scout", "providers", "google-places.ts"), "utf8");
    for (const forbidden of ["Perfect Choice Nursery", "perfectchoicenursery.com", "The Time Is Now", "thetimeisnowdesignandbuild.com", "Verdant Lyfe", "verdantlyfe.com"]) {
      assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });
});

describe("createGooglePlacesDiscoveryProvider: configuration and failure handling", () => {
  it("reports unavailable with a clear diagnostic when unconfigured, rather than throwing", async () => {
    const provider = createGooglePlacesDiscoveryProvider({ env: {} });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.deepEqual(result.businesses, []);
    assert.match(result.diagnostic ?? "", /google_places_not_configured/);
  });

  it("never invokes the fetcher (never calls the network) when unconfigured", async () => {
    let called = false;
    const provider = createGooglePlacesDiscoveryProvider({
      env: {},
      fetcher: async () => {
        called = true;
        return jsonResult({ places: [] });
      },
    });
    await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.equal(called, false);
  });

  it("classifies a 429 as quota-exceeded without retrying", async () => {
    let calls = 0;
    const provider = createGooglePlacesDiscoveryProvider({
      env: { GOOGLE_PLACES_API_KEY: "test-key" },
      fetcher: async () => {
        calls += 1;
        return jsonResult({}, 429);
      },
    });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.match(result.diagnostic ?? "", /google_places_quota_exceeded/);
    assert.equal(calls, 1, "must not retry on quota exhaustion");
  });

  it("classifies 401/403 as an auth error and never includes the API key value in the diagnostic", async () => {
    const provider = createGooglePlacesDiscoveryProvider({
      env: { GOOGLE_PLACES_API_KEY: "super-secret-key-value" },
      fetcher: async () => jsonResult({}, 403),
    });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.match(result.diagnostic ?? "", /google_places_auth_error/);
    assert.doesNotMatch(result.diagnostic ?? "", /super-secret-key-value/);
  });

  it("fails soft on a network/timeout error rather than throwing and crashing the run", async () => {
    const provider = createGooglePlacesDiscoveryProvider({
      env: { GOOGLE_PLACES_API_KEY: "test-key" },
      fetcher: async () => {
        throw new Error("timeout");
      },
    });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.deepEqual(result.businesses, []);
    assert.match(result.diagnostic ?? "", /google_places_network_error/);
  });

  it("fails soft on an unparseable response body", async () => {
    const provider = createGooglePlacesDiscoveryProvider({
      env: { GOOGLE_PLACES_API_KEY: "test-key" },
      fetcher: async () => ({ status: 200, body: "not json" }),
    });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.deepEqual(result.businesses, []);
    assert.match(result.diagnostic ?? "", /google_places_invalid_response/);
  });

  it("makes exactly one request per search -- no pagination, no automatic retry loop", async () => {
    let calls = 0;
    const provider = createGooglePlacesDiscoveryProvider({
      env: { GOOGLE_PLACES_API_KEY: "test-key" },
      fetcher: async () => {
        calls += 1;
        return jsonResult({ places: [REGRESSION_PLACES["Verdant Lyfe"]] });
      },
    });
    await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 50 });
    assert.equal(calls, 1);
  });

  it("respects the requested candidate limit", async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `place-${i}`, displayName: { text: `Business ${i}` } }));
    const provider = createGooglePlacesDiscoveryProvider({
      env: { GOOGLE_PLACES_API_KEY: "test-key" },
      fetcher: async () => jsonResult({ places: many }),
    });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 5 });
    assert.equal(result.businesses.length, 5);
  });

  it("deduplicates by Place ID within a single response", async () => {
    const place = REGRESSION_PLACES["Perfect Choice Nursery"];
    const provider = createGooglePlacesDiscoveryProvider({
      env: { GOOGLE_PLACES_API_KEY: "test-key" },
      fetcher: async () => jsonResult({ places: [place, place] }),
    });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.equal(result.businesses.length, 1);
  });

  it("costs are reported honestly: paid provider, no live API call made in tests", () => {
    const provider = createGooglePlacesDiscoveryProvider({ env: { GOOGLE_PLACES_API_KEY: "test-key" } });
    assert.equal(provider.cost.paid, true);
    assert.equal(provider.id, "google_places");
  });
});

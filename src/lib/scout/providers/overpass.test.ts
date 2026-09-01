import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SafeFetchError, type FetchResult, type SafeHttpClient } from "@/lib/http/fetch";
import { buildOverpassQuery, createOverpassDiscoveryProvider, parseOverpassElement, type OverpassElement } from "./overpass";
import { SUPPORTED_SCOUT_LOCATIONS } from "../locations";

function mockClient(handler: (url: string) => FetchResult | Promise<never>): SafeHttpClient {
  return {
    async fetch(url) {
      const result = handler(url);
      return result instanceof Promise ? await result : result;
    },
  };
}

function jsonResult(body: unknown, status = 200): FetchResult {
  return { url: "https://overpass-api.de/api/interpreter", status, location: null, body: JSON.stringify(body), elapsedMs: 10, truncated: false, contentType: "application/json" };
}

describe("buildOverpassQuery", () => {
  it("includes the bounding box and both node/way clauses for every tag", () => {
    const bounds = SUPPORTED_SCOUT_LOCATIONS[0];
    const query = buildOverpassQuery(bounds, [{ key: "craft", value: "gardener" }], 10);
    assert.match(query, /node\["craft"="gardener"\]\(25\.95,-80\.87,26\.33,-80\.05\);/);
    assert.match(query, /way\["craft"="gardener"\]\(25\.95,-80\.87,26\.33,-80\.05\);/);
    assert.match(query, /\[out:json\]\[timeout:20\];/);
  });
});

describe("parseOverpassElement", () => {
  const base = { categoryId: "landscapers" as const, industry: "Landscaping", query: "q", retrievedAt: "2026-01-01T00:00:00Z" };

  it("returns null for an element with no name -- never invents one", () => {
    const element: OverpassElement = { type: "node", id: 1, tags: { craft: "gardener" } };
    assert.equal(parseOverpassElement(element, base), null);
  });

  it("extracts only what OSM tags directly provide, with null for anything absent", () => {
    const element: OverpassElement = {
      type: "node",
      id: 42,
      tags: {
        name: "Oak & Frond Landscaping",
        "addr:housenumber": "100",
        "addr:street": "Main St",
        "addr:city": "Boca Raton",
        "addr:state": "FL",
        phone: "+1-954-555-0100",
        website: "oakandfrond.example",
        "contact:instagram": "oakandfrond",
      },
    };
    const business = parseOverpassElement(element, base);
    assert.ok(business);
    assert.equal(business!.name, "Oak & Frond Landscaping");
    assert.equal(business!.address, "100 Main St");
    assert.equal(business!.city, "Boca Raton");
    assert.equal(business!.websiteUrl, "https://oakandfrond.example");
    assert.equal(business!.instagramUrl, "https://www.instagram.com/oakandfrond");
    assert.equal(business!.rating, null);
    assert.equal(business!.reviewCount, null);
    assert.equal(business!.email, null);
    assert.equal(business!.sourceUrl, "https://www.openstreetmap.org/node/42");
  });

  it("flags a franchise/chain only from an explicit brand tag, never guessed from the name", () => {
    const element: OverpassElement = { type: "node", id: 2, tags: { name: "Some Shop", brand: "Big Chain Co" } };
    const business = parseOverpassElement(element, base);
    assert.equal(business!.likelyChain, true);
  });
});

describe("createOverpassDiscoveryProvider", () => {
  it("reports a clear diagnostic for an unsupported location instead of guessing a bounding box", async () => {
    const provider = createOverpassDiscoveryProvider({ http: mockClient(() => jsonResult({ elements: [] })) });
    const result = await provider.search({ location: "Miami, FL", categoryId: "landscapers", limit: 10 });
    assert.deepEqual(result.businesses, []);
    assert.match(result.diagnostic ?? "", /not yet a supported/);
  });

  it("reports a clear diagnostic for a category with no OSM tag mapping instead of returning noise", async () => {
    const provider = createOverpassDiscoveryProvider({ http: mockClient(() => jsonResult({ elements: [] })) });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "pool_services", limit: 10 });
    assert.deepEqual(result.businesses, []);
    assert.match(result.diagnostic ?? "", /no_discovery_mapping/);
  });

  it("parses real elements, dedupes, and respects the limit", async () => {
    const elements: OverpassElement[] = [
      { type: "node", id: 1, tags: { name: "Oak & Frond", "addr:street": "Main St" } },
      { type: "node", id: 2, tags: { name: "Oak & Frond", "addr:street": "Main St" } }, // duplicate
      { type: "node", id: 3, tags: { name: "Cypress Yard Care" } },
      { type: "node", id: 4, tags: {} }, // unnamed, dropped
    ];
    const provider = createOverpassDiscoveryProvider({ http: mockClient(() => jsonResult({ elements })) });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 1 });
    assert.equal(result.businesses.length, 1);
    assert.equal(result.businesses[0].name, "Oak & Frond");
  });

  it("classifies a 429 as a rate-limit diagnostic and a 504 as a busy diagnostic, without throwing", async () => {
    const provider429 = createOverpassDiscoveryProvider({ http: mockClient(() => jsonResult({}, 429)) });
    const result429 = await provider429.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.deepEqual(result429.businesses, []);
    assert.match(result429.diagnostic ?? "", /rate_limited/);

    const provider504 = createOverpassDiscoveryProvider({ http: mockClient(() => jsonResult({}, 504)) });
    const result504 = await provider504.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.match(result504.diagnostic ?? "", /busy/);
  });

  it("fails soft (empty result + diagnostic) on a network error rather than throwing and crashing the run", async () => {
    const provider = createOverpassDiscoveryProvider({
      http: mockClient(() => {
        throw new SafeFetchError("network", "network");
      }),
    });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.deepEqual(result.businesses, []);
    assert.match(result.diagnostic ?? "", /provider_network_error/);
  });

  it("fails soft on an unparseable response body", async () => {
    const provider = createOverpassDiscoveryProvider({
      http: mockClient(() => ({ url: "x", status: 200, location: null, body: "not json", elapsedMs: 1, truncated: false, contentType: null })),
    });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.deepEqual(result.businesses, []);
    assert.match(result.diagnostic ?? "", /provider_invalid_response/);
  });

  it("reports no_results_found as an informational diagnostic, not an error, on a real clean zero-match search", async () => {
    const provider = createOverpassDiscoveryProvider({ http: mockClient(() => jsonResult({ elements: [] })) });
    const result = await provider.search({ location: "Broward County, FL", categoryId: "landscapers", limit: 10 });
    assert.deepEqual(result.businesses, []);
    assert.match(result.diagnostic ?? "", /no_results_found/);
  });

  it("costs $0 and never requires an API key", () => {
    const provider = createOverpassDiscoveryProvider();
    assert.equal(provider.cost.usd, 0);
    assert.equal(provider.cost.paid, false);
  });
});

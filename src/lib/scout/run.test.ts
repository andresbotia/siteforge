import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCatalogHttpClient, createMockCatalogProvider } from "./catalog";
import { decidePersistence } from "./dedupe";
import type { BusinessDiscoveryProvider } from "./discovery";
import { SCOUT_SIDE_EFFECTS, denyDirectPaidAi, scoutPaidAiPath } from "./policy";
import { runScoutPipeline } from "./run";
import type { DiscoveredBusiness, ExistingLeadRecord, NormalizedBusiness } from "./types";

describe("duplicate detection", () => {
  it("matches an existing lead by domain and does not insert", () => {
    const business: NormalizedBusiness = {
      name: "Harborline Plumbing",
      categoryId: "plumbers",
      industry: "Plumbing",
      city: "Fort Lauderdale",
      state: "FL",
      websiteUrl: "https://www.harborlineplumbing.example.test",
      phone: "(954) 555-0142",
      source: "mock_catalog",
      normalizedName: "harborline plumbing",
      normalizedDomain: "harborlineplumbing.example.test",
      normalizedPhone: "9545550142",
    };
    const existing: ExistingLeadRecord[] = [
      {
        id: "10000000-0000-4000-8000-000000000001",
        businessName: "Harborline Plumbing",
        websiteUrl: "https://www.harborlineplumbing.example.test",
        phone: "(954) 555-0142",
        city: "Fort Lauderdale",
        status: "qualified",
        notes: "manual note",
        normalizedDomain: "harborlineplumbing.example.test",
      },
    ];
    const decision = decidePersistence(business, existing);
    assert.equal(decision.action, "update");
    assert.equal(decision.existingId, existing[0].id);
  });

  it("matches an existing lead by Google Place ID first, even when other fields differ (e.g. a corrected phone/domain)", () => {
    const business: NormalizedBusiness = {
      name: "Perfect Choice Nursery LLC",
      categoryId: "landscapers",
      industry: "Landscaping",
      city: "Davie",
      state: "FL",
      websiteUrl: "https://perfectchoicenursery.com/",
      phone: "(954) 555-9999",
      source: "google_places",
      placeId: "place-perfect-choice-nursery",
      normalizedName: "perfect choice nursery",
      normalizedDomain: "perfectchoicenursery.com",
      normalizedPhone: "9545559999",
    };
    const existing: ExistingLeadRecord[] = [
      {
        id: "10000000-0000-4000-8000-000000000002",
        businessName: "Perfect Choice Nursery",
        websiteUrl: null,
        phone: "(954) 555-0100",
        city: "Davie",
        status: "discovered",
        notes: null,
        normalizedDomain: null,
        normalizedPhone: "9545550100",
        googlePlaceId: "place-perfect-choice-nursery",
      },
    ];
    const decision = decidePersistence(business, existing);
    assert.equal(decision.action, "update");
    assert.equal(decision.existingId, existing[0].id);
  });

  it("never merges two distinct businesses merely because their names are similar", () => {
    const business: NormalizedBusiness = {
      name: "Green Thumb Landscaping",
      categoryId: "landscapers",
      industry: "Landscaping",
      city: "Fort Lauderdale",
      state: "FL",
      websiteUrl: "https://greenthumb-fl.example.test",
      phone: "(954) 555-2222",
      source: "google_places",
      placeId: "place-green-thumb-a",
      normalizedName: "green thumb landscaping",
      normalizedDomain: "greenthumb-fl.example.test",
      normalizedPhone: "9545552222",
    };
    const existing: ExistingLeadRecord[] = [
      {
        id: "10000000-0000-4000-8000-000000000003",
        businessName: "Green Thumb Landscaping Co",
        websiteUrl: "https://different-domain.example.test",
        phone: "(954) 555-3333",
        city: "Pompano Beach",
        status: "discovered",
        notes: null,
        normalizedDomain: "different-domain.example.test",
        normalizedPhone: "9545553333",
        googlePlaceId: "place-green-thumb-b",
      },
    ];
    const decision = decidePersistence(business, existing);
    assert.equal(decision.action, "insert");
  });
});

describe("scout pipeline", () => {
  it("runs discovery through qualification without paid AI", async () => {
    const result = await runScoutPipeline(
      {
        location: "Fort Lauderdale, FL",
        categoryId: "plumbers",
        limit: 10,
        existingLeads: [
          {
            id: "10000000-0000-4000-8000-000000000001",
            businessName: "Harborline Plumbing",
            websiteUrl: "https://www.harborlineplumbing.example.test",
            phone: "(954) 555-0142",
            city: "Fort Lauderdale",
            status: "qualified",
            notes: "keep me",
            normalizedDomain: "harborlineplumbing.example.test",
          },
        ],
      },
      {
        discovery: createMockCatalogProvider(),
        http: createCatalogHttpClient(),
      },
    );
    assert.ok(result.discovered >= 1);
    assert.equal(result.discoveryCostUsd, 0);
    assert.equal(result.paidAi, "not_required");
    const harborline = result.candidates.find(
      (item) => item.business.normalizedName === "harborline plumbing",
    );
    assert.equal(harborline?.persist.action, "update");
    assert.notEqual(harborline?.persist.action, "insert");
  });
});

function fakeDiscovery(businesses: DiscoveredBusiness[], diagnostic: string | null = null): BusinessDiscoveryProvider {
  return {
    id: "fake_provider",
    label: "Fake provider",
    cost: { usd: 0, paid: false, providerId: "fake_provider", providerLabel: "Fake", notes: "" },
    async search() {
      return { businesses, diagnostic };
    },
  };
}

function throwingDiscovery(): BusinessDiscoveryProvider {
  return {
    id: "fake_provider",
    label: "Fake provider",
    cost: { usd: 0, paid: false, providerId: "fake_provider", providerLabel: "Fake", notes: "" },
    async search() {
      throw new Error("network_down");
    },
  };
}

function fixtureBusiness(overrides: Partial<DiscoveredBusiness> = {}): DiscoveredBusiness {
  return {
    name: "Fixture Co",
    categoryId: "landscapers",
    industry: "Landscaping",
    city: "Fort Lauderdale",
    state: "FL",
    source: "fake_provider",
    ...overrides,
  };
}

describe("scout pipeline: real-provider resilience and commercial ranking", () => {
  it("does not crash the run when the discovery provider itself throws -- reports a diagnostic instead", async () => {
    const result = await runScoutPipeline(
      { location: "Fort Lauderdale, FL", categoryId: "landscapers", limit: 10, existingLeads: [] },
      { discovery: throwingDiscovery(), http: createCatalogHttpClient() },
    );
    assert.equal(result.discovered, 0);
    assert.match(result.discoveryDiagnostic ?? "", /discovery_failed/);
  });

  it("passes through a provider diagnostic (e.g. unsupported location) without treating it as a crash", async () => {
    const result = await runScoutPipeline(
      { location: "Fort Lauderdale, FL", categoryId: "landscapers", limit: 10, existingLeads: [] },
      { discovery: fakeDiscovery([], "no_results_found: 0 named businesses matched"), http: createCatalogHttpClient() },
    );
    assert.equal(result.discovered, 0);
    assert.match(result.discoveryDiagnostic ?? "", /no_results_found/);
  });

  it("one failed website inspection does not fail the whole run (fail soft, per-business)", async () => {
    const businesses = [
      fixtureBusiness({ name: "Good Co", websiteUrl: "https://oakandfrond.example.test" }),
      fixtureBusiness({ name: "Bad Co", websiteUrl: "https://does-not-exist.invalid.test" }),
    ];
    const result = await runScoutPipeline(
      { location: "Fort Lauderdale, FL", categoryId: "landscapers", limit: 10, existingLeads: [] },
      { discovery: fakeDiscovery(businesses), http: createCatalogHttpClient() },
    );
    assert.equal(result.candidates.length, 2);
  });

  it("produces a BUILD/REVIEW/SKIP breakdown alongside the existing tier breakdown", async () => {
    const result = await runScoutPipeline(
      { location: "Fort Lauderdale, FL", categoryId: "landscapers", limit: 10, existingLeads: [] },
      {
        discovery: fakeDiscovery([fixtureBusiness({ phone: "(954) 555-0100", address: "1 Main St" })]),
        http: createCatalogHttpClient(),
      },
    );
    assert.equal(result.build + result.reviewCommercial + result.skip, result.candidates.length);
    const [candidate] = result.candidates;
    assert.ok(["BUILD", "REVIEW", "SKIP"].includes(candidate.commercial.recommendation));
  });

  it("bounds external requests with a per-run ceiling and reports partial results honestly", async () => {
    const many = Array.from({ length: 60 }, (_, i) => fixtureBusiness({ name: `Co ${i}` }));
    const result = await runScoutPipeline(
      { location: "Fort Lauderdale, FL", categoryId: "landscapers", limit: 50, existingLeads: [] },
      { discovery: fakeDiscovery(many), http: createCatalogHttpClient() },
    );
    assert.equal(result.discovered, 60);
    if (result.ceilingReached) {
      assert.ok(result.candidates.length < 60);
      assert.equal(result.notInspectedDueToCeiling, 60 - result.candidates.length);
    }
  });

  it("still performs no paid AI and no external side effects on the real-provider path", async () => {
    const result = await runScoutPipeline(
      { location: "Fort Lauderdale, FL", categoryId: "landscapers", limit: 10, existingLeads: [] },
      { discovery: fakeDiscovery([fixtureBusiness()]), http: createCatalogHttpClient() },
    );
    assert.equal(result.paidAi, "not_required");
    assert.equal(result.discoveryCostUsd, 0);
  });
});

describe("scout cannot bypass paid-AI or create side effects", () => {
  it("does not require or invoke paid AI for basic qualification", () => {
    assert.equal(scoutPaidAiPath(), "not_required");
    assert.throws(() => denyDirectPaidAi("executeApprovedAiRun"), /cannot call executeApprovedAiRun/);
  });

  it("performs no email, deploy, or payment side effects", () => {
    assert.equal(SCOUT_SIDE_EFFECTS.canSendEmail, false);
    assert.equal(SCOUT_SIDE_EFFECTS.canDeploy, false);
    assert.equal(SCOUT_SIDE_EFFECTS.canCharge, false);
    assert.equal(SCOUT_SIDE_EFFECTS.canCallXaiDirectly, false);
  });

  it("cannot invoke Designer -- no Scout module imports Designer's job-creation/prompt/worker code", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const scoutDir = join(process.cwd(), "src", "lib", "scout");
    const forbiddenImports = [/@\/lib\/designer\/(prompt|runner|worker-db|report)/, /@\/data\/designer/];

    function scan(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
          continue;
        }
        if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
        const source = readFileSync(full, "utf8");
        for (const pattern of forbiddenImports) {
          assert.doesNotMatch(source, pattern, `${full} must not import Designer job-invocation code`);
        }
      }
    }
    scan(scoutDir);
  });
});

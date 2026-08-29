import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCatalogHttpClient, createMockCatalogProvider } from "./catalog";
import { decidePersistence } from "./dedupe";
import { SCOUT_SIDE_EFFECTS, denyDirectPaidAi, scoutPaidAiPath } from "./policy";
import { runScoutPipeline } from "./run";
import type { ExistingLeadRecord, NormalizedBusiness } from "./types";

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
});

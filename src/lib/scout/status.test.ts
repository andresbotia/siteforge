import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decidePersistence } from "./dedupe";
import {
  buildExistingLeadScoutPatch,
  resolveScoutLeadStatus,
} from "./status";
import type { ExistingLeadRecord, NormalizedBusiness } from "./types";

const harborline: NormalizedBusiness = {
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

function patch(currentStatus: string, proposedStatus: string) {
  return buildExistingLeadScoutPatch({
    currentStatus,
    currentSource: "seed",
    currentPhone: "(954) 555-0142",
    currentWebsite: "https://www.harborlineplumbing.example.test",
    currentRating: 4.8,
    currentReviewCount: 312,
    proposedStatus,
    proposedPhone: "(954) 555-0142",
    proposedWebsite: "https://www.harborlineplumbing.example.test",
    proposedRating: 4.8,
    proposedReviewCount: 312,
    normalizedDomain: "harborlineplumbing.example.test",
    normalizedPhone: "9545550142",
    qualificationTier: "review",
    businessStrengthScore: 100,
    websiteOpportunityScore: 20,
    overallQualificationScore: 58,
    reasons: ["Business strength 100"],
    inspectionSummary: { reachable: true },
    runId: "run-2",
  });
}

describe("Scout status is monotonic", () => {
  it("keeps existing qualified when Scout proposes discovered", () => {
    assert.equal(resolveScoutLeadStatus("qualified", "discovered"), "qualified");
    assert.equal(patch("qualified", "discovered").status, "qualified");
  });

  it("keeps existing audited", () => {
    assert.equal(resolveScoutLeadStatus("audited", "discovered"), "audited");
    assert.equal(resolveScoutLeadStatus("audited", "qualified"), "audited");
  });

  it("keeps later customer-like statuses", () => {
    assert.equal(resolveScoutLeadStatus("customer", "qualified"), "customer");
    assert.equal(resolveScoutLeadStatus("contacted", "discovered"), "contacted");
    assert.equal(resolveScoutLeadStatus("interested", "qualified"), "interested");
    assert.equal(resolveScoutLeadStatus("website_built", "qualified"), "website_built");
    assert.equal(resolveScoutLeadStatus("approved", "discovered"), "approved");
  });

  it("allows an early discovered lead to advance when Scout qualifies it", () => {
    assert.equal(resolveScoutLeadStatus("discovered", "qualified"), "qualified");
  });

  it("still enriches Scout evidence on a duplicate", () => {
    const existing: ExistingLeadRecord[] = [
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
    ];
    const decision = decidePersistence(harborline, existing);
    assert.equal(decision.action, "update");
    const next = patch("qualified", "discovered");
    assert.equal(next.qualification_tier, "review");
    assert.equal(next.business_strength_score, 100);
    assert.equal(next.last_scout_run_id, "run-2");
    assert.deepEqual(next.inspection_summary, { reachable: true });
  });

  it("protects source and does not include notes in the update patch", () => {
    const next = patch("qualified", "discovered");
    assert.equal(next.source, "seed");
    assert.equal("notes" in next, false);
  });
});

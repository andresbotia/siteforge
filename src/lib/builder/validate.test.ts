import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runBuilderPipeline } from "./run";
import { validateWebsiteSpec } from "./validate";
import type { BuilderAuditInput, BuilderLeadInput } from "./types";

function lead(): BuilderLeadInput {
  return {
    id: "lead-1",
    businessName: "Harborline Plumbing",
    industry: "Plumbing",
    city: "Fort Lauderdale",
    state: "FL",
    address: null,
    phone: "(954) 555-0142",
    email: null,
    websiteUrl: "https://www.harborlineplumbing.example.test",
    rating: 4.8,
    reviewCount: 10,
    status: "audited",
    inspectionSummary: {},
  };
}

const audit: BuilderAuditInput = {
  id: "audit-1",
  overallScore: 40,
  redesignOpportunityScore: 70,
  findings: [{ code: "missing_viewport", title: "Missing viewport" }],
};

describe("trusted renderer validation", () => {
  it("accepts a structured spec from the pipeline", () => {
    const result = runBuilderPipeline(lead(), audit);
    assert.equal(validateWebsiteSpec(result.spec).ok, true);
  });

  it("rejects an invalid spec", () => {
    assert.equal(validateWebsiteSpec(null).ok, false);
    assert.equal(validateWebsiteSpec({ version: "nope" }).ok, false);
    const result = runBuilderPipeline(lead(), audit);
    assert.equal(validateWebsiteSpec({ ...result.spec, pages: [] }).ok, false);
  });
});

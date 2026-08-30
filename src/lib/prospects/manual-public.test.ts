import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { isLeadEligibleForAudit } from "../auditor/eligibility";
import { isLeadEligibleForBuild } from "../builder/eligibility";
import {
  MANUAL_PUBLIC_PROSPECT_SOURCE,
  isManualPublicProspectSource,
  validateManualPublicProspect,
} from "./manual-public";
import type { ExistingLeadRecord } from "../scout/types";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");

describe("manual public prospect import validation", () => {
  it("normalizes public business input and marks manual provenance", async () => {
    const result = await validateManualPublicProspect(
      {
        businessName: "  Harborline Plumbing LLC  ",
        websiteUrl: "www.harborline.example.test/contact",
        location: "Fort Lauderdale, FL",
        industry: "Plumbing",
        phone: "(954) 555-0142",
        address: "101 Public Ave",
        sourceNote: "Operator entered from public website.",
      },
      [],
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.draft.source, MANUAL_PUBLIC_PROSPECT_SOURCE);
    assert.equal(result.draft.business.websiteUrl, "https://www.harborline.example.test/contact");
    assert.equal(result.draft.business.normalizedDomain, "harborline.example.test");
    assert.equal(result.draft.business.normalizedPhone, "9545550142");
    assert.equal(result.draft.business.normalizedName, "harborline plumbing");
    assert.equal(result.draft.duplicateId, null);
  });

  it("dedupes against existing normalized domains", async () => {
    const existing: ExistingLeadRecord[] = [
      {
        id: "lead-existing",
        businessName: "Existing Harborline",
        websiteUrl: "https://harborline.example.test",
        phone: null,
        city: "Fort Lauderdale",
        status: "discovered",
        notes: null,
        normalizedDomain: "harborline.example.test",
        normalizedPhone: null,
      },
    ];

    const result = await validateManualPublicProspect(
      {
        businessName: "Harborline Plumbing",
        websiteUrl: "https://www.harborline.example.test/services",
        location: "Fort Lauderdale, FL",
        industry: "Plumbing",
      },
      existing,
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.draft.duplicateId, "lead-existing");
  });

  it("rejects private, local, metadata, and non-http URLs", async () => {
    const base = {
      businessName: "Public Business",
      location: "Miami, FL",
      industry: "Restaurant",
    };

    for (const websiteUrl of [
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "http://169.254.169.254/latest/meta-data",
      "file:///etc/passwd",
    ]) {
      const result = await validateManualPublicProspect(
        { ...base, websiteUrl },
        [],
      );
      assert.equal(result.ok, false);
    }
  });

  it("rejects public-looking hostnames that resolve to private IPs", async () => {
    const result = await validateManualPublicProspect(
      {
        businessName: "Public Looking Business",
        websiteUrl: "https://public-looking.example.test",
        location: "Tampa, FL",
        industry: "HVAC",
      },
      [],
      async () => ["10.0.0.5"],
    );

    assert.equal(result.ok, false);
  });

  it("distinguishes manual public prospects from fixtures and Scout rows", () => {
    assert.equal(isManualPublicProspectSource(MANUAL_PUBLIC_PROSPECT_SOURCE), true);
    assert.equal(isManualPublicProspectSource("scout"), false);
    assert.equal(isManualPublicProspectSource(null), false);
  });

  it("keeps import code free of email, payment, deployment, and paid AI side effects", () => {
    const source = readFileSync(resolve(currentDir, "manual-public.ts"), "utf8");
    assert.equal(
      /sendEmail|createCheckout|deploy|executeApprovedAiRun|createLiveXaiProvider|stripe|resend/i.test(
        source,
      ),
      false,
    );
  });

  it("uses an authenticated server action boundary for manual mutations", () => {
    const actionSource = readFileSync(
      resolve(repoRoot, "src/app/actions/leads.ts"),
      "utf8",
    );

    assert.match(actionSource, /"use server"/);
    assert.match(actionSource, /requireAdminSession\(\)/);
    assert.doesNotMatch(actionSource, /sendEmail|createCheckout|deploy|executeApprovedAiRun/i);
  });

  it("hands manual prospects to Auditor before Builder", async () => {
    const result = await validateManualPublicProspect(
      {
        businessName: "Review Stage Plumbing",
        websiteUrl: "reviewstage.example.test",
        location: "Orlando, FL",
        industry: "Plumbing",
      },
      [],
    );

    assert.equal(result.ok, true);
    assert.equal(isLeadEligibleForAudit({ status: "discovered" }), true);
    assert.equal(isLeadEligibleForBuild({ status: "discovered" }), false);
    assert.equal(isLeadEligibleForBuild({ status: "audited" }), true);
  });
});

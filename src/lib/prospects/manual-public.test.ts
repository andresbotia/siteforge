import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { isLeadEligibleForAudit } from "../auditor/eligibility";
import { isLeadEligibleForBuild } from "../builder/eligibility";
import {
  buildManualPublicProspectFailureState,
  readManualPublicProspectFormValues,
} from "./form-state";
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

  it("accepts and normalizes reasonable location whitespace and casing", async () => {
    const result = await validateManualPublicProspect(
      {
        businessName: "Coconut Creek Cooling",
        websiteUrl: "coconut-cooling.example.test",
        location: "  coconut creek , fl  ",
        industry: "HVAC",
      },
      [],
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.draft.business.city, "Coconut Creek");
    assert.equal(result.draft.business.state, "FL");
  });

  it("accepts Coconut Creek, FL as a valid location", async () => {
    const result = await validateManualPublicProspect(
      {
        businessName: "Coconut Creek Electric",
        websiteUrl: "coconut-electric.example.test",
        location: "Coconut Creek, FL",
        industry: "Electrical",
      },
      [],
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.draft.business.city, "Coconut Creek");
    assert.equal(result.draft.business.state, "FL");
  });

  it("preserves entered form values when location validation fails", async () => {
    const formData = new FormData();
    formData.set("businessName", "Palm Aire Plumbing");
    formData.set("websiteUrl", "palmaire.example.test");
    formData.set("location", "Coconut Creek Florida");
    formData.set("industry", "Plumbing");
    formData.set("phone", "(954) 555-0199");
    formData.set("address", "123 Public Rd");
    formData.set("sourceNote", "Public website footer");

    const values = readManualPublicProspectFormValues(formData);
    const result = await validateManualPublicProspect(values, []);

    assert.equal(result.ok, false);
    if (result.ok) return;
    const state = buildManualPublicProspectFailureState(result, values);
    assert.equal(state.values?.businessName, "Palm Aire Plumbing");
    assert.equal(state.values?.websiteUrl, "palmaire.example.test");
    assert.equal(state.values?.location, "Coconut Creek Florida");
    assert.equal(state.values?.industry, "Plumbing");
    assert.equal(state.values?.phone, "(954) 555-0199");
    assert.equal(state.values?.address, "123 Public Rd");
    assert.equal(state.values?.sourceNote, "Public website footer");
    assert.equal(state.fieldErrors?.location, result.error);
  });

  it("rejects malformed location values", async () => {
    for (const location of ["Coconut Creek Florida", "Coconut Creek, Florida", "FL", ""]) {
      const result = await validateManualPublicProspect(
        {
          businessName: "Malformed Location Business",
          websiteUrl: "malformed-location.example.test",
          location,
          industry: "HVAC",
        },
        [],
      );

      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.field, "location");
      }
    }
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

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bodyStatesCommercialTerms,
  COMMERCIAL_TERMS_REQUIRED_PHRASES,
  commercialTermsBlock,
  commercialTermsLines,
} from "./commercial-terms";
import { composeSalesDraft } from "./draft";
import { composeFollowUpDraft } from "./follow-up";

describe("commercial terms", () => {
  it("emits exactly four clauses covering setup+domain+year-one, optional post-year-one monthly, ownership, lapse", () => {
    const lines = commercialTermsLines("Reef Pool Care");
    assert.equal(lines.length, 4);
    assert.match(lines[0], /one-time payment.*registering a domain.*the first year of hosting/s);
    assert.match(lines[1], /only applies after the first year.*plus any changes/s);
    assert.match(lines[2], /registered in Reef Pool Care's name.*technical contact.*transfers to you on request/s);
    assert.match(lines[3], /stays online for 30 days and then comes down.*hand over the site files and transfer the domain to you/s);
  });

  it("does not imply the monthly starts immediately", () => {
    const block = commercialTermsBlock("X");
    assert.doesNotMatch(block, /\$39\/month.*starts now|billed monthly from launch/i);
    assert.match(block, /only applies after the first year/);
  });

  it("bodyStatesCommercialTerms requires every clause phrase", () => {
    assert.equal(bodyStatesCommercialTerms(commercialTermsBlock("Any Business")), true);
    assert.equal(bodyStatesCommercialTerms("just $99 setup and $39/month"), false);
    assert.equal(bodyStatesCommercialTerms(null), false);

    for (const phrase of COMMERCIAL_TERMS_REQUIRED_PHRASES) {
      const missingOne = commercialTermsLines("Any Business")
        .join("\n")
        .replace(phrase, "REDACTED");
      assert.equal(
        bodyStatesCommercialTerms(missingOne),
        false,
        `removing "${phrase}" should fail the check`,
      );
    }
  });

  it("both draft kinds embed the fixed terms verbatim", () => {
    const cold = composeSalesDraft(
      {
        businessName: "Palmetto Plumbing",
        city: "Fort Lauderdale",
        state: "FL",
        industry: "Plumbing",
        email: "owner@palmetto.test",
        websiteStatus: "no_standalone_website",
      } as Parameters<typeof composeSalesDraft>[0],
      { opportunityType: "new_website", findings: [], issues: [] } as Parameters<typeof composeSalesDraft>[1],
      { template: "home-services", auditFixes: [] } as Parameters<typeof composeSalesDraft>[2],
      {
        id: "p1",
        tokenHint: "hint",
        status: "active",
        revokedAt: null,
        attributionTokenHash: "h",
        attributionTokenHint: "ah",
      } as Parameters<typeof composeSalesDraft>[3],
    );
    assert.equal(bodyStatesCommercialTerms(cold.body), true);

    const followUp = composeFollowUpDraft(
      {
        id: "offer-1",
        businessName: "Palmetto Plumbing",
        setupAmountCents: 9900,
        managedMonthlyAmountCents: 3900,
        managedPlanSelected: true,
        purchaseTokenHash: "hash",
      },
      { recipientEmail: "owner@palmetto.test" },
    );
    assert.equal(bodyStatesCommercialTerms(followUp.body), true);
  });
});

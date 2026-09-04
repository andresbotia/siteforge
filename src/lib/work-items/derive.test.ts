import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveDesiredWorkItems, type LeadWorkItemInputs } from "./derive";
import { WORK_ITEM_PRIORITY } from "./types";

function inputs(overrides: Partial<LeadWorkItemInputs> = {}): LeadWorkItemInputs {
  return {
    lead: { id: "L1", status: "discovered" },
    latestAuditId: null,
    hasWebsite: false,
    offers: [],
    outreach: [],
    pendingEmailApprovals: [],
    customer: null,
    ...overrides,
  };
}

const types = (i: LeadWorkItemInputs) =>
  deriveDesiredWorkItems(i).map((d) => d.type).sort();

describe("deriveDesiredWorkItems", () => {
  it("wants qualify_lead for a discovered lead and nothing else", () => {
    assert.deepEqual(types(inputs()), ["qualify_lead"]);
  });

  it("drops qualify_lead once the lead advances (resolution is derived, not flagged)", () => {
    assert.deepEqual(types(inputs({ lead: { id: "L1", status: "qualified" } })), []);
  });

  it("wants review_site after an audit until a website exists", () => {
    const audited = inputs({ lead: { id: "L1", status: "audited" }, latestAuditId: "A1" });
    assert.deepEqual(types(audited), ["review_site"]);
    assert.deepEqual(
      types({ ...audited, hasWebsite: true }),
      [],
    );
  });

  it("does not want review_site for an archived / rejected / customer lead", () => {
    for (const status of ["archived", "rejected", "customer"]) {
      assert.equal(
        types(inputs({ lead: { id: "L1", status }, latestAuditId: "A1" })).includes("review_site"),
        false,
        status,
      );
    }
  });

  it("keys review_site on the audit id so a re-audit produces a fresh item", () => {
    const a1 = deriveDesiredWorkItems(
      inputs({ lead: { id: "L1", status: "audited" }, latestAuditId: "A1" }),
    );
    const a2 = deriveDesiredWorkItems(
      inputs({ lead: { id: "L1", status: "audited" }, latestAuditId: "A2" }),
    );
    assert.equal(a1[0].dedupeKey, "audit:A1");
    assert.equal(a2[0].dedupeKey, "audit:A2");
  });

  it("maps a pending cold approval to approve_outreach and a follow-up approval to approve_follow_up", () => {
    const ctx = inputs({
      lead: { id: "L1", status: "contacted" },
      pendingEmailApprovals: [
        { id: "AP1", payloadAction: "send_outreach_email" },
        { id: "AP2", payloadAction: "send_follow_up_email" },
      ],
    });
    const derived = deriveDesiredWorkItems(ctx);
    assert.deepEqual(
      derived.map((d) => `${d.type}:${d.dedupeKey}`).sort(),
      ["approve_follow_up:approval:AP2", "approve_outreach:approval:AP1"],
    );
  });

  it("treats a legacy approval with no payload action as a cold outreach approval", () => {
    const ctx = inputs({
      lead: { id: "L1", status: "contacted" },
      pendingEmailApprovals: [{ id: "AP1", payloadAction: null }],
    });
    assert.deepEqual(types(ctx), ["approve_outreach"]);
  });

  it("wants handle_reply for a replied outreach until the lead moves to interested/declined", () => {
    const replied = inputs({
      lead: { id: "L1", status: "contacted" },
      outreach: [{ id: "O1", kind: "cold_outreach", status: "replied" }],
    });
    assert.deepEqual(types(replied), ["handle_reply"]);
    assert.deepEqual(
      types({ ...replied, lead: { id: "L1", status: "interested" } }).includes("handle_reply"),
      false,
    );
  });

  it("wants confirm_intent only for an interested lead with no live offer", () => {
    const interested = inputs({ lead: { id: "L1", status: "interested" } });
    assert.deepEqual(types(interested), ["confirm_intent"]);

    const withDraftOffer = {
      ...interested,
      offers: [{ id: "OF1", status: "draft" }],
    };
    assert.equal(types(withDraftOffer).includes("confirm_intent"), false);

    const withRejectedOffer = {
      ...interested,
      offers: [{ id: "OF1", status: "rejected" }],
    };
    assert.equal(types(withRejectedOffer).includes("confirm_intent"), true);
  });

  it("wants fulfill_site only while the customer is pending_setup", () => {
    assert.deepEqual(
      types(inputs({ lead: { id: "L1", status: "customer" }, customer: { id: "C1", status: "pending_setup" } })),
      ["fulfill_site"],
    );
    assert.deepEqual(
      types(inputs({ lead: { id: "L1", status: "customer" }, customer: { id: "C1", status: "active" } })),
      [],
    );
  });

  it("wants review_visuals for a built site awaiting visual sign-off, from either producer", () => {
    const fromWebsite = inputs({
      lead: { id: "L1", status: "contacted" },
      hasWebsite: true,
      websitesAwaitingVisualReview: [{ id: "W1" }],
    });
    assert.deepEqual(
      deriveDesiredWorkItems(fromWebsite).map((d) => `${d.type}:${d.dedupeKey}`),
      ["review_visuals:website:W1"],
    );

    const fromDesignerJob = inputs({
      lead: { id: "L1", status: "website_built" },
      designerJobsAwaitingVisualReview: [{ id: "J1" }],
    });
    assert.deepEqual(
      deriveDesiredWorkItems(fromDesignerJob).map((d) => `${d.type}:${d.dedupeKey}`),
      ["review_visuals:designer_job:J1"],
    );
  });

  it("drops review_visuals once the lead is archived / rejected / customer", () => {
    for (const status of ["archived", "rejected", "customer"]) {
      assert.equal(
        types(
          inputs({
            lead: { id: "L1", status },
            websitesAwaitingVisualReview: [{ id: "W1" }],
          }),
        ).includes("review_visuals"),
        false,
        status,
      );
    }
  });

  it("orders review_visuals between fulfill_site and review_site", () => {
    assert.ok(WORK_ITEM_PRIORITY.fulfill_site < WORK_ITEM_PRIORITY.review_visuals);
    assert.ok(WORK_ITEM_PRIORITY.review_visuals < WORK_ITEM_PRIORITY.review_site);
  });

  it("assigns handle_reply the highest priority and qualify_lead the lowest", () => {
    assert.equal(WORK_ITEM_PRIORITY.handle_reply, 0);
    assert.ok(WORK_ITEM_PRIORITY.qualify_lead > WORK_ITEM_PRIORITY.approve_outreach);
    assert.ok(WORK_ITEM_PRIORITY.approve_outreach > WORK_ITEM_PRIORITY.review_site);
  });
});

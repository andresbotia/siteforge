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

  it("M10.6: never wants confirm_intent once a customer row exists, even if lead.status still reads interested", () => {
    // lead.status is operator-set and can lag the payment webhook; the
    // customers row is the fact that actually confirms intent.
    const interestedButPaid = inputs({
      lead: { id: "L1", status: "interested" },
      customer: { id: "C1", status: "pending_setup" },
    });
    assert.equal(types(interestedButPaid).includes("confirm_intent"), false);
  });

  it("M10.6 follow-up: an archived lead produces fulfill_site nowhere, even with a pending_setup customer row", () => {
    // Regression: fulfill_site's condition (customer.status === "pending_setup")
    // never checked lead.status at all, unlike every other type. Archiving
    // Tidewash / Atlantic Drain Plumbing (both had a live pending_setup
    // customer row from before they were archived) left "Fulfil the paid
    // site" showing at the top of the queue indefinitely -- reconcile kept
    // recomputing it as desired on every pass since the condition never
    // changed, so it was never in the "no longer desired" set reconcile
    // resolves. This is a missing status guard, not a resolve-pass bug.
    const archivedButPendingSetup = inputs({
      lead: { id: "L1", status: "archived" },
      customer: { id: "C1", status: "pending_setup" },
    });
    assert.deepEqual(types(archivedButPendingSetup), []);
  });

  it("M10.6 follow-up: an archived lead produces NO work item of any type, whatever else is true about it", () => {
    // Every trigger at once, to prove the guard is a blanket early return and
    // not one more per-type condition someone has to remember to add.
    const archivedWithEverything = inputs({
      lead: { id: "L1", status: "archived" },
      latestAuditId: "A1",
      hasWebsite: false,
      latestWebsite: { id: "W1", status: "review_required" },
      latestDesignerJob: { id: "J1", status: "visual_review_required" },
      customer: { id: "C1", status: "pending_setup" },
      offers: [{ id: "OF1", status: "draft" }],
      outreach: [{ id: "O1", kind: "cold_outreach", status: "replied" }],
      pendingEmailApprovals: [
        { id: "AP1", payloadAction: "send_outreach_email" },
        { id: "AP2", payloadAction: "send_follow_up_email" },
      ],
    });
    assert.deepEqual(deriveDesiredWorkItems(archivedWithEverything), []);
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

  it("M10.6: a lead with a pending follow-up approval AND a pending_setup customer wants fulfill_site only, not all three at once", () => {
    // This is the exact overlap M10.6 reported: one business simultaneously
    // asking to confirm intent, approve a payment follow-up, and fulfil the
    // paid site. Once a customers row exists, intent is confirmed and any
    // "please pay" follow-up is stale -- fulfill_site is the only live ask.
    const overlapping = inputs({
      lead: { id: "L1", status: "interested" },
      customer: { id: "C1", status: "pending_setup" },
      pendingEmailApprovals: [{ id: "AP1", payloadAction: "send_follow_up_email" }],
    });
    assert.deepEqual(types(overlapping), ["fulfill_site"]);
  });

  it("M10.6: approve_follow_up still fires normally before any customer row exists", () => {
    // A real follow-up approval always implies an approved offer (per
    // evaluateFollowUpEligibility), which also suppresses confirm_intent --
    // so this fixture matches what the real eligibility gate would produce.
    const stillProspect = inputs({
      lead: { id: "L1", status: "interested" },
      offers: [{ id: "OF1", status: "approved" }],
      pendingEmailApprovals: [{ id: "AP1", payloadAction: "send_follow_up_email" }],
    });
    assert.deepEqual(types(stillProspect), ["approve_follow_up"]);
  });

  it("M10.6: approve_outreach (cold) is unaffected by an existing customer row", () => {
    const alreadyCustomerButColdApprovalSomehowPending = inputs({
      lead: { id: "L1", status: "customer" },
      customer: { id: "C1", status: "active" },
      pendingEmailApprovals: [{ id: "AP1", payloadAction: "send_outreach_email" }],
    });
    assert.deepEqual(types(alreadyCustomerButColdApprovalSomehowPending), ["approve_outreach"]);
  });

  it("wants review_visuals for a built site awaiting visual sign-off, from either producer", () => {
    const fromWebsite = inputs({
      lead: { id: "L1", status: "contacted" },
      hasWebsite: true,
      latestWebsite: { id: "W1", status: "review_required" },
    });
    assert.deepEqual(
      deriveDesiredWorkItems(fromWebsite).map((d) => `${d.type}:${d.dedupeKey}`),
      ["review_visuals:website:W1"],
    );

    const fromDesignerJob = inputs({
      lead: { id: "L1", status: "website_built" },
      latestDesignerJob: { id: "J1", status: "visual_review_required" },
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
            latestWebsite: { id: "W1", status: "review_required" },
          }),
        ).includes("review_visuals"),
        false,
        status,
      );
    }
  });

  it("M10.6 follow-up: review_visuals ignores a superseded website even if it is still review_required, and follows only the latest", () => {
    // Regression for the Antojitos bug: 8 historical generated_websites rows
    // all sitting in review_required (rebuilds create history instead of
    // overwriting; nothing moves an old draft out of that status when it's
    // superseded) used to produce 8 duplicate work items. The data layer
    // (src/data/work-items.ts) now resolves "latest" before calling in here,
    // so derive only ever sees ONE candidate per lead -- this asserts the
    // derive-side half of the contract: passing the current version produces
    // exactly one item keyed on ITS id, never on an older one.
    const currentIsAwaitingReview = inputs({
      lead: { id: "L1", status: "website_built" },
      latestWebsite: { id: "W-latest", status: "review_required" },
    });
    assert.deepEqual(
      deriveDesiredWorkItems(currentIsAwaitingReview).map((d) => d.dedupeKey),
      ["website:W-latest"],
    );

    // The current version has already moved past review_required (approved,
    // live, building, failed, ...) -- no item, even though older history
    // might still say review_required in the database (derive never sees
    // that history at all; the data layer excludes it before this point).
    for (const status of ["approved", "live", "building", "failed"]) {
      const currentIsPastReview = inputs({
        lead: { id: "L1", status: "website_built" },
        latestWebsite: { id: "W-latest", status },
      });
      assert.deepEqual(types(currentIsPastReview), [], status);
    }

    // Nothing produced (no exception) when there is no current version at all.
    assert.deepEqual(types(inputs({ lead: { id: "L1", status: "website_built" }, latestWebsite: null })), []);
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

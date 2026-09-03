import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveOperatorActions,
  recommendWebsiteProducer,
  type OperatorActionContext,
} from "./operator-actions";

const CONFIGURED_SETUP_CENTS = 9900;
const CONFIGURED_MANAGED_CENTS = 3900;

function baseContext(
  overrides: Partial<OperatorActionContext> = {},
): OperatorActionContext {
  return {
    lead: { status: "discovered", industry: "Plumbing" },
    website: null,
    preview: null,
    hasPendingPreviewApproval: false,
    outreach: [],
    offers: [],
    isCustomer: false,
    ...overrides,
  };
}

const ids = (ctx: OperatorActionContext) =>
  deriveOperatorActions(ctx).map((action) => action.id);

describe("deriveOperatorActions", () => {
  it("offers exactly what the lifecycle table + eligibility helpers allow for a fresh discovered lead", () => {
    // discovered -> interested is a legal forward jump in LEAD_LIFECYCLE_TRANSITIONS,
    // so mark_interested is offered by derivation rather than a second rule set.
    assert.deepEqual(ids(baseContext()), ["mark_interested", "run_audit", "archive"]);
  });

  it("does not offer create_website until the lead is build-eligible", () => {
    assert.equal(ids(baseContext({ lead: { status: "discovered", industry: "Plumbing" } })).includes("create_website"), false);
    assert.equal(
      ids(baseContext({ lead: { status: "audited", industry: "Plumbing" } })).includes("create_website"),
      true,
    );
  });

  it("hides create_website once a website exists", () => {
    const ctx = baseContext({
      lead: { status: "audited", industry: "Plumbing" },
      website: { id: "w1", hasSpec: true },
    });
    assert.equal(ids(ctx).includes("create_website"), false);
  });

  it("routes create_website to the deterministic Builder when a template family covers the industry", () => {
    const [action] = deriveOperatorActions(
      baseContext({
        lead: { status: "audited", industry: "Plumbing" },
      }),
    ).filter((a) => a.id === "create_website");
    assert.equal(action.websiteProducer, "builder");
    assert.equal(recommendWebsiteProducer("Plumbing"), "builder");
  });

  it("routes create_website to a Designer Job when no template family covers the industry", () => {
    const [action] = deriveOperatorActions(
      baseContext({
        lead: { status: "audited", industry: "Artisanal Widget Foundry" },
      }),
    ).filter((a) => a.id === "create_website");
    assert.equal(action.websiteProducer, "designer_job");
    assert.equal(recommendWebsiteProducer("Artisanal Widget Foundry"), "designer_job");
  });

  it("offers preview approval only when a spec draft exists with no live preview and no pending approval", () => {
    const withDraft = baseContext({
      lead: { status: "website_built", industry: "Plumbing" },
      website: { id: "w1", hasSpec: true },
    });
    assert.equal(ids(withDraft).includes("request_preview_approval"), true);

    assert.equal(
      ids({ ...withDraft, hasPendingPreviewApproval: true }).includes("request_preview_approval"),
      false,
    );
    assert.equal(
      ids({ ...withDraft, preview: { status: "active", revokedAt: null } }).includes(
        "request_preview_approval",
      ),
      false,
    );
  });

  it("offers cold outreach only with a live approved preview and no cold email yet", () => {
    const ready = baseContext({
      lead: { status: "approved", industry: "Plumbing" },
      website: { id: "w1", hasSpec: true },
      preview: { status: "active", revokedAt: null },
    });
    assert.equal(ids(ready).includes("draft_cold_outreach"), true);

    const alreadySent = {
      ...ready,
      outreach: [{ kind: "cold_outreach" as const, status: "sent" }],
    };
    assert.equal(ids(alreadySent).includes("draft_cold_outreach"), false);
  });

  it("offers mark_interested only when the lifecycle table allows it", () => {
    assert.equal(ids(baseContext({ lead: { status: "contacted", industry: "Plumbing" } })).includes("mark_interested"), true);
    // interested -> interested is a no-op, not offered
    assert.equal(ids(baseContext({ lead: { status: "interested", industry: "Plumbing" } })).includes("mark_interested"), false);
    // customer cannot go back to interested
    assert.equal(ids(baseContext({ lead: { status: "customer", industry: "Plumbing" } })).includes("mark_interested"), false);
  });

  it("offers create_offer once there is a website and the lead can still become a customer", () => {
    const ctx = baseContext({
      lead: { status: "interested", industry: "Plumbing" },
      website: { id: "w1", hasSpec: true },
    });
    assert.equal(ids(ctx).includes("create_offer"), true);

    // not once an offer already exists
    const withOffer = {
      ...ctx,
      offers: [
        {
          status: "draft",
          setupAmountCents: CONFIGURED_SETUP_CENTS,
          managedMonthlyAmountCents: null,
          managedPlanSelected: false,
          purchaseTokenHash: null,
          purchaseLinkRevokedAt: null,
        },
      ],
    };
    assert.equal(ids(withOffer).includes("create_offer"), false);
  });

  it("offers publish_purchase_link for an approved offer with no link", () => {
    const ctx = baseContext({
      lead: { status: "interested", industry: "Plumbing" },
      website: { id: "w1", hasSpec: true },
      offers: [
        {
          status: "approved",
          setupAmountCents: CONFIGURED_SETUP_CENTS,
          managedMonthlyAmountCents: null,
          managedPlanSelected: false,
          purchaseTokenHash: null,
          purchaseLinkRevokedAt: null,
        },
      ],
    });
    assert.equal(ids(ctx).includes("publish_purchase_link"), true);
  });

  it("offers draft_follow_up only when follow-up eligibility passes and none has been sent", () => {
    const eligible = baseContext({
      lead: { status: "interested", industry: "Plumbing" },
      website: { id: "w1", hasSpec: true },
      offers: [
        {
          status: "approved",
          setupAmountCents: CONFIGURED_SETUP_CENTS,
          managedMonthlyAmountCents: CONFIGURED_MANAGED_CENTS,
          managedPlanSelected: true,
          purchaseTokenHash: "hash-abc",
          purchaseLinkRevokedAt: null,
        },
      ],
    });
    assert.equal(ids(eligible).includes("draft_follow_up"), true);

    const alreadySent = {
      ...eligible,
      outreach: [{ kind: "follow_up" as const, status: "sent" }],
    };
    assert.equal(ids(alreadySent).includes("draft_follow_up"), false);

    // a revoked link fails the shared follow-up eligibility check
    const revoked = {
      ...eligible,
      offers: [{ ...eligible.offers[0], purchaseLinkRevokedAt: "2026-09-01T00:00:00Z" }],
    };
    assert.equal(ids(revoked).includes("draft_follow_up"), false);
  });

  it("offers un-archive (and nothing else destructive) for an archived lead", () => {
    const archived = ids(baseContext({ lead: { status: "archived", industry: "Plumbing" } }));
    assert.equal(archived.includes("unarchive"), true);
    assert.equal(archived.includes("archive"), false);
  });

  it("orders close actions ahead of housekeeping", () => {
    const ctx = baseContext({
      lead: { status: "interested", industry: "Plumbing" },
      website: { id: "w1", hasSpec: true },
      offers: [
        {
          status: "approved",
          setupAmountCents: CONFIGURED_SETUP_CENTS,
          managedMonthlyAmountCents: CONFIGURED_MANAGED_CENTS,
          managedPlanSelected: true,
          purchaseTokenHash: "hash-abc",
          purchaseLinkRevokedAt: null,
        },
      ],
    });
    const order = deriveOperatorActions(ctx);
    assert.equal(order[0].id, "draft_follow_up");
    assert.equal(order[order.length - 1].id, "archive");
  });
});

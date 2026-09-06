import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCustomerActivationPatch, canActivateCustomerSite } from "./activation";
import { deriveDesiredWorkItems, type LeadWorkItemInputs } from "@/lib/work-items/derive";

function inputs(overrides: Partial<LeadWorkItemInputs> = {}): LeadWorkItemInputs {
  return {
    lead: { id: "L1", status: "customer" },
    latestAuditId: null,
    hasWebsite: true,
    offers: [],
    outreach: [],
    pendingEmailApprovals: [],
    customer: null,
    ...overrides,
  };
}

describe("canActivateCustomerSite", () => {
  it("only succeeds from pending_setup", () => {
    assert.equal(canActivateCustomerSite("pending_setup").ok, true);
  });

  it("refuses (does not no-op silently) from active or cancelled or any other status", () => {
    for (const status of ["active", "cancelled", "", "draft", "unknown"]) {
      const result = canActivateCustomerSite(status);
      assert.equal(result.ok, false, status);
      if (!result.ok) {
        assert.match(result.error, /not "pending_setup"/);
        assert.match(result.error, new RegExp(`"${status}"`));
      }
    }
  });
});

describe("buildCustomerActivationPatch", () => {
  it("records the exact fields the update writes, with a real timestamp", () => {
    const now = new Date("2026-09-06T12:00:00.000Z");
    const patch = buildCustomerActivationPatch(now);
    assert.deepEqual(patch, { status: "active", activated_at: "2026-09-06T12:00:00.000Z" });
  });

  it("defaults to the current time when no date is given", () => {
    const before = Date.now();
    const patch = buildCustomerActivationPatch();
    const after = Date.now();
    const recorded = new Date(patch.activated_at).getTime();
    assert.ok(recorded >= before && recorded <= after);
  });
});

describe("activation clears the fulfill_site work item (integration with deriveDesiredWorkItems)", () => {
  it("a pending_setup customer wants fulfill_site; applying the activation patch's status makes it stop wanting it", () => {
    assert.equal(canActivateCustomerSite("pending_setup").ok, true);

    const before = deriveDesiredWorkItems(
      inputs({ customer: { id: "C1", status: "pending_setup" } }),
    );
    assert.ok(before.some((item) => item.type === "fulfill_site"));

    const patch = buildCustomerActivationPatch(new Date("2026-09-06T12:00:00.000Z"));
    const after = deriveDesiredWorkItems(
      inputs({ customer: { id: "C1", status: patch.status } }),
    );
    assert.equal(after.some((item) => item.type === "fulfill_site"), false);
  });
});

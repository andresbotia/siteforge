import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { leadStatuses } from "@/lib/constants";
import { resolveMonotonicLeadStatus, resolveScoutLeadStatus } from "@/lib/scout/status";
import type { LeadStatus } from "@/types";
import {
  canTransitionLeadStatus,
  LEAD_LIFECYCLE_TRANSITIONS,
  normalizeArchivedReason,
  operatorSelectableStatuses,
  resolveLeadStatusTransition,
} from "./lifecycle";

const PIPELINE_ORDER: LeadStatus[] = [
  "discovered",
  "qualified",
  "audited",
  "website_built",
  "approved",
  "contacted",
  "interested",
  "customer",
];

describe("lead lifecycle transition table", () => {
  it("covers every declared lead status exactly once", () => {
    const tableKeys = Object.keys(LEAD_LIFECYCLE_TRANSITIONS).sort();
    assert.deepEqual(tableKeys, [...leadStatuses].sort());
  });

  it("never lists an unknown status as a target", () => {
    const known = new Set<string>(leadStatuses);
    for (const [from, targets] of Object.entries(LEAD_LIFECYCLE_TRANSITIONS)) {
      for (const target of targets) {
        assert.ok(known.has(target), `${from} -> ${target} is not a known status`);
      }
    }
  });

  it("allows archived from every state, including customer and rejected", () => {
    for (const status of leadStatuses) {
      if (status === "archived") continue;
      assert.equal(
        canTransitionLeadStatus(status, "archived", { archivedReason: "operator closed it out" }).ok,
        true,
        `${status} must be able to reach archived`,
      );
    }
  });

  it("refuses to archive without a non-empty reason", () => {
    const missing = canTransitionLeadStatus("contacted", "archived");
    assert.equal(missing.ok, false);
    assert.match(missing.ok === false ? missing.error : "", /reason/i);

    const blank = canTransitionLeadStatus("contacted", "archived", { archivedReason: "   " });
    assert.equal(blank.ok, false);

    assert.equal(
      canTransitionLeadStatus("contacted", "archived", { archivedReason: "no budget this year" }).ok,
      true,
    );
  });

  it("allows the interested -> contacted fallback when a prospect goes quiet", () => {
    assert.equal(canTransitionLeadStatus("interested", "contacted").ok, true);
  });

  it("keeps every other transition monotonic -- no other backward edge exists", () => {
    for (let from = 0; from < PIPELINE_ORDER.length; from += 1) {
      for (let to = 0; to < from; to += 1) {
        const current = PIPELINE_ORDER[from];
        const next = PIPELINE_ORDER[to];
        const isTheOneAllowedFallback = current === "interested" && next === "contacted";
        assert.equal(
          canTransitionLeadStatus(current, next).ok,
          isTheOneAllowedFallback,
          `${current} -> ${next} backward edge`,
        );
      }
    }
  });

  it("allows forward jumps that skip intermediate stages, as the pipeline always did", () => {
    // The outreach send path moves audited -> contacted; the Stripe webhook
    // moves contacted -> customer. Both skip stages and must stay legal.
    assert.equal(canTransitionLeadStatus("audited", "contacted").ok, true);
    assert.equal(canTransitionLeadStatus("contacted", "customer").ok, true);
    assert.equal(canTransitionLeadStatus("discovered", "website_built").ok, true);
  });

  it("gives archived exactly one exit -- archived -> contacted -- so an accidental archive is reversible", () => {
    assert.deepEqual(LEAD_LIFECYCLE_TRANSITIONS.archived, ["contacted"]);
    assert.equal(canTransitionLeadStatus("archived", "contacted").ok, true);
    for (const status of leadStatuses) {
      if (status === "archived" || status === "contacted") continue;
      assert.equal(
        canTransitionLeadStatus("archived", status, { archivedReason: "x" }).ok,
        false,
        `archived must not move to ${status}`,
      );
    }
  });

  it("keeps the archived -> contacted exit operator-only: no automated writer can un-archive", () => {
    assert.equal(resolveLeadStatusTransition("archived", "contacted"), "archived");
    assert.equal(resolveMonotonicLeadStatus("archived", "contacted"), "archived");
  });

  it("keeps rejected reachable only from discovered, exactly as before M9.9", () => {
    assert.equal(canTransitionLeadStatus("discovered", "rejected").ok, true);
    for (const status of PIPELINE_ORDER.slice(1)) {
      assert.equal(
        canTransitionLeadStatus(status, "rejected").ok,
        false,
        `${status} -> rejected must stay disallowed`,
      );
    }
  });

  it("allows a no-op transition so idempotent writers do not have to special-case it", () => {
    for (const status of leadStatuses) {
      assert.equal(canTransitionLeadStatus(status, status, { archivedReason: "r" }).ok, true);
    }
  });

  it("rejects unknown statuses on either side", () => {
    assert.equal(canTransitionLeadStatus("not_a_status", "qualified").ok, false);
    assert.equal(canTransitionLeadStatus("qualified", "not_a_status").ok, false);
  });

  it("operatorSelectableStatuses returns exactly the table row", () => {
    assert.deepEqual(operatorSelectableStatuses("interested"), ["contacted", "customer", "archived"]);
    assert.deepEqual(operatorSelectableStatuses("archived"), ["contacted"]);
    assert.deepEqual(operatorSelectableStatuses("nonsense"), []);
  });

  it("normalizeArchivedReason trims, nulls empties, and bounds length", () => {
    assert.equal(normalizeArchivedReason("  went quiet  "), "went quiet");
    assert.equal(normalizeArchivedReason("   "), null);
    assert.equal(normalizeArchivedReason(null), null);
    assert.equal(normalizeArchivedReason("x".repeat(900))?.length, 500);
  });
});

describe("automated writers resolve through the same table", () => {
  it("never archives from an automated writer", () => {
    assert.equal(resolveLeadStatusTransition("contacted", "archived"), "contacted");
  });

  it("preserves pre-M9.9 Scout behavior", () => {
    assert.equal(resolveScoutLeadStatus(null, "discovered"), "discovered");
    assert.equal(resolveScoutLeadStatus("qualified", "discovered"), "qualified");
    assert.equal(resolveScoutLeadStatus("discovered", "qualified"), "qualified");
    assert.equal(resolveScoutLeadStatus("rejected", "qualified"), "rejected");
    assert.equal(resolveScoutLeadStatus("discovered", "rejected"), "rejected");
    assert.equal(resolveScoutLeadStatus("qualified", "rejected"), "qualified");
    assert.equal(resolveScoutLeadStatus("weird_legacy_status", "qualified"), "weird_legacy_status");
    assert.equal(resolveScoutLeadStatus("qualified", "not_a_status"), "qualified");
  });

  it("never walks an archived lead back onto the pipeline (operator-only archived -> contacted aside)", () => {
    assert.equal(resolveMonotonicLeadStatus("archived", "contacted"), "archived");
    assert.equal(resolveMonotonicLeadStatus("archived", "customer"), "archived");
  });

  it("does not let an automated writer use the interested -> contacted fallback silently", () => {
    // The fallback is an operator decision. The cold-send path is the only
    // automated writer that proposes "contacted", and src/data/outreach.ts
    // only proposes it for a cold_outreach send; this asserts the resolver
    // itself would otherwise permit it, which is why that call site is
    // kind-scoped.
    assert.equal(resolveLeadStatusTransition("interested", "contacted"), "contacted");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDesignerJobTransition,
  canPromoteToMaster,
  canTransitionDesignerJob,
  isTerminalDesignerJobStatus,
} from "./state-machine";

describe("designer job state machine", () => {
  it("allows the documented happy path", () => {
    const path = [
      "queued",
      "claimed",
      "preparing",
      "generating",
      "generated",
      "validating",
      "technical_qa_passed",
      "visual_review_required",
      "approved",
    ] as const;
    for (let index = 0; index < path.length - 1; index += 1) {
      assert.equal(canTransitionDesignerJob(path[index], path[index + 1]), true);
    }
  });

  it("rejects skipping straight to approved", () => {
    assert.equal(canTransitionDesignerJob("queued", "approved"), false);
    assert.equal(canTransitionDesignerJob("generating", "approved"), false);
    assert.equal(canTransitionDesignerJob("technical_qa_passed", "approved"), false);
    assert.throws(() => assertDesignerJobTransition("technical_qa_passed", "approved"));
  });

  it("only reaches approved from visual_review_required", () => {
    assert.equal(canTransitionDesignerJob("visual_review_required", "approved"), true);
    assert.equal(canTransitionDesignerJob("technical_qa_failed", "approved"), false);
  });

  it("treats every failure-adjacent state as reachable from generation", () => {
    assert.equal(canTransitionDesignerJob("generating", "failed"), true);
    assert.equal(canTransitionDesignerJob("claimed", "cancelled"), true);
  });

  it("marks terminal states correctly", () => {
    assert.equal(isTerminalDesignerJobStatus("approved"), true);
    assert.equal(isTerminalDesignerJobStatus("rejected"), true);
    assert.equal(isTerminalDesignerJobStatus("visual_review_required"), false);
    assert.equal(isTerminalDesignerJobStatus("queued"), false);
  });

  it("only promotes new_master jobs that are approved end to end", () => {
    assert.equal(canPromoteToMaster({ status: "approved", visualReviewStatus: "approved", mode: "new_master" }), true);
    assert.equal(canPromoteToMaster({ status: "approved", visualReviewStatus: "approved", mode: "adaptation" }), false);
    assert.equal(canPromoteToMaster({ status: "approved", visualReviewStatus: "needs_revision", mode: "new_master" }), false);
    assert.equal(canPromoteToMaster({ status: "visual_review_required", visualReviewStatus: "approved", mode: "new_master" }), false);
  });
});

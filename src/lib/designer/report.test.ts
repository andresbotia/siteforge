import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseDesignerWorkerReport } from "./report";

const JOB_ID = "11111111-1111-1111-1111-111111111111";

describe("designer worker report contract", () => {
  it("parses a well-formed completion report", () => {
    const raw = JSON.stringify({
      jobId: JOB_ID,
      status: "completed",
      summary: "Built a hero-first single page for a fictional HVAC business.",
      factsUsed: ["business name", "phone"],
      factsOmitted: ["hours - not supplied"],
      imageryUsed: [],
      unsupportedFactCheck: "No invented facts.",
      technicalNotes: "Vite + React static export.",
      visualNotes: "Full-bleed hero, editorial services list.",
      selfCritique: "Tightened the CTA link so it never wraps to two lines on a 375px viewport.",
      recommendedMasterFamily: "home_services",
      candidateForMaster: true,
      warnings: [],
    });
    const parsed = parseDesignerWorkerReport(raw, JOB_ID);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.report.status, "completed");
      assert.equal(parsed.report.candidateForMaster, true);
      assert.equal(parsed.report.recommendedMasterFamily, "home_services");
      assert.match(parsed.report.selfCritique, /never wraps to two lines/);
    }
  });

  it("fails closed on invalid JSON", () => {
    const parsed = parseDesignerWorkerReport("not json", JOB_ID);
    assert.equal(parsed.ok, false);
  });

  it("fails closed when the job id does not match (prevents cross-job report confusion)", () => {
    const raw = JSON.stringify({ jobId: "someone-elses-job", status: "completed", summary: "x" });
    const parsed = parseDesignerWorkerReport(raw, JOB_ID);
    assert.equal(parsed.ok, false);
  });

  it("fails closed when status is missing or invalid", () => {
    const raw = JSON.stringify({ jobId: JOB_ID, status: "done", summary: "x" });
    const parsed = parseDesignerWorkerReport(raw, JOB_ID);
    assert.equal(parsed.ok, false);
  });

  it("fails closed when summary is missing", () => {
    const raw = JSON.stringify({ jobId: JOB_ID, status: "completed" });
    const parsed = parseDesignerWorkerReport(raw, JOB_ID);
    assert.equal(parsed.ok, false);
  });

  it("ignores an unrecognized recommendedMasterFamily rather than trusting it", () => {
    const raw = JSON.stringify({
      jobId: JOB_ID,
      status: "completed",
      summary: "x",
      recommendedMasterFamily: "totally_made_up_family",
    });
    const parsed = parseDesignerWorkerReport(raw, JOB_ID);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.report.recommendedMasterFamily, null);
  });

  it("bounds oversized arrays and strings instead of trusting an adversarial report", () => {
    const raw = JSON.stringify({
      jobId: JOB_ID,
      status: "completed",
      summary: "x".repeat(10_000),
      factsUsed: Array.from({ length: 500 }, (_, index) => `fact-${index}`),
    });
    const parsed = parseDesignerWorkerReport(raw, JOB_ID);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.report.summary.length <= 4_000, true);
      assert.equal(parsed.report.factsUsed.length <= 40, true);
    }
  });
});

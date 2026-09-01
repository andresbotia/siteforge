import { asRecord, asStringArray } from "@/lib/json";

/**
 * Machine-readable completion report the Designer Worker prompt (prompt.ts)
 * instructs Claude to write to output/report.json before finishing. This is
 * never trusted blindly: SiteForge independently re-derives build_passed via
 * buildExternalSourceArtifact() (external-artifacts.ts) and treats every
 * field here as a claim to be checked, not a fact. See collect.ts.
 */
export type DesignerWorkerReport = {
  jobId: string;
  status: "completed" | "failed";
  summary: string;
  factsUsed: string[];
  factsOmitted: string[];
  imageryUsed: string[];
  unsupportedFactCheck: string;
  technicalNotes: string;
  visualNotes: string;
  selfCritique: string;
  recommendedMasterFamily: string | null;
  candidateForMaster: boolean;
  warnings: string[];
};

export type ParsedDesignerWorkerReport =
  | { ok: true; report: DesignerWorkerReport }
  | { ok: false; reason: string };

const MAX_ITEMS = 40;
const MAX_TEXT = 4_000;

/**
 * Parses and bounds the worker's self-report. Unknown/malformed fields fail
 * closed rather than being coerced into something plausible-looking -- an
 * invalid report is itself a failure signal (failure_code: invalid_report),
 * not something to patch over.
 */
export function parseDesignerWorkerReport(raw: string, expectedJobId: string): ParsedDesignerWorkerReport {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "report_not_valid_json" };
  }
  const row = asRecord(value);
  if (typeof row.jobId !== "string" || row.jobId !== expectedJobId) {
    return { ok: false, reason: "report_job_id_mismatch" };
  }
  if (row.status !== "completed" && row.status !== "failed") {
    return { ok: false, reason: "report_missing_status" };
  }
  if (typeof row.summary !== "string" || !row.summary.trim()) {
    return { ok: false, reason: "report_missing_summary" };
  }
  return {
    ok: true,
    report: {
      jobId: row.jobId,
      status: row.status,
      summary: bounded(row.summary, MAX_TEXT),
      factsUsed: boundedArray(row.factsUsed),
      factsOmitted: boundedArray(row.factsOmitted),
      imageryUsed: boundedArray(row.imageryUsed),
      unsupportedFactCheck: bounded(typeof row.unsupportedFactCheck === "string" ? row.unsupportedFactCheck : "", MAX_TEXT),
      technicalNotes: bounded(typeof row.technicalNotes === "string" ? row.technicalNotes : "", MAX_TEXT),
      visualNotes: bounded(typeof row.visualNotes === "string" ? row.visualNotes : "", MAX_TEXT),
      selfCritique: bounded(typeof row.selfCritique === "string" ? row.selfCritique : "", MAX_TEXT),
      recommendedMasterFamily:
        row.recommendedMasterFamily === "home_services" ||
        row.recommendedMasterFamily === "restaurant" ||
        row.recommendedMasterFamily === "professional" ||
        row.recommendedMasterFamily === "other"
          ? row.recommendedMasterFamily
          : null,
      candidateForMaster: row.candidateForMaster === true,
      warnings: boundedArray(row.warnings),
    },
  };
}

function boundedArray(value: unknown): string[] {
  return asStringArray(value).slice(0, MAX_ITEMS).map((item) => bounded(item, 300));
}

function bounded(value: string, max: number): string {
  return value.slice(0, max);
}

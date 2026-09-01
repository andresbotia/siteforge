/**
 * Designer Job lifecycle.
 *
 * A Designer Job asks a design-capable worker (initially the operator's local
 * Claude Code subscription session) to produce a candidate master template or
 * a meaningful adaptation of one, for a lead the deterministic Builder
 * registry cannot confidently cover. See src/lib/builder/registry.ts for the
 * coverage check this replaces manual design work for.
 *
 * Legal transitions:
 *   queued                  -> claimed | cancelled
 *   claimed                 -> preparing | failed | cancelled
 *   preparing               -> generating | failed | cancelled
 *   generating               -> generated | failed | cancelled
 *   generated                -> validating | failed
 *   validating                -> technical_qa_passed | technical_qa_failed
 *   technical_qa_failed      -> failed | superseded
 *   technical_qa_passed      -> visual_review_required
 *   visual_review_required   -> approved | rejected | superseded | queued
 *   approved                 -> (terminal; may separately be promoted_to_master)
 *   rejected                 -> (terminal)
 *   failed                   -> (terminal)
 *   cancelled                -> (terminal)
 *   superseded               -> (terminal)
 *
 * Human visual approval is structural, not advisory: the only path into
 * `approved` is from `visual_review_required`, and that transition may only
 * be requested by recordVisualReview() (src/data/designer.ts) after an admin
 * session has written a visual_review_status of 'approved'. No worker output
 * and no automated QA result can set status to `approved` directly. This
 * mirrors the mandatory human-approval boundary already used for M7 preview
 * publication and M9 checkout approval.
 *
 * Revision loop: `visual_review_required -> queued` is the ONE additional
 * edge beyond the original linear happy path. recordVisualReview() takes it
 * only when an admin submits visual_review_status='needs_revision' with
 * non-empty notes, and resets the worker-owned execution fields (claimed_by,
 * claimed_at, workspace_path, started_at, completed_at, technical_qa_report,
 * failure_code/reason) so the job re-enters claimNextDesignerJob()'s normal
 * queue exactly like a brand-new job -- but visual_review_notes is
 * deliberately NOT cleared, and the job keeps its id, so the worker reuses
 * the same on-disk workspace (createDesignerJobWorkspace() is keyed by job
 * id and is not wiped between runs). This lets the Designer Worker read its
 * own previous output back and revise it in place, informed by the human's
 * notes, without a second job row, a new workspace, or a conversational
 * revision protocol. No new status was introduced for this on purpose --
 * "revising" is just "re-running the same job with feedback attached."
 */
export const DESIGNER_JOB_STATES = [
  "queued",
  "claimed",
  "preparing",
  "generating",
  "generated",
  "validating",
  "technical_qa_failed",
  "technical_qa_passed",
  "visual_review_required",
  "approved",
  "rejected",
  "failed",
  "cancelled",
  "superseded",
] as const;

export type DesignerJobStatus = (typeof DESIGNER_JOB_STATES)[number];

const TRANSITIONS: Record<DesignerJobStatus, DesignerJobStatus[]> = {
  queued: ["claimed", "cancelled"],
  claimed: ["preparing", "failed", "cancelled"],
  preparing: ["generating", "failed", "cancelled"],
  generating: ["generated", "failed", "cancelled"],
  generated: ["validating", "failed"],
  validating: ["technical_qa_passed", "technical_qa_failed"],
  technical_qa_failed: ["failed", "superseded"],
  technical_qa_passed: ["visual_review_required"],
  visual_review_required: ["approved", "rejected", "superseded", "queued"],
  approved: [],
  rejected: [],
  failed: [],
  cancelled: [],
  superseded: [],
};

export const TERMINAL_DESIGNER_JOB_STATES: DesignerJobStatus[] = [
  "approved",
  "rejected",
  "failed",
  "cancelled",
  "superseded",
];

export function canTransitionDesignerJob(
  from: DesignerJobStatus,
  to: DesignerJobStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertDesignerJobTransition(
  from: DesignerJobStatus,
  to: DesignerJobStatus,
): void {
  if (!canTransitionDesignerJob(from, to)) {
    throw new Error(`Illegal designer_job transition: ${from} -> ${to}`);
  }
}

export function isTerminalDesignerJobStatus(status: DesignerJobStatus): boolean {
  return TERMINAL_DESIGNER_JOB_STATES.includes(status);
}

/**
 * True only when a job may legally be promoted to an approved reusable
 * master. Takes plain strings (not the DesignerJobStatus union) because
 * callers read `status`/`mode` straight off a DesignerJobRow, which is
 * typed as `string` at the database layer.
 */
export function canPromoteToMaster(input: {
  status: string;
  visualReviewStatus: string;
  mode: string;
}): boolean {
  return input.status === "approved" && input.visualReviewStatus === "approved" && input.mode === "new_master";
}

export const VISUAL_REVIEW_STATES = ["not_ready", "pending", "approved", "needs_revision", "rejected"] as const;
export type VisualReviewStatus = (typeof VISUAL_REVIEW_STATES)[number];

export const DESIGNER_JOB_MODES = ["new_master", "adaptation"] as const;
export type DesignerJobMode = (typeof DESIGNER_JOB_MODES)[number];

export const DESIGNER_PROVIDERS = ["claude_code", "grok_local"] as const;
export type DesignerProviderId = (typeof DESIGNER_PROVIDERS)[number];

export const DESIGNER_FAILURE_CODES = [
  "cli_not_found",
  "auth_unavailable",
  "subscription_capacity_unavailable",
  "api_billing_required",
  "timeout",
  "cancelled_by_operator",
  "workspace_error",
  "invalid_report",
  "build_failed",
  "validation_failed",
  "process_error",
  "unknown",
] as const;
export type DesignerFailureCode = (typeof DESIGNER_FAILURE_CODES)[number];

/**
 * Auditor side-effect policy for Milestone 5.
 * Deterministic inspection does not use paid AI.
 */

export const AUDITOR_SIDE_EFFECTS = {
  canSendEmail: false,
  canDeploy: false,
  canCharge: false,
  canCallXaiDirectly: false,
  requiresPaidAiForBasicRun: false,
  generatesReplacementWebsite: false,
  contactsBusiness: false,
} as const;

/**
 * Optional future AI enrichment. Disabled in this milestone.
 * If enabled later it MUST use executeApprovedAiRun after Milestone 3 approval.
 * Auditor must never import createLiveXaiProvider or read XAI_API_KEY.
 */
export const AUDITOR_AI_ENRICHMENT = {
  enabled: false,
  requiredPath: "executeApprovedAiRun",
} as const;

export function assertNoAuditorSideEffects(): void {
  if (AUDITOR_SIDE_EFFECTS.canSendEmail) throw new Error("auditor_email_forbidden");
  if (AUDITOR_SIDE_EFFECTS.canDeploy) throw new Error("auditor_deploy_forbidden");
  if (AUDITOR_SIDE_EFFECTS.canCharge) throw new Error("auditor_payment_forbidden");
  if (AUDITOR_SIDE_EFFECTS.canCallXaiDirectly) throw new Error("auditor_direct_xai_forbidden");
  if (AUDITOR_SIDE_EFFECTS.generatesReplacementWebsite) {
    throw new Error("auditor_builder_forbidden");
  }
  if (AUDITOR_SIDE_EFFECTS.contactsBusiness) {
    throw new Error("auditor_outreach_forbidden");
  }
  if (AUDITOR_AI_ENRICHMENT.enabled) {
    throw new Error("auditor_ai_enrichment_disabled");
  }
}

export function auditorPaidAiPath(): "not_required" | "milestone_3_approval" {
  return AUDITOR_SIDE_EFFECTS.requiresPaidAiForBasicRun
    ? "milestone_3_approval"
    : "not_required";
}

export function denyDirectPaidAi(label = "executeApprovedAiRun"): never {
  throw new Error(
    `Auditor cannot call ${label} directly. Paid AI must go through requestPaidAiRun and a human-approved ceiling.`,
  );
}

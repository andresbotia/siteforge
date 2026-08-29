/**
 * Builder side-effect policy for Milestone 6.
 * Deterministic template drafts do not use paid AI and do not leave the system.
 */

export const BUILDER_SIDE_EFFECTS = {
  canSendEmail: false,
  canDeployProduction: false,
  canCharge: false,
  canBuyDomain: false,
  canChangeDns: false,
  canCallXaiDirectly: false,
  requiresPaidAiForBasicRun: false,
  contactsBusiness: false,
} as const;

export const BUILDER_AI_ENRICHMENT = {
  enabled: false,
  requiredPath: "executeApprovedAiRun",
} as const;

export function assertNoBuilderSideEffects(): void {
  if (BUILDER_SIDE_EFFECTS.canSendEmail) throw new Error("builder_email_forbidden");
  if (BUILDER_SIDE_EFFECTS.canDeployProduction) {
    throw new Error("builder_deploy_forbidden");
  }
  if (BUILDER_SIDE_EFFECTS.canCharge) throw new Error("builder_payment_forbidden");
  if (BUILDER_SIDE_EFFECTS.canBuyDomain) throw new Error("builder_domain_forbidden");
  if (BUILDER_SIDE_EFFECTS.canChangeDns) throw new Error("builder_dns_forbidden");
  if (BUILDER_SIDE_EFFECTS.canCallXaiDirectly) throw new Error("builder_direct_xai_forbidden");
  if (BUILDER_SIDE_EFFECTS.contactsBusiness) throw new Error("builder_outreach_forbidden");
  if (BUILDER_AI_ENRICHMENT.enabled) throw new Error("builder_ai_enrichment_disabled");
}

export function builderPaidAiPath(): "not_required" | "milestone_3_approval" {
  return BUILDER_SIDE_EFFECTS.requiresPaidAiForBasicRun
    ? "milestone_3_approval"
    : "not_required";
}

export function denyDirectPaidAi(label = "executeApprovedAiRun"): never {
  throw new Error(
    `Builder cannot call ${label} directly. Paid AI must go through requestPaidAiRun and a human-approved ceiling.`,
  );
}

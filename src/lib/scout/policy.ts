/**
 * Scout side-effect policy for Milestone 4.
 * Basic discovery/qualification does not use paid AI.
 */

export const SCOUT_SIDE_EFFECTS = {
  canSendEmail: false,
  canDeploy: false,
  canCharge: false,
  canCallXaiDirectly: false,
  requiresPaidAiForBasicRun: false,
} as const;

export function assertNoScoutSideEffects(): void {
  if (SCOUT_SIDE_EFFECTS.canSendEmail) throw new Error("scout_email_forbidden");
  if (SCOUT_SIDE_EFFECTS.canDeploy) throw new Error("scout_deploy_forbidden");
  if (SCOUT_SIDE_EFFECTS.canCharge) throw new Error("scout_payment_forbidden");
  if (SCOUT_SIDE_EFFECTS.canCallXaiDirectly) throw new Error("scout_direct_xai_forbidden");
}

export function scoutPaidAiPath(): "not_required" | "milestone_3_approval" {
  return SCOUT_SIDE_EFFECTS.requiresPaidAiForBasicRun
    ? "milestone_3_approval"
    : "not_required";
}

export function denyDirectPaidAi(label = "executeApprovedAiRun"): never {
  throw new Error(
    `Scout cannot call ${label} directly. Paid AI must go through requestPaidAiRun and a human-approved ceiling.`,
  );
}

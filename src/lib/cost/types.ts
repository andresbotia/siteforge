/**
 * Legacy USD display types. Authoritative paid-AI money is integer ticks
 * in src/lib/ai. No agent may incur unapproved paid cost.
 */
export type CostUsd = number;

export type CostFields = {
  estimatedCostUsd: CostUsd | null;
  approvedCostLimitUsd: CostUsd | null;
  actualCostUsd: CostUsd | null;
  requiresApproval: boolean;
};

export const PAID_AI_USAGE_APPROVAL_TYPE = "paid_ai_usage" as const;

export function exceedsApprovedCostLimit(cost: CostFields): boolean {
  if (cost.approvedCostLimitUsd === null) return cost.requiresApproval;
  const actual = cost.actualCostUsd ?? 0;
  const estimated = cost.estimatedCostUsd ?? 0;
  return Math.max(actual, estimated) > cost.approvedCostLimitUsd;
}

export function paidActionRequiresApproval(
  estimatedCostUsd: CostUsd | null,
  approvedCostLimitUsd: CostUsd | null = 0,
): boolean {
  const estimate = estimatedCostUsd ?? 0;
  const limit = approvedCostLimitUsd ?? 0;
  return estimate > limit;
}

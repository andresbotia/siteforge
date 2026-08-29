import type { LeadStatus, QualificationTier } from "@/types";

const AUDITABLE_STATUSES = new Set<string>([
  "discovered",
  "qualified",
  "audited",
  "website_built",
  "approved",
  "contacted",
  "interested",
  "customer",
]);

const PRIORITY_TIERS = new Set<string>(["review", "qualified", "high_priority"]);

export function isLeadEligibleForAudit(lead: {
  status: string;
}): boolean {
  if (lead.status === "rejected") return false;
  return AUDITABLE_STATUSES.has(lead.status);
}

/**
 * Scout review / qualified / high-priority candidates are the initial
 * Auditor queue. Later-stage leads remain eligible for re-audit.
 */
export function isPriorityAuditCandidate(lead: {
  status: string;
  qualificationTier?: QualificationTier | string | null;
}): boolean {
  if (!isLeadEligibleForAudit(lead)) return false;
  if (lead.status === "discovered" || lead.status === "qualified") {
    const tier = lead.qualificationTier;
    return !tier || PRIORITY_TIERS.has(tier);
  }
  return true;
}

export function auditPriorityRank(lead: {
  status: string;
  qualificationTier?: QualificationTier | string | null;
}): number {
  const tier = lead.qualificationTier;
  if (tier === "high_priority") return 0;
  if (tier === "qualified" || lead.status === "qualified") return 1;
  if (tier === "review" || lead.status === "discovered") return 2;
  if (lead.status === "audited") return 3;
  return 4;
}

export function isAuditableStatus(status: LeadStatus | string): boolean {
  return isLeadEligibleForAudit({ status });
}

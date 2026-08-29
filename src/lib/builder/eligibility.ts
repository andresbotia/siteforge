const BUILDABLE_STATUSES = new Set<string>([
  "audited",
  "website_built",
  "approved",
  "contacted",
  "interested",
  "customer",
]);

export function isLeadEligibleForBuild(lead: { status: string }): boolean {
  if (lead.status === "rejected") return false;
  return BUILDABLE_STATUSES.has(lead.status);
}

export function buildPriorityRank(lead: {
  status: string;
  overallScore?: number | null;
}): number {
  if (lead.status === "audited") return 0;
  if (lead.status === "website_built") return 1;
  return 2;
}

import { leadStatuses } from "@/lib/constants";
import type { LeadStatus } from "@/types";
import type { Json } from "@/types/database";

/**
 * Authoritative Scout workflow order. Matches src/types LeadStatus.
 * rejected is terminal/off-path and is never overwritten by rediscovery.
 */
export const LEAD_PIPELINE_ORDER: readonly LeadStatus[] = [
  "discovered",
  "qualified",
  "audited",
  "website_built",
  "approved",
  "contacted",
  "interested",
  "customer",
];

const PIPELINE = new Set<string>(LEAD_PIPELINE_ORDER);
const KNOWN = new Set<string>(leadStatuses);

export function isLeadStatus(value: string): value is LeadStatus {
  return KNOWN.has(value);
}

export function leadPipelineRank(status: string): number | null {
  const index = LEAD_PIPELINE_ORDER.indexOf(status as LeadStatus);
  return index >= 0 ? index : null;
}

/**
 * Existing lead status is monotonic.
 * Scout may advance discovered → qualified, but never move backward.
 * rejected stays rejected. Unknown statuses are preserved.
 */
export function resolveScoutLeadStatus(
  current: string | null | undefined,
  proposed: string,
): string {
  if (!current) return proposed;
  if (current === "rejected") return current;
  if (!isLeadStatus(current)) return current;

  const currentRank = leadPipelineRank(current);
  const proposedRank = leadPipelineRank(proposed);

  if (proposed === "rejected") {
    return currentRank === 0 ? proposed : current;
  }
  if (currentRank === null || proposedRank === null) return current;
  return proposedRank > currentRank ? proposed : current;
}

export type ExistingLeadScoutPatch = {
  status: string;
  source: string | null;
  phone: string | null;
  website_url: string | null;
  google_rating: number | null;
  review_count: number;
  normalized_domain: string | null;
  normalized_phone: string | null;
  qualification_tier: string;
  business_strength_score: number;
  website_opportunity_score: number;
  overall_qualification_score: number;
  qualification_reasons: string[];
  inspection_summary: Json;
  last_scout_run_id: string;
};

export function buildExistingLeadScoutPatch(input: {
  currentStatus: string;
  currentSource: string | null;
  currentPhone: string | null;
  currentWebsite: string | null;
  currentRating: number | null;
  currentReviewCount: number;
  proposedStatus: string;
  proposedPhone: string | null;
  proposedWebsite: string | null;
  proposedRating: number | null;
  proposedReviewCount: number | null;
  normalizedDomain: string | null;
  normalizedPhone: string | null;
  qualificationTier: string;
  businessStrengthScore: number;
  websiteOpportunityScore: number;
  overallQualificationScore: number;
  reasons: string[];
  inspectionSummary: Json;
  runId: string;
}): ExistingLeadScoutPatch {
  return {
    status: resolveScoutLeadStatus(input.currentStatus, input.proposedStatus),
    source: input.currentSource,
    phone: input.currentPhone || input.proposedPhone,
    website_url: input.currentWebsite || input.proposedWebsite,
    google_rating: input.proposedRating ?? input.currentRating,
    review_count: input.proposedReviewCount ?? input.currentReviewCount,
    normalized_domain: input.normalizedDomain,
    normalized_phone: input.normalizedPhone,
    qualification_tier: input.qualificationTier,
    business_strength_score: input.businessStrengthScore,
    website_opportunity_score: input.websiteOpportunityScore,
    overall_qualification_score: input.overallQualificationScore,
    qualification_reasons: input.reasons,
    inspection_summary: input.inspectionSummary,
    last_scout_run_id: input.runId,
  };
}

export { PIPELINE as SCOUT_PIPELINE_STATUSES };

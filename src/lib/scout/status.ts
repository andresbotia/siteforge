import {
  isLeadStatus as isLifecycleLeadStatus,
  resolveLeadStatusTransition,
} from "@/lib/leads/lifecycle";
import type { LeadStatus } from "@/types";
import type { Json } from "@/types/database";

/**
 * Authoritative Scout workflow order. Matches src/types LeadStatus.
 * rejected/archived are terminal/off-path and are never overwritten by
 * rediscovery. The transition RULES themselves live in one place --
 * `src/lib/leads/lifecycle.ts` -- and this order is retained only for
 * Scout's own display/ranking use.
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

export function isLeadStatus(value: string): value is LeadStatus {
  return isLifecycleLeadStatus(value);
}

export function leadPipelineRank(status: string): number | null {
  const index = LEAD_PIPELINE_ORDER.indexOf(status as LeadStatus);
  return index >= 0 ? index : null;
}

/**
 * Existing lead status for automated writers (Scout, Auditor, outreach send,
 * Stripe webhook). Since M9.9 the rules are not implemented here -- this
 * delegates to the single allowed-transitions table in
 * `src/lib/leads/lifecycle.ts`. Behavior for every pre-M9.9 case is
 * unchanged: early-stage leads may advance (including skipping stages),
 * later pipeline statuses never move backward, `rejected` is only reachable
 * from `discovered` and then stays rejected, unknown statuses are preserved.
 * `archived` is additionally never set by an automated writer.
 */
export function resolveMonotonicLeadStatus(
  current: string | null | undefined,
  proposed: string,
): string {
  return resolveScoutLeadStatus(current, proposed);
}

export function resolveScoutLeadStatus(
  current: string | null | undefined,
  proposed: string,
): string {
  return resolveLeadStatusTransition(current, proposed);
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

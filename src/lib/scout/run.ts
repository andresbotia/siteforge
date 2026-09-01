import { getScoutCategory } from "./categories";
import { assessCommercialScore, type CommercialScoreResult } from "./commercial-score";
import { mapWithConcurrency } from "./concurrency";
import { assessContactability, type ContactabilityAssessment } from "./contactability";
import type { BusinessDiscoveryProvider } from "./discovery";
import { decidePersistence } from "./dedupe";
import { inspectWebsite, type ScoutHttpClient } from "./inspector";
import {
  SCOUT_DEFAULT_CANDIDATES,
  SCOUT_INSPECTION_CONCURRENCY,
  SCOUT_MAX_CANDIDATES,
  SCOUT_MAX_EXTERNAL_REQUESTS_PER_RUN,
  SCOUT_MAX_LINKS_TO_CHECK,
} from "./limits";
import { normalizeBusinessName, normalizeDomain, normalizePhone, parseLocation } from "./normalize";
import { assertNoScoutSideEffects, denyDirectPaidAi, scoutPaidAiPath } from "./policy";
import { scoreCandidate } from "./scoring";
import type { DnsLookup } from "./ssrf";
import { classifyWebsiteStatus, type WebsiteStatus } from "./website-status";
import type {
  DiscoveredBusiness,
  ExistingLeadRecord,
  InspectionResult,
  NormalizedBusiness,
  ScoutCandidateResult,
  ScoutRunConfig,
} from "./types";

export type EnrichedScoutCandidateResult = ScoutCandidateResult & {
  websiteStatus: WebsiteStatus;
  contactability: ContactabilityAssessment;
  commercial: CommercialScoreResult;
};

export type ScoutPipelineInput = ScoutRunConfig & {
  existingLeads: ExistingLeadRecord[];
};

export type ScoutPipelineResult = {
  config: ScoutRunConfig;
  locationLabel: string;
  categoryLabel: string;
  discoveryCostUsd: number;
  discoveryProviderId: string;
  discoveryDiagnostic: string | null;
  paidAi: "not_required" | "milestone_3_approval";
  discovered: number;
  inspected: number;
  qualified: number;
  review: number;
  rejected: number;
  errors: number;
  build: number;
  reviewCommercial: number;
  skip: number;
  ceilingReached: boolean;
  notInspectedDueToCeiling: number;
  candidates: EnrichedScoutCandidateResult[];
};

/** Worst-case external requests one candidate's website inspection can use (homepage + link checks). */
const MAX_REQUESTS_PER_CANDIDATE = 1 + SCOUT_MAX_LINKS_TO_CHECK;

export async function runScoutPipeline(
  input: ScoutPipelineInput,
  deps: {
    discovery: BusinessDiscoveryProvider;
    http: ScoutHttpClient;
    lookup?: DnsLookup;
  },
): Promise<ScoutPipelineResult> {
  assertNoScoutSideEffects();
  if (scoutPaidAiPath() !== "not_required") {
    denyDirectPaidAi();
  }

  const category = getScoutCategory(input.categoryId);
  if (!category) throw new Error("unknown_category");
  const limit = Math.max(1, Math.min(SCOUT_MAX_CANDIDATES, input.limit || SCOUT_DEFAULT_CANDIDATES));
  const location = parseLocation(input.location);

  let discoveryResult: { businesses: DiscoveredBusiness[]; diagnostic: string | null };
  try {
    discoveryResult = await deps.discovery.search({ location: input.location, categoryId: input.categoryId, limit });
  } catch (error) {
    discoveryResult = {
      businesses: [],
      diagnostic: `discovery_failed: ${error instanceof Error ? error.message : "unknown_error"}`,
    };
  }
  const discovered = discoveryResult.businesses;

  // Reserve the run's external-request budget before inspecting anything, so
  // a large candidate set degrades to a smaller, fully-inspected set rather
  // than an unbounded number of requests. No infinite discovery loops.
  const maxInspectable = Math.max(0, Math.floor(SCOUT_MAX_EXTERNAL_REQUESTS_PER_RUN / MAX_REQUESTS_PER_CANDIDATE));
  const toInspect = discovered.slice(0, maxInspectable);
  const ceilingReached = discovered.length > toInspect.length;
  const notInspectedDueToCeiling = discovered.length - toInspect.length;

  const normalizedList: NormalizedBusiness[] = toInspect.map((raw) => ({
    ...raw,
    industry: category.industry,
    categoryId: input.categoryId,
    normalizedName: normalizeBusinessName(raw.name),
    normalizedDomain: normalizeDomain(raw.websiteUrl),
    normalizedPhone: normalizePhone(raw.phone),
  }));

  let errors = 0;
  let inspectedCount = 0;
  const inspected = await mapWithConcurrency(normalizedList, SCOUT_INSPECTION_CONCURRENCY, async (business) => {
    try {
      const inspection = await inspectWebsite(business.websiteUrl, deps.http, deps.lookup);
      inspectedCount += 1;
      return { business, inspection };
    } catch {
      errors += 1;
      const inspection: InspectionResult = {
        reachable: false,
        finalUrl: null,
        blockedReason: null,
        error: "inspect_failed",
        homepage: null,
        linkChecks: [],
        pagesFetched: 0,
      };
      return { business, inspection };
    }
  });

  const candidates: EnrichedScoutCandidateResult[] = [];
  const existing = [...input.existingLeads];

  for (const { business, inspection } of inspected) {
    const score = scoreCandidate(business, inspection);
    const persist = decidePersistence(business, existing);
    if (persist.action === "insert") {
      existing.push({
        id: `pending:${business.normalizedName}:${business.city}`,
        businessName: business.name,
        websiteUrl: business.websiteUrl ?? null,
        phone: business.phone ?? null,
        city: business.city,
        status: "discovered",
        notes: null,
        normalizedDomain: business.normalizedDomain,
        normalizedPhone: business.normalizedPhone,
      });
    }
    const websiteStatus = classifyWebsiteStatus(business, inspection);
    const contactability = assessContactability(business, inspection);
    const commercial = assessCommercialScore({ business, inspection, score, websiteStatus, contactability });
    candidates.push({ business, inspection, score, persist, websiteStatus, contactability, commercial });
  }

  return {
    config: { location: input.location, categoryId: input.categoryId, limit },
    locationLabel: location.label,
    categoryLabel: category.label,
    discoveryCostUsd: deps.discovery.cost.usd,
    discoveryProviderId: deps.discovery.id,
    discoveryDiagnostic: discoveryResult.diagnostic,
    paidAi: scoutPaidAiPath(),
    discovered: discovered.length,
    inspected: inspectedCount,
    qualified: candidates.filter((item) => item.score.tier === "qualified" || item.score.tier === "high_priority").length,
    review: candidates.filter((item) => item.score.tier === "review").length,
    rejected: candidates.filter((item) => item.score.tier === "reject").length,
    errors,
    build: candidates.filter((item) => item.commercial.recommendation === "BUILD").length,
    reviewCommercial: candidates.filter((item) => item.commercial.recommendation === "REVIEW").length,
    skip: candidates.filter((item) => item.commercial.recommendation === "SKIP").length,
    ceilingReached,
    notInspectedDueToCeiling,
    candidates,
  };
}

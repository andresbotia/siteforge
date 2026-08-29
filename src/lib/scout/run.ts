import { getScoutCategory } from "./categories";
import type { BusinessDiscoveryProvider } from "./discovery";
import { decidePersistence } from "./dedupe";
import { inspectWebsite, type ScoutHttpClient } from "./inspector";
import { SCOUT_DEFAULT_CANDIDATES, SCOUT_MAX_CANDIDATES } from "./limits";
import { normalizeBusinessName, normalizeDomain, normalizePhone, parseLocation } from "./normalize";
import { assertNoScoutSideEffects, denyDirectPaidAi, scoutPaidAiPath } from "./policy";
import { scoreCandidate } from "./scoring";
import type { DnsLookup } from "./ssrf";
import type {
  ExistingLeadRecord,
  NormalizedBusiness,
  ScoutCandidateResult,
  ScoutRunConfig,
} from "./types";

export type ScoutPipelineInput = ScoutRunConfig & {
  existingLeads: ExistingLeadRecord[];
};

export type ScoutPipelineResult = {
  config: ScoutRunConfig;
  locationLabel: string;
  categoryLabel: string;
  discoveryCostUsd: number;
  paidAi: "not_required" | "milestone_3_approval";
  discovered: number;
  inspected: number;
  qualified: number;
  review: number;
  rejected: number;
  errors: number;
  candidates: ScoutCandidateResult[];
};

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
  const discovered = await deps.discovery.search({
    location: input.location,
    categoryId: input.categoryId,
    limit,
  });

  const candidates: ScoutCandidateResult[] = [];
  const existing = [...input.existingLeads];
  let inspected = 0;
  let errors = 0;

  for (const raw of discovered) {
    const business: NormalizedBusiness = {
      ...raw,
      industry: category.industry,
      categoryId: input.categoryId,
      normalizedName: normalizeBusinessName(raw.name),
      normalizedDomain: normalizeDomain(raw.websiteUrl),
      normalizedPhone: normalizePhone(raw.phone),
    };
    try {
      const inspection = await inspectWebsite(business.websiteUrl, deps.http, deps.lookup);
      inspected += 1;
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
      candidates.push({ business, inspection, score, persist });
    } catch {
      errors += 1;
      const inspection = {
        reachable: false,
        finalUrl: null,
        blockedReason: null,
        error: "inspect_failed",
        homepage: null,
        linkChecks: [],
        pagesFetched: 0,
      };
      const score = scoreCandidate(business, inspection);
      candidates.push({
        business,
        inspection,
        score,
        persist: decidePersistence(business, existing),
      });
    }
  }

  return {
    config: { location: input.location, categoryId: input.categoryId, limit },
    locationLabel: location.label,
    categoryLabel: category.label,
    discoveryCostUsd: deps.discovery.cost.usd,
    paidAi: scoutPaidAiPath(),
    discovered: discovered.length,
    inspected,
    qualified: candidates.filter((item) => item.score.tier === "qualified" || item.score.tier === "high_priority").length,
    review: candidates.filter((item) => item.score.tier === "review").length,
    rejected: candidates.filter((item) => item.score.tier === "reject").length,
    errors,
    candidates,
  };
}

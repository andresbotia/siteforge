import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { createLiveHttpClient } from "@/lib/scout/inspector";
import { createOverpassDiscoveryProvider } from "@/lib/scout/providers/overpass";
import { SCOUT_DEFAULT_CANDIDATES, SCOUT_MAX_CANDIDATES, SCOUT_REAL_PROVIDER_ID } from "@/lib/scout/limits";
import { buildExistingLeadScoutPatch } from "@/lib/scout/status";
import { getScoutCategory, type ScoutCategoryId } from "@/lib/scout/categories";
import { runScoutPipeline, type EnrichedScoutCandidateResult, type ScoutPipelineResult } from "@/lib/scout/run";
import { leadStatusForTier } from "@/lib/scout/scoring";
import { websiteStatusLabel } from "@/lib/scout/website-status";
import { mutateTable, readTable } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { AgentRow, AgentRunRow, LeadRow } from "@/types/database";
import type { ExistingLeadRecord } from "@/lib/scout/types";

const SCOUT_AGENT_SLUG = "scout";

function inspectionSummary(candidate: EnrichedScoutCandidateResult): Json {
  const page = candidate.inspection.homepage;
  return {
    reachable: candidate.inspection.reachable,
    final_url: candidate.inspection.finalUrl,
    error: candidate.inspection.error,
    https: page?.https ?? null,
    title: page?.title ?? null,
    has_viewport: page?.hasViewport ?? null,
    has_cta: page?.hasContactCta ?? null,
    menu_link: page?.menuLink ?? null,
    reservation_link: page?.reservationLink ?? null,
    order_link: page?.orderLink ?? null,
    broken_links: candidate.inspection.linkChecks
      .filter((item) => !item.ok)
      .map((item) => ({ kind: item.kind, url: item.url, status: item.status })),
    website_status: candidate.websiteStatus,
    website_status_label: websiteStatusLabel(candidate.websiteStatus),
    source_url: candidate.business.sourceUrl ?? null,
    sources: candidate.business.sources ?? [],
    contactability: {
      score: candidate.contactability.score,
      verified: candidate.contactability.verified,
      channels: candidate.contactability.channels,
    },
    commercial_potential: {
      score: candidate.commercial.commercialPotentialScore,
      recommendation: candidate.commercial.recommendation,
      components: candidate.commercial.components,
      designer_coverage_level: candidate.commercial.designerCoverageLevel,
      facts_completeness_count: candidate.commercial.factsCompletenessCount,
      reasons: candidate.commercial.reasons,
    },
  };
}

function asExisting(row: LeadRow): ExistingLeadRecord {
  return {
    id: row.id,
    businessName: row.business_name,
    websiteUrl: row.website_url,
    phone: row.phone,
    city: row.city,
    status: row.status,
    notes: row.notes,
    normalizedDomain: row.normalized_domain,
    normalizedPhone: row.normalized_phone,
  };
}

export async function listScoutRuns(): Promise<AgentRunRow[]> {
  const agent = await readTable<Pick<AgentRow, "id"> | null>((client) =>
    client.from("agents").select("id").eq("slug", SCOUT_AGENT_SLUG).maybeSingle(),
  );
  if (!agent) return [];
  const rows = await readTable<AgentRunRow[]>((client) =>
    client
      .from("agent_runs")
      .select("*")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(20),
  );
  return rows ?? [];
}

export async function getScoutRun(id: string): Promise<AgentRunRow | null> {
  return readTable<AgentRunRow | null>((client) =>
    client.from("agent_runs").select("*").eq("id", id).maybeSingle(),
  );
}

export async function startScoutRun(input: {
  location: string;
  categoryId: string;
  limit: number;
}): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  const category = getScoutCategory(input.categoryId);
  if (!category) return { ok: false, error: "Unknown category." };
  const limit = Math.max(1, Math.min(SCOUT_MAX_CANDIDATES, Math.trunc(input.limit) || SCOUT_DEFAULT_CANDIDATES));
  const location = input.location.trim();
  if (!location) return { ok: false, error: "Location is required." };

  const agent = await readTable<Pick<AgentRow, "id"> | null>((client) =>
    client.from("agents").select("id").eq("slug", SCOUT_AGENT_SLUG).maybeSingle(),
  );
  if (!agent) return { ok: false, error: "Scout agent record was not found." };

  const run = await mutateTable<AgentRunRow | null>((client) =>
    client
      .from("agent_runs")
      .insert({
        agent_id: agent.id,
        status: "running",
        trigger_type: "manual",
        provider: SCOUT_REAL_PROVIDER_ID,
        purpose: `Scout ${category.label} in ${location}`,
        input: {
          location,
          category_id: category.id,
          limit,
          discovery_cost_usd: 0,
          paid_ai: "not_required",
        },
      })
      .select("*")
      .maybeSingle(),
  );
  if (!run) return { ok: false, error: "Could not create the Scout run." };

  await mutateTable((client) =>
    client
      .from("agent_runs")
      .update({ started_at: new Date().toISOString() })
      .eq("id", run.id)
      .select("id")
      .maybeSingle(),
  );

  try {
    const leads = await readTable<LeadRow[]>((client) =>
      client
        .from("leads")
        .select("*"),
    );
    const pipeline = await runScoutPipeline(
      {
        location,
        categoryId: category.id as ScoutCategoryId,
        limit,
        existingLeads: (leads ?? []).map(asExisting),
      },
      {
        discovery: createOverpassDiscoveryProvider(),
        http: createLiveHttpClient(),
      },
    );

    await recordToolCall(run.id, "discover", "search", {
      location,
      category: category.id,
      limit,
    }, {
      provider: SCOUT_REAL_PROVIDER_ID,
      count: pipeline.discovered,
      cost_usd: 0,
      diagnostic: pipeline.discoveryDiagnostic,
    });

    const persisted: EnrichedScoutCandidateResult[] = [];
    for (const candidate of pipeline.candidates) {
      const leadId = await persistCandidate(candidate, run.id);
      persisted.push({ ...candidate, leadId });
    }

    await recordToolCall(run.id, "inspect", "bounded_fetch", {
      pages_cap: 3,
      concurrency: 4,
    }, {
      inspected: pipeline.inspected,
      ceiling_reached: pipeline.ceilingReached,
      not_inspected_due_to_ceiling: pipeline.notInspectedDueToCeiling,
    });
    await recordToolCall(run.id, "qualify", "deterministic_score", {
      paid_ai: "not_required",
    }, {
      qualified: pipeline.qualified,
      review: pipeline.review,
      rejected: pipeline.rejected,
    });
    await recordToolCall(run.id, "commercial_rank", "deterministic_score", {
      paid_ai: "not_required",
    }, {
      build: pipeline.build,
      review: pipeline.reviewCommercial,
      skip: pipeline.skip,
    });

    const output = {
      discovered: pipeline.discovered,
      inspected: pipeline.inspected,
      qualified: pipeline.qualified,
      review: pipeline.review,
      rejected: pipeline.rejected,
      errors: pipeline.errors,
      build: pipeline.build,
      review_commercial: pipeline.reviewCommercial,
      skip: pipeline.skip,
      discovery_cost_usd: 0,
      discovery_provider: pipeline.discoveryProviderId,
      discovery_diagnostic: pipeline.discoveryDiagnostic,
      ceiling_reached: pipeline.ceilingReached,
      not_inspected_due_to_ceiling: pipeline.notInspectedDueToCeiling,
      paid_ai: "not_required",
      candidates: persisted
        .slice()
        .sort((a, b) => b.commercial.commercialPotentialScore - a.commercial.commercialPotentialScore)
        .map((item) => ({
          lead_id: item.leadId ?? null,
          name: item.business.name,
          category: item.business.industry,
          city: item.business.city,
          rating: item.business.rating,
          reviews: item.business.reviewCount,
          website: item.business.websiteUrl,
          website_status: item.websiteStatus,
          business_strength: item.score.businessStrengthScore,
          website_opportunity: item.score.websiteOpportunityScore,
          overall: item.score.overallQualificationScore,
          tier: item.score.tier,
          commercial_score: item.commercial.commercialPotentialScore,
          recommendation: item.commercial.recommendation,
          contactability_score: item.contactability.score,
          contactability_channels: item.contactability.channels.map((channel) => channel.type),
          facts_completeness_count: item.commercial.factsCompletenessCount,
          designer_coverage: item.commercial.designerCoverageLevel,
          persist: item.persist.action,
          reasons: item.score.reasons.slice(0, 8),
          commercial_reasons: item.commercial.reasons.slice(0, 8),
        })),
    };

    await mutateTable((client) =>
      client
        .from("agent_runs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          output,
        })
        .eq("id", run.id)
        .select("id")
        .maybeSingle(),
    );

    await recordActivityEvent({
      eventType: "scout_run_completed",
      title: "Scout run completed",
      description: `${category.label} in ${location}: ${pipeline.discovered} discovered`,
      actorType: "admin",
      metadata: { run_id: run.id, discovered: String(pipeline.discovered) },
    });

    return { ok: true, runId: run.id };
  } catch (error) {
    await mutateTable((client) =>
      client
        .from("agent_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          failure_reason: error instanceof Error ? error.message : "scout_failed",
        })
        .eq("id", run.id)
        .select("id")
        .maybeSingle(),
    );
    return { ok: false, error: "Scout run failed." };
  }
}

async function persistCandidate(
  candidate: EnrichedScoutCandidateResult,
  runId: string,
): Promise<string | undefined> {
  const nextStatus = leadStatusForTier(candidate.score.tier);
  const summary = inspectionSummary(candidate);
  const reasons = candidate.score.reasons;

  if (candidate.persist.action === "insert") {
    const row = await mutateTable<LeadRow | null>((client) =>
      client
        .from("leads")
        .insert({
          business_name: candidate.business.name,
          industry: candidate.business.industry,
          address: candidate.business.address ?? null,
          city: candidate.business.city,
          state: candidate.business.state,
          phone: candidate.business.phone ?? null,
          email: candidate.business.email ?? null,
          website_url: candidate.business.websiteUrl ?? null,
          google_rating: candidate.business.rating ?? null,
          review_count: candidate.business.reviewCount ?? 0,
          status: nextStatus,
          lead_score: candidate.score.overallQualificationScore,
          source: "scout",
          normalized_domain: candidate.business.normalizedDomain,
          normalized_phone: candidate.business.normalizedPhone,
          qualification_tier: candidate.score.tier,
          business_strength_score: candidate.score.businessStrengthScore,
          website_opportunity_score: candidate.score.websiteOpportunityScore,
          overall_qualification_score: candidate.score.overallQualificationScore,
          qualification_reasons: reasons,
          inspection_summary: summary,
          discovered_at: new Date().toISOString(),
          last_scout_run_id: runId,
        })
        .select("*")
        .maybeSingle(),
    );
    return row?.id;
  }

  if (candidate.persist.action === "update" && candidate.persist.existingId) {
    const existing = await readTable<LeadRow | null>((client) =>
      client.from("leads").select("*").eq("id", candidate.persist.existingId!).maybeSingle(),
    );
    if (!existing) return candidate.persist.existingId;
    const update = buildExistingLeadScoutPatch({
      currentStatus: existing.status,
      currentSource: existing.source,
      currentPhone: existing.phone,
      currentWebsite: existing.website_url,
      currentRating: existing.google_rating,
      currentReviewCount: existing.review_count,
      proposedStatus: nextStatus,
      proposedPhone: candidate.business.phone ?? null,
      proposedWebsite: candidate.business.websiteUrl ?? null,
      proposedRating: candidate.business.rating ?? null,
      proposedReviewCount: candidate.business.reviewCount ?? null,
      normalizedDomain: candidate.business.normalizedDomain,
      normalizedPhone: candidate.business.normalizedPhone,
      qualificationTier: candidate.score.tier,
      businessStrengthScore: candidate.score.businessStrengthScore,
      websiteOpportunityScore: candidate.score.websiteOpportunityScore,
      overallQualificationScore: candidate.score.overallQualificationScore,
      reasons,
      inspectionSummary: summary,
      runId,
    });
    const persistUpdate = {
      ...update,
      lead_score: candidate.score.overallQualificationScore,
    };
    await mutateTable((client) =>
      client
        .from("leads")
        .update(persistUpdate)
        .eq("id", existing.id)
        .select("id")
        .maybeSingle(),
    );
    return existing.id;
  }

  return candidate.persist.existingId;
}

async function recordToolCall(
  runId: string,
  tool: string,
  action: string,
  request: Json,
  response: Json,
) {
  await mutateTable((client) =>
    client
      .from("agent_tool_calls")
      .insert({
        agent_run_id: runId,
        tool_name: tool,
        action,
        request,
        response,
        status: "completed",
        provider: SCOUT_REAL_PROVIDER_ID,
        estimated_cost_usd: 0,
        actual_cost_usd: 0,
        requires_approval: false,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle(),
  );
}

export type { ScoutPipelineResult };

import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { listLeads } from "@/data/leads";
import { getLatestAuditForLead } from "@/data/leads";
import { isLeadEligibleForBuild, buildPriorityRank } from "@/lib/builder/eligibility";
import {
  BUILDER_COST_USD,
  BUILDER_PROVIDER_ID,
  BUILDER_VERSION,
} from "@/lib/builder/limits";
import { buildBuilderToolCalls, buildGeneratedWebsiteInsert } from "@/lib/builder/persist";
import { runBuilderPipeline } from "@/lib/builder/run";
import { selectTemplate, templateLabel } from "@/lib/builder/templates";
import { needsNewMasterTemplate } from "@/lib/builder/registry";
import { mutateTable, readTable } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { AgentRow, AgentRunRow, LeadRow, WebsiteRow } from "@/types/database";
import type { Lead, WebsiteAudit } from "@/types";
import { asRecord } from "@/lib/json";
import { isNoStandaloneWebsiteLead } from "@/lib/prospects/no-website";
import { randomUUID } from "node:crypto";

const BUILDER_AGENT_SLUG = "builder";

export async function listBuilderRuns(): Promise<AgentRunRow[]> {
  const agent = await readTable<Pick<AgentRow, "id"> | null>((client) =>
    client.from("agents").select("id").eq("slug", BUILDER_AGENT_SLUG).maybeSingle(),
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

export type BuilderCandidate = Lead & {
  latestOverall: number | null;
  latestOpportunity: number | null;
  recommendedTemplate: string;
  recommendedTemplateKey: ReturnType<typeof selectTemplate>;
  latestWebsiteId: string | null;
  /**
   * True when the template registry has no purpose-built master for this
   * lead's industry (src/lib/builder/registry.ts:needsNewMasterTemplate).
   * Builder still drafts a fallback so operators are never blocked, but this
   * signal routes the lead toward a Designer Job instead of silently
   * shipping a generic draft as if it were premium coverage.
   */
  coverageMissing: boolean;
};

export async function listEligibleLeadsForBuild(): Promise<BuilderCandidate[]> {
  const leads = await listLeads();
  const eligible = leads.filter((lead) => isLeadEligibleForBuild(lead));
  const websites = await readTable<Pick<WebsiteRow, "id" | "lead_id" | "created_at">[]>(
    (client) =>
      client
        .from("generated_websites")
        .select("id, lead_id, created_at")
        .order("created_at", { ascending: false }),
  );
  const latestSite = new Map<string, string>();
  for (const site of websites ?? []) {
    if (!latestSite.has(site.lead_id)) latestSite.set(site.lead_id, site.id);
  }

  const withMeta: BuilderCandidate[] = [];
  for (const lead of eligible) {
    const audit = await getLatestAuditForLead(lead.id);
    const key = selectTemplate(lead.industry);
    withMeta.push({
      ...lead,
      latestOverall: audit?.overallScore ?? null,
      latestOpportunity:
        audit?.redesignOpportunityScore ??
        (isNoStandaloneWebsiteLead(lead) ? lead.websiteOpportunityScore : null),
      recommendedTemplate: templateLabel(key),
      recommendedTemplateKey: key,
      latestWebsiteId: latestSite.get(lead.id) ?? null,
      coverageMissing: needsNewMasterTemplate(lead.industry),
    });
  }
  return withMeta.sort((a, b) => {
    const rank = buildPriorityRank(a) - buildPriorityRank(b);
    if (rank !== 0) return rank;
    return (b.latestOpportunity ?? 0) - (a.latestOpportunity ?? 0);
  });
}

export async function startBuilderRun(input: {
  leadId: string;
}): Promise<{ ok: true; runId: string; websiteId: string } | { ok: false; error: string }> {
  const leadId = input.leadId.trim();
  if (!leadId) return { ok: false, error: "A lead is required." };

  const lead = await readTable<LeadRow | null>((client) =>
    client.from("leads").select("*").eq("id", leadId).maybeSingle(),
  );
  if (!lead) return { ok: false, error: "Lead was not found." };
  if (!isLeadEligibleForBuild(lead)) {
    return { ok: false, error: "This lead is not eligible for a Builder draft. Audit it first." };
  }

  const agent = await readTable<Pick<AgentRow, "id"> | null>((client) =>
    client.from("agents").select("id").eq("slug", BUILDER_AGENT_SLUG).maybeSingle(),
  );
  if (!agent) return { ok: false, error: "Builder agent record was not found." };

  const audit = await getLatestAuditForLead(lead.id);
  const noStandaloneWebsite = isNoStandaloneWebsiteLead(lead);
  if (!audit && !noStandaloneWebsite) {
    return { ok: false, error: "This lead is not eligible for a Builder draft. Audit it first." };
  }

  const run = await mutateTable<AgentRunRow | null>((client) =>
    client
      .from("agent_runs")
      .insert({
        agent_id: agent.id,
        lead_id: lead.id,
        status: "running",
        trigger_type: "manual",
        provider: BUILDER_PROVIDER_ID,
        purpose: `Build website draft for ${lead.business_name}`,
        estimated_cost_usd: BUILDER_COST_USD,
        input: {
          lead_id: lead.id,
          audit_id: audit?.id ?? null,
          no_standalone_website: noStandaloneWebsite,
          build_cost_usd: BUILDER_COST_USD,
          paid_ai: "not_required",
          version: BUILDER_VERSION,
        },
      })
      .select("*")
      .maybeSingle(),
  );
  if (!run) return { ok: false, error: "Could not create the Builder run." };

  await mutateTable((client) =>
    client
      .from("agent_runs")
      .update({ started_at: new Date().toISOString() })
      .eq("id", run.id)
      .select("id")
      .maybeSingle(),
  );

  try {
    const pipeline = runBuilderPipeline(
      {
        id: lead.id,
        businessName: lead.business_name,
        industry: lead.industry,
        city: lead.city,
        state: lead.state,
        address: lead.address,
        phone: lead.phone,
        email: lead.email,
        websiteUrl: lead.website_url,
        rating: lead.google_rating === null ? null : Number(lead.google_rating),
        reviewCount: lead.review_count,
        status: lead.status,
        inspectionSummary: Object.keys(asRecord(lead.inspection_summary)).length
          ? asRecord(lead.inspection_summary)
          : null,
      },
      toBuilderAudit(audit),
    );

    for (const call of buildBuilderToolCalls(pipeline)) {
      await recordToolCall(run.id, call.tool, call.action, call.request, call.response);
    }

    const websiteId = randomUUID();
    const insert = buildGeneratedWebsiteInsert({
      result: pipeline,
      websiteId,
      auditId: audit?.id ?? null,
      runId: run.id,
      beforeScore: audit?.overallScore ?? null,
    });

    const site = await mutateTable<WebsiteRow | null>((client) =>
      client.from("generated_websites").insert(insert).select("*").maybeSingle(),
    );
    if (!site) throw new Error("website_persist_failed");

    if (pipeline.nextStatus !== lead.status) {
      await mutateTable((client) =>
        client
          .from("leads")
          .update({ status: pipeline.nextStatus })
          .eq("id", lead.id)
          .select("id")
          .maybeSingle(),
      );
    }

    await mutateTable((client) =>
      client
        .from("agent_runs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          output: {
            summary: pipeline.summary,
            website_id: site.id,
            lead_id: lead.id,
            template: pipeline.template,
            paid_ai: "not_required",
            cost_usd: 0,
            version: pipeline.version,
            next_status: pipeline.nextStatus,
          },
        })
        .eq("id", run.id)
        .select("id")
        .maybeSingle(),
    );

    await recordActivityEvent({
      eventType: "builder_run_completed",
      title: "Website draft built",
      description: `${lead.business_name}: ${pipeline.templateLabel}`,
      actorType: "admin",
      leadId: lead.id,
      metadata: { run_id: run.id, website_id: site.id },
    });

    return { ok: true, runId: run.id, websiteId: site.id };
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "builder_failed";
    await mutateTable((client) =>
      client
        .from("agent_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          failure_reason: failureReason,
        })
        .eq("id", run.id)
        .select("id")
        .maybeSingle(),
    );
    return { ok: false, error: safeBuilderFailureMessage(failureReason) };
  }
}

function safeBuilderFailureMessage(reason: string): string {
  if (reason === "unsafe_hero" || reason === "unsafe_copy") {
    return "Builder validation failed. Shorten or simplify the verified public summary, then try again.";
  }
  if (reason === "unsafe_hours") {
    return "Builder validation failed. Shorten or simplify the verified public hours, then try again.";
  }
  if (reason.startsWith("unsafe_") || reason.startsWith("invalid_")) {
    return `Builder validation failed: ${reason}.`;
  }
  return "Builder run failed.";
}

function toBuilderAudit(audit: WebsiteAudit | null) {
  if (!audit) {
    return {
      id: null,
      overallScore: null,
      redesignOpportunityScore: null,
      findings: [],
      opportunityType: "new_website" as const,
    };
  }
  return {
    id: audit.id,
    overallScore: audit.overallScore,
    redesignOpportunityScore: audit.redesignOpportunityScore,
    findings: audit.findings.map((item) => ({
      code: item.code,
      title: item.title,
    })),
    opportunityType: "redesign" as const,
  };
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
        provider: BUILDER_PROVIDER_ID,
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

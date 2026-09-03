import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { listLeads } from "@/data/leads";
import { createAuditorHttpClient } from "@/lib/auditor/fixtures";
import { isLeadEligibleForAudit, auditPriorityRank } from "@/lib/auditor/eligibility";
import {
  AUDITOR_COST_USD,
  AUDITOR_PROVIDER_ID,
  AUDITOR_VERSION,
} from "@/lib/auditor/limits";
import { buildAuditorToolCalls, buildWebsiteAuditInsert } from "@/lib/auditor/persist";
import { runAuditorPipeline } from "@/lib/auditor/run";
import { syncWorkItemsForLead } from "@/data/work-items";
import { mutateTable, readTable } from "@/lib/supabase/server";
import { asRecord } from "@/lib/json";
import type { Json } from "@/types/database";
import type { AgentRow, AgentRunRow, AuditRow, LeadRow } from "@/types/database";
import type { Lead } from "@/types";

const AUDITOR_AGENT_SLUG = "auditor";

export async function listAuditorRuns(): Promise<AgentRunRow[]> {
  const agent = await readTable<Pick<AgentRow, "id"> | null>((client) =>
    client.from("agents").select("id").eq("slug", AUDITOR_AGENT_SLUG).maybeSingle(),
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

export async function listEligibleLeadsForAudit(): Promise<Lead[]> {
  const leads = await listLeads();
  return leads
    .filter((lead) => isLeadEligibleForAudit(lead))
    .sort((a, b) => {
      const rank = auditPriorityRank(a) - auditPriorityRank(b);
      if (rank !== 0) return rank;
      return b.leadScore - a.leadScore;
    });
}

export async function startAuditorRun(input: {
  leadId: string;
}): Promise<{ ok: true; runId: string; auditId: string } | { ok: false; error: string }> {
  const leadId = input.leadId.trim();
  if (!leadId) return { ok: false, error: "A lead is required." };

  const lead = await readTable<LeadRow | null>((client) =>
    client.from("leads").select("*").eq("id", leadId).maybeSingle(),
  );
  if (!lead) return { ok: false, error: "Lead was not found." };
  if (!isLeadEligibleForAudit(lead)) {
    return { ok: false, error: "This lead is not eligible for an Auditor run." };
  }

  const agent = await readTable<Pick<AgentRow, "id"> | null>((client) =>
    client.from("agents").select("id").eq("slug", AUDITOR_AGENT_SLUG).maybeSingle(),
  );
  if (!agent) return { ok: false, error: "Auditor agent record was not found." };

  const run = await mutateTable<AgentRunRow | null>((client) =>
    client
      .from("agent_runs")
      .insert({
        agent_id: agent.id,
        lead_id: lead.id,
        status: "running",
        trigger_type: "manual",
        provider: AUDITOR_PROVIDER_ID,
        purpose: `Audit ${lead.business_name}`,
        estimated_cost_usd: AUDITOR_COST_USD,
        input: {
          lead_id: lead.id,
          website_url: lead.website_url,
          audit_cost_usd: AUDITOR_COST_USD,
          paid_ai: "not_required",
          version: AUDITOR_VERSION,
        },
      })
      .select("*")
      .maybeSingle(),
  );
  if (!run) return { ok: false, error: "Could not create the Auditor run." };

  await mutateTable((client) =>
    client
      .from("agent_runs")
      .update({ started_at: new Date().toISOString() })
      .eq("id", run.id)
      .select("id")
      .maybeSingle(),
  );

  try {
    const pipeline = await runAuditorPipeline(
      {
        id: lead.id,
        businessName: lead.business_name,
        industry: lead.industry,
        city: lead.city,
        phone: lead.phone,
        websiteUrl: lead.website_url,
        status: lead.status,
        inspectionSummary: Object.keys(asRecord(lead.inspection_summary)).length
          ? asRecord(lead.inspection_summary)
          : null,
      },
      { http: createAuditorHttpClient() },
    );

    for (const call of buildAuditorToolCalls(pipeline)) {
      await recordToolCall(run.id, call.tool, call.action, call.request, call.response);
    }

    const insert = buildWebsiteAuditInsert(pipeline, run.id, lead.website_url);
    const audit = await mutateTable<AuditRow | null>((client) =>
      client
        .from("website_audits")
        .insert({
          lead_id: insert.lead_id,
          website_url: insert.website_url,
          overall_score: insert.overall_score,
          technical_score: insert.technical_score,
          seo_score: insert.seo_score,
          ux_score: insert.ux_score,
          content_score: insert.content_score,
          redesign_opportunity_score: insert.redesign_opportunity_score,
          design_score: insert.design_score,
          mobile_score: insert.mobile_score,
          performance_score: insert.performance_score,
          conversion_score: insert.conversion_score,
          issues: insert.issues,
          recommendations: insert.recommendations,
          summary: insert.summary,
          findings: insert.findings,
          inspected_urls: insert.inspected_urls,
          audit_version: insert.audit_version,
          source_run_id: insert.source_run_id,
          pages_inspected: insert.pages_inspected,
        })
        .select("*")
        .maybeSingle(),
    );
    if (!audit) throw new Error("audit_persist_failed");

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

    const output = {
      summary: pipeline.summary,
      audit_id: audit.id,
      lead_id: lead.id,
      pages_inspected: pipeline.crawl.pagesFetched,
      findings_count: pipeline.findings.length,
      technical_score: pipeline.scores.technicalScore,
      seo_score: pipeline.scores.seoScore,
      ux_score: pipeline.scores.uxScore,
      content_score: pipeline.scores.contentScore,
      overall_audit_score: pipeline.scores.overallAuditScore,
      redesign_opportunity_score: pipeline.scores.redesignOpportunityScore,
      redesign_opportunity_breakdown: pipeline.scores.redesignOpportunityBreakdown,
      next_status: pipeline.nextStatus,
      paid_ai: "not_required",
      cost_usd: 0,
      version: pipeline.version,
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
      eventType: "auditor_run_completed",
      title: "Website audit completed",
      description: `${lead.business_name}: website health ${pipeline.scores.overallAuditScore}, opportunity ${pipeline.scores.redesignOpportunityScore}`,
      actorType: "admin",
      leadId: lead.id,
      metadata: {
        run_id: run.id,
        audit_id: audit.id,
        website_health: String(pipeline.scores.overallAuditScore),
      },
    });

    // M10: a completed audit creates a review_site work item.
    await syncWorkItemsForLead(lead.id).catch(() => {});

    return { ok: true, runId: run.id, auditId: audit.id };
  } catch (error) {
    await mutateTable((client) =>
      client
        .from("agent_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          failure_reason: error instanceof Error ? error.message : "auditor_failed",
        })
        .eq("id", run.id)
        .select("id")
        .maybeSingle(),
    );
    return { ok: false, error: "Auditor run failed." };
  }
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
        provider: AUDITOR_PROVIDER_ID,
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

import "server-only";

import { randomUUID } from "node:crypto";
import { recordActivityEvent } from "@/data/activity";
import { getLatestAuditForLead, listLeads } from "@/data/leads";
import { asRecord } from "@/lib/json";
import { isNoStandaloneWebsiteLead } from "@/lib/prospects/no-website";
import { getAuthConfig } from "@/lib/auth/config";
import { createOutreachAttributionToken } from "@/lib/sales/attribution";
import {
  SALES_COST_USD,
  SALES_PROVIDER_ID,
  SALES_VERSION,
} from "@/lib/sales/limits";
import {
  canAddToM95DFirstCampaign,
  M95D_FIRST_CAMPAIGN_ID,
} from "@/lib/sales/campaign";
import { buildOutreachInsert, buildSalesToolCalls } from "@/lib/sales/persist";
import { runSalesPipeline } from "@/lib/sales/run";
import { mutateTable, readTable } from "@/lib/supabase/server";
import type { Lead, WebsiteAudit } from "@/types";
import type {
  AgentRow,
  AgentRunRow,
  Json,
  LeadRow,
  OutreachRow,
  PreviewDeploymentRow,
  WebsiteRow,
} from "@/types/database";

const SALES_AGENT_SLUG = "sales";

export type SalesCandidate = Lead & {
  latestWebsiteId: string | null;
  activePreviewId: string | null;
  previewTokenHint: string | null;
  latestOutreachId: string | null;
  outreachStatus: string | null;
};

export async function listSalesRuns(): Promise<AgentRunRow[]> {
  const agent = await readTable<Pick<AgentRow, "id"> | null>((client) =>
    client.from("agents").select("id").eq("slug", SALES_AGENT_SLUG).maybeSingle(),
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

export async function listEligibleLeadsForSales(): Promise<SalesCandidate[]> {
  const [leads, websites, previews, outreachList] = await Promise.all([
    listLeads(),
    readTable<Pick<WebsiteRow, "id" | "lead_id" | "created_at">[]>((client) =>
      client
        .from("generated_websites")
        .select("id, lead_id, created_at")
        .order("created_at", { ascending: false }),
    ),
    readTable<
      Pick<
        PreviewDeploymentRow,
        "id" | "lead_id" | "generated_website_id" | "status" | "token_hint" | "revoked_at" | "created_at"
      >[]
    >((client) =>
      client
        .from("preview_deployments")
        .select("id, lead_id, generated_website_id, status, token_hint, revoked_at, created_at")
        .eq("status", "active")
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
    ),
    readTable<Pick<OutreachRow, "id" | "lead_id" | "status" | "created_at">[]>((client) =>
      client
        .from("outreach")
        .select("id, lead_id, status, created_at")
        .order("created_at", { ascending: false }),
    ),
  ]);

  const latestSite = new Map<string, string>();
  for (const site of websites ?? []) {
    if (!latestSite.has(site.lead_id)) latestSite.set(site.lead_id, site.id);
  }

  const activePreview = new Map<string, { id: string; hint: string }>();
  for (const prev of previews ?? []) {
    if (!activePreview.has(prev.lead_id)) {
      activePreview.set(prev.lead_id, { id: prev.id, hint: prev.token_hint });
    }
  }

  const latestOutreach = new Map<string, { id: string; status: string }>();
  for (const item of outreachList ?? []) {
    if (!latestOutreach.has(item.lead_id)) {
      latestOutreach.set(item.lead_id, { id: item.id, status: item.status });
    }
  }

  const results: SalesCandidate[] = [];
  for (const lead of leads) {
    const siteId = latestSite.get(lead.id);
    const prev = activePreview.get(lead.id);
    if (siteId && prev && lead.status !== "rejected") {
      const out = latestOutreach.get(lead.id);
      results.push({
        ...lead,
        latestWebsiteId: siteId,
        activePreviewId: prev.id,
        previewTokenHint: prev.hint,
        latestOutreachId: out?.id ?? null,
        outreachStatus: out?.status ?? null,
      });
    }
  }

  return results;
}

export async function startSalesDraftRun(input: {
  leadId: string;
  recipientEmailOverride?: string;
  senderName?: string;
  senderEmail?: string;
}): Promise<{ ok: true; runId: string; outreachId: string } | { ok: false; error: string }> {
  const leadId = input.leadId.trim();
  if (!leadId) return { ok: false, error: "A lead is required." };

  const [lead, agent, websiteRows, previewRows] = await Promise.all([
    readTable<LeadRow | null>((client) =>
      client.from("leads").select("*").eq("id", leadId).maybeSingle(),
    ),
    readTable<Pick<AgentRow, "id"> | null>((client) =>
      client.from("agents").select("id").eq("slug", SALES_AGENT_SLUG).maybeSingle(),
    ),
    readTable<WebsiteRow[]>((client) =>
      client
        .from("generated_websites")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1),
    ),
    readTable<PreviewDeploymentRow[]>((client) =>
      client
        .from("preview_deployments")
        .select("*")
        .eq("lead_id", leadId)
        .eq("status", "active")
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1),
    ),
  ]);

  if (!lead) return { ok: false, error: "Lead was not found." };
  if (!agent) return { ok: false, error: "Sales agent record was not found." };

  const website = websiteRows?.[0];
  const preview = previewRows?.[0];

  if (!website) {
    return { ok: false, error: "No generated website draft found for this lead. Build it first." };
  }
  if (!preview || preview.status !== "active" || preview.revoked_at) {
    return { ok: false, error: "An active approved preview deployment is required before drafting outreach." };
  }
  if (preview.expires_at && new Date(preview.expires_at) <= new Date()) {
    return { ok: false, error: "The active preview deployment is expired. Publish a fresh preview before drafting outreach." };
  }

  const campaignRows = await readTable<Pick<OutreachRow, "lead_id">[]>((client) =>
    client.from("outreach").select("lead_id").eq("campaign_id", M95D_FIRST_CAMPAIGN_ID),
  );
  const selectedLeadIds = new Set((campaignRows ?? []).map((row) => row.lead_id));
  if (!selectedLeadIds.has(lead.id) && !canAddToM95DFirstCampaign(selectedLeadIds.size)) {
    return { ok: false, error: "M9.5D first campaign is capped at 5 manually selected prospects." };
  }

  const audit = await getLatestAuditForLead(lead.id);
  const noStandaloneWebsite = isNoStandaloneWebsiteLead(lead);

  const run = await mutateTable<AgentRunRow | null>((client) =>
    client
      .from("agent_runs")
      .insert({
        agent_id: agent.id,
        lead_id: lead.id,
        status: "running",
        trigger_type: "manual",
        provider: SALES_PROVIDER_ID,
        purpose: `Draft personalized outreach for ${lead.business_name}`,
        estimated_cost_usd: SALES_COST_USD,
        input: {
          lead_id: lead.id,
          website_id: website.id,
          preview_deployment_id: preview.id,
          audit_id: audit?.id ?? null,
          paid_ai: "not_required",
          version: SALES_VERSION,
        },
      })
      .select("*")
      .maybeSingle(),
  );

  if (!run) return { ok: false, error: "Could not create the Sales run." };

  await mutateTable((client) =>
    client
      .from("agent_runs")
      .update({ started_at: new Date().toISOString() })
      .eq("id", run.id)
      .select("id")
      .maybeSingle(),
  );

  try {
    const fixes = Array.isArray(website.audit_fixes) ? website.audit_fixes : [];
    const outreachId = randomUUID();
    const tokenCreatedAt = new Date().toISOString();
    const authConfig = getAuthConfig();
    if (!authConfig) throw new Error("auth_not_configured");
    const attributionToken = createOutreachAttributionToken({
      outreachId,
      createdAt: tokenCreatedAt,
      secret: authConfig.authSecret,
    });

    const pipeline = runSalesPipeline(
      {
        id: lead.id,
        businessName: lead.business_name,
        industry: lead.industry,
        city: lead.city ?? "",
        state: lead.state ?? undefined,
        email: lead.email,
        phone: lead.phone,
        websiteUrl: lead.website_url,
        websiteStatus: noStandaloneWebsite ? "no_standalone_website" : lead.website_url ? "has_website" : "unknown",
        status: lead.status as Lead["status"],
      },
      toSalesAudit(audit, noStandaloneWebsite),
      {
        id: website.id,
        template: website.template ?? "",
        templateKey: website.template_key,
        auditFixes: fixes.flatMap((item) => {
          const rowFix = asRecord(item);
          const findingCode = rowFix.findingCode ?? rowFix.finding_code;
          if (typeof findingCode !== "string") return [];
          return [
            {
              findingCode,
              addressed: rowFix.addressed === true,
              builderAction: String(rowFix.builderAction ?? rowFix.builder_action ?? ""),
            },
          ];
        }),
      },
      {
        id: preview.id,
        tokenHint: preview.token_hint,
        status: preview.status,
        revokedAt: preview.revoked_at,
        outreachPublicUrl: `/o/${attributionToken.token}`,
        attributionTokenHash: attributionToken.hash,
        attributionTokenHint: attributionToken.hint,
      },
      {
        senderName: input.senderName,
        senderEmail: input.senderEmail,
        recipientEmailOverride: input.recipientEmailOverride,
      },
    );

    for (const call of buildSalesToolCalls(pipeline)) {
      await recordToolCall(run.id, call.tool, call.action, call.request, call.response);
    }

    const insert = buildOutreachInsert({
      result: pipeline,
      outreachId,
      runId: run.id,
    });
    insert.attribution_token_created_at = tokenCreatedAt;

    const outreach = await mutateTable<OutreachRow | null>((client) =>
      client.from("outreach").insert(insert).select("*").maybeSingle(),
    );
    if (!outreach) throw new Error("outreach_persist_failed");

    // Insert outreach event: draft_created
    await mutateTable((client) =>
      client.from("outreach_events").insert({
        outreach_id: outreach.id,
        event_type: "draft_created",
        payload: {
          sender: pipeline.draft.senderEmail,
          has_recipient: Boolean(pipeline.draft.recipientEmail),
          evidence_count: pipeline.draft.evidence.length,
        },
      }),
    );

    // Update preview_deployments outreach_id linkage
    await mutateTable((client) =>
      client
        .from("preview_deployments")
        .update({ outreach_id: outreach.id, campaign_id: M95D_FIRST_CAMPAIGN_ID })
        .eq("id", preview.id)
        .select("id")
        .maybeSingle(),
    );

    await mutateTable((client) =>
      client
        .from("agent_runs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          output: {
            summary: pipeline.summary,
            outreach_id: outreach.id,
            lead_id: lead.id,
            paid_ai: "not_required",
            cost_usd: 0,
            version: pipeline.version,
            recipient: pipeline.draft.recipientEmail || "none",
          },
        })
        .eq("id", run.id)
        .select("id")
        .maybeSingle(),
    );

    await recordActivityEvent({
      eventType: "sales_draft_created",
      title: "Outreach draft created",
      description: `${lead.business_name}: "${pipeline.draft.subject}"`,
      actorType: "admin",
      leadId: lead.id,
      metadata: { run_id: run.id, outreach_id: outreach.id },
    });

    return { ok: true, runId: run.id, outreachId: outreach.id };
  } catch (error) {
    await mutateTable((client) =>
      client
        .from("agent_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          failure_reason: error instanceof Error ? error.message : "sales_draft_failed",
        })
        .eq("id", run.id)
        .select("id")
        .maybeSingle(),
    );
    return { ok: false, error: "Sales draft run failed." };
  }
}

function toSalesAudit(audit: WebsiteAudit | null, noStandaloneWebsite = false) {
  if (!audit && noStandaloneWebsite) {
    return {
      id: null,
      overallScore: null,
      redesignOpportunityScore: null,
      findings: [],
      issues: [],
      opportunityType: "new_website" as const,
    };
  }
  return {
    id: audit?.id ?? null,
    overallScore: audit?.overallScore ?? null,
    redesignOpportunityScore: audit?.redesignOpportunityScore ?? null,
    findings: (audit?.findings ?? []).map((item) => ({
      code: item.code,
      title: item.title,
      category: item.category,
    })),
    issues: audit?.issues ?? [],
    opportunityType: "redesign" as const,
  };
}

async function recordToolCall(
  runId: string,
  tool: string,
  action: string,
  request: unknown,
  response: unknown,
) {
  await mutateTable((client) =>
    client
      .from("agent_tool_calls")
      .insert({
        agent_run_id: runId,
        tool_name: tool,
        action,
        request: request as Json,
        response: response as Json,
        status: "completed",
        provider: SALES_PROVIDER_ID,
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

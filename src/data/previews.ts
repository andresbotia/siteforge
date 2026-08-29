import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { getWebsiteById } from "@/data/websites";
import { createPreviewToken, hashPreviewToken, isPreviewToken } from "@/lib/previews/tokens";
import {
  classifyBot,
  classifyBrowser,
  classifyDevice,
  createVisitorKey,
  isPreviewEventType,
  sanitizePreviewPath,
  sanitizeReferrer,
  type PreviewRequestFacts,
} from "@/lib/previews/events";
import { assertPreviewPublicationAllowed } from "@/lib/previews/policy";
import { asRecord } from "@/lib/json";
import { createServerSupabaseClient, mutateTable, readTable } from "@/lib/supabase/server";
import type {
  BotClassification,
  BrowserClass,
  DeviceClass,
  GeneratedWebsite,
  PreviewAnalytics,
  PreviewDeployment,
  PreviewDeploymentStatus,
} from "@/types";
import type {
  ApprovalRow,
  PreviewDeploymentRow,
  PreviewEventRow,
  WebsiteRow,
} from "@/types/database";

const PREVIEW_APPROVAL_ACTION = "public_preview_publication";
const PREVIEW_APPROVAL_TYPE = "website_deployment";

const deploymentStatuses = new Set<PreviewDeploymentStatus>([
  "active",
  "revoked",
  "expired",
]);
const botClasses = new Set<BotClassification>(["human_likely", "bot_likely", "unknown"]);
const deviceClasses = new Set<DeviceClass>(["desktop", "mobile", "tablet", "unknown"]);
const browserClasses = new Set<BrowserClass>([
  "chrome",
  "safari",
  "firefox",
  "edge",
  "bot",
  "unknown",
]);

export type PreviewPublicationApprovalResult = {
  ok: boolean;
  error?: string;
  publicPath?: string;
};

export type PublicPreview = {
  deployment: PreviewDeployment;
  site: GeneratedWebsite;
  token: string;
};

export function isPreviewPublicationApprovalPayload(payload: unknown): boolean {
  const record = asRecord(payload);
  return record.action === PREVIEW_APPROVAL_ACTION;
}

function mapDeployment(row: PreviewDeploymentRow): PreviewDeployment {
  return {
    id: row.id,
    generatedWebsiteId: row.generated_website_id,
    leadId: row.lead_id,
    approvalId: row.approval_id,
    tokenHint: row.token_hint,
    status: deploymentStatuses.has(row.status as PreviewDeploymentStatus)
      ? (row.status as PreviewDeploymentStatus)
      : "revoked",
    sourceRunId: row.source_run_id,
    outreachId: row.outreach_id,
    campaignId: row.campaign_id,
    buildVersion: row.build_version,
    expiresAt: row.expires_at,
    approvedAt: row.approved_at,
    revokedAt: row.revoked_at,
    lastViewedAt: row.last_viewed_at,
    viewCount: row.view_count,
    createdAt: row.created_at,
  };
}

function mapWebsite(row: WebsiteRow, businessName: string): GeneratedWebsite {
  const metadata = asRecord(row.metadata);
  const spec = asRecord(row.spec);
  const fixes = Array.isArray(row.audit_fixes) ? row.audit_fixes : [];
  const provenance = Array.isArray(row.content_provenance)
    ? row.content_provenance
    : [];
  return {
    id: row.id,
    leadId: row.lead_id,
    businessName,
    status: row.status as GeneratedWebsite["status"],
    template: row.template ?? "",
    templateKey: row.template_key,
    beforeScore: typeof metadata.before_score === "number" ? metadata.before_score : 0,
    afterScore: typeof metadata.after_score === "number" ? metadata.after_score : null,
    previewUrl: row.preview_url ?? "",
    productionUrl: row.production_url,
    createdAt: row.created_at,
    spec: Object.keys(spec).length ? spec : null,
    buildVersion: row.build_version,
    sourceAuditId: row.source_audit_id,
    sourceRunId: row.source_run_id,
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
    contentProvenance: provenance.flatMap((item) => {
      const rowItem = asRecord(item);
      if (typeof rowItem.field !== "string") return [];
      return [
        {
          field: rowItem.field,
          provenance: String(rowItem.provenance ?? "derived"),
          source: typeof rowItem.source === "string" ? rowItem.source : null,
        },
      ];
    }),
  };
}

async function hasActiveDeployment(websiteId: string): Promise<boolean> {
  const row = await readTable<Pick<PreviewDeploymentRow, "id"> | null>((client) =>
    client
      .from("preview_deployments")
      .select("id")
      .eq("generated_website_id", websiteId)
      .eq("status", "active")
      .is("revoked_at", null)
      .maybeSingle(),
  );
  return Boolean(row);
}

async function getPendingPreviewApprovalId(websiteId: string): Promise<string | null> {
  const row = await readTable<Pick<ApprovalRow, "id"> | null>((client) =>
    client
      .from("approvals")
      .select("id")
      .eq("approval_type", PREVIEW_APPROVAL_TYPE)
      .eq("status", "pending")
      .contains("payload", {
        action: PREVIEW_APPROVAL_ACTION,
        generated_website_id: websiteId,
      })
      .maybeSingle(),
  );
  return row?.id ?? null;
}

export async function getPreviewAnalyticsForWebsite(
  websiteId: string,
): Promise<PreviewAnalytics> {
  const [deployments, pendingApprovalId] = await Promise.all([
    readTable<PreviewDeploymentRow[]>((client) =>
      client
        .from("preview_deployments")
        .select("*")
        .eq("generated_website_id", websiteId)
        .order("created_at", { ascending: false }),
    ),
    getPendingPreviewApprovalId(websiteId),
  ]);

  const deployment = deployments?.[0] ? mapDeployment(deployments[0]) : null;
  if (!deployment) {
    return emptyAnalytics(null, pendingApprovalId);
  }

  const events = await readTable<PreviewEventRow[]>((client) =>
    client
      .from("preview_events")
      .select("*")
      .eq("preview_deployment_id", deployment.id)
      .order("occurred_at", { ascending: false })
      .limit(250),
  );

  return aggregateAnalytics(deployment, pendingApprovalId, events ?? []);
}

function emptyAnalytics(
  deployment: PreviewDeployment | null,
  pendingApprovalId: string | null,
): PreviewAnalytics {
  return {
    deployment,
    pendingApprovalId,
    totalEvents: 0,
    humanLikelyViews: 0,
    botLikelyViews: 0,
    ctaClicks: 0,
    uniqueVisitors: 0,
    lastEventAt: null,
    recentEvents: [],
  };
}

function aggregateAnalytics(
  deployment: PreviewDeployment,
  pendingApprovalId: string | null,
  events: PreviewEventRow[],
): PreviewAnalytics {
  const visitors = new Set<string>();
  let humanLikelyViews = 0;
  let botLikelyViews = 0;
  let ctaClicks = 0;

  for (const event of events) {
    if (event.visitor_key) visitors.add(event.visitor_key);
    if (event.event_type === "preview_viewed") {
      if (event.bot_classification === "bot_likely") botLikelyViews += 1;
      else if (event.bot_classification === "human_likely") humanLikelyViews += 1;
    } else {
      ctaClicks += 1;
    }
  }

  return {
    deployment,
    pendingApprovalId,
    totalEvents: events.length,
    humanLikelyViews,
    botLikelyViews,
    ctaClicks,
    uniqueVisitors: visitors.size,
    lastEventAt: events[0]?.occurred_at ?? null,
    recentEvents: events.slice(0, 10).map((event) => ({
      id: event.id,
      eventType: isPreviewEventType(event.event_type)
        ? event.event_type
        : "preview_viewed",
      botClassification: botClasses.has(event.bot_classification as BotClassification)
        ? (event.bot_classification as BotClassification)
        : "unknown",
      deviceClass: deviceClasses.has(event.device_class as DeviceClass)
        ? (event.device_class as DeviceClass)
        : "unknown",
      browserClass: browserClasses.has(event.browser_class as BrowserClass)
        ? (event.browser_class as BrowserClass)
        : "unknown",
      occurredAt: event.occurred_at,
    })),
  };
}

export async function requestPreviewPublication(
  websiteId: string,
): Promise<{ ok: boolean; error?: string; approvalId?: string }> {
  const site = await getWebsiteById(websiteId);
  const pendingApprovalId = await getPendingPreviewApprovalId(websiteId);
  const policy = assertPreviewPublicationAllowed({
    site,
    hasActiveDeployment: await hasActiveDeployment(websiteId),
    hasPendingApproval: Boolean(pendingApprovalId),
  });
  if (!policy.ok) return policy;

  const rows = await mutateTable<ApprovalRow[] | null>((client) =>
    client
      .from("approvals")
      .insert({
        lead_id: site!.leadId,
        agent_run_id: site!.sourceRunId,
        approval_type: PREVIEW_APPROVAL_TYPE,
        status: "pending",
        title: "Publish prospect preview",
        description:
          "Create a tokenized public preview URL for this generated website. This does not deploy production resources or contact the prospect.",
        payload: {
          action: PREVIEW_APPROVAL_ACTION,
          generated_website_id: site!.id,
          risk_level: "medium",
          agent_slug: "builder",
        },
        requested_cost_ticks: "0",
        approved_cost_limit_ticks: "0",
      })
      .select("*"),
  );
  const row = rows?.[0];
  if (!row) return { ok: false, error: "Could not create approval request." };

  await recordActivityEvent({
    eventType: "preview_publication_requested",
    title: "Preview publication requested",
    description: site!.businessName,
    actorType: "admin",
    leadId: site!.leadId,
    metadata: { generated_website_id: site!.id, approval_id: row.id },
  });

  return { ok: true, approvalId: row.id };
}

export async function approvePreviewPublicationApproval(
  approvalId: string,
): Promise<PreviewPublicationApprovalResult> {
  const approval = await readTable<ApprovalRow | null>((client) =>
    client.from("approvals").select("*").eq("id", approvalId).maybeSingle(),
  );
  if (!approval || approval.status !== "pending") {
    return { ok: false, error: "Approval is no longer pending." };
  }
  if (
    approval.approval_type !== PREVIEW_APPROVAL_TYPE ||
    !isPreviewPublicationApprovalPayload(approval.payload)
  ) {
    return { ok: false, error: "This approval cannot publish a preview." };
  }

  const payload = asRecord(approval.payload);
  const websiteId =
    typeof payload.generated_website_id === "string" ? payload.generated_website_id : "";
  const site = await getWebsiteById(websiteId);
  const policy = assertPreviewPublicationAllowed({
    site,
    hasActiveDeployment: await hasActiveDeployment(websiteId),
    hasPendingApproval: false,
  });
  if (!policy.ok) return policy;

  const token = createPreviewToken();
  const now = new Date().toISOString();
  const deploymentRows = await mutateTable<PreviewDeploymentRow[] | null>((client) =>
    client
      .from("preview_deployments")
      .insert({
        generated_website_id: site!.id,
        lead_id: site!.leadId,
        approval_id: approval.id,
        token_hash: token.hash,
        token_hint: token.hint,
        status: "active",
        source_run_id: site!.sourceRunId,
        build_version: site!.buildVersion,
        attribution: {},
        approved_at: now,
      })
      .select("*"),
  );
  const deployment = deploymentRows?.[0];
  if (!deployment) return { ok: false, error: "Could not create preview deployment." };

  const approvalRows = await mutateTable<ApprovalRow[] | null>((client) =>
    client
      .from("approvals")
      .update({
        status: "executed",
        resolved_at: now,
        resolved_by: "admin",
      })
      .eq("id", approval.id)
      .eq("status", "pending")
      .select("*"),
  );
  if (!approvalRows?.[0]) {
    return { ok: false, error: "Preview was created, but approval execution was not recorded." };
  }

  await recordActivityEvent({
    eventType: "preview_publication_executed",
    title: "Public preview published",
    description: site!.businessName,
    actorType: "admin",
    leadId: site!.leadId,
    metadata: {
      generated_website_id: site!.id,
      preview_deployment_id: deployment.id,
      token_hint: token.hint,
    },
  });

  return { ok: true, publicPath: `/p/${token.token}` };
}

export async function revokePreviewDeployment(input: {
  websiteId: string;
  deploymentId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
  const rows = await mutateTable<PreviewDeploymentRow[] | null>((client) =>
    client
      .from("preview_deployments")
      .update({ status: "revoked", revoked_at: now, updated_at: now })
      .eq("id", input.deploymentId)
      .eq("generated_website_id", input.websiteId)
      .eq("status", "active")
      .select("*"),
  );
  const row = rows?.[0];
  if (!row) return { ok: false, error: "Preview is not active or was not found." };
  await recordActivityEvent({
    eventType: "preview_revoked",
    title: "Public preview revoked",
    description: `Token ending ${row.token_hint}`,
    actorType: "admin",
    leadId: row.lead_id,
    metadata: {
      generated_website_id: row.generated_website_id,
      preview_deployment_id: row.id,
      token_hint: row.token_hint,
    },
  });
  return { ok: true };
}

export async function getPublicPreviewByToken(token: string): Promise<PublicPreview | null> {
  if (!isPreviewToken(token)) return null;
  const client = createServerSupabaseClient();
  if (!client) return null;

  const { data: deployment, error: deploymentError } = await client
    .from("preview_deployments")
    .select("*")
    .eq("token_hash", hashPreviewToken(token))
    .eq("status", "active")
    .is("revoked_at", null)
    .maybeSingle();

  if (deploymentError) {
    console.error("Public preview deployment lookup failed", deploymentError.code ?? "unknown");
    return null;
  }
  if (!deployment) return null;
  if (deployment.expires_at && new Date(deployment.expires_at) <= new Date()) {
    return null;
  }

  const { data: website, error: websiteError } = await client
    .from("generated_websites")
    .select("*")
    .eq("id", deployment.generated_website_id)
    .maybeSingle();
  if (websiteError || !website) {
    console.error("Public preview website lookup failed", websiteError?.code ?? "not_found");
    return null;
  }

  const { data: lead } = await client
    .from("leads")
    .select("business_name")
    .eq("id", deployment.lead_id)
    .maybeSingle();

  const site = mapWebsite(website, lead?.business_name ?? "Unknown business");
  if (!site.spec) return null;

  return { deployment: mapDeployment(deployment), site, token };
}

export async function recordPreviewEvent(input: {
  token: string;
  eventType: string;
  request: PreviewRequestFacts;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  if (!isPreviewToken(input.token) || !isPreviewEventType(input.eventType)) return;
  const client = createServerSupabaseClient();
  if (!client) return;

  const { data: deployment, error: deploymentError } = await client
    .from("preview_deployments")
    .select("*")
    .eq("token_hash", hashPreviewToken(input.token))
    .eq("status", "active")
    .is("revoked_at", null)
    .maybeSingle();

  if (deploymentError || !deployment) {
    if (deploymentError) {
      console.error("Preview event deployment lookup failed", deploymentError.code ?? "unknown");
    }
    return;
  }
  if (deployment.expires_at && new Date(deployment.expires_at) <= new Date()) return;

  const occurredAt = new Date();
  const visitorKey = createVisitorKey({
    previewDeploymentId: deployment.id,
    occurredAt,
    request: input.request,
  });
  const botClassification = classifyBot(input.request);

  const { error: insertError } = await client.from("preview_events").insert({
    preview_deployment_id: deployment.id,
    generated_website_id: deployment.generated_website_id,
    lead_id: deployment.lead_id,
    event_type: input.eventType,
    visitor_key: visitorKey,
    bot_classification: botClassification,
    device_class: classifyDevice(input.request.userAgent),
    browser_class: classifyBrowser(input.request.userAgent),
    country: input.request.country,
    region: input.request.region,
    city: input.request.city,
    referrer: sanitizeReferrer(input.request.referrer),
    path: sanitizePreviewPath(input.request.path),
    metadata: input.metadata ?? {},
    occurred_at: occurredAt.toISOString(),
  });
  if (insertError) {
    console.error("Preview event insert failed", insertError.code ?? "unknown");
    return;
  }

  if (input.eventType === "preview_viewed" && botClassification !== "bot_likely") {
    await client
      .from("preview_deployments")
      .update({
        last_viewed_at: occurredAt.toISOString(),
        view_count: deployment.view_count + 1,
        updated_at: occurredAt.toISOString(),
      })
      .eq("id", deployment.id);
  }
}

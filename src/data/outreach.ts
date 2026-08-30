import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { getAuthConfig } from "@/lib/auth/config";
import { validateWebsiteSpec } from "@/lib/builder/validate";
import { getEmailProvider, isValidEmail } from "@/lib/email/provider";
import { asRecord } from "@/lib/json";
import {
  createOutreachAttributionToken,
  hashOutreachAttributionToken,
  isOutreachAttributionToken,
  renderOutreachBody,
} from "@/lib/sales/attribution";
import { computeOutreachContentHash } from "@/lib/sales/content-hash";
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
import { resolveMonotonicLeadStatus } from "@/lib/scout/status";
import { createServerSupabaseClient, mutateTable, readTable } from "@/lib/supabase/server";
import type { Outreach, OutreachStatus } from "@/types";
import type {
  ApprovalRow,
  LeadRow,
  OutreachEventRow,
  OutreachRow,
  PreviewDeploymentRow,
  PreviewEventRow,
  WebsiteRow,
} from "@/types/database";

const dbStatuses = new Set<OutreachStatus>([
  "draft",
  "awaiting_approval",
  "approved",
  "sent",
  "failed",
  "replied",
  "interested",
  "declined",
  "unsubscribed",
]);

function displayStatus(
  status: string,
  events: OutreachEventRow[],
): OutreachStatus {
  if (events.some((event) => event.event_type === "unsubscribed")) {
    return "unsubscribed";
  }
  if (events.some((event) => event.event_type === "declined")) {
    return "declined";
  }
  if (events.some((event) => event.event_type === "interested")) {
    return "interested";
  }
  if (dbStatuses.has(status as OutreachStatus)) {
    return status as OutreachStatus;
  }
  return "draft";
}

export async function listOutreach(): Promise<Outreach[]> {
  const [rows, events, leads, previews] = await Promise.all([
    readTable<OutreachRow[]>((client) =>
      client.from("outreach").select("*").order("created_at", { ascending: false }),
    ),
    readTable<OutreachEventRow[]>((client) =>
      client.from("outreach_events").select("*"),
    ),
    readTable<Pick<LeadRow, "id" | "business_name">[]>((client) =>
      client.from("leads").select("id, business_name"),
    ),
    readTable<Pick<PreviewDeploymentRow, "id" | "token_hint">[]>((client) =>
      client.from("preview_deployments").select("id, token_hint"),
    ),
  ]);

  const nameById = new Map(
    (leads ?? []).map((lead) => [lead.id, lead.business_name]),
  );
  const previewHintById = new Map(
    (previews ?? []).map((p) => [p.id, p.token_hint]),
  );

  const eventsByOutreach = new Map<string, OutreachEventRow[]>();
  for (const event of events ?? []) {
    const list = eventsByOutreach.get(event.outreach_id) ?? [];
    list.push(event);
    eventsByOutreach.set(event.outreach_id, list);
  }

  return (rows ?? []).map((row) => {
    const related = eventsByOutreach.get(row.id) ?? [];
    const opened = related.find((event) => event.event_type === "opened");
    const clicked = related.find((event) => event.event_type === "clicked");
    const replied = related.find((event) => event.event_type === "replied");
    const hint = row.preview_deployment_id ? previewHintById.get(row.preview_deployment_id) : null;

    return {
      id: row.id,
      leadId: row.lead_id,
      generatedWebsiteId: row.generated_website_id,
      previewDeploymentId: row.preview_deployment_id,
      salesRunId: row.sales_run_id,
      approvalId: row.approval_id,
      agentRunId: row.agent_run_id,
      businessName: nameById.get(row.lead_id) ?? "Unknown business",
      recipient: row.recipient_email ?? "",
      senderName: row.sender_name ?? null,
      senderEmail: row.sender_email ?? null,
      subject: row.subject ?? "",
      body: row.body ?? "",
      contentHash: row.content_hash,
      contentVersion: row.content_version ?? null,
      status: displayStatus(row.status, related),
      provider: row.provider ?? "mock",
      providerMessageId: row.provider_message_id,
      previewUrl: row.attribution_token_hint ? `/o/...${row.attribution_token_hint}` : null,
      tokenHint: hint,
      attributionTokenHint: row.attribution_token_hint,
      campaignId: row.campaign_id,
      approvedAt: row.approved_at,
      sentAt: row.sent_at,
      openedAt: opened?.occurred_at ?? null,
      clickedAt: clicked?.occurred_at ?? null,
      repliedAt: replied?.occurred_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: asRecord(row.metadata),
    };
  });
}

export type OutreachDetail = Outreach & {
  lead: LeadRow | null;
  website: WebsiteRow | null;
  previewDeployment: PreviewDeploymentRow | null;
  approval: ApprovalRow | null;
  events: OutreachEventRow[];
  attributedPreviewEvents: PreviewEventRow[];
  evidence: Array<{ type: string; text: string; source?: string }>;
};

export async function getOutreachById(id: string): Promise<OutreachDetail | null> {
  const row = await readTable<OutreachRow | null>((client) =>
    client.from("outreach").select("*").eq("id", id).maybeSingle(),
  );
  if (!row) return null;

  const [lead, website, preview, approval, events, attributedPreviewEvents] = await Promise.all([
    readTable<LeadRow | null>((client) =>
      client.from("leads").select("*").eq("id", row.lead_id).maybeSingle(),
    ),
    row.generated_website_id
      ? readTable<WebsiteRow | null>((client) =>
          client.from("generated_websites").select("*").eq("id", row.generated_website_id!).maybeSingle(),
        )
      : null,
    row.preview_deployment_id
      ? readTable<PreviewDeploymentRow | null>((client) =>
          client.from("preview_deployments").select("*").eq("id", row.preview_deployment_id!).maybeSingle(),
        )
      : null,
    row.approval_id
      ? readTable<ApprovalRow | null>((client) =>
          client.from("approvals").select("*").eq("id", row.approval_id!).maybeSingle(),
        )
      : null,
    readTable<OutreachEventRow[]>((client) =>
      client
        .from("outreach_events")
        .select("*")
        .eq("outreach_id", id)
        .order("occurred_at", { ascending: false }),
    ),
    row.preview_deployment_id
      ? readTable<PreviewEventRow[]>((client) =>
          client
            .from("preview_events")
            .select("*")
            .eq("outreach_id", row.id)
            .order("occurred_at", { ascending: false })
            .limit(100),
        )
      : null,
  ]);

  const relatedEvents = events ?? [];
  const meta = asRecord(row.metadata);
  const evidence = Array.isArray(meta.evidence)
    ? (meta.evidence as Array<{ type: string; text: string; source?: string }>)
    : [];

  const hint = preview?.token_hint ?? null;

  return {
    id: row.id,
    leadId: row.lead_id,
    generatedWebsiteId: row.generated_website_id,
    previewDeploymentId: row.preview_deployment_id,
    salesRunId: row.sales_run_id,
    approvalId: row.approval_id,
    agentRunId: row.agent_run_id,
    businessName: lead?.business_name ?? "Unknown business",
    recipient: row.recipient_email ?? "",
    senderName: row.sender_name ?? null,
    senderEmail: row.sender_email ?? null,
    subject: row.subject ?? "",
    body: row.body ?? "",
    contentHash: row.content_hash,
    contentVersion: row.content_version ?? null,
    status: displayStatus(row.status, relatedEvents),
    provider: row.provider ?? "mock",
    providerMessageId: row.provider_message_id,
    previewUrl: row.attribution_token_hint ? `/o/...${row.attribution_token_hint}` : null,
    tokenHint: hint,
    attributionTokenHint: row.attribution_token_hint,
    campaignId: row.campaign_id,
    approvedAt: row.approved_at,
    sentAt: row.sent_at,
    openedAt: relatedEvents.find((e) => e.event_type === "opened")?.occurred_at ?? null,
    clickedAt: relatedEvents.find((e) => e.event_type === "clicked")?.occurred_at ?? null,
    repliedAt: relatedEvents.find((e) => e.event_type === "replied")?.occurred_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: meta,
    lead,
    website,
    previewDeployment: preview,
    approval,
    events: relatedEvents,
    attributedPreviewEvents: attributedPreviewEvents ?? [],
    evidence,
  };
}

export async function updateOutreachDraft(input: {
  id: string;
  subject: string;
  body: string;
  recipientEmail: string;
}): Promise<{ ok: boolean; error?: string }> {
  const current = await readTable<OutreachRow | null>((client) =>
    client.from("outreach").select("*").eq("id", input.id).maybeSingle(),
  );
  if (!current) return { ok: false, error: "Outreach record was not found." };
  if (current.status === "sent") {
    return { ok: false, error: "Sent outreach cannot be edited." };
  }

  const subject = input.subject.trim();
  const body = input.body.trim();
  const recipient = input.recipientEmail.trim();

  if (!subject) return { ok: false, error: "Subject cannot be empty." };
  if (!body) return { ok: false, error: "Email body cannot be empty." };

  const contentHash = computeOutreachContentHash({
    subject,
    body,
    recipient,
    previewDeploymentId: current.preview_deployment_id,
    attributionTokenHash: current.attribution_token_hash,
  });

  // If status was awaiting_approval or approved, reset approval reference because content changed
  const needsApprovalReset = current.status === "awaiting_approval" || current.status === "approved";
  const now = new Date().toISOString();

  const rows = await mutateTable<OutreachRow[] | null>((client) =>
    client
      .from("outreach")
      .update({
        subject,
        body,
        recipient_email: recipient || null,
        content_hash: contentHash,
        status: needsApprovalReset ? "draft" : current.status,
        approval_id: needsApprovalReset ? null : current.approval_id,
        approved_at: needsApprovalReset ? null : current.approved_at,
        updated_at: now,
      })
      .eq("id", input.id)
      .select("*"),
  );

  if (!rows?.[0]) {
    return { ok: false, error: "Failed to update outreach record." };
  }

  if (needsApprovalReset && current.approval_id) {
    await mutateTable((client) =>
      client
        .from("approvals")
        .update({
          status: "expired",
          resolved_at: now,
          resolved_by: "system_content_modified",
        })
        .eq("id", current.approval_id!)
        .eq("status", "pending")
        .select("id"),
    );
  }

  return { ok: true };
}

export async function requestOutreachSendApproval(
  outreachId: string,
): Promise<{ ok: boolean; error?: string; approvalId?: string }> {
  const outreach = await readTable<OutreachRow | null>((client) =>
    client.from("outreach").select("*").eq("id", outreachId).maybeSingle(),
  );
  if (!outreach) return { ok: false, error: "Outreach record was not found." };
  if (outreach.status === "sent") {
    return { ok: false, error: "Outreach has already been sent." };
  }
  if (!outreach.recipient_email || !isValidEmail(outreach.recipient_email)) {
    return { ok: false, error: "A valid recipient email address is required before requesting send approval." };
  }

  if (!outreach.preview_deployment_id) {
    return { ok: false, error: "Outreach is missing an associated preview deployment." };
  }
  if (!outreach.attribution_token_hash) {
    return { ok: false, error: "Outreach is missing a valid attribution link." };
  }

  const preview = await readTable<PreviewDeploymentRow | null>((client) =>
    client.from("preview_deployments").select("*").eq("id", outreach.preview_deployment_id!).maybeSingle(),
  );
  if (!preview || preview.status !== "active" || preview.revoked_at) {
    return { ok: false, error: "The associated preview deployment is no longer active. Approvals require an active preview." };
  }

  const lead = await readTable<Pick<LeadRow, "business_name"> | null>((client) =>
    client.from("leads").select("business_name").eq("id", outreach.lead_id).maybeSingle(),
  );

  const contentHash = computeOutreachContentHash({
    subject: outreach.subject ?? "",
    body: outreach.body ?? "",
    recipient: outreach.recipient_email,
    previewDeploymentId: outreach.preview_deployment_id,
    attributionTokenHash: outreach.attribution_token_hash,
  });

  const approvalRows = await mutateTable<ApprovalRow[] | null>((client) =>
    client
      .from("approvals")
      .insert({
        lead_id: outreach.lead_id,
        agent_run_id: outreach.agent_run_id,
        approval_type: "external_email",
        status: "pending",
        title: `Send outreach email to ${outreach.recipient_email}`,
        description: `Personalized website pitch for ${lead?.business_name ?? "prospect"} referencing preview ${preview.token_hint}.`,
        payload: {
          action: "send_outreach_email",
          outreach_id: outreach.id,
          recipient_email: outreach.recipient_email,
          subject: outreach.subject,
          content_hash: contentHash,
          content_version: outreach.content_version,
          preview_deployment_id: outreach.preview_deployment_id,
          attribution_token_hash: outreach.attribution_token_hash,
          agent_slug: "sales",
          risk_level: "high",
        },
        requested_cost_ticks: "0",
        approved_cost_limit_ticks: "0",
      })
      .select("*"),
  );

  const approval = approvalRows?.[0];
  if (!approval) return { ok: false, error: "Could not create approval request." };

  const now = new Date().toISOString();
  await mutateTable((client) =>
    client
      .from("outreach")
      .update({
        status: "awaiting_approval",
        approval_id: approval.id,
        content_hash: contentHash,
        updated_at: now,
      })
      .eq("id", outreach.id)
      .select("id"),
  );

  await mutateTable((client) =>
    client.from("outreach_events").insert({
      outreach_id: outreach.id,
      event_type: "approval_requested",
      payload: {
        approval_id: approval.id,
        recipient: outreach.recipient_email,
      },
    }),
  );

  await recordActivityEvent({
    eventType: "outreach_approval_requested",
    title: "Email outreach approval requested",
    description: `${lead?.business_name ?? "Prospect"}: ${outreach.recipient_email}`,
    actorType: "admin",
    leadId: outreach.lead_id,
    metadata: { outreach_id: outreach.id, approval_id: approval.id },
  });

  return { ok: true, approvalId: approval.id };
}

export async function approveOutreachSendApproval(
  approvalId: string,
): Promise<{ ok: boolean; error?: string }> {
  const approval = await readTable<ApprovalRow | null>((client) =>
    client.from("approvals").select("*").eq("id", approvalId).maybeSingle(),
  );
  if (!approval || approval.status !== "pending") {
    return { ok: false, error: "Approval is no longer pending." };
  }
  if (approval.approval_type !== "external_email") {
    return { ok: false, error: "This approval is not an email outreach approval." };
  }

  const payload = asRecord(approval.payload);
  if (payload.action !== "send_outreach_email") {
    return { ok: false, error: "Approval payload action does not match email outreach." };
  }
  const outreachId = typeof payload.outreach_id === "string" ? payload.outreach_id : "";
  const expectedHash = typeof payload.content_hash === "string" ? payload.content_hash : "";

  const outreach = await readTable<OutreachRow | null>((client) =>
    client.from("outreach").select("*").eq("id", outreachId).maybeSingle(),
  );
  if (!outreach) return { ok: false, error: "Associated outreach record not found." };

  const currentHash = computeOutreachContentHash({
    subject: outreach.subject ?? "",
    body: outreach.body ?? "",
    recipient: outreach.recipient_email ?? "",
    previewDeploymentId: outreach.preview_deployment_id,
    attributionTokenHash: outreach.attribution_token_hash,
  });

  if (currentHash !== expectedHash) {
    return {
      ok: false,
      error: "Outreach content was modified after approval was requested. Please request approval again.",
    };
  }
  if (payload.attribution_token_hash !== outreach.attribution_token_hash) {
    return { ok: false, error: "Outreach attribution link changed after approval was requested. Please request approval again." };
  }
  if (
    payload.preview_deployment_id !== outreach.preview_deployment_id ||
    payload.content_version !== outreach.content_version
  ) {
    return { ok: false, error: "Outreach preview or content version changed after approval was requested. Please request approval again." };
  }

  const now = new Date().toISOString();
  await mutateTable((client) =>
    client
      .from("approvals")
      .update({
        status: "executed",
        resolved_at: now,
        resolved_by: "admin",
      })
      .eq("id", approval.id)
      .eq("status", "pending")
      .select("id"),
  );

  await mutateTable((client) =>
    client
      .from("outreach")
      .update({
        status: "approved",
        approved_at: now,
        updated_at: now,
      })
      .eq("id", outreach.id)
      .select("id"),
  );

  await mutateTable((client) =>
    client.from("outreach_events").insert({
      outreach_id: outreach.id,
      event_type: "approved",
      payload: { approval_id: approval.id },
    }),
  );

  return { ok: true };
}

export async function sendApprovedOutreach(
  outreachId: string,
): Promise<{ ok: boolean; error?: string; messageId?: string; simulated?: boolean }> {
  const outreach = await readTable<OutreachRow | null>((client) =>
    client.from("outreach").select("*").eq("id", outreachId).maybeSingle(),
  );
  if (!outreach) return { ok: false, error: "Outreach record was not found." };
  if (outreach.status === "sent") {
    return { ok: false, error: "This outreach email has already been sent." };
  }
  if (outreach.status !== "approved") {
    return { ok: false, error: "Outreach must be approved by a human before sending." };
  }
  if (!outreach.recipient_email || !isValidEmail(outreach.recipient_email)) {
    return { ok: false, error: "A valid recipient email address is required to send." };
  }

  if (!outreach.preview_deployment_id) {
    return { ok: false, error: "Outreach is missing an associated preview deployment." };
  }
  if (!outreach.attribution_token_hash || !outreach.attribution_token_created_at) {
    return { ok: false, error: "Outreach is missing a valid attribution link." };
  }

  const preview = await readTable<PreviewDeploymentRow | null>((client) =>
    client.from("preview_deployments").select("*").eq("id", outreach.preview_deployment_id!).maybeSingle(),
  );
  if (!preview || preview.status !== "active" || preview.revoked_at) {
    return { ok: false, error: "The associated preview deployment is revoked or inactive. Cannot send outreach with invalid preview." };
  }

  // Verify approval exists and was executed
  if (outreach.approval_id) {
    const approval = await readTable<ApprovalRow | null>((client) =>
      client.from("approvals").select("*").eq("id", outreach.approval_id!).maybeSingle(),
    );
    if (!approval || (approval.status !== "executed" && approval.status !== "approved")) {
      return { ok: false, error: "Send approval is not in an approved state." };
    }
    const payload = asRecord(approval.payload);
    const currentHash = computeOutreachContentHash({
      subject: outreach.subject ?? "",
      body: outreach.body ?? "",
      recipient: outreach.recipient_email,
      previewDeploymentId: outreach.preview_deployment_id,
      attributionTokenHash: outreach.attribution_token_hash,
    });
    if (
      payload.action !== "send_outreach_email" ||
      payload.content_hash !== currentHash ||
      payload.attribution_token_hash !== outreach.attribution_token_hash ||
      payload.preview_deployment_id !== outreach.preview_deployment_id ||
      payload.content_version !== outreach.content_version
    ) {
      return { ok: false, error: "Approved content no longer matches this outreach draft." };
    }
  } else {
    return { ok: false, error: "Send approval is required before sending." };
  }

  const provider = getEmailProvider();
  if (provider.id !== "mock") {
    return { ok: false, error: "Only the mock email provider is allowed in Milestone 8." };
  }
  const authConfig = getAuthConfig();
  if (!authConfig) return { ok: false, error: "Admin auth is not configured." };
  const attributionToken = createOutreachAttributionToken({
    outreachId: outreach.id,
    createdAt: outreach.attribution_token_created_at,
    secret: authConfig.authSecret,
  });
  if (attributionToken.hash !== outreach.attribution_token_hash) {
    return { ok: false, error: "Outreach attribution token verification failed." };
  }
  const renderedBody = renderOutreachBody({
    bodyTemplate: outreach.body ?? "",
    publicPath: `/o/${attributionToken.token}`,
  });

  await mutateTable((client) =>
    client.from("outreach_events").insert({
      outreach_id: outreach.id,
      event_type: "send_attempted",
      payload: { provider: provider.id, simulated: true },
    }),
  );

  const sendResult = await provider.sendEmail({
    to: outreach.recipient_email,
    from: outreach.sender_email || "outreach@siteforge.agency",
    subject: outreach.subject ?? "",
    text: renderedBody,
    metadata: {
      outreach_id: outreach.id,
      lead_id: outreach.lead_id,
      preview_deployment_id: outreach.preview_deployment_id,
    },
  });

  const now = new Date().toISOString();

  if (!sendResult.ok) {
    await mutateTable((client) =>
      client
        .from("outreach")
        .update({ status: "failed", updated_at: now })
        .eq("id", outreach.id)
        .select("id"),
    );

    await mutateTable((client) =>
      client.from("outreach_events").insert({
        outreach_id: outreach.id,
        event_type: "failed",
        payload: { error: sendResult.error ?? "unknown_send_error" },
      }),
    );

    return { ok: false, error: sendResult.error ?? "Failed to send email via provider." };
  }

  // Record send success
  await mutateTable((client) =>
    client
      .from("outreach")
      .update({
        status: "sent",
        sent_at: now,
        provider_message_id: sendResult.messageId ?? null,
        provider: sendResult.provider,
        updated_at: now,
      })
      .eq("id", outreach.id)
      .select("id"),
  );

  // Advance lead status monotonically to contacted
  const lead = await readTable<LeadRow | null>((client) =>
    client.from("leads").select("*").eq("id", outreach.lead_id).maybeSingle(),
  );

  if (lead) {
    const nextLeadStatus = resolveMonotonicLeadStatus(lead.status, "contacted");
    if (nextLeadStatus !== lead.status) {
      await mutateTable((client) =>
        client
          .from("leads")
          .update({ status: nextLeadStatus })
          .eq("id", lead.id)
          .select("id"),
      );
    }
  }

  // Insert outreach event
  await mutateTable((client) =>
    client.from("outreach_events").insert({
      outreach_id: outreach.id,
      event_type: "sent",
      payload: {
        provider: sendResult.provider,
        message_id: sendResult.messageId ?? null,
        simulated: sendResult.simulated ?? false,
      },
    }),
  );

  await recordActivityEvent({
    eventType: "outreach_sent",
    title: "Email outreach sent (simulated)",
    description: `${lead?.business_name ?? "Prospect"} (${outreach.recipient_email})`,
    actorType: "admin",
    leadId: outreach.lead_id,
    metadata: {
      outreach_id: outreach.id,
      provider: sendResult.provider,
      message_id: sendResult.messageId,
      simulated: sendResult.simulated,
    },
  });

  return {
    ok: true,
    messageId: sendResult.messageId,
    simulated: sendResult.simulated,
  };
}

export type PublicOutreachPreview = {
  outreachId: string;
  previewDeploymentId: string;
  generatedWebsiteId: string;
  leadId: string;
  spec: unknown;
  token: string;
};

export async function getPublicOutreachPreviewByToken(
  token: string,
): Promise<PublicOutreachPreview | null> {
  if (!isOutreachAttributionToken(token)) return null;
  const client = createServerSupabaseClient();
  if (!client) return null;

  const { data: outreach, error: outreachError } = await client
    .from("outreach")
    .select("*")
    .eq("attribution_token_hash", hashOutreachAttributionToken(token))
    .maybeSingle();
  if (outreachError || !outreach) {
    if (outreachError) {
      console.error("Outreach attribution lookup failed", outreachError.code ?? "unknown");
    }
    return null;
  }
  if (!outreach.preview_deployment_id || !outreach.generated_website_id) return null;

  const { data: preview, error: previewError } = await client
    .from("preview_deployments")
    .select("*")
    .eq("id", outreach.preview_deployment_id)
    .eq("status", "active")
    .is("revoked_at", null)
    .maybeSingle();
  if (previewError || !preview) {
    if (previewError) {
      console.error("Outreach preview lookup failed", previewError.code ?? "unknown");
    }
    return null;
  }
  if (preview.expires_at && new Date(preview.expires_at) <= new Date()) return null;

  const { data: website, error: websiteError } = await client
    .from("generated_websites")
    .select("id, lead_id, spec")
    .eq("id", outreach.generated_website_id)
    .maybeSingle();
  if (websiteError || !website) {
    if (websiteError) {
      console.error("Outreach website lookup failed", websiteError.code ?? "unknown");
    }
    return null;
  }

  const validation = validateWebsiteSpec(website.spec);
  if (!validation.ok) return null;

  return {
    outreachId: outreach.id,
    previewDeploymentId: preview.id,
    generatedWebsiteId: website.id,
    leadId: website.lead_id,
    spec: validation.spec,
    token,
  };
}

export async function recordOutreachPreviewEvent(input: {
  token: string;
  eventType: string;
  request: PreviewRequestFacts;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  if (!isOutreachAttributionToken(input.token) || !isPreviewEventType(input.eventType)) return;
  const client = createServerSupabaseClient();
  if (!client) return;

  const { data: outreach } = await client
    .from("outreach")
    .select("*")
    .eq("attribution_token_hash", hashOutreachAttributionToken(input.token))
    .maybeSingle();
  if (!outreach?.preview_deployment_id || !outreach.generated_website_id) return;

  const { data: preview } = await client
    .from("preview_deployments")
    .select("*")
    .eq("id", outreach.preview_deployment_id)
    .eq("status", "active")
    .is("revoked_at", null)
    .maybeSingle();
  if (!preview) return;
  if (preview.expires_at && new Date(preview.expires_at) <= new Date()) return;

  const occurredAt = new Date();
  const botClassification = classifyBot(input.request);
  const { error: insertError } = await client.from("preview_events").insert({
    preview_deployment_id: preview.id,
    generated_website_id: preview.generated_website_id,
    lead_id: preview.lead_id,
    outreach_id: outreach.id,
    event_type: input.eventType,
    visitor_key: createVisitorKey({
      previewDeploymentId: preview.id,
      occurredAt,
      request: input.request,
    }),
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
    console.error("Outreach preview event insert failed", insertError.code ?? "unknown");
    return;
  }

  if (input.eventType === "preview_viewed" && botClassification !== "bot_likely") {
    await client
      .from("preview_deployments")
      .update({
        last_viewed_at: occurredAt.toISOString(),
        view_count: preview.view_count + 1,
        updated_at: occurredAt.toISOString(),
      })
      .eq("id", preview.id);
  }
}

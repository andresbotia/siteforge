import type { Json } from "@/types/database";
import type { SalesPipelineResult } from "./types";

export type OutreachInsert = {
  id: string;
  lead_id: string;
  generated_website_id: string;
  preview_deployment_id: string;
  agent_run_id: string;
  sales_run_id: string;
  subject: string;
  body: string;
  recipient_email: string | null;
  sender_name: string;
  sender_email: string;
  content_hash: string;
  content_version: string;
  attribution_token_hash: string;
  attribution_token_hint: string;
  attribution_token_created_at?: string;
  status: "draft";
  provider: string;
  metadata: Json;
};

export function buildOutreachInsert(input: {
  result: SalesPipelineResult;
  outreachId: string;
  runId: string;
}): OutreachInsert {
  const { result, outreachId, runId } = input;
  return {
    id: outreachId,
    lead_id: result.leadId,
    generated_website_id: result.generatedWebsiteId,
    preview_deployment_id: result.previewDeploymentId,
    agent_run_id: runId,
    sales_run_id: runId,
    subject: result.draft.subject,
    body: result.draft.body,
    recipient_email: result.draft.recipientEmail ? result.draft.recipientEmail : null,
    sender_name: result.draft.senderName,
    sender_email: result.draft.senderEmail,
    content_hash: result.draft.contentHash,
    content_version: result.version,
    attribution_token_hash: result.draft.attributionTokenHash,
    attribution_token_hint: result.draft.attributionTokenHint,
    status: "draft",
    provider: "mock",
    metadata: {
      version: result.version,
      evidence: result.draft.evidence as unknown as Json,
      paid_ai: "not_required",
      cost_usd: 0,
    },
  };
}

export function buildSalesToolCalls(result: SalesPipelineResult): Array<{
  tool: string;
  action: string;
  request: Json;
  response: Json;
}> {
  return [
    {
      tool: "validate_evidence",
      action: "audit_and_preview",
      request: {
        lead_id: result.leadId,
        website_id: result.generatedWebsiteId,
        preview_id: result.previewDeploymentId,
      },
      response: { eligible: true },
    },
    {
      tool: "compose_draft",
      action: "deterministic_personalization",
      request: { version: result.version, business_name: result.draft.subject },
      response: {
        subject: result.draft.subject,
        has_recipient: Boolean(result.draft.recipientEmail),
        evidence_count: result.draft.evidence.length,
      },
    },
    {
      tool: "content_hash",
      action: "sha256",
      request: { length: result.draft.body.length },
      response: { hash: result.draft.contentHash },
    },
    {
      tool: "persist",
      action: "insert_outreach_draft",
      request: { lead_id: result.leadId, status: "draft" },
      response: { cost_usd: 0, sendable: Boolean(result.draft.recipientEmail) },
    },
  ];
}

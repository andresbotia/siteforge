import { computeOutreachContentHash } from "@/lib/sales/content-hash";
import { asRecord } from "@/lib/json";
import type { ApprovalRow, OutreachEventRow, OutreachRow } from "@/types/database";
import { isValidEmail } from "./validation";

const SUPPRESSION_EVENTS = new Set([
  "unsubscribed",
  "bounced",
  "complained",
  "suppressed",
  "email.bounced",
  "email.complained",
  "email.suppressed",
]);

export type ApprovalCheckResult =
  | { ok: true; contentHash: string }
  | { ok: false; error: string };

export function verifyApprovedOutreachContent(
  outreach: Pick<
    OutreachRow,
    | "subject"
    | "body"
    | "recipient_email"
    | "preview_deployment_id"
    | "attribution_token_hash"
    | "content_version"
  >,
  approval: Pick<ApprovalRow, "status" | "approval_type" | "payload"> | null,
): ApprovalCheckResult {
  if (!approval || (approval.status !== "executed" && approval.status !== "approved")) {
    return { ok: false, error: "Send approval is not in an approved state." };
  }
  if (approval.approval_type !== "external_email") {
    return { ok: false, error: "Send approval is not an email approval." };
  }

  const payload = asRecord(approval.payload);
  const currentHash = computeOutreachContentHash({
    subject: outreach.subject ?? "",
    body: outreach.body ?? "",
    recipient: outreach.recipient_email ?? "",
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

  return { ok: true, contentHash: currentHash };
}

export function isRecipientSuppressed(
  recipient: string,
  events: Array<Pick<OutreachEventRow, "event_type" | "payload">>,
): boolean {
  const normalized = recipient.trim().toLowerCase();
  if (!isValidEmail(normalized)) return true;

  return events.some((event) => {
    if (!SUPPRESSION_EVENTS.has(event.event_type)) return false;
    const payload = asRecord(event.payload);
    const eventRecipient = String(payload.recipient_email ?? payload.email ?? "").trim().toLowerCase();
    return !eventRecipient || eventRecipient === normalized;
  });
}

export function hasUnsubscribeLanguage(body: string | null | undefined): boolean {
  return /\b(unsubscribe|opt[-\s]?out|do not contact)\b/i.test(body ?? "");
}

export function validateProspectSendPreview(
  outreach: Pick<OutreachRow, "lead_id" | "generated_website_id" | "preview_deployment_id">,
  preview: {
    id: string;
    lead_id: string;
    generated_website_id: string;
    status: string;
    revoked_at: string | null;
    expires_at: string | null;
  } | null,
): { ok: true } | { ok: false; error: string } {
  if (!outreach.preview_deployment_id) {
    return { ok: false, error: "Outreach is missing an associated preview deployment." };
  }
  if (!preview) {
    return { ok: false, error: "The associated preview deployment was not found." };
  }
  if (preview.id !== outreach.preview_deployment_id) {
    return { ok: false, error: "Preview deployment does not match this outreach." };
  }
  if (
    preview.lead_id !== outreach.lead_id ||
    preview.generated_website_id !== outreach.generated_website_id
  ) {
    return { ok: false, error: "Preview deployment is not associated with this lead and website." };
  }
  if (preview.status !== "active" || preview.revoked_at) {
    return { ok: false, error: "The associated preview deployment is revoked or inactive." };
  }
  if (preview.expires_at && new Date(preview.expires_at) <= new Date()) {
    return { ok: false, error: "The associated preview deployment is expired." };
  }
  return { ok: true };
}

export function liveEmailAllowed(input: {
  allowLiveEmail: boolean;
  providerKeyPresent: boolean;
  fromConfigured: boolean;
  replyToConfigured: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.allowLiveEmail) return { ok: false, error: "Live email gate is disabled." };
  if (!input.providerKeyPresent) return { ok: false, error: "RESEND_API_KEY is not configured." };
  if (!input.fromConfigured) return { ok: false, error: "SITEFORGE_EMAIL_FROM is not configured." };
  if (!input.replyToConfigured) return { ok: false, error: "SITEFORGE_EMAIL_REPLY_TO is not configured." };
  return { ok: true };
}

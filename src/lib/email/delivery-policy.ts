import { computeOutreachBindingHash } from "@/lib/sales/content-hash";
import { OUTREACH_APPROVAL_ACTION, toOutreachKind, type OutreachKind } from "@/lib/sales/kinds";
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

type ApprovalBindableOutreach = Pick<
  OutreachRow,
  | "kind"
  | "subject"
  | "body"
  | "recipient_email"
  | "preview_deployment_id"
  | "attribution_token_hash"
  | "commercial_offer_id"
  | "purchase_token_hash"
  | "content_version"
>;

/**
 * One approval-binding check for both outreach kinds -- there is no second
 * send path and no second verifier.
 *
 * A cold_outreach approval binds: action=send_outreach_email, content hash
 * (subject + body + recipient + preview + attribution token), attribution
 * token hash, preview deployment, content version. Unchanged from M8.
 *
 * A follow_up approval binds: action=send_follow_up_email, content hash
 * (subject + body + recipient + commercial offer + purchase token hash),
 * commercial offer id, purchase token hash, content version. Editing any of
 * those invalidates the approval, exactly as an edit does on the cold path,
 * because the recomputed hash stops matching the bound one.
 *
 * The per-kind approval action also means an approval granted for one kind
 * can never authorize a send of the other.
 */
export function verifyApprovedOutreachContent(
  outreach: ApprovalBindableOutreach,
  approval: Pick<ApprovalRow, "status" | "approval_type" | "payload"> | null,
): ApprovalCheckResult {
  if (!approval || (approval.status !== "executed" && approval.status !== "approved")) {
    return { ok: false, error: "Send approval is not in an approved state." };
  }
  if (approval.approval_type !== "external_email") {
    return { ok: false, error: "Send approval is not an email approval." };
  }

  const kind = toOutreachKind(outreach.kind);
  const payload = asRecord(approval.payload);
  const currentHash = computeOutreachBindingHash({
    kind,
    subject: outreach.subject ?? "",
    body: outreach.body ?? "",
    recipient: outreach.recipient_email ?? "",
    previewDeploymentId: outreach.preview_deployment_id,
    attributionTokenHash: outreach.attribution_token_hash,
    commercialOfferId: outreach.commercial_offer_id,
    purchaseTokenHash: outreach.purchase_token_hash,
  });

  if (
    payload.action !== OUTREACH_APPROVAL_ACTION[kind] ||
    payload.content_hash !== currentHash ||
    payload.content_version !== outreach.content_version
  ) {
    return { ok: false, error: "Approved content no longer matches this outreach draft." };
  }

  if (kind === "follow_up") {
    if (
      payload.commercial_offer_id !== outreach.commercial_offer_id ||
      payload.purchase_token_hash !== outreach.purchase_token_hash
    ) {
      return { ok: false, error: "Approved offer or purchase link no longer matches this follow-up." };
    }
  } else if (
    payload.attribution_token_hash !== outreach.attribution_token_hash ||
    payload.preview_deployment_id !== outreach.preview_deployment_id
  ) {
    return { ok: false, error: "Approved content no longer matches this outreach draft." };
  }

  return { ok: true, contentHash: currentHash };
}

/**
 * Duplicate-send blocking is per lead PER KIND: an already-sent cold email
 * must not block the payment follow-up to the same lead, and a second
 * follow-up to a lead that already received one must still be blocked. The
 * outreach row's own `sent` status remains the primary guard; the sibling
 * scan generalizes the previous implicit "one outreach per lead" assumption
 * instead of bypassing it.
 */
export function isDuplicateSendBlocked(input: {
  outreach: Pick<OutreachRow, "id" | "lead_id" | "kind" | "status">;
  siblings: Array<Pick<OutreachRow, "id" | "lead_id" | "kind" | "status">>;
}): { blocked: boolean; reason: string } {
  if (input.outreach.status === "sent") {
    return { blocked: true, reason: "This outreach has already been sent." };
  }
  const kind: OutreachKind = toOutreachKind(input.outreach.kind);
  const duplicate = input.siblings.find(
    (row) =>
      row.id !== input.outreach.id &&
      row.lead_id === input.outreach.lead_id &&
      toOutreachKind(row.kind) === kind &&
      row.status === "sent",
  );
  if (duplicate) {
    return {
      blocked: true,
      reason: `A ${kind === "follow_up" ? "payment follow-up" : "cold outreach"} email has already been sent to this lead.`,
    };
  }
  return { blocked: false, reason: "No completed send recorded for this lead and outreach kind." };
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

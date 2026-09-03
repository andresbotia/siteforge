import { createHash } from "node:crypto";
import type { OutreachKind } from "./kinds";

export function computeOutreachContentHash(input: {
  subject: string;
  body: string;
  recipient: string;
  previewDeploymentId?: string | null;
  attributionTokenHash?: string | null;
}): string {
  const normalized = [
    input.subject.trim(),
    input.body.trim(),
    input.recipient.trim().toLowerCase(),
    (input.previewDeploymentId ?? "").trim(),
    (input.attributionTokenHash ?? "").trim(),
  ].join("\n---\n");

  return createHash("sha256").update(normalized).digest("hex");
}

export function verifyOutreachContentHash(
  input: {
    subject: string;
    body: string;
    recipient: string;
    previewDeploymentId?: string | null;
    attributionTokenHash?: string | null;
  },
  expectedHash: string | null | undefined,
): boolean {
  if (!expectedHash) return false;
  const computed = computeOutreachContentHash(input);
  return computed === expectedHash;
}

const FOLLOW_UP_HASH_DOMAIN = "outreach-follow-up.v1";

/**
 * M9.9 binding hash for the payment follow-up email.
 *
 * The cold email binds recipient + subject + body + preview deployment +
 * sfo_ attribution token. A follow-up binds recipient + subject + body +
 * commercial offer + sfb_ purchase token hash instead -- the preview and
 * attribution bindings are meaningless for it, and a follow-up must not be
 * approvable without naming the exact offer and the exact purchase link it
 * will carry.
 *
 * A domain-separator line is prepended so a follow-up hash can never collide
 * with a cold-email hash, and so the two kinds can never be swapped past an
 * approval that was granted for the other one.
 */
export function computeFollowUpContentHash(input: {
  subject: string;
  body: string;
  recipient: string;
  commercialOfferId: string;
  purchaseTokenHash: string;
}): string {
  const normalized = [
    FOLLOW_UP_HASH_DOMAIN,
    input.subject.trim(),
    input.body.trim(),
    input.recipient.trim().toLowerCase(),
    input.commercialOfferId.trim(),
    input.purchaseTokenHash.trim(),
  ].join("\n---\n");

  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Kind-aware entry point used by every caller that has an outreach row in
 * hand. `cold_outreach` delegates byte-for-byte to the pre-M9.9 function so
 * hashes already stored on existing rows (and inside already-granted
 * approvals) stay valid.
 */
export function computeOutreachBindingHash(input: {
  kind: OutreachKind;
  subject: string;
  body: string;
  recipient: string;
  previewDeploymentId?: string | null;
  attributionTokenHash?: string | null;
  commercialOfferId?: string | null;
  purchaseTokenHash?: string | null;
}): string {
  if (input.kind === "follow_up") {
    return computeFollowUpContentHash({
      subject: input.subject,
      body: input.body,
      recipient: input.recipient,
      commercialOfferId: input.commercialOfferId ?? "",
      purchaseTokenHash: input.purchaseTokenHash ?? "",
    });
  }
  return computeOutreachContentHash(input);
}

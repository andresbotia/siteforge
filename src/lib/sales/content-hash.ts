import { createHash } from "node:crypto";

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

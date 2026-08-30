import { createHash, createHmac } from "node:crypto";

export const OUTREACH_TOKEN_PREFIX = "sfo_";
const TOKEN_VERSION = "sales-outreach-token.v1";

export type OutreachAttributionToken = {
  token: string;
  hash: string;
  hint: string;
};

function canonicalTokenTimestamp(createdAt: string): string {
  const timestamp = new Date(createdAt);
  if (Number.isNaN(timestamp.getTime())) return createdAt;
  return timestamp.toISOString();
}

export function createOutreachAttributionToken(input: {
  outreachId: string;
  createdAt: string;
  secret: string;
}): OutreachAttributionToken {
  const createdAt = canonicalTokenTimestamp(input.createdAt);
  const body = createHmac("sha256", input.secret)
    .update([TOKEN_VERSION, input.outreachId, createdAt].join("|"))
    .digest("base64url");
  const token = `${OUTREACH_TOKEN_PREFIX}${body}`;
  return {
    token,
    hash: hashOutreachAttributionToken(token),
    hint: token.slice(-8),
  };
}

export function hashOutreachAttributionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isOutreachAttributionToken(value: string): boolean {
  if (!value.startsWith(OUTREACH_TOKEN_PREFIX)) return false;
  return /^[A-Za-z0-9_-]{40,60}$/.test(value.slice(OUTREACH_TOKEN_PREFIX.length));
}

export function renderOutreachBody(input: {
  bodyTemplate: string;
  publicPath: string;
}): string {
  return input.bodyTemplate.replaceAll("{{OUTREACH_PREVIEW_LINK}}", input.publicPath);
}

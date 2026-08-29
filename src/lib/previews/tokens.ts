import { createHash, randomBytes } from "node:crypto";

export const PREVIEW_TOKEN_PREFIX = "sfp_";
const TOKEN_BYTES = 32;
const HASH_ALGORITHM = "sha256";

export type PreviewToken = {
  token: string;
  hash: string;
  hint: string;
};

export function createPreviewToken(): PreviewToken {
  const token = `${PREVIEW_TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
  return {
    token,
    hash: hashPreviewToken(token),
    hint: token.slice(-8),
  };
}

export function hashPreviewToken(token: string): string {
  return createHash(HASH_ALGORITHM).update(token).digest("hex");
}

export function isPreviewToken(value: string): boolean {
  if (!value.startsWith(PREVIEW_TOKEN_PREFIX)) return false;
  const body = value.slice(PREVIEW_TOKEN_PREFIX.length);
  return /^[A-Za-z0-9_-]{40,60}$/.test(body);
}

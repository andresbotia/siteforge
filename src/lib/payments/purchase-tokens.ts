import { createHash, randomBytes } from "node:crypto";

/**
 * Opaque public purchase-link tokens, mirroring
 * src/lib/previews/tokens.ts's hash+hint philosophy exactly: only a SHA-256
 * hash and an 8-char hint are ever persisted (commercial_offers columns
 * added by 20260901030000_commercial_offer_purchase_links.sql); the raw
 * token is shown to the admin once, at publish time, and is not
 * recoverable afterward. A distinct prefix (sfb_ -- "SiteForge Buy") keeps
 * purchase tokens visually and structurally separate from M7 preview
 * tokens (sfp_) and M8 outreach tokens (sfo_), consistent with this
 * repo's existing rule that separate token namespaces must never be
 * reconstructed from one another.
 */
export const PURCHASE_TOKEN_PREFIX = "sfb_";
const TOKEN_BYTES = 32;
const HASH_ALGORITHM = "sha256";

export type PurchaseToken = {
  token: string;
  hash: string;
  hint: string;
};

export function createPurchaseToken(): PurchaseToken {
  const token = `${PURCHASE_TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
  return {
    token,
    hash: hashPurchaseToken(token),
    hint: token.slice(-8),
  };
}

export function hashPurchaseToken(token: string): string {
  return createHash(HASH_ALGORITHM).update(token).digest("hex");
}

export function isPurchaseToken(value: string): boolean {
  if (!value.startsWith(PURCHASE_TOKEN_PREFIX)) return false;
  const body = value.slice(PURCHASE_TOKEN_PREFIX.length);
  return /^[A-Za-z0-9_-]{40,60}$/.test(body);
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPurchaseToken, hashPurchaseToken, isPurchaseToken, PURCHASE_TOKEN_PREFIX } from "./purchase-tokens";

describe("purchase tokens", () => {
  it("uses a distinct prefix from preview (sfp_) and outreach (sfo_) tokens", () => {
    assert.equal(PURCHASE_TOKEN_PREFIX, "sfb_");
  });

  it("creates a token whose hash is reproducible from the raw token alone", () => {
    const { token, hash } = createPurchaseToken();
    assert.equal(hashPurchaseToken(token), hash);
  });

  it("creates cryptographically distinct tokens on each call", () => {
    const a = createPurchaseToken();
    const b = createPurchaseToken();
    assert.notEqual(a.token, b.token);
    assert.notEqual(a.hash, b.hash);
  });

  it("hint is a short suffix of the token, safe to display without revealing the token", () => {
    const { token, hint } = createPurchaseToken();
    assert.equal(hint.length, 8);
    assert.ok(token.endsWith(hint));
    assert.ok(hint.length < token.length);
  });

  it("validates well-formed purchase tokens and rejects everything else", () => {
    const { token } = createPurchaseToken();
    assert.equal(isPurchaseToken(token), true);
    assert.equal(isPurchaseToken("sfp_" + token.slice(4)), false); // wrong prefix (preview token)
    assert.equal(isPurchaseToken("sfo_" + token.slice(4)), false); // wrong prefix (outreach token)
    assert.equal(isPurchaseToken("not-a-token"), false);
    assert.equal(isPurchaseToken(""), false);
    assert.equal(isPurchaseToken("sfb_short"), false);
  });
});

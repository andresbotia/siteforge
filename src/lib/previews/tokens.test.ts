import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createPreviewToken,
  hashPreviewToken,
  isPreviewToken,
  PREVIEW_TOKEN_PREFIX,
} from "./tokens";

describe("preview tokens", () => {
  it("creates a non-persistable token with a deterministic hash and hint", () => {
    const token = createPreviewToken();

    assert.equal(token.token.startsWith(PREVIEW_TOKEN_PREFIX), true);
    assert.equal(isPreviewToken(token.token), true);
    assert.equal(token.hash, hashPreviewToken(token.token));
    assert.equal(token.hash.length, 64);
    assert.equal(token.hint, token.token.slice(-8));
    assert.equal(token.hash.includes(token.token), false);
  });

  it("rejects malformed public preview tokens", () => {
    assert.equal(isPreviewToken("plain-token"), false);
    assert.equal(isPreviewToken(`${PREVIEW_TOKEN_PREFIX}short`), false);
    assert.equal(isPreviewToken(`${PREVIEW_TOKEN_PREFIX}<script>`), false);
  });
});

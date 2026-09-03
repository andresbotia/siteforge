import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSuggestedDomain } from "./suggested-domain";

describe("operator-supplied suggested domain", () => {
  it("accepts a bare domain and lowercases it", () => {
    assert.deepEqual(normalizeSuggestedDomain("  AtlanticDrain.com "), {
      ok: true,
      domain: "atlanticdrain.com",
    });
  });

  it("strips only a leading www.", () => {
    assert.deepEqual(normalizeSuggestedDomain("www.atlanticdrain.com"), {
      ok: true,
      domain: "atlanticdrain.com",
    });
    assert.deepEqual(normalizeSuggestedDomain("shop.atlanticdrain.com"), {
      ok: true,
      domain: "shop.atlanticdrain.com",
    });
  });

  it("treats an empty value as cleared, not as an error", () => {
    assert.deepEqual(normalizeSuggestedDomain(""), { ok: true, domain: null });
    assert.deepEqual(normalizeSuggestedDomain("   "), { ok: true, domain: null });
    assert.deepEqual(normalizeSuggestedDomain(null), { ok: true, domain: null });
  });

  it("rejects a URL, a path, a port, or anything with whitespace rather than silently cleaning it", () => {
    for (const value of [
      "https://atlanticdrain.com",
      "atlanticdrain.com/pricing",
      "atlanticdrain.com:443",
      "atlantic drain.com",
      "owner@atlanticdrain.com",
    ]) {
      assert.equal(normalizeSuggestedDomain(value).ok, false, `${value} must be rejected`);
    }
  });

  it("rejects malformed domains", () => {
    for (const value of ["atlanticdrain", ".com", "a..com", "-bad.com", "bad-.com", "x".repeat(300)]) {
      assert.equal(normalizeSuggestedDomain(value).ok, false, `${value} must be rejected`);
    }
  });
});

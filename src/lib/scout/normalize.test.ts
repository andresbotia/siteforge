import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  locationMatches,
  normalizeBusinessName,
  normalizeDomain,
  normalizePhone,
  parseLocation,
} from "./normalize";

describe("business normalization", () => {
  it("strips legal suffixes and punctuation", () => {
    assert.equal(
      normalizeBusinessName("Harborline Plumbing, LLC"),
      "harborline plumbing",
    );
    assert.equal(normalizeBusinessName("Oak & Frond Landscaping"), "oak and frond landscaping");
  });
});

describe("domain normalization", () => {
  it("drops scheme and www", () => {
    assert.equal(
      normalizeDomain("https://www.HarborlinePlumbing.example.test/path"),
      "harborlineplumbing.example.test",
    );
    assert.equal(normalizeDomain("atlanticdrain.example.test"), "atlanticdrain.example.test");
  });
});

describe("phone and location", () => {
  it("normalizes US phone numbers", () => {
    assert.equal(normalizePhone("(954) 555-0142"), "9545550142");
    assert.equal(normalizePhone("1-954-555-0142"), "9545550142");
  });

  it("parses city/state labels", () => {
    const parsed = parseLocation("Fort Lauderdale, FL");
    assert.equal(parsed.city, "Fort Lauderdale");
    assert.equal(parsed.state, "FL");
    assert.equal(
      locationMatches("Fort Lauderdale", "FL", parsed),
      true,
    );
  });
});

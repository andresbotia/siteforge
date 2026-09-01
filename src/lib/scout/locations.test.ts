import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveScoutLocation } from "./locations";

describe("scout location resolution (V1 static geography table)", () => {
  it("resolves Broward County by county name", () => {
    const result = resolveScoutLocation("Broward County, Florida");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.bounds.key, "broward_county_fl");
  });

  it("resolves a supported city regardless of ', FL' vs ', Florida' suffix", () => {
    const a = resolveScoutLocation("Fort Lauderdale, FL");
    const b = resolveScoutLocation("Fort Lauderdale, Florida");
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (a.ok && b.ok) assert.equal(a.bounds.key, b.bounds.key);
  });

  it("fails closed with the supported list for an unsupported location rather than guessing", () => {
    const result = resolveScoutLocation("Miami, FL");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.supportedLocations.includes("Broward County, FL"));
      assert.ok(result.supportedLocations.length > 0);
    }
  });
});

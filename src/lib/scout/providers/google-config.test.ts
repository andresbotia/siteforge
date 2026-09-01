import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getGooglePlacesConfigFromEnv, getGooglePlacesMonthlyCeiling, isGooglePlacesConfigured } from "./google-config";

describe("Google Places configuration", () => {
  it("is unconfigured when GOOGLE_PLACES_API_KEY is absent", () => {
    assert.equal(getGooglePlacesConfigFromEnv({}), null);
    assert.equal(isGooglePlacesConfigured({}), false);
  });

  it("is unconfigured when the key is only whitespace", () => {
    assert.equal(getGooglePlacesConfigFromEnv({ GOOGLE_PLACES_API_KEY: "   " }), null);
  });

  it("is configured when a non-empty key is present", () => {
    const config = getGooglePlacesConfigFromEnv({ GOOGLE_PLACES_API_KEY: "test-key-value" });
    assert.ok(config);
    assert.equal(config!.apiKey, "test-key-value");
    assert.equal(isGooglePlacesConfigured({ GOOGLE_PLACES_API_KEY: "test-key-value" }), true);
  });

  it("never reads or exposes a NEXT_PUBLIC_-prefixed variant", () => {
    assert.equal(getGooglePlacesConfigFromEnv({ NEXT_PUBLIC_GOOGLE_PLACES_API_KEY: "leaked" }), null);
  });

  it("falls back to the safe default monthly ceiling when unset or invalid", () => {
    assert.equal(getGooglePlacesMonthlyCeiling({}), 300);
    assert.equal(getGooglePlacesMonthlyCeiling({ GOOGLE_PLACES_MONTHLY_REQUEST_CEILING: "not-a-number" }), 300);
    assert.equal(getGooglePlacesMonthlyCeiling({ GOOGLE_PLACES_MONTHLY_REQUEST_CEILING: "-5" }), 300);
  });

  it("honors a valid operator-configured monthly ceiling override", () => {
    assert.equal(getGooglePlacesMonthlyCeiling({ GOOGLE_PLACES_MONTHLY_REQUEST_CEILING: "50" }), 50);
  });
});

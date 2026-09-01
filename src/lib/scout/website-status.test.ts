import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyWebsiteStatus } from "./website-status";
import type { InspectionResult, NormalizedBusiness } from "./types";

function business(overrides: Partial<NormalizedBusiness> = {}): NormalizedBusiness {
  return {
    name: "Test Co",
    categoryId: "landscapers",
    industry: "Landscaping",
    city: "Fort Lauderdale",
    state: "FL",
    source: "openstreetmap_overpass",
    normalizedName: "test co",
    normalizedDomain: null,
    normalizedPhone: null,
    ...overrides,
  };
}

const REACHABLE: InspectionResult = { reachable: true, finalUrl: "https://x.test", blockedReason: null, error: null, homepage: null, linkChecks: [], pagesFetched: 1 };
const UNREACHABLE: InspectionResult = { reachable: false, finalUrl: null, blockedReason: null, error: "timeout", homepage: null, linkChecks: [], pagesFetched: 0 };
const NO_WEBSITE: InspectionResult = { reachable: false, finalUrl: null, blockedReason: null, error: "no_website", homepage: null, linkChecks: [], pagesFetched: 0 };

describe("classifyWebsiteStatus", () => {
  it("is working_standalone_website when a listed site is actually reachable", () => {
    assert.equal(classifyWebsiteStatus(business({ websiteUrl: "https://x.test" }), REACHABLE), "working_standalone_website");
  });

  it("is website_unreachable when a listed site fails inspection, never silently downgraded to no-website", () => {
    assert.equal(classifyWebsiteStatus(business({ websiteUrl: "https://x.test" }), UNREACHABLE), "website_unreachable");
  });

  it("is social_or_directory_only when no website but a real social profile was sourced", () => {
    assert.equal(classifyWebsiteStatus(business({ instagramUrl: "https://www.instagram.com/testco" }), NO_WEBSITE), "social_or_directory_only");
    assert.equal(classifyWebsiteStatus(business({ facebookUrl: "https://www.facebook.com/testco" }), NO_WEBSITE), "social_or_directory_only");
  });

  it("is only no_standalone_website_unverified when the source truly gave nothing to go on", () => {
    assert.equal(classifyWebsiteStatus(business(), NO_WEBSITE), "no_standalone_website_unverified");
  });
});

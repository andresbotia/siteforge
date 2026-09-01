import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessContactability } from "./contactability";
import type { InspectionResult, NormalizedBusiness, PageSignals } from "./types";

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

function page(overrides: Partial<PageSignals> = {}): PageSignals {
  return {
    url: "https://x.test",
    status: 200,
    https: true,
    elapsedMs: 100,
    title: "Test",
    metaDescription: null,
    hasViewport: true,
    hasCanonical: false,
    canonicalHref: null,
    headingCount: 2,
    h1Count: 1,
    h1Texts: [],
    h2Count: 1,
    hasNav: true,
    hasPhoneLink: false,
    hasMailto: false,
    hasForm: false,
    hasContactCta: false,
    copyrightYear: null,
    menuLink: null,
    menuLooksLikePdf: false,
    reservationLink: null,
    orderLink: null,
    contactLink: null,
    servicesLink: null,
    aboutLink: null,
    mentionsMenu: false,
    mentionsReservations: false,
    mentionsOrdering: false,
    visibleTextLength: 500,
    hasHours: false,
    hasAddressOrLocation: false,
    hasServiceArea: false,
    mentionsEmergency: false,
    hasPlaceholderText: false,
    hasPlainPhoneText: false,
    looksMalformed: false,
    modernizationSignals: [],
    sameSiteHrefs: [],
    sameOriginHrefs: [],
    ...overrides,
  };
}

function inspection(homepage: PageSignals | null): InspectionResult {
  return { reachable: homepage !== null, finalUrl: homepage?.url ?? null, blockedReason: null, error: null, homepage, linkChecks: [], pagesFetched: homepage ? 1 : 0 };
}

describe("assessContactability", () => {
  it("is unverified with zero channels when nothing is sourced or observed", () => {
    const result = assessContactability(business(), inspection(null));
    assert.equal(result.verified, false);
    assert.equal(result.score, 0);
    assert.deepEqual(result.channels, []);
  });

  it("credits a directly-sourced phone number", () => {
    const result = assessContactability(business({ phone: "(954) 555-0100" }), inspection(null));
    assert.equal(result.verified, true);
    assert.ok(result.channels.some((channel) => channel.type === "phone"));
  });

  it("credits a tel: link actually found on the business's own site, not a guess", () => {
    const result = assessContactability(business(), inspection(page({ hasPhoneLink: true })));
    assert.ok(result.channels.some((channel) => channel.type === "phone" && channel.source === "website_inspection"));
  });

  it("never invents an email address -- only credits a sourced address or an observed mailto: link", () => {
    const noneFound = assessContactability(business(), inspection(page()));
    assert.ok(!noneFound.channels.some((channel) => channel.type === "email"));

    const sourced = assessContactability(business({ email: "owner@realbusiness.test" }), inspection(null));
    assert.ok(sourced.channels.some((channel) => channel.type === "email" && channel.value === "owner@realbusiness.test"));

    const observed = assessContactability(business(), inspection(page({ hasMailto: true })));
    assert.ok(observed.channels.some((channel) => channel.type === "email" && channel.source === "website_inspection"));
  });

  it("credits multiple real channels additively, capped at 100", () => {
    const result = assessContactability(
      business({ phone: "(954) 555-0100", email: "owner@realbusiness.test", instagramUrl: "https://www.instagram.com/testco", facebookUrl: "https://www.facebook.com/testco" }),
      inspection(page({ hasForm: true })),
    );
    assert.equal(result.channels.length, 5);
    assert.ok(result.score <= 100);
  });
});

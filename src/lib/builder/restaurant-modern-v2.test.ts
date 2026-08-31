import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { DraftSite } from "@/components/builder/site/draft-site";
import { noStandaloneWebsiteSummary } from "@/lib/prospects/no-website";
import { validateVerifiedPublicFacts } from "@/lib/prospects/verified-public-facts";
import { buildGeneratedWebsiteInsert } from "./persist";
import { restaurantModernV2FixtureSpec } from "./restaurant-v2-fixture";
import { runBuilderPipeline } from "./run";
import { validateWebsiteSpec } from "./validate";
import type { BuilderAuditInput, BuilderLeadInput, WebsiteImageAsset, WebsiteSpec } from "./types";

function lead(overrides: Partial<BuilderLeadInput> = {}): BuilderLeadInput {
  return {
    id: "lead-restaurant-v2",
    businessName: "Mariposa Comedor",
    industry: "Restaurant",
    city: "Coconut Creek",
    state: "FL",
    address: "123 Sample Road, Coconut Creek, FL",
    phone: "(954) 555-0195",
    email: null,
    websiteUrl: null,
    rating: null,
    reviewCount: 0,
    status: "qualified",
    inspectionSummary: noStandaloneWebsiteSummary(),
    ...overrides,
  };
}

function noWebsiteAudit(): BuilderAuditInput {
  return {
    id: null,
    overallScore: null,
    redesignOpportunityScore: null,
    findings: [],
    opportunityType: "new_website",
  };
}

function auditedWebsiteAudit(): BuilderAuditInput {
  return {
    id: "audit-restaurant-v2",
    overallScore: 42,
    redesignOpportunityScore: 78,
    findings: [{ code: "restaurant_menu_missing", title: "Menu missing" }],
    opportunityType: "redesign",
  };
}

function approvedImage(overrides: Partial<WebsiteImageAsset> = {}): WebsiteImageAsset {
  return {
    url: "/fixtures/restaurant/market-table.svg",
    alt: "Colorful restaurant table with plates",
    role: "hero",
    sourceType: "managed_asset",
    sourceUrl: null,
    rightsStatus: "approved",
    approvalStatus: "approved",
    attribution: null,
    ...overrides,
  };
}

function render(spec: WebsiteSpec = restaurantModernV2FixtureSpec): string {
  return renderToStaticMarkup(
    React.createElement(DraftSite, {
      spec,
      basePath: "/visual-qa/restaurant-v2",
    }),
  );
}

async function enrichedNoWebsiteResult() {
  const verified = await validateVerifiedPublicFacts(
    {
      sourceUrl: "https://public.example.test/mariposa-profile",
      description:
        "Salvadoran restaurant with pupusas, breakfast plates, soups, seafood, and casual counter-service dining.",
      cuisine: "Salvadoran restaurant",
      dailyHours: {
        monday: { value: "8:00 AM - 10:00 PM", closed: false },
        tuesday: { value: "8:00 AM - 10:00 PM", closed: false },
        wednesday: { value: "8:00 AM - 10:00 PM", closed: false },
        thursday: { value: "8:00 AM - 11:00 PM", closed: false },
        friday: { value: "8:00 AM - 11:00 PM", closed: false },
        saturday: { value: "8:00 AM - 11:00 PM", closed: false },
        sunday: { value: "", closed: true },
      },
      rating: "4.5",
      reviewCount: "295",
      socialProfiles: {
        instagram: "https://instagram.com/mariposa.comedor",
      },
      menuUrl: "https://public.example.test/mariposa-comedor-menu",
    },
    {
      verifiedAt: "2026-08-30T12:00:00.000Z",
      lookup: async () => ["93.184.216.34"],
    },
  );
  assert.equal(verified.ok, true);
  if (!verified.ok) throw new Error("verified facts failed");

  return runBuilderPipeline(
    lead({
      inspectionSummary: {
        ...noStandaloneWebsiteSummary(),
        verified_public_facts: verified.summary,
        approved_images: [
          approvedImage(),
          approvedImage({
            url: "/fixtures/restaurant/griddle.svg",
            alt: "Round masa cakes on a cooktop",
            role: "gallery",
          }),
          approvedImage({
            url: "/fixtures/restaurant/dining-room.svg",
            alt: "Warm small dining room",
            role: "gallery",
          }),
        ],
      },
    }),
    noWebsiteAudit(),
  );
}

describe("Restaurant Modern V2 data contract", () => {
  it("accepts approved local restaurant images and rejects unapproved or unsafe images", () => {
    const valid = {
      ...restaurantModernV2FixtureSpec,
      assets: { images: [approvedImage()] },
    };
    assert.equal(validateWebsiteSpec(valid).ok, true);

    const pending = {
      ...valid,
      assets: { images: [approvedImage({ approvalStatus: "pending" })] },
    };
    assert.equal(validateWebsiteSpec(pending).ok, false);

    const unsafe = {
      ...valid,
      assets: { images: [approvedImage({ url: "https://images.example.test/photo.jpg" })] },
    };
    assert.equal(validateWebsiteSpec(unsafe).ok, false);
  });

  it("preserves sourced manual public verification facts and approved image metadata", async () => {
    const result = await enrichedNoWebsiteResult();

    assert.equal(validateWebsiteSpec(result.spec).ok, true);
    assert.equal(result.spec.business.websiteUrl, null);
    assert.equal(result.spec.business.cuisine, "Salvadoran restaurant");
    assert.equal(result.spec.business.rating, 4.5);
    assert.equal(result.spec.business.reviewCount, 295);
    assert.equal(result.spec.business.ratingSource, "public");
    assert.equal(result.spec.business.dailyHours.length, 7);
    assert.equal(result.spec.business.socialProfiles[0]?.platform, "instagram");
    assert.deepEqual(result.spec.business.highlights, [
      "Salvadoran restaurant",
      "Pupusas",
      "Soups",
      "Seafood",
    ]);
    assert.equal(result.spec.assets?.images.length, 3);
    assert.ok(
      result.spec.provenance.some(
        (item) =>
          item.field === "description" &&
          item.provenance === "sourced" &&
          item.source ===
            "manual_public_verification:lead.inspection_summary.verified_public_facts.description",
      ),
    );
    assert.ok(
      result.spec.provenance.some(
        (item) =>
          item.field === "images" &&
          item.source === "manual_public_verification:lead.inspection_summary.approved_images",
      ),
    );
  });

  it("generates a new enriched no-website restaurant version without overwriting the prior draft", async () => {
    const result = await enrichedNoWebsiteResult();
    const prior = buildGeneratedWebsiteInsert({
      result,
      websiteId: "web-prior-internal",
      auditId: null,
      runId: "run-prior",
      beforeScore: null,
    });
    const next = buildGeneratedWebsiteInsert({
      result,
      websiteId: "web-enriched-next",
      auditId: null,
      runId: "run-enriched",
      beforeScore: null,
    });

    assert.notEqual(prior.id, next.id);
    assert.equal(prior.lead_id, next.lead_id);
    assert.equal(prior.status, "review_required");
    assert.equal(next.status, "review_required");
    assert.equal(next.source_audit_id, null);
    assert.equal(next.source_run_id, "run-enriched");
  });

  it("keeps the normal audited restaurant Builder path valid", () => {
    const result = runBuilderPipeline(
      lead({
        websiteUrl: "https://mariposa.example.test",
        rating: 4.2,
        reviewCount: 88,
        status: "audited",
        inspectionSummary: { reachable: true, has_cta: false, menu_link: "https://mariposa.example.test/menu" },
      }),
      auditedWebsiteAudit(),
    );

    assert.equal(result.template, "restaurant-modern");
    assert.equal(validateWebsiteSpec(result.spec).ok, true);
    assert.equal(result.nextStatus, "website_built");
  });
});

describe("Restaurant Modern V2 rendering", () => {
  it("renders the composition with sourced cuisine, location, hours, rating, and reviews", () => {
    const html = render();

    assert.match(html, /sf-restaurant-v2/);
    assert.match(html, /Mariposa Comedor/);
    assert.match(html, /Salvadoran restaurant/);
    assert.match(html, /Coconut Creek, FL/);
    assert.match(html, /Monday/);
    assert.match(html, /8:00 AM - 10:00 PM/);
    assert.match(html, /Sunday/);
    assert.match(html, /Closed/);
    assert.match(html, /4\.5/);
    assert.match(html, /295/);
    assert.match(html, /Public rating/);
    assert.doesNotMatch(html, /Google rating/);
    assert.match(html, /Get Directions/);
    assert.match(html, /destination=123%20Sample%20Road%2C%20Coconut%20Creek%2C%20FL/);
  });

  it("uses Google attribution only when the persisted rating source says Google", () => {
    const html = render({
      ...restaurantModernV2FixtureSpec,
      business: { ...restaurantModernV2FixtureSpec.business, ratingSource: "google" },
    });

    assert.match(html, /Google rating/);
    assert.doesNotMatch(html, /Public rating/);
  });

  it("renders approved images with alt text and a nonblank fallback when images are absent", () => {
    const imageHtml = render();
    assert.match(imageHtml, /src="\/fixtures\/restaurant\/market-table\.svg"/);
    assert.match(imageHtml, /alt="Colorful restaurant table with plates"/);

    const fallbackHtml = render({
      ...restaurantModernV2FixtureSpec,
      assets: { images: [] },
    });
    assert.match(fallbackHtml, /sf-hero-fallback/);
    assert.doesNotMatch(fallbackHtml, /h-24 rounded-2xl bg-white\/10/);
    assert.doesNotMatch(fallbackHtml, /sf-map-fallback/);
  });

  it("handles partial gallery image counts without dropping approved images", () => {
    for (const count of [1, 2, 3, 4]) {
      const images = [
        approvedImage({ role: "gallery", url: "/fixtures/restaurant/griddle.svg" }),
        approvedImage({ role: "gallery", url: "/fixtures/restaurant/dining-room.svg" }),
        approvedImage({ role: "gallery", url: "/fixtures/restaurant/plates.svg" }),
        approvedImage({ role: "gallery", url: "/fixtures/restaurant/market-table.svg" }),
      ].slice(0, count);
      const html = render({
        ...restaurantModernV2FixtureSpec,
        assets: { images },
      });
      assert.equal((html.match(/<img /g) ?? []).length, count);
    }
  });

  it("does not dump raw facts, fabricate testimonials, prices, dishes, or internal QA copy", () => {
    const html = render({
      ...restaurantModernV2FixtureSpec,
      business: {
        ...restaurantModernV2FixtureSpec.business,
        cuisine: "Restaurant",
        description: "Neighborhood restaurant with counter-service dining.",
        highlights: [],
      },
    });

    assert.doesNotMatch(html, /Rating:\s*4\.5|Review count:\s*295|Description:/i);
    assert.doesNotMatch(html, /testimonial|reviewer|family owned|award|fresh daily|best in|since 19/i);
    assert.doesNotMatch(html, /Pupusas|Soups|Seafood|Traditional dishes/);
    assert.doesNotMatch(html, /\$\d+/);
    assert.doesNotMatch(html, /SiteForge|provenance|manual_public_verification|This draft/i);
  });
});

describe("Restaurant Modern V2.1 legacy summary and structured fact handling", () => {
  const legacySummary =
    "Cuisine/category: Salvadoran restaurant Rating: 4.5 Review count: 295 Description: Salvadoran restaurant in Margate serving Salvadoran dishes including pupusas, soups, seafood and other traditional plates. Hours: Monday: 8:00 AM - 10:00 PM Tuesday: 8:00 AM - 10:00 PM Wednesday: 8:00 AM - 10:00 PM Thursday: 8:00 AM - 11:00 PM Friday: 8:00 AM - 11:00 PM Saturday: 8:00 AM - 11:00 PM Sunday: 8:00 AM - 11:00 PM";

  it("sanitizes the exact legacy combined-summary shape before visitor-facing output", () => {
    const result = runBuilderPipeline(
      lead({
        businessName: "Legacy Summary Restaurant",
        city: "Margate",
        state: "FL",
        address: "456 Sample Street, Margate, FL",
        phone: "(954) 555-0211",
        inspectionSummary: {
          ...noStandaloneWebsiteSummary(),
          public_description: legacySummary,
          cuisine: "Salvadoran restaurant",
          public_hours: "Monday-Sunday 8:00 AM - 10:00 PM",
        },
        rating: 4.5,
        reviewCount: 295,
      }),
      noWebsiteAudit(),
    );
    const html = render(result.spec);

    assert.doesNotMatch(html, /Cuisine\/category:|Rating:|Review count:|Description:|Hours:/);
    assert.match(html, /Salvadoran restaurant in Margate serving Salvadoran dishes including pupusas, soups, seafood and other traditional plates\./);
    assert.match(html, /Salvadoran restaurant/);
    assert.match(html, /4\.5/);
    assert.match(html, /295/);
    assert.match(html, /Monday/);
    assert.match(html, /8:00 AM - 10:00 PM/);
    assert.match(html, /456 Sample Street, Margate, FL/);
    assert.match(html, /\(954\) 555-0211/);
  });

  it("lets dedicated cuisine, rating, review count, and structured hours win over labels inside summary", async () => {
    const verified = await validateVerifiedPublicFacts(
      {
        description: legacySummary,
        cuisine: "Cafe",
        rating: "4.1",
        reviewCount: "12",
        dailyHours: {
          monday: { value: "9:00 AM - 5:00 PM", closed: false },
          tuesday: { value: "", closed: true },
        },
      },
      { lookup: async () => ["93.184.216.34"] },
    );
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    const result = runBuilderPipeline(
      lead({ inspectionSummary: { ...noStandaloneWebsiteSummary(), verified_public_facts: verified.summary } }),
      noWebsiteAudit(),
    );

    assert.equal(result.spec.business.description, "Salvadoran restaurant in Margate serving Salvadoran dishes including pupusas, soups, seafood and other traditional plates.");
    assert.equal(result.spec.business.cuisine, "Cafe");
    assert.equal(result.spec.business.rating, 4.1);
    assert.equal(result.spec.business.reviewCount, 12);
    assert.deepEqual(result.spec.business.dailyHours.map((row) => row.value), ["9:00 AM - 5:00 PM", "Closed"]);
    assert.doesNotMatch(JSON.stringify(result.spec), /Cuisine\/category:|Rating:|Review count:|Description:|Hours:/);
  });

  it("omits unknown structured facts and internal provenance language", () => {
    const result = runBuilderPipeline(
      lead({
        address: null,
        city: null,
        state: null,
        inspectionSummary: noStandaloneWebsiteSummary(),
        rating: null,
        reviewCount: 0,
        phone: null,
      }),
      noWebsiteAudit(),
    );
    const html = render(result.spec);

    assert.doesNotMatch(html, /Public rating|Public reviews|Hours|SiteForge|manual_public_verification|provenance/);
    assert.doesNotMatch(html, /Get Directions/);
  });
});

describe("Restaurant Modern V2.1 social, maps, and image safety", () => {
  it("renders verified social platforms and omits missing profiles cleanly", () => {
    const html = render();
    assert.match(html, /aria-label="Instagram"/);
    assert.match(html, /aria-label="Facebook"/);
    assert.match(html, /aria-label="YouTube"/);

    const empty = render({
      ...restaurantModernV2FixtureSpec,
      business: { ...restaurantModernV2FixtureSpec.business, socialProfiles: [] },
    });
    assert.doesNotMatch(empty, /aria-label="Instagram"|Follow/);
  });

  it("rejects mismatched, javascript, malformed, and unverified social profiles", () => {
    for (const url of ["https://evil.example/restaurant", "javascript:alert(1)", "not a url"]) {
      const bad = {
        ...restaurantModernV2FixtureSpec,
        business: {
          ...restaurantModernV2FixtureSpec.business,
          socialProfiles: [{ platform: "instagram", url, sourceUrl: null, verificationStatus: "operator_verified" }],
        },
      };
      assert.equal(validateWebsiteSpec(bad).ok, false);
    }
    const candidate = {
      ...restaurantModernV2FixtureSpec,
      business: {
        ...restaurantModernV2FixtureSpec.business,
        socialProfiles: [{
          platform: "instagram",
          url: "https://instagram.com/candidate",
          sourceUrl: null,
          verificationStatus: "candidate",
        }],
      },
    };
    assert.equal(validateWebsiteSpec(candidate).ok, false);
  });

  it("validates Google directions and blocks malicious address markup", () => {
    const html = render();
    assert.match(html, /https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=123%20Sample%20Road%2C%20Coconut%20Creek%2C%20FL/);
    assert.doesNotMatch(html, /<iframe|sf-map-fallback|dangerouslySetInnerHTML/);

    const bad = {
      ...restaurantModernV2FixtureSpec,
      business: { ...restaurantModernV2FixtureSpec.business, address: "123 Sample <script>alert(1)</script>" },
    };
    assert.equal(validateWebsiteSpec(bad).ok, false);
  });

  it("keeps image rights, role selection, and provenance fail-closed", async () => {
    assert.equal(validateWebsiteSpec({ ...restaurantModernV2FixtureSpec, assets: { images: [approvedImage({ rightsStatus: "unknown" })] } }).ok, false);
    assert.equal(validateWebsiteSpec({ ...restaurantModernV2FixtureSpec, assets: { images: [approvedImage({ approvalStatus: "pending" })] } }).ok, false);
    assert.equal(validateWebsiteSpec({ ...restaurantModernV2FixtureSpec, assets: { images: [approvedImage({ url: "http://127.0.0.1/photo.svg" })] } }).ok, false);

    const result = await enrichedNoWebsiteResult();
    assert.equal(result.spec.assets?.images[0]?.role, "hero");
    assert.ok(result.spec.provenance.some((item) => item.field === "images"));
  });
});

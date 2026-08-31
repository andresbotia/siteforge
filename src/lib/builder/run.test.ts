import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolveMonotonicLeadStatus } from "../scout/status";
import { noStandaloneWebsiteSummary } from "../prospects/no-website";
import { validateVerifiedPublicFacts } from "../prospects/verified-public-facts";
import { BUILDER_SIDE_EFFECTS, builderPaidAiPath, denyDirectPaidAi } from "./policy";
import { buildBuilderToolCalls, buildGeneratedWebsiteInsert } from "./persist";
import { runBuilderPipeline } from "./run";
import { selectTemplate } from "./templates";
import { validateWebsiteSpec } from "./validate";
import type { BuilderAuditInput, BuilderLeadInput, WebsiteSpec } from "./types";

function lead(overrides: Partial<BuilderLeadInput> = {}): BuilderLeadInput {
  return {
    id: "lead-1",
    businessName: "Harborline Plumbing",
    industry: "Plumbing",
    city: "Fort Lauderdale",
    state: "FL",
    address: "1842 SE 17th Street",
    phone: "(954) 555-0142",
    email: "owner@harborlineplumbing.example.test",
    websiteUrl: "https://www.harborlineplumbing.example.test",
    rating: 4.8,
    reviewCount: 312,
    status: "audited",
    inspectionSummary: { reachable: true, has_cta: false },
    ...overrides,
  };
}

function audit(codes: string[] = ["missing_viewport", "missing_cta", "home_service_services_undiscoverable"]): BuilderAuditInput {
  return {
    id: "audit-1",
    overallScore: 38,
    redesignOpportunityScore: 80,
    findings: codes.map((code) => ({ code, title: code })),
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

function firstHome(spec: WebsiteSpec) {
  return spec.pages.find((page) => page.id === "home");
}

function sectionsOf(spec: WebsiteSpec, type: string) {
  return spec.pages.flatMap((page) => page.sections.filter((section) => section.type === type));
}

describe("template selection", () => {
  it("selects home-services-modern for a plumber", () => {
    assert.equal(selectTemplate("Plumbing"), "home-services-modern");
    const result = runBuilderPipeline(lead(), audit());
    assert.equal(result.template, "home-services-modern");
  });

  it("selects restaurant-modern for a restaurant", () => {
    assert.equal(selectTemplate("Restaurant"), "restaurant-modern");
    const result = runBuilderPipeline(
      lead({ businessName: "Mangrove Table", industry: "Restaurant", phone: "(954) 555-0444" }),
      audit(["restaurant_menu_missing"]),
    );
    assert.equal(result.template, "restaurant-modern");
  });

  it("uses professional-services-modern as a safe fallback", () => {
    assert.equal(selectTemplate("Dentistry"), "professional-services-modern");
    assert.equal(selectTemplate("Unknown Widgets"), "professional-services-modern");
    const result = runBuilderPipeline(lead({ industry: "Dentistry" }), audit());
    assert.equal(result.template, "professional-services-modern");
  });
});

describe("spec validation", () => {
  it("validates a generated spec", () => {
    const result = runBuilderPipeline(lead(), audit());
    const validated = validateWebsiteSpec(result.spec);
    assert.equal(validated.ok, true);
  });

  it("rejects an unknown template key", () => {
    const result = runBuilderPipeline(lead(), audit());
    const bad = { ...result.spec, template: "evil-template" };
    const validated = validateWebsiteSpec(bad);
    assert.equal(validated.ok, false);
    if (!validated.ok) assert.equal(validated.error, "unknown_template");
  });

  it("rejects arbitrary executable code in WebsiteSpec", () => {
    const result = runBuilderPipeline(lead(), audit());
    const bad = {
      ...result.spec,
      business: { ...result.spec.business, name: "Evil<script>alert(1)</script>" },
    };
    const validated = validateWebsiteSpec(bad);
    assert.equal(validated.ok, false);
  });
});

describe("factual integrity", () => {
  it("puts a known phone in the CTA", () => {
    const result = runBuilderPipeline(lead(), audit());
    const home = firstHome(result.spec);
    const blob = JSON.stringify(home);
    assert.match(blob, /954/);
    assert.ok(blob.includes("tel:"));
  });

  it("does not fabricate an absent phone", () => {
    const result = runBuilderPipeline(lead({ phone: null }), audit(["missing_cta"]));
    const blob = JSON.stringify(result.spec);
    assert.equal(/tel:/.test(blob), false);
    assert.equal(result.spec.business.phone, null);
  });

  it("includes a known location", () => {
    const result = runBuilderPipeline(lead(), audit(["weak_local_signals"]));
    assert.ok(JSON.stringify(result.spec).includes("Fort Lauderdale"));
  });

  it("does not fabricate an absent location", () => {
    const result = runBuilderPipeline(
      lead({ city: null, state: null, address: null }),
      audit(["weak_local_signals"]),
    );
    const areas = sectionsOf(result.spec, "serviceArea");
    assert.equal(areas.length, 0);
    assert.equal(result.spec.business.city, null);
  });

  it("shows emergency CTA only when emergency service is known", () => {
    const withEmergency = runBuilderPipeline(lead(), audit(["home_service_emergency_cta_missing"]));
    assert.ok(JSON.stringify(withEmergency.spec).includes("Emergency"));
    const without = runBuilderPipeline(lead(), audit(["missing_viewport"]));
    assert.equal(JSON.stringify(without.spec).includes("Emergency service"), false);
  });

  it("does not fabricate hours", () => {
    const result = runBuilderPipeline(lead(), audit(["restaurant_hours_missing"]));
    const hours = sectionsOf(result.spec, "hoursLocation") as Array<{ hours: string | null }>;
    assert.ok(hours.every((item) => item.hours === null));
  });

  it("does not invent review counts, ratings, or testimonials", () => {
    const result = runBuilderPipeline(lead({ rating: null, reviewCount: 0 }), audit());
    assert.equal(result.spec.business.rating, null);
    assert.equal(result.spec.business.reviewCount, null);
    assert.equal(
      result.spec.pages.some((page) =>
        page.sections.some((section) => section.type === "trust" && (section.rating || section.reviewCount)),
      ),
      false,
    );
    assert.equal(result.spec.provenance.some((item) => item.field === "testimonials" && item.provenance === "omitted"), true);
  });

  it("builds an explicit no-website prospect without fake audit scores or URL", () => {
    const result = runBuilderPipeline(
      lead({
        businessName: "No Website Pupuseria",
        industry: "Restaurant",
        websiteUrl: null,
        status: "qualified",
        email: null,
        rating: null,
        reviewCount: 0,
        inspectionSummary: noStandaloneWebsiteSummary(),
      }),
      noWebsiteAudit(),
    );
    const insert = buildGeneratedWebsiteInsert({
      result,
      websiteId: "web-no-site",
      auditId: null,
      runId: "run-no-site",
      beforeScore: null,
    });

    assert.equal(result.template, "restaurant-modern");
    assert.equal(result.spec.business.websiteUrl, null);
    assert.equal(insert.source_audit_id, null);
    assert.equal((insert.metadata as Record<string, unknown>).before_score, null);
    assert.ok(
      result.spec.provenance.some(
        (item) =>
          item.field === "websiteStatus" &&
          item.provenance === "sourced" &&
          item.source === "lead.inspection_summary.no_standalone_website",
      ),
    );
    assert.ok(
      result.spec.auditFixes.some(
        (item) => item.findingCode === "new_website_opportunity" && item.addressed,
      ),
    );
  });

  it("keeps no-website restaurant drafts within sourced and omitted facts", () => {
    const result = runBuilderPipeline(
      lead({
        businessName: "No Website Pupuseria",
        industry: "Restaurant",
        websiteUrl: null,
        phone: "(954) 555-0188",
        email: null,
        rating: null,
        reviewCount: 0,
        inspectionSummary: noStandaloneWebsiteSummary(),
      }),
      noWebsiteAudit(),
    );
    const blob = JSON.stringify(result.spec);

    assert.equal(/\$\d+|pupusa revuelta|award|since 19|Reserve a table|order online/i.test(blob), false);
    assert.ok(result.spec.provenance.some((item) => item.field === "hours" && item.provenance === "omitted"));
    assert.ok(result.spec.provenance.some((item) => item.field === "menuLink" && item.provenance === "omitted"));
    assert.ok(result.spec.provenance.some((item) => item.field === "email" && item.provenance === "omitted"));
    assert.equal(
      /This draft uses only sourced|Menu details will be confirmed|No dishes or prices were invented|not in the sourced lead data|does not submit forms|SiteForge/i.test(blob),
      false,
    );
  });

  it("generates a new version for an enriched no-website restaurant with an existing draft", async () => {
    const boundedDescription = (
      "Salvadoran restaurant with pupusas, breakfast plates, soups, and casual counter-service dining in Margate. "
    )
      .repeat(6)
      .slice(0, 500);
    const verified = await validateVerifiedPublicFacts(
      {
        sourceUrl: "https://public.example.test/antojitos-profile",
        description: boundedDescription,
        cuisine: "Salvadoran restaurant",
        hours: "Monday-Saturday 10 AM - 8 PM",
        rating: "4.5",
        reviewCount: "295",
        socialUrl: "https://social.example.test/antojitos",
        menuUrl: "https://public.example.test/antojitos-menu",
        orderUrl: "https://orders.example.test/antojitos",
      },
      {
        verifiedAt: "2026-08-30T12:00:00.000Z",
        lookup: async () => ["93.184.216.34"],
      },
    );
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    const normalizedDescription = verified.summary.facts.description;
    assert.ok(normalizedDescription);

    const result = runBuilderPipeline(
      lead({
        businessName: "Antojitos Test",
        industry: "Restaurant",
        city: "Margate",
        state: "FL",
        address: "123 Sample Road, Margate, FL",
        websiteUrl: null,
        email: null,
        rating: null,
        reviewCount: 0,
        inspectionSummary: {
          ...noStandaloneWebsiteSummary(),
          verified_public_facts: verified.summary,
        },
      }),
      noWebsiteAudit(),
    );
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
    const blob = JSON.stringify(result.spec);

    assert.equal(validateWebsiteSpec(result.spec).ok, true);
    assert.notEqual(prior.id, next.id);
    assert.equal(prior.lead_id, next.lead_id);
    assert.equal(prior.status, "review_required");
    assert.equal(next.status, "review_required");
    assert.equal(next.source_audit_id, null);
    assert.equal(next.source_run_id, "run-enriched");
    assert.equal(result.spec.business.websiteUrl, null);
    assert.equal(result.spec.business.cuisine, "Salvadoran restaurant");
    assert.equal(result.spec.business.rating, 4.5);
    assert.equal(result.spec.business.reviewCount, 295);
    assert.equal(result.spec.business.description, normalizedDescription);
    assert.ok(blob.includes(normalizedDescription.slice(0, 400)));
    assert.ok(blob.includes("Monday-Saturday 10 AM - 8 PM"));
    assert.ok(blob.includes("https://public.example.test/antojitos-menu"));
    assert.ok(blob.includes("https://orders.example.test/antojitos"));
    assert.ok(blob.includes("https://social.example.test/antojitos"));
    assert.equal(/\$\d+|family owned|award|fresh daily|since 19|best in/i.test(blob), false);
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
          item.field === "reviewCount" &&
          item.provenance === "sourced" &&
          item.source ===
            "manual_public_verification:lead.inspection_summary.verified_public_facts.reviewCount",
      ),
    );
  });
});

describe("restaurant CTAs and menu", () => {
  const resto = lead({
    businessName: "Mangrove Table",
    industry: "Restaurant",
    phone: "(954) 555-0444",
    inspectionSummary: { menu_link: "https://mangrovetable.example.test/menu" },
  });

  it("adds a reservation CTA only when reservations are offered", () => {
    const offered = runBuilderPipeline(
      resto,
      audit(["restaurant_reservation_broken"]),
    );
    assert.ok(JSON.stringify(offered.spec).includes("Reserve a table"));
    const notOffered = runBuilderPipeline(resto, audit(["restaurant_menu_missing"]));
    assert.equal(JSON.stringify(notOffered.spec).includes("Reserve a table"), false);
  });

  it("adds an ordering CTA only when ordering is offered", () => {
    const offered = runBuilderPipeline(resto, audit(["restaurant_order_broken"]));
    assert.ok(JSON.stringify(offered.spec).includes("\"kind\":\"order\""));
    const notOffered = runBuilderPipeline(resto, audit(["missing_viewport"]));
    assert.equal(JSON.stringify(notOffered.spec).includes("\"kind\":\"order\""), false);
  });

  it("handles a menu link without inventing menu items", () => {
    const result = runBuilderPipeline(resto, audit(["restaurant_menu_pdf"]));
    const blob = JSON.stringify(result.spec);
    assert.ok(blob.includes("mangrovetable.example.test/menu"));
    assert.equal(/\$\d+|appetizer|entree|prix/i.test(blob), false);
  });
});

describe("audit-driven fixes", () => {
  it("maps a missing CTA finding to a Builder fix", () => {
    const result = runBuilderPipeline(lead(), audit(["missing_cta"]));
    assert.ok(result.spec.auditFixes.some((item) => item.findingCode === "missing_cta" && item.addressed));
  });

  it("maps weak services navigation to a services fix", () => {
    const result = runBuilderPipeline(lead(), audit(["home_service_services_undiscoverable"]));
    assert.ok(result.spec.auditFixes.some((item) => item.findingCode === "home_service_services_undiscoverable"));
    assert.ok(result.spec.navigation.some((item) => item.id === "services"));
  });

  it("maps a restaurant menu problem to a menu fix", () => {
    const result = runBuilderPipeline(
      lead({ industry: "Restaurant", inspectionSummary: { menu_link: "https://resto.example.test/menu.pdf" } }),
      audit(["restaurant_menu_pdf"]),
    );
    assert.ok(result.spec.auditFixes.some((item) => item.findingCode === "restaurant_menu_pdf" && item.addressed));
  });

  it("maps a reservation problem only when reservations are offered", () => {
    const offered = runBuilderPipeline(
      lead({ industry: "Restaurant" }),
      audit(["restaurant_reservation_broken"]),
    );
    assert.ok(offered.spec.auditFixes.some((item) => item.findingCode === "restaurant_reservation_broken" && item.addressed));
  });

  it("builds an SEO title from known business, category, and location", () => {
    const result = runBuilderPipeline(lead(), audit(["missing_title"]));
    assert.match(result.spec.seo.title, /Harborline Plumbing/);
    assert.match(result.spec.seo.title, /Plumbing/);
    assert.match(result.spec.seo.title, /Fort Lauderdale/);
  });
});

describe("lead status and history", () => {
  it("may advance an audited lead to website_built", () => {
    const result = runBuilderPipeline(lead({ status: "audited" }), audit());
    assert.equal(result.nextStatus, "website_built");
  });

  it("keeps website_built as website_built", () => {
    const result = runBuilderPipeline(lead({ status: "website_built" }), audit());
    assert.equal(result.nextStatus, "website_built");
  });

  it("never regresses later pipeline statuses", () => {
    for (const status of ["approved", "contacted", "interested", "customer"]) {
      assert.equal(resolveMonotonicLeadStatus(status, "website_built"), status);
    }
  });

  it("rebuild inserts a new record rather than overwriting", () => {
    const result = runBuilderPipeline(lead(), audit());
    const first = buildGeneratedWebsiteInsert({
      result,
      websiteId: "web-1",
      auditId: "audit-1",
      runId: "run-1",
      beforeScore: 38,
    });
    const second = buildGeneratedWebsiteInsert({
      result,
      websiteId: "web-2",
      auditId: "audit-1",
      runId: "run-2",
      beforeScore: 38,
    });
    assert.equal("id" in first && first.id === "web-1", true);
    assert.notEqual(first.id, second.id);
    assert.equal(first.production_url, null);
    assert.equal(first.status, "review_required");
    assert.equal(second.source_run_id, "run-2");
  });
});

describe("builder cannot bypass paid-AI or create side effects", () => {
  it("records bounded tool-call summaries without page source", () => {
    const result = runBuilderPipeline(lead(), audit());
    const calls = buildBuilderToolCalls(result);
    assert.deepEqual(
      calls.map((item) => item.tool),
      ["validate", "select_template", "compose_spec", "map_audit_fixes", "persist"],
    );
    assert.equal(/<!doctype|<html/i.test(JSON.stringify(calls)), false);
  });

  it("does not require a live xAI call", () => {
    assert.equal(builderPaidAiPath(), "not_required");
    assert.equal(runBuilderPipeline(lead(), audit()).costUsd, 0);
    assert.throws(() => denyDirectPaidAi("executeApprovedAiRun"), /cannot call executeApprovedAiRun/);
  });

  it("cannot send email, deploy, charge, buy domains, or change DNS", () => {
    assert.equal(BUILDER_SIDE_EFFECTS.canSendEmail, false);
    assert.equal(BUILDER_SIDE_EFFECTS.canDeployProduction, false);
    assert.equal(BUILDER_SIDE_EFFECTS.canCharge, false);
    assert.equal(BUILDER_SIDE_EFFECTS.canBuyDomain, false);
    assert.equal(BUILDER_SIDE_EFFECTS.canChangeDns, false);
  });

  it("does not import paid-AI execution from Builder modules", () => {
    const sources = [
      "src/lib/builder/run.ts",
      "src/lib/builder/policy.ts",
      "src/lib/builder/spec.ts",
    ];
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      const importLines = text
        .split(/\r?\n/)
        .filter((line) => /^\s*import\b/.test(line))
        .join("\n");
      assert.equal(importLines.includes("@/lib/ai"), false, file);
      assert.equal(importLines.includes("createLiveXaiProvider"), false, file);
      assert.equal(importLines.includes("XAI_API_KEY"), false, file);
    }
  });
});

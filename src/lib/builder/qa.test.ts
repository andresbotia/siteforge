import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDesignBrief, designBriefRequestFromLead } from "./design-brief";
import { runTemplateQa } from "./qa";
import { runBuilderPipeline } from "./run";
import type { BuilderAuditInput, BuilderLeadInput, WebsiteSpec } from "./types";

function lead(overrides: Partial<BuilderLeadInput> = {}): BuilderLeadInput {
  return {
    id: "lead-qa",
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
    inspectionSummary: { reachable: true },
    ...overrides,
  };
}

function audit(): BuilderAuditInput {
  return { id: "audit-qa", overallScore: 40, redesignOpportunityScore: 72, findings: [] };
}

function specFor(overrides: Partial<BuilderLeadInput> = {}): WebsiteSpec {
  return runBuilderPipeline(lead(overrides), audit()).spec;
}

describe("template QA", () => {
  it("passes a fully sourced deterministic draft", () => {
    const report = runTemplateQa(specFor());
    assert.equal(report.blockers, 0, JSON.stringify(report.findings, null, 2));
    assert.equal(report.passed, true);
    assert.equal(report.templateId, "home-services-modern@2.0.0");
  });

  it("passes a restaurant draft", () => {
    const report = runTemplateQa(
      specFor({ businessName: "Antojitos Kitchen", industry: "Restaurant" }),
    );
    assert.equal(report.blockers, 0, JSON.stringify(report.findings, null, 2));
    assert.equal(report.templateId, "restaurant-modern@2.1.0");
  });

  it("passes a sparse lead with only a name, industry, and phone", () => {
    const report = runTemplateQa(
      specFor({
        city: null,
        state: null,
        address: null,
        email: null,
        websiteUrl: null,
        rating: null,
        reviewCount: 0,
        inspectionSummary: null,
      }),
    );
    assert.equal(report.blockers, 0, JSON.stringify(report.findings, null, 2));
  });

  it("flags a draft with no way to reach the business", () => {
    const report = runTemplateQa(
      specFor({ phone: null, email: null, rating: null, reviewCount: 0 }),
    );
    assert.ok(report.findings.some((finding) => finding.code === "no_contact_path"));
    assert.equal(report.passed, false);
  });

  it("blocks unsupported marketing claims", () => {
    const spec = specFor();
    const home = spec.pages.find((page) => page.id === "home");
    assert.ok(home);
    home.sections = home.sections.map((section) =>
      section.type === "about"
        ? { ...section, body: "Over 25 years in business. Licensed and insured. Free estimates!" }
        : section,
    );
    const report = runTemplateQa(spec);
    const codes = report.findings.map((finding) => finding.code);
    assert.ok(codes.includes("claim_experience"));
    assert.ok(codes.includes("claim_licensing"));
    assert.ok(codes.includes("claim_free"));
    assert.equal(report.passed, false);
  });

  it("blocks internal and placeholder language reaching prospect copy", () => {
    const spec = specFor();
    const home = spec.pages.find((page) => page.id === "home");
    assert.ok(home);
    home.sections = home.sections.map((section) =>
      section.type === "about" ? { ...section, body: "Lorem ipsum placeholder copy." } : section,
    );
    const report = runTemplateQa(spec);
    assert.ok(report.findings.some((finding) => finding.code === "leak_internal_term"));
  });

  it("blocks unsafe and broken CTA destinations", () => {
    const spec = specFor();
    const home = spec.pages.find((page) => page.id === "home");
    assert.ok(home);
    home.sections = home.sections.map((section) =>
      section.type === "hero"
        ? {
            ...section,
            ctas: [
              { kind: "contact" as const, label: "Click", href: "javascript:alert(1)" },
              { kind: "quote" as const, label: "Quote", href: "/nowhere" },
            ],
          }
        : section,
    );
    const report = runTemplateQa(spec);
    const codes = report.findings.map((finding) => finding.code);
    assert.ok(codes.includes("unsafe_cta_href"));
    assert.ok(codes.includes("broken_cta_target"));
  });

  it("rejects a spec whose template is not in the registry", () => {
    const spec = { ...specFor(), template: "evil-template" } as unknown as WebsiteSpec;
    const report = runTemplateQa(spec);
    assert.equal(report.passed, false);
    assert.equal(report.findings[0].code, "unknown_template");
  });

  it("notes a missing hero image without blocking the draft", () => {
    const report = runTemplateQa(specFor());
    const note = report.findings.find((finding) => finding.code === "no_hero_image");
    assert.ok(note);
    assert.equal(note.severity, "note");
  });
});

describe("designer brief", () => {
  it("declares a new master template is needed for an uncovered industry", () => {
    const brief = buildDesignBrief({ industry: "Artisanal Widget Foundry" });
    assert.equal(brief.newTemplateNeeded, true);
    assert.equal(brief.suggestedTemplateKey, "artisanal-widget-foundry-modern");
    assert.match(brief.markdown, /No existing SiteForge template covers this industry/);
  });

  it("does not demand a new template when one already covers the industry", () => {
    const brief = buildDesignBrief({ industry: "Plumbing" });
    assert.equal(brief.newTemplateNeeded, false);
    assert.equal(brief.suggestedTemplateKey, "home-services-modern");
  });

  it("carries the content, static-export, and imagery rules into the brief", () => {
    const brief = buildDesignBrief({ industry: "Bicycle Repair" });
    assert.match(brief.markdown, /dist\/index\.html/);
    assert.match(brief.markdown, /Do NOT invent/);
    assert.match(brief.markdown, /never scrape imagery/i);
    assert.match(brief.markdown, /4\.5:1/);
    assert.match(brief.markdown, /390px/);
  });

  it("is provider neutral", () => {
    const brief = buildDesignBrief({ industry: "Bicycle Repair" });
    assert.doesNotMatch(brief.markdown, /lovable|openai|anthropic|claude|xai|grok/i);
  });

  it("describes which facts a real lead is missing without inventing them", () => {
    const request = designBriefRequestFromLead(
      lead({ phone: null, rating: null, address: null }),
    );
    const brief = buildDesignBrief(request);
    assert.match(brief.markdown, /Facts NOT available: phone, street address, public rating/);
    assert.doesNotMatch(brief.markdown, /owner@harborlineplumbing/);
  });
});

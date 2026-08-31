import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createMockHttpClient, SafeFetchError } from "../http/fetch";
import { resolveMonotonicLeadStatus } from "../scout/status";
import { noStandaloneWebsiteSummary } from "../prospects/no-website";
import {
  AUDITOR_AI_ENRICHMENT,
  AUDITOR_SIDE_EFFECTS,
  auditorPaidAiPath,
  denyDirectPaidAi,
} from "./policy";
import { buildAuditorToolCalls, buildWebsiteAuditInsert } from "./persist";
import { runAuditorPipeline } from "./run";
import { AUDIT_SCORING, scoreAudit } from "./scoring";
import type { AuditFinding, AuditorLeadInput, CrawlResult } from "./types";
import { healthyHtml, healthyRestaurantHtml, poorHtml } from "./fixtures";

function lead(overrides: Partial<AuditorLeadInput> = {}): AuditorLeadInput {
  return {
    id: "lead-1",
    businessName: "Harborline Plumbing",
    industry: "Plumbing",
    city: "Fort Lauderdale",
    phone: "(954) 555-0142",
    websiteUrl: "https://site.example.test/",
    status: "qualified",
    ...overrides,
  };
}

const healthyPages = {
  "https://site.example.test/": { body: healthyHtml() },
  "https://site.example.test/services": {
    body: healthyHtml({ title: "Plumbing services in Fort Lauderdale" }),
  },
  "https://site.example.test/contact": {
    body: healthyHtml({ title: "Contact Harborline Plumbing" }),
  },
  "https://site.example.test/about": {
    body: healthyHtml({ title: "About Harborline Plumbing" }),
  },
};

function sitePages(
  home: string,
  extra: Record<string, { status?: number; body?: string }> = {},
  origin = "https://site.example.test",
) {
  return {
    [`${origin}/`]: { body: home },
    [`${origin}/services`]: {
      body: healthyHtml({ title: "Services | Local business" }),
    },
    [`${origin}/contact`]: {
      body: healthyHtml({ title: "Contact | Local business" }),
    },
    ...extra,
  };
}

function modernStrongLocalHtml(): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Harborline Plumbing | Fort Lauderdale plumbing services</title>
<meta name="description" content="Plumbing repair, water heaters, and emergency service in Fort Lauderdale.">
<link rel="canonical" href="https://site.example.test/">
</head><body>
<header><nav><a href="/services">Services</a><a href="/contact">Contact</a><a href="/about">About</a></nav></header>
<main>
<h1>Fort Lauderdale plumbing services</h1>
<h2>Emergency plumbing and water heaters</h2>
<p>We serve Fort Lauderdale, Pompano Beach, and nearby Broward County homes. Licensed local plumbing team at 1842 SE 17th Street with same-day repair options.</p>
<p>Call <a href="tel:9545550142">(954) 555-0142</a> or <a href="/contact">request a quote</a>.</p>
<form><input name="name"><button>Request a quote</button></form>
</main><footer>Copyright 2026 Harborline Plumbing</footer>
</body></html>`;
}

function legacyHealthyLocalHtml(): string {
  const style = 'style="font-family:Arial;color:#333;margin:0;padding:4px;background:#fff"';
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width">
<meta name="generator" content="Microsoft FrontPage 5.0">
<title>Harborline Plumbing | Fort Lauderdale plumbing services</title>
<meta name="description" content="Plumbing repair, water heaters, and emergency service in Fort Lauderdale.">
<link rel="canonical" href="https://site.example.test/default.aspx">
<script src="/Scripts/jquery-1.7.2.min.js"></script>
</head><body>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td>
<center><font face="Arial"><nav><a href="/services.aspx">Services</a><a href="/contact.aspx">Contact</a><a href="/about.aspx">About</a></nav></font></center>
<table><tr><td ${style}><h1>Fort Lauderdale plumbing services</h1></td></tr></table>
<table><tr><td ${style}><h2>Emergency plumbing and water heaters</h2></td></tr></table>
<p ${style}>We serve Fort Lauderdale, Pompano Beach, and nearby Broward County homes. Licensed local plumbing team at 1842 SE 17th Street with same-day repair options.</p>
<p ${style}>Call <a href="tel:9545550142">(954) 555-0142</a> or <a href="/contact.aspx">request a quote</a>.</p>
<form><input name="name"><button>Request a quote</button></form>
<p ${style}>Copyright 2016 Harborline Plumbing</p>
</td></tr></table>
</body></html>`;
}

function weakConversionHtml(): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width">
<title>Harborline Plumbing | Fort Lauderdale</title>
<meta name="description" content="Local plumbing service in Fort Lauderdale.">
<link rel="canonical" href="https://site.example.test/">
</head><body>
<nav><a href="/services">Services</a><a href="/about">About</a></nav>
<h1>Harborline Plumbing</h1>
<h2>Services</h2>
<p>Drain cleaning, leak repair, and water heaters for Fort Lauderdale. We serve Broward County homes and provide scheduled plumbing repairs.</p>
</body></html>`;
}

function modernWeakSeoContentHtml(): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width">
<title>AC</title>
<link rel="canonical" href="https://site.example.test/">
</head><body>
<main><nav><a href="/services">Services</a><a href="/contact">Contact</a></nav>
<p>Serving Fort Lauderdale. <a href="tel:9545550142">Call now</a>.</p>
<form><input name="name"><button>Contact</button></form>
</main></body></html>`;
}

function poorLegacyHtml(): string {
  return `<!doctype html><html><head>
<title></title>
<script>document.write("old");</script>
<script src="/Scripts/jquery-1.4.2.min.js"></script>
</head><body bgcolor="#ffffff">
<table cellpadding="0" cellspacing="0"><tr><td><font>Welcome</font></td></tr></table>
<table><tr><td><center><a href="/services.aspx">Services</a><a href="/contact.aspx">Contact</a></center></td></tr></table>
<p style="font-size:12px;color:#333;margin:0;padding:2px">Call 954-555-0199.</p>
<p>Copyright 2014 Sample Business</p>
</body></html>`;
}

const scoredCrawl: CrawlResult = {
  targetUrl: "https://site.example.test/",
  finalHomepageUrl: "https://site.example.test/",
  homepageOk: true,
  blockedReason: null,
  error: null,
  pages: [
    {
      url: "https://site.example.test/",
      kind: "home",
      status: 200,
      ok: true,
      elapsedMs: 120,
      truncated: false,
      https: true,
      isPdf: false,
      error: null,
      signals: null,
    },
  ],
  linkChecks: [],
  pagesFetched: 1,
  linkChecksPerformed: 0,
};

function auditFinding(
  overrides: Partial<AuditFinding> & Pick<AuditFinding, "category" | "code" | "severity">,
): AuditFinding {
  return {
    title: overrides.code,
    evidence: "test",
    affectedUrl: "https://site.example.test/",
    recommendation: "test",
    confidence: 0.95,
    ...overrides,
  };
}

function componentScore(
  result: Awaited<ReturnType<typeof runAuditorPipeline>>,
  label: string,
): number {
  return result.scores.redesignOpportunityBreakdown.components.find(
    (component) => component.label === label,
  )?.score ?? -1;
}

function restaurantPages(home: string, extra: Record<string, { status?: number; body?: string }> = {}) {
  return {
    "https://resto.example.test/": { body: home },
    "https://resto.example.test/menu": {
      body: `<html><head><title>Dinner menu | Resto</title><meta name="viewport" content="width=device-width"></head><body><h1>Menu</h1><p>Fort Lauderdale dinner hours 5pm-10pm.</p></body></html>`,
    },
    "https://resto.example.test/contact": {
      body: `<html><head><title>Contact Resto</title></head><body><h1>Contact</h1><a href="tel:9545550444">Call</a><p>100 Las Olas, Fort Lauderdale</p></body></html>`,
    },
    "https://resto.example.test/about": {
      body: `<html><head><title>About Resto</title></head><body><h1>About</h1></body></html>`,
    },
    ...extra,
  };
}

describe("healthy vs poor quality scores", () => {
  it("healthy website produces a high quality score", async () => {
    const result = await runAuditorPipeline(lead(), { http: createMockHttpClient(healthyPages) });
    assert.equal(result.paidAi, "not_required");
    assert.equal(result.costUsd, 0);
    assert.ok(result.scores.overallAuditScore >= 80, String(result.scores.overallAuditScore));
    assert.ok(result.scores.redesignOpportunityScore <= 25, String(result.scores.redesignOpportunityScore));
    assert.ok(!result.findings.some((item) => item.severity === "critical"));
  });

  it("poor website produces a lower quality score", async () => {
    const poor = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": { body: poorHtml() },
        "https://site.example.test/menu": { status: 404, body: "gone" },
        "https://site.example.test/contact": { status: 404, body: "gone" },
      }),
    });
    const healthy = await runAuditorPipeline(lead(), { http: createMockHttpClient(healthyPages) });
    assert.ok(poor.scores.overallAuditScore < healthy.scores.overallAuditScore);
    assert.ok(poor.scores.overallAuditScore < 70, String(poor.scores.overallAuditScore));
  });

  it("redesign opportunity increases as meaningful findings increase", async () => {
    const healthy = await runAuditorPipeline(lead(), { http: createMockHttpClient(healthyPages) });
    const poor = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": { body: poorHtml() },
        "https://site.example.test/contact": { status: 404, body: "gone" },
      }),
    });
    assert.ok(poor.findings.length > healthy.findings.length);
    assert.ok(poor.scores.redesignOpportunityScore > healthy.scores.redesignOpportunityScore);
  });

  it("does not inflate redesign opportunity for minor maintenance findings", () => {
    const scores = scoreAudit(
      [
        auditFinding({ category: "seo", code: "missing_canonical", severity: "low" }),
        auditFinding({ category: "ux", code: "stale_copyright", severity: "low" }),
        auditFinding({ category: "seo", code: "multiple_h1", severity: "low" }),
      ],
      scoredCrawl,
    );

    assert.ok(scores.overallAuditScore >= 95, String(scores.overallAuditScore));
    assert.ok(scores.redesignOpportunityScore <= 24, String(scores.redesignOpportunityScore));
  });

  it("can score redesign opportunity higher than health impact for conversion blockers", () => {
    const scores = scoreAudit(
      [
        auditFinding({ category: "ux", code: "missing_cta", severity: "high" }),
        auditFinding({
          category: "ux",
          code: "home_service_phone_cta_missing",
          severity: "high",
        }),
      ],
      scoredCrawl,
    );

    assert.ok(scores.overallAuditScore >= 85, String(scores.overallAuditScore));
    assert.ok(scores.redesignOpportunityScore >= 35, String(scores.redesignOpportunityScore));
  });
});

describe("opportunity differentiation profiles", () => {
  it("keeps a modern strong local-business site high-health and low-opportunity", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient(sitePages(modernStrongLocalHtml())),
    });

    assert.ok(result.scores.overallAuditScore >= 90, String(result.scores.overallAuditScore));
    assert.ok(result.scores.redesignOpportunityScore <= 20, String(result.scores.redesignOpportunityScore));
    assert.equal(componentScore(result, "Modernization") <= 10, true);
  });

  it("raises modernization opportunity for legacy structure without technical-health damage", async () => {
    const modern = await runAuditorPipeline(lead(), {
      http: createMockHttpClient(sitePages(modernStrongLocalHtml())),
    });
    const legacy = await runAuditorPipeline(
      lead({ websiteUrl: "https://site.example.test/default.aspx" }),
      {
        http: createMockHttpClient({
          "https://site.example.test/default.aspx": { body: legacyHealthyLocalHtml() },
          "https://site.example.test/services.aspx": { body: healthyHtml({ title: "Services" }) },
          "https://site.example.test/contact.aspx": { body: healthyHtml({ title: "Contact" }) },
          "https://site.example.test/about.aspx": { body: healthyHtml({ title: "About" }) },
        }),
      },
    );

    assert.ok(legacy.scores.technicalScore >= 90, String(legacy.scores.technicalScore));
    assert.ok(
      legacy.scores.redesignOpportunityScore >= modern.scores.redesignOpportunityScore + 10,
      `${legacy.scores.redesignOpportunityScore} vs ${modern.scores.redesignOpportunityScore}`,
    );
    assert.ok(componentScore(legacy, "Modernization") >= 40);
  });

  it("scores weak conversion combinations as moderate or high opportunity", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": { body: weakConversionHtml() },
        "https://site.example.test/services": { body: healthyHtml({ title: "Services" }) },
        "https://site.example.test/about": { body: healthyHtml({ title: "About" }) },
      }),
    });

    assert.ok(result.scores.redesignOpportunityScore >= 35, String(result.scores.redesignOpportunityScore));
    assert.ok(componentScore(result, "Conversion") >= 45);
  });

  it("attributes modern technical SEO/content weakness to content expansion", async () => {
    const result = await runAuditorPipeline(lead({ industry: "HVAC" }), {
      http: createMockHttpClient(sitePages(modernWeakSeoContentHtml())),
    });

    assert.ok(componentScore(result, "Content/SEO expansion") > componentScore(result, "Modernization"));
    assert.ok(componentScore(result, "Modernization") <= 10);
  });

  it("scores poor multi-dimensional sites as high redesign opportunity", async () => {
    const result = await runAuditorPipeline(
      lead({ websiteUrl: "https://site.example.test/index.aspx" }),
      {
        http: createMockHttpClient({
          "https://site.example.test/index.aspx": { body: poorLegacyHtml() },
          "https://site.example.test/services.aspx": { status: 404, body: "gone" },
          "https://site.example.test/contact.aspx": { status: 404, body: "gone" },
        }),
      },
    );

    assert.ok(result.scores.overallAuditScore < 70, String(result.scores.overallAuditScore));
    assert.ok(result.scores.redesignOpportunityScore >= 65, String(result.scores.redesignOpportunityScore));
  });

  it("keeps sparse unknown evidence away from unjustified extremes", () => {
    const scores = scoreAudit([], scoredCrawl);

    assert.ok(scores.redesignOpportunityScore >= 18, String(scores.redesignOpportunityScore));
    assert.ok(scores.redesignOpportunityScore <= 58, String(scores.redesignOpportunityScore));
    assert.ok(
      scores.redesignOpportunityBreakdown.components.some(
        (component) => component.unknownEvidence.length > 0,
      ),
    );
  });

  it("is deterministic and keeps all opportunity scores in bounds", async () => {
    const first = await runAuditorPipeline(
      lead({ websiteUrl: "https://site.example.test/default.aspx" }),
      {
        http: createMockHttpClient({
          "https://site.example.test/default.aspx": { body: legacyHealthyLocalHtml() },
          "https://site.example.test/services.aspx": { body: healthyHtml({ title: "Services" }) },
          "https://site.example.test/contact.aspx": { body: healthyHtml({ title: "Contact" }) },
          "https://site.example.test/about.aspx": { body: healthyHtml({ title: "About" }) },
        }),
      },
    );
    const second = await runAuditorPipeline(
      lead({ websiteUrl: "https://site.example.test/default.aspx" }),
      {
        http: createMockHttpClient({
          "https://site.example.test/default.aspx": { body: legacyHealthyLocalHtml() },
          "https://site.example.test/services.aspx": { body: healthyHtml({ title: "Services" }) },
          "https://site.example.test/contact.aspx": { body: healthyHtml({ title: "Contact" }) },
          "https://site.example.test/about.aspx": { body: healthyHtml({ title: "About" }) },
        }),
      },
    );

    assert.deepEqual(first.scores, second.scores);
    for (const component of first.scores.redesignOpportunityBreakdown.components) {
      assert.ok(component.score >= 0 && component.score <= 100, component.label);
    }
    assert.ok(first.scores.redesignOpportunityScore >= 0);
    assert.ok(first.scores.redesignOpportunityScore <= 100);
  });

  it("keeps opportunity independent from health", async () => {
    const legacy = await runAuditorPipeline(
      lead({ websiteUrl: "https://site.example.test/default.aspx" }),
      {
        http: createMockHttpClient({
          "https://site.example.test/default.aspx": { body: legacyHealthyLocalHtml() },
          "https://site.example.test/services.aspx": { body: healthyHtml({ title: "Services" }) },
          "https://site.example.test/contact.aspx": { body: healthyHtml({ title: "Contact" }) },
          "https://site.example.test/about.aspx": { body: healthyHtml({ title: "About" }) },
        }),
      },
    );
    const weakSeo = await runAuditorPipeline(lead({ industry: "HVAC" }), {
      http: createMockHttpClient(sitePages(modernWeakSeoContentHtml())),
    });

    assert.ok(Math.abs(legacy.scores.overallAuditScore - weakSeo.scores.overallAuditScore) <= 20);
    assert.notEqual(legacy.scores.redesignOpportunityScore, 100 - legacy.scores.overallAuditScore);
    assert.notEqual(weakSeo.scores.redesignOpportunityScore, 100 - weakSeo.scores.overallAuditScore);
  });

  it("distinguishes CTA, tel, contact, service-area, trust, and hierarchy combinations", async () => {
    const oneMissing = await runAuditorPipeline(lead(), {
      http: createMockHttpClient(sitePages(modernStrongLocalHtml().replace(/<form>[\s\S]*?<\/form>/, ""))),
    });
    const severalMissing = await runAuditorPipeline(lead({ city: "Boca Raton" }), {
      http: createMockHttpClient({
        "https://site.example.test/": {
          body: weakConversionHtml()
            .replaceAll("Fort Lauderdale", "South Florida")
            .replace("We serve Broward County homes and ", ""),
        },
        "https://site.example.test/services": {
          body: `<html><head><meta name="viewport" content="width=device-width"><title>Services</title></head><body><h1>Services</h1><p>Repairs and maintenance.</p></body></html>`,
        },
      }),
    });

    assert.ok(componentScore(severalMissing, "Conversion") > componentScore(oneMissing, "Conversion"));
    assert.ok(
      componentScore(severalMissing, "Local marketing") > componentScore(oneMissing, "Local marketing"),
    );
    assert.ok(severalMissing.scores.redesignOpportunityScore > oneMissing.scores.redesignOpportunityScore);
  });

  it("records scoring version and keeps persistence insert-only", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient(sitePages(modernStrongLocalHtml())),
    });
    const insert = buildWebsiteAuditInsert(result, "run-calibration", lead().websiteUrl);

    assert.equal(result.version, "auditor.v1");
    assert.equal("id" in insert, false);
    assert.equal(insert.source_run_id, "run-calibration");
    assert.equal(insert.redesign_opportunity_score, result.scores.redesignOpportunityScore);
  });
});

describe("core findings", () => {
  it("handles an unreachable homepage", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": { throwCode: "network" },
      }),
    });
    assert.equal(result.crawl.homepageOk, false);
    assert.ok(result.findings.some((item) => item.code === "homepage_unreachable"));
    assert.equal(result.scores.overallAuditScore, AUDIT_SCORING.unscoredCap);
    assert.ok(result.scores.redesignOpportunityScore >= 80);
  });

  it("handles a lead with no website", async () => {
    const result = await runAuditorPipeline(lead({ websiteUrl: null }), {
      http: createMockHttpClient({}),
    });
    assert.ok(result.findings.some((item) => item.code === "no_website"));
    assert.equal(result.scores.overallAuditScore, AUDIT_SCORING.unscoredCap);
  });

  it("does not run normal Auditor crawl for explicit no-website prospects", async () => {
    let fetches = 0;
    await assert.rejects(
      () =>
        runAuditorPipeline(
          lead({
            websiteUrl: null,
            inspectionSummary: noStandaloneWebsiteSummary(),
          }),
          {
            http: {
              async fetch() {
                fetches += 1;
                throw new Error("should_not_fetch");
              },
            },
          },
        ),
      /no_standalone_website_not_auditable/,
    );
    assert.equal(fetches, 0);
  });

  it("detects missing viewport", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": {
          body: `<html><head><title>Shop in Fort Lauderdale</title></head><body><h1>Hi</h1></body></html>`,
        },
      }),
    });
    assert.ok(result.findings.some((item) => item.code === "missing_viewport"));
  });

  it("detects missing title", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": {
          body: `<html><head><meta name="viewport" content="width=device-width"></head><body><h1>Hi</h1></body></html>`,
        },
      }),
    });
    assert.ok(result.findings.some((item) => item.code === "missing_title"));
  });

  it("detects missing meta description", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": {
          body: `<html><head><meta name="viewport" content="width=device-width"><title>Local plumber Fort Lauderdale</title></head><body><h1>Hi</h1></body></html>`,
        },
      }),
    });
    assert.ok(result.findings.some((item) => item.code === "missing_meta_description"));
  });

  it("detects missing H1", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": {
          body: `<html><head><meta name="viewport" content="width=device-width"><title>Local plumber Fort Lauderdale</title><meta name="description" content="Pipes"></head><body><p>Hello Fort Lauderdale</p></body></html>`,
        },
      }),
    });
    assert.ok(result.findings.some((item) => item.code === "missing_h1"));
  });

  it("detects a broken important link", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": {
          body: healthyHtml({ extra: "" }).replace('href="/contact"', 'href="/missing-contact"'),
        },
        "https://site.example.test/services": {
          body: healthyHtml({ title: "Services" }),
        },
        "https://site.example.test/about": {
          body: healthyHtml({ title: "About" }),
        },
        "https://site.example.test/missing-contact": { status: 404, body: "gone" },
      }),
    });
    assert.ok(
      result.findings.some(
        (item) => item.code === "broken_important_link" || item.code === "broken_cta",
      ),
      JSON.stringify(result.findings.map((item) => item.code)),
    );
  });

  it("detects a missing CTA", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": {
          body: `<html><head><meta name="viewport" content="width=device-width"><title>Local shop Fort Lauderdale</title><meta name="description" content="Hi"><link rel="canonical" href="https://site.example.test/"></head><body><h1>Shop</h1><p>We are in Fort Lauderdale on 100 Main Street and serve the city with lots of descriptive copy about our work every weekday from 8am to 5pm for customers who need help.</p></body></html>`,
        },
      }),
    });
    assert.ok(result.findings.some((item) => item.code === "missing_cta"));
  });

  it("detects a non-clickable phone signal", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": {
          body: `<html><head><meta name="viewport" content="width=device-width"><title>Plumber Fort Lauderdale</title><meta name="description" content="Pipes"></head><body><nav><a href="/">Home</a></nav><h1>Pipes</h1><p>Call 954-555-0142 in Fort Lauderdale. Request a quote today at our 100 Main Street shop. Hours 8am-5pm.</p></body></html>`,
        },
      }),
    });
    assert.ok(result.findings.some((item) => item.code === "phone_not_clickable"));
  });

  it("detects a stale copyright signal", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": {
          body: healthyHtml({ extra: "<p>© 2014 Harborline Plumbing</p>" }),
        },
        "https://site.example.test/services": {
          body: healthyHtml({ title: "Services" }),
        },
        "https://site.example.test/contact": {
          body: healthyHtml({ title: "Contact" }),
        },
        "https://site.example.test/about": {
          body: healthyHtml({ title: "About" }),
        },
      }),
    });
    assert.ok(result.findings.some((item) => item.code === "stale_copyright"));
  });

  it("detects duplicate titles across inspected pages", async () => {
    const same = healthyHtml({ title: "Same title everywhere" });
    const result = await runAuditorPipeline(lead(), {
      http: createMockHttpClient({
        "https://site.example.test/": { body: same },
        "https://site.example.test/services": { body: same },
        "https://site.example.test/contact": { body: same },
        "https://site.example.test/about": { body: same },
      }),
    });
    assert.ok(result.findings.some((item) => item.code === "duplicate_title"));
  });
});

describe("restaurant-specific auditing", () => {
  it("flags a restaurant missing a menu", async () => {
    const result = await runAuditorPipeline(
      lead({
        businessName: "Mangrove Table",
        industry: "Restaurant",
        websiteUrl: "https://resto.example.test/",
      }),
      {
        http: createMockHttpClient(
          restaurantPages(
            `<html><head><meta name="viewport" content="width=device-width"><title>Mangrove Table Fort Lauderdale</title><meta name="description" content="Dinner"></head><body><nav><a href="/contact">Contact</a></nav><h1>Mangrove Table</h1><p>Independent restaurant at 100 Las Olas, Fort Lauderdale. Hours 5pm-10pm. <a href="tel:9545550444">Call</a></p></body></html>`,
            {
              "https://resto.example.test/menu": { throwCode: "network" },
            },
          ),
        ),
      },
    );
    assert.ok(result.findings.some((item) => item.code === "restaurant_menu_missing"));
  });

  it("flags a restaurant PDF menu as an opportunity", async () => {
    const pdfHome = `<html><head><meta name="viewport" content="width=device-width"><title>Mangrove Table Fort Lauderdale</title><meta name="description" content="Dinner"><link rel="canonical" href="https://resto.example.test/"></head><body>
<nav><a href="/">Home</a><a href="/menu.pdf">Menu PDF</a><a href="/contact">Contact</a></nav>
<h1>Mangrove Table</h1>
<p>Located at 100 Las Olas Boulevard, Fort Lauderdale. Hours: Tuesday–Sunday 5pm–10pm.</p>
<p>Download our <a href="/menu.pdf">menu PDF</a> or <a href="tel:9545550444">call (954) 555-0444</a>.</p>
</body></html>`;
    const result = await runAuditorPipeline(
      lead({
        businessName: "Mangrove Table",
        industry: "Restaurant",
        websiteUrl: "https://resto.example.test/",
      }),
      {
        http: createMockHttpClient({
          "https://resto.example.test/": { body: pdfHome },
          "https://resto.example.test/menu.pdf": {
            status: 200,
            body: "%PDF-1.4 fake",
            contentType: "application/pdf",
          },
          "https://resto.example.test/contact": {
            body: `<html><head><title>Contact</title></head><body><h1>Contact</h1><a href="tel:9545550444">Call</a></body></html>`,
          },
        }),
      },
    );
    assert.ok(
      result.findings.some((item) => item.code === "restaurant_menu_pdf"),
      result.findings.map((item) => item.code).join(","),
    );
  });

  it("flags a broken reservation link when reservations are offered", async () => {
    const home = healthyRestaurantHtml()
      .replace("https://healthy-resto.example.test/", "https://resto.example.test/")
      .replace(
        "View our",
        'Reservations available. <a href="/reserve">Reserve a table</a> View our',
      );
    const result = await runAuditorPipeline(
      lead({
        businessName: "Mangrove Table",
        industry: "Restaurant",
        websiteUrl: "https://resto.example.test/",
      }),
      {
        http: createMockHttpClient(
          restaurantPages(home, {
            "https://resto.example.test/reserve": { status: 404, body: "gone" },
          }),
        ),
      },
    );
    assert.ok(result.findings.some((item) => item.code === "restaurant_reservation_broken"));
  });

  it("does not penalize a restaurant that does not offer reservations", async () => {
    const result = await runAuditorPipeline(
      lead({
        businessName: "Mangrove Table",
        industry: "Restaurant",
        websiteUrl: "https://resto.example.test/",
      }),
      { http: createMockHttpClient(restaurantPages(healthyRestaurantHtml().replaceAll("https://healthy-resto.example.test/", "https://resto.example.test/"))) },
    );
    assert.equal(
      result.findings.some((item) => /reservation/i.test(item.code)),
      false,
      result.findings.map((item) => item.code).join(","),
    );
  });

  it("does not penalize a restaurant that does not offer online ordering", async () => {
    const result = await runAuditorPipeline(
      lead({
        businessName: "Mangrove Table",
        industry: "Restaurant",
        websiteUrl: "https://resto.example.test/",
      }),
      { http: createMockHttpClient(restaurantPages(healthyRestaurantHtml().replaceAll("https://healthy-resto.example.test/", "https://resto.example.test/"))) },
    );
    assert.equal(result.findings.some((item) => /order/i.test(item.code)), false);
  });
});

describe("home-service auditing", () => {
  it("treats a home-service site with clear contact and service info as healthy", async () => {
    const result = await runAuditorPipeline(lead(), { http: createMockHttpClient(healthyPages) });
    assert.equal(result.findings.some((item) => item.code === "home_service_phone_cta_missing"), false);
    assert.equal(result.findings.some((item) => item.code === "home_service_services_undiscoverable"), false);
    assert.ok(result.scores.overallAuditScore >= 75);
  });
});

describe("lead status is monotonic after audit", () => {
  it("advances a qualified lead to audited", async () => {
    const result = await runAuditorPipeline(lead({ status: "qualified" }), {
      http: createMockHttpClient(healthyPages),
    });
    assert.equal(result.nextStatus, "audited");
  });

  it("keeps an already audited lead audited", async () => {
    const result = await runAuditorPipeline(lead({ status: "audited" }), {
      http: createMockHttpClient(healthyPages),
    });
    assert.equal(result.nextStatus, "audited");
  });

  it("does not regress later pipeline statuses", () => {
    for (const status of ["website_built", "approved", "contacted", "interested", "customer"]) {
      assert.equal(resolveMonotonicLeadStatus(status, "audited"), status);
    }
  });
});

describe("audit history and tool-call summaries", () => {
  it("builds a new audit insert rather than targeting an existing audit id", async () => {
    const result = await runAuditorPipeline(lead(), { http: createMockHttpClient(healthyPages) });
    const first = buildWebsiteAuditInsert(result, "run-1", lead().websiteUrl);
    const second = buildWebsiteAuditInsert(result, "run-2", lead().websiteUrl);
    assert.equal("id" in first, false);
    assert.equal(first.source_run_id, "run-1");
    assert.equal(second.source_run_id, "run-2");
    assert.notEqual(first.source_run_id, second.source_run_id);
  });

  it("records bounded inspect/score tool-call summaries without HTML", async () => {
    const result = await runAuditorPipeline(lead(), { http: createMockHttpClient(healthyPages) });
    const calls = buildAuditorToolCalls(result);
    assert.ok(calls.some((item) => item.tool === "inspect"));
    assert.ok(calls.some((item) => item.tool === "score"));
    const blob = JSON.stringify(calls);
    assert.equal(/<html/i.test(blob), false);
  });
});

describe("auditor cannot bypass paid-AI or create side effects", () => {
  it("does not require a live xAI call for a deterministic audit", () => {
    assert.equal(auditorPaidAiPath(), "not_required");
    assert.equal(AUDITOR_AI_ENRICHMENT.enabled, false);
    assert.throws(() => denyDirectPaidAi("executeApprovedAiRun"), /cannot call executeApprovedAiRun/);
  });

  it("cannot send email, deploy, or process payments", () => {
    assert.equal(AUDITOR_SIDE_EFFECTS.canSendEmail, false);
    assert.equal(AUDITOR_SIDE_EFFECTS.canDeploy, false);
    assert.equal(AUDITOR_SIDE_EFFECTS.canCharge, false);
    assert.equal(AUDITOR_SIDE_EFFECTS.canCallXaiDirectly, false);
  });

  it("does not import paid-AI execution from Auditor modules", () => {
    const sources = [
      "src/lib/auditor/run.ts",
      "src/lib/auditor/policy.ts",
      "src/lib/auditor/findings.ts",
      "src/lib/auditor/crawl.ts",
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

describe("timeout and size errors surface as unreachable", () => {
  it("handles request timeout", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: {
        async fetch() {
          throw new SafeFetchError("timeout", "timeout");
        },
      },
    });
    assert.equal(result.crawl.homepageOk, false);
    assert.equal(result.crawl.error, "timeout");
  });

  it("handles response-size cap", async () => {
    const result = await runAuditorPipeline(lead(), {
      http: {
        async fetch() {
          throw new SafeFetchError("size", "size");
        },
      },
    });
    assert.equal(result.crawl.error, "size");
  });
});

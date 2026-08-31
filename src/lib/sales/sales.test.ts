import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { MockEmailProvider } from "@/lib/email/mock";
import {
  createOutreachAttributionToken,
  hashOutreachAttributionToken,
  isOutreachAttributionToken,
  renderOutreachBody,
} from "@/lib/sales/attribution";
import {
  canAddToM95DFirstCampaign,
  M95D_FIRST_CAMPAIGN_ID,
  M95D_FIRST_CAMPAIGN_MAX_PROSPECTS,
} from "./campaign";
import { computeOutreachContentHash, verifyOutreachContentHash } from "./content-hash";
import { composeSalesDraft } from "./draft";
import { isLeadEligibleForSales } from "./eligibility";
import { SALES_COST_USD, SALES_VERSION } from "./limits";
import { buildOutreachInsert, buildSalesToolCalls } from "./persist";
import { assertNoSalesSideEffects, salesPaidAiPath } from "./policy";
import { runSalesPipeline } from "./run";
import type {
  SalesAuditInput,
  SalesLeadInput,
  SalesPreviewInput,
  SalesWebsiteInput,
} from "./types";

const mockLead: SalesLeadInput = {
  id: "lead-123",
  businessName: "Atlantic Drain Plumbing",
  industry: "Plumbing",
  city: "Fort Lauderdale",
  state: "FL",
  email: "contact@atlanticdrain.example.test",
  phone: "(954) 555-0144",
  websiteUrl: "https://atlanticdrain.example.test",
  status: "website_built",
};

const mockAudit: SalesAuditInput = {
  id: "audit-123",
  overallScore: 63,
  redesignOpportunityScore: 100,
  findings: [
    {
      code: "missing_call_cta",
      title: "Missing tap-to-call phone button on mobile viewport",
      category: "ux",
    },
    {
      code: "missing_local_schema",
      title: "No LocalBusiness structured data found",
      category: "seo",
    },
  ],
  issues: ["Missing emergency CTA", "Mobile menu overflow"],
};

const mockWebsite: SalesWebsiteInput = {
  id: "website-123",
  template: "Home Services Modern",
  templateKey: "home-services-modern",
  auditFixes: [
    {
      findingCode: "missing_call_cta",
      addressed: true,
      builderAction: "Adds immediate click-to-call header and emergency banner",
    },
    {
      findingCode: "missing_local_schema",
      addressed: true,
      builderAction: "Embeds LocalBusiness JSON-LD schema",
    },
  ],
};

const mockPreview: SalesPreviewInput = {
  id: "preview-123",
  tokenHint: "KY0rJhyc",
  status: "active",
  revokedAt: null,
  outreachPublicUrl: "/o/sfo_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO",
  attributionTokenHash:
    "9087a2d9de2a4a2a9c8ef2aca3f2688cdfa144931d6f00c7c791d3ba1ba79077",
  attributionTokenHint: "GHIJKLMNO",
};

describe("Sales Agent: eligibility", () => {
  test("accepts lead with valid website and active approved preview", () => {
    assert.equal(
      isLeadEligibleForSales(
        { status: "website_built" },
        { id: "site-1", status: "review_required" },
        { id: "prev-1", status: "active", revokedAt: null },
      ),
      true,
    );
  });

  test("rejects lead without website", () => {
    assert.equal(
      isLeadEligibleForSales(
        { status: "audited" },
        null,
        { id: "prev-1", status: "active", revokedAt: null },
      ),
      false,
    );
  });

  test("rejects lead without preview deployment", () => {
    assert.equal(
      isLeadEligibleForSales(
        { status: "website_built" },
        { id: "site-1", status: "review_required" },
        null,
      ),
      false,
    );
  });

  test("rejects lead with revoked preview deployment", () => {
    assert.equal(
      isLeadEligibleForSales(
        { status: "website_built" },
        { id: "site-1", status: "review_required" },
        { id: "prev-1", status: "revoked", revokedAt: new Date().toISOString() },
      ),
      false,
    );
  });

  test("rejects lead in rejected status", () => {
    assert.equal(
      isLeadEligibleForSales(
        { status: "rejected" },
        { id: "site-1", status: "review_required" },
        { id: "prev-1", status: "active", revokedAt: null },
      ),
      false,
    );
  });
});

describe("Sales Agent: deterministic $0 drafting & factual integrity", () => {
  test("generates personalized draft referencing audit and builder fixes", () => {
    const draft = composeSalesDraft(mockLead, mockAudit, mockWebsite, mockPreview);

    assert.equal(draft.subject, "Quick website concept for Atlantic Drain Plumbing");
    assert.match(draft.body, /Hi Atlantic Drain Plumbing team,/);
    assert.match(draft.body, /missing tap-to-call phone button/i);
    assert.match(draft.body, /adds immediate click-to-call header/i);
    assert.match(draft.body, /\{\{OUTREACH_PREVIEW_LINK\}\}/);
    assert.doesNotMatch(draft.body, /\/p\/KY0rJhyc/);
    assert.equal(draft.recipientEmail, "contact@atlanticdrain.example.test");
    assert.ok(draft.contentHash.length === 64);
    assert.ok(draft.evidence.length >= 3);
  });

  test("does not invent contact names or unsupported claims", () => {
    const draft = composeSalesDraft(mockLead, mockAudit, mockWebsite, mockPreview);

    // Should use safe team greeting rather than hallucinated owner name
    assert.match(draft.body, /Hi Atlantic Drain Plumbing team,/);
    assert.doesNotMatch(draft.body, /CEO/);
    assert.doesNotMatch(draft.body, /President/);
    assert.doesNotMatch(draft.body, /Award-winning/);
    assert.doesNotMatch(draft.body, /5-star guarantee/);
  });

  test("handles lead without email on file as non-sendable draft", () => {
    const leadNoEmail = { ...mockLead, email: null };
    const draft = composeSalesDraft(leadNoEmail, mockAudit, mockWebsite, mockPreview);

    assert.equal(draft.recipientEmail, "");
    assert.ok(draft.body.length > 0);
  });

  test("frames no-website prospects as standalone web presence, not redesign audit", () => {
    const draft = composeSalesDraft(
      {
        ...mockLead,
        websiteUrl: null,
        websiteStatus: "no_standalone_website",
      },
      {
        id: null,
        overallScore: null,
        redesignOpportunityScore: null,
        findings: [],
        issues: [],
        opportunityType: "new_website",
      },
      {
        ...mockWebsite,
        auditFixes: [
          {
            findingCode: "new_website_opportunity",
            addressed: true,
            builderAction: "Creates a standalone mobile-first web presence",
          },
        ],
      },
      mockPreview,
    );

    assert.match(draft.body, /standalone website/i);
    assert.match(draft.body, /standalone site/i);
    assert.doesNotMatch(draft.body, /inspecting your current website/i);
    assert.doesNotMatch(draft.body, /audited your website/i);
    assert.doesNotMatch(draft.body, /current website is bad/i);
    assert.doesNotMatch(draft.body, /redesign/i);
    assert.ok(draft.evidence.some((item) => item.type === "website_status"));
  });
});

describe("Sales Agent: content-hash & approval binding", () => {
  test("computes deterministic SHA-256 hash for identical input", () => {
    const input = {
      subject: "Test Subject",
      body: "Test Body",
      recipient: "test@example.com",
      previewDeploymentId: "prev-123",
    };
    const hash1 = computeOutreachContentHash(input);
    const hash2 = computeOutreachContentHash(input);
    assert.equal(hash1, hash2);
    assert.equal(verifyOutreachContentHash(input, hash1), true);
  });

  test("changing subject, body, or recipient invalidates the content hash", () => {
    const input = {
      subject: "Test Subject",
      body: "Test Body",
      recipient: "test@example.com",
      previewDeploymentId: "prev-123",
    };
    const originalHash = computeOutreachContentHash(input);

    assert.equal(
      verifyOutreachContentHash({ ...input, subject: "Modified Subject" }, originalHash),
      false,
    );
    assert.equal(
      verifyOutreachContentHash({ ...input, body: "Modified Body" }, originalHash),
      false,
    );
    assert.equal(
      verifyOutreachContentHash({ ...input, recipient: "other@example.com" }, originalHash),
      false,
    );
    assert.equal(
      verifyOutreachContentHash({ ...input, previewDeploymentId: "prev-999" }, originalHash),
      false,
    );
  });
});

describe("Sales Agent: pipeline execution & tool calls", () => {
  test("runs pipeline deterministically at $0 cost", () => {
    assertNoSalesSideEffects();
    assert.equal(salesPaidAiPath(), "not_required");

    const result = runSalesPipeline(mockLead, mockAudit, mockWebsite, mockPreview);

    assert.equal(result.version, SALES_VERSION);
    assert.equal(result.paidAi, "not_required");
    assert.equal(result.costUsd, SALES_COST_USD);
    assert.equal(result.leadId, mockLead.id);
    assert.equal(result.generatedWebsiteId, mockWebsite.id);
    assert.equal(result.previewDeploymentId, mockPreview.id);
  });

  test("builds structured tool calls and outreach insert for persistence", () => {
    const result = runSalesPipeline(mockLead, mockAudit, mockWebsite, mockPreview);
    const toolCalls = buildSalesToolCalls(result);

    assert.equal(toolCalls.length, 4);
    assert.equal(toolCalls[0].tool, "validate_evidence");
    assert.equal(toolCalls[1].tool, "compose_draft");
    assert.equal(toolCalls[2].tool, "content_hash");
    assert.equal(toolCalls[3].tool, "persist");

    const insert = buildOutreachInsert({
      result,
      outreachId: "outreach-999",
      runId: "run-999",
    });

    assert.equal(insert.id, "outreach-999");
    assert.equal(insert.lead_id, mockLead.id);
    assert.equal(insert.generated_website_id, mockWebsite.id);
    assert.equal(insert.preview_deployment_id, mockPreview.id);
    assert.equal(insert.agent_run_id, "run-999");
    assert.equal(insert.sales_run_id, "run-999");
    assert.equal(insert.status, "draft");
    assert.equal(insert.provider, "mock");
    assert.equal(insert.campaign_id, M95D_FIRST_CAMPAIGN_ID);
    assert.equal(insert.content_hash, result.draft.contentHash);
    assert.equal(insert.attribution_token_hash, result.draft.attributionTokenHash);
  });

  test("caps the first M9.5D campaign cohort at five manually selected prospects", () => {
    assert.equal(M95D_FIRST_CAMPAIGN_MAX_PROSPECTS, 5);
    assert.equal(canAddToM95DFirstCampaign(4), true);
    assert.equal(canAddToM95DFirstCampaign(5), false);
  });

  test("throws error when trying to run on ineligible lead", () => {
    const revokedPreview = { ...mockPreview, status: "revoked", revokedAt: "2026-08-30" };
    assert.throws(
      () => runSalesPipeline(mockLead, mockAudit, mockWebsite, revokedPreview),
      /ineligible_for_sales_outreach/,
    );
  });
});

describe("Sales Agent: outreach attribution tokens", () => {
  test("creates opaque public route tokens while persisting only hashes and hints", () => {
    const token = createOutreachAttributionToken({
      outreachId: "outreach-123",
      createdAt: "2026-08-30T10:00:00.000Z",
      secret: "test-secret-that-is-long-enough",
    });

    assert.equal(isOutreachAttributionToken(token.token), true);
    assert.equal(token.hash, hashOutreachAttributionToken(token.token));
    assert.equal(token.hash.includes(token.token), false);
    assert.equal(token.hint, token.token.slice(-8));
    assert.equal(token.token.startsWith("sfo_"), true);
  });

  test("normalizes attribution token timestamps before deriving the token", () => {
    const isoToken = createOutreachAttributionToken({
      outreachId: "outreach-123",
      createdAt: "2026-08-30T10:00:00.000Z",
      secret: "test-secret-that-is-long-enough",
    });
    const postgresToken = createOutreachAttributionToken({
      outreachId: "outreach-123",
      createdAt: "2026-08-30 10:00:00+00",
      secret: "test-secret-that-is-long-enough",
    });

    assert.equal(postgresToken.token, isoToken.token);
    assert.equal(postgresToken.hash, isoToken.hash);
  });

  test("does not accept an M7 token hint as an outreach attribution token", () => {
    assert.equal(isOutreachAttributionToken("KY0rJhyc"), false);
    assert.equal(isOutreachAttributionToken("sfp_KY0rJhyc"), false);
  });

  test("renders email body links transiently from the placeholder", () => {
    assert.equal(
      renderOutreachBody({
        bodyTemplate: "Preview: {{OUTREACH_PREVIEW_LINK}}",
        publicPath: "/o/sfo_exampleOpaqueToken123456789012345678901234567890",
      }),
      "Preview: /o/sfo_exampleOpaqueToken123456789012345678901234567890",
    );
  });
});

describe("Sales Agent: mock email provider", () => {
  const provider = new MockEmailProvider();

  test("simulates send successfully for valid email", async () => {
    const result = await provider.sendEmail({
      to: "owner@business.com",
      from: "outreach@siteforge.agency",
      subject: "Quick website pitch",
      text: "Email text body",
    });

    assert.equal(result.ok, true);
    assert.equal(result.provider, "mock");
    assert.equal(result.simulated, true);
    assert.match(result.messageId ?? "", /^msg_mock_/);
  });

  test("rejects send for invalid email address format", async () => {
    const result = await provider.sendEmail({
      to: "invalid-email-no-domain",
      from: "outreach@siteforge.agency",
      subject: "Quick website pitch",
      text: "Email text body",
    });

    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /invalid recipient email/i);
  });
});

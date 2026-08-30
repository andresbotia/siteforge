import type { Json } from "@/types/database";
import type { AuditorPipelineResult, InspectedUrlSummary } from "./types";

function inspectedUrlSummaries(result: AuditorPipelineResult): InspectedUrlSummary[] {
  return result.crawl.pages.map((page) => ({
    url: page.url,
    kind: page.kind,
    status: page.status,
    ok: page.ok,
  }));
}

export type WebsiteAuditInsert = {
  lead_id: string;
  website_url: string | null;
  overall_score: number;
  technical_score: number;
  seo_score: number;
  ux_score: number;
  content_score: number;
  redesign_opportunity_score: number;
  design_score: number;
  mobile_score: number;
  performance_score: number;
  conversion_score: number;
  issues: string[];
  recommendations: string[];
  summary: string;
  findings: Json;
  inspected_urls: Json;
  audit_version: string;
  source_run_id: string;
  pages_inspected: number;
};

export function buildWebsiteAuditInsert(
  result: AuditorPipelineResult,
  runId: string,
  websiteUrl: string | null,
): WebsiteAuditInsert {
  const viewportOk = !result.findings.some((item) => item.code === "missing_viewport");
  const slow = result.findings.some((item) => item.code === "slow_response");
  return {
    lead_id: result.leadId,
    website_url: websiteUrl,
    overall_score: result.scores.overallAuditScore,
    technical_score: result.scores.technicalScore,
    seo_score: result.scores.seoScore,
    ux_score: result.scores.uxScore,
    content_score: result.scores.contentScore,
    redesign_opportunity_score: result.scores.redesignOpportunityScore,
    design_score: result.scores.contentScore,
    mobile_score: viewportOk ? result.scores.technicalScore : Math.min(result.scores.technicalScore, 40),
    performance_score: slow ? Math.min(result.scores.technicalScore, 45) : result.scores.technicalScore,
    conversion_score: result.scores.uxScore,
    issues: result.issues,
    recommendations: result.recommendations,
    summary: result.summary,
    findings: result.findings.map((item) => ({
      category: item.category,
      code: item.code,
      title: item.title,
      severity: item.severity,
      evidence: item.evidence,
      affected_url: item.affectedUrl,
      recommendation: item.recommendation,
      confidence: item.confidence,
    })),
    inspected_urls: inspectedUrlSummaries(result),
    audit_version: result.version,
    source_run_id: runId,
    pages_inspected: result.crawl.pagesFetched,
  };
}

export function buildAuditorToolCalls(result: AuditorPipelineResult): Array<{
  tool: string;
  action: string;
  request: Json;
  response: Json;
}> {
  const counts = result.findings.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});
  return [
    {
      tool: "validate",
      action: "target_url",
      request: { lead_id: result.leadId },
      response: {
        website: result.crawl.targetUrl,
        blocked: result.crawl.blockedReason,
        error: result.crawl.error,
      },
    },
    {
      tool: "inspect",
      action: "bounded_crawl",
      request: { pages_cap: 6, redirect_cap: 4 },
      response: {
        pages_inspected: result.crawl.pagesFetched,
        urls: inspectedUrlSummaries(result).slice(0, 8),
        link_checks: result.crawl.linkChecksPerformed,
      },
    },
    {
      tool: "score",
      action: "deterministic_score",
      request: { paid_ai: "not_required" },
      response: {
        findings: result.findings.length,
        by_category: counts,
        technical: result.scores.technicalScore,
        seo: result.scores.seoScore,
        ux: result.scores.uxScore,
        content: result.scores.contentScore,
        website_health: result.scores.overallAuditScore,
        redesign_opportunity: result.scores.redesignOpportunityScore,
        redesign_opportunity_breakdown: result.scores.redesignOpportunityBreakdown,
        cost_usd: 0,
      },
    },
    {
      tool: "persist",
      action: "insert_website_audit",
      request: { lead_id: result.leadId, next_status: result.nextStatus },
      response: { immutable_history: true },
    },
  ];
}

import { AUDITOR_VERSION } from "./limits";
import type { AuditFinding, AuditScores, AuditSeverity, CrawlResult } from "./types";

/**
 * Quality scores: 100 = healthy / strong, 0 = severely deficient.
 * Redesign opportunity: 100 = strong SiteForge redesign candidate.
 *
 * Scores are reproducible from findings. An LLM must not author them.
 *
 * When the homepage cannot be inspected (no website / unreachable / blocked),
 * every category is capped at `unscoredCap` because quality cannot be shown.
 */
export const AUDIT_SCORING = {
  qualityStart: 100,
  categoryWeights: {
    technical: 0.28,
    seo: 0.26,
    ux: 0.26,
    content: 0.2,
  },
  qualityPenalty: {
    critical: 45,
    high: 18,
    medium: 10,
    low: 4,
    info: 0,
  } satisfies Record<AuditSeverity, number>,
  opportunityPoints: {
    critical: 45,
    high: 18,
    medium: 10,
    low: 4,
    info: 0,
  } satisfies Record<AuditSeverity, number>,
  unscoredCap: 12,
  unscoredOpportunity: 92,
  slowMs: 3_000,
  thinTextChars: 180,
  weakTitleChars: 8,
  staleCopyrightYears: 4,
  confidence: {
    structural: 0.95,
    heuristic: 0.75,
    industry: 0.85,
  },
} as const;

const SITE_UNAVAILABLE_CODES = new Set(["homepage_unreachable", "no_website"]);

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreAudit(findings: AuditFinding[], crawl: CrawlResult): AuditScores {
  const technicalScore = categoryScore(findings, "technical");
  const seoScore = categoryScore(findings, "seo");
  const uxScore = categoryScore(findings, "ux");
  const contentScore = categoryScore(findings, "content");

  let overall = clamp(
    technicalScore * AUDIT_SCORING.categoryWeights.technical +
      seoScore * AUDIT_SCORING.categoryWeights.seo +
      uxScore * AUDIT_SCORING.categoryWeights.ux +
      contentScore * AUDIT_SCORING.categoryWeights.content,
  );

  let opportunity = clamp(
    findings.reduce(
      (sum, finding) => sum + AUDIT_SCORING.opportunityPoints[finding.severity],
      0,
    ),
  );

  const unavailable = findings.some((finding) => SITE_UNAVAILABLE_CODES.has(finding.code));
  if (unavailable || (!crawl.homepageOk && crawl.pages.length === 0)) {
    return {
      technicalScore: Math.min(technicalScore, AUDIT_SCORING.unscoredCap),
      seoScore: Math.min(seoScore, AUDIT_SCORING.unscoredCap),
      uxScore: Math.min(uxScore, AUDIT_SCORING.unscoredCap),
      contentScore: Math.min(contentScore, AUDIT_SCORING.unscoredCap),
      overallAuditScore: AUDIT_SCORING.unscoredCap,
      redesignOpportunityScore: Math.max(opportunity, AUDIT_SCORING.unscoredOpportunity),
    };
  }

  if (findings.length === 0) {
    overall = 100;
    opportunity = 0;
  }

  return {
    technicalScore,
    seoScore,
    uxScore,
    contentScore,
    overallAuditScore: overall,
    redesignOpportunityScore: opportunity,
  };
}

function categoryScore(findings: AuditFinding[], category: AuditFinding["category"]): number {
  const penalty = findings
    .filter((finding) => finding.category === category)
    .reduce((sum, finding) => sum + AUDIT_SCORING.qualityPenalty[finding.severity], 0);
  return clamp(AUDIT_SCORING.qualityStart - penalty);
}

export function summarizeAudit(findings: AuditFinding[], scores: AuditScores): {
  summary: string;
  issues: string[];
  recommendations: string[];
} {
  const ranked = [...findings].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
  const issues = ranked
    .filter((finding) => finding.severity !== "info")
    .map((finding) => finding.title)
    .slice(0, 12);
  const recommendations = [
    ...new Set(
      ranked
        .filter((finding) => finding.severity !== "info")
        .map((finding) => finding.recommendation),
    ),
  ].slice(0, 12);

  const critical = findings.filter((item) => item.severity === "critical").length;
  const high = findings.filter((item) => item.severity === "high").length;
  const summary =
    findings.length === 0
      ? `Deterministic ${AUDITOR_VERSION} audit found no material website issues. Overall quality ${scores.overallAuditScore}.`
      : `Deterministic ${AUDITOR_VERSION} audit: overall ${scores.overallAuditScore}, redesign opportunity ${scores.redesignOpportunityScore}. ${critical} critical, ${high} high, ${findings.length} findings.`;

  return { summary, issues, recommendations };
}

export function severityRank(severity: AuditSeverity): number {
  return {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }[severity];
}

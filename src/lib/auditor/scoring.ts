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
    critical: 30,
    high: 8,
    medium: 3,
    low: 1,
    info: 0,
  } satisfies Record<AuditSeverity, number>,
  opportunityCategoryMultiplier: {
    technical: 0.4,
    seo: 0.65,
    ux: 1,
    content: 0.9,
  } satisfies Record<AuditFinding["category"], number>,
  opportunityCodePoints: {
    no_website: 100,
    homepage_unreachable: 95,
    http_not_https: 16,
    missing_viewport: 10,
    excessive_page_size: 8,
    slow_response: 8,
    broken_important_link: 28,
    redirect_limit: 8,
    missing_title: 12,
    missing_meta_description: 6,
    missing_h1: 12,
    multiple_h1: 2,
    weak_heading_hierarchy: 3,
    missing_canonical: 2,
    duplicate_title: 7,
    weak_local_signals: 14,
    missing_cta: 35,
    broken_cta: 35,
    phone_not_clickable: 14,
    weak_navigation: 12,
    contact_hard_to_find: 32,
    stale_copyright: 3,
    poor_mobile_metadata: 8,
    thin_service_information: 16,
    missing_location_information: 12,
    placeholder_text: 18,
    restaurant_menu_missing: 32,
    restaurant_menu_broken: 34,
    restaurant_menu_pdf: 18,
    restaurant_hours_missing: 14,
    restaurant_phone_missing: 18,
    restaurant_reservation_broken: 30,
    restaurant_reservation_unclear: 14,
    restaurant_order_broken: 30,
    home_service_phone_cta_missing: 35,
    home_service_services_undiscoverable: 18,
    home_service_area_missing: 16,
    home_service_emergency_cta_missing: 24,
    home_service_contact_form_missing: 8,
  } satisfies Record<string, number>,
  conversionBlockerCodes: [
    "no_website",
    "homepage_unreachable",
    "missing_cta",
    "broken_cta",
    "contact_hard_to_find",
    "restaurant_menu_missing",
    "restaurant_menu_broken",
    "restaurant_reservation_broken",
    "restaurant_order_broken",
    "home_service_phone_cta_missing",
    "home_service_emergency_cta_missing",
  ] as readonly string[],
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

  let opportunity = scoreRedesignOpportunity(findings, overall);

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

function scoreRedesignOpportunity(findings: AuditFinding[], overallHealth: number): number {
  const directOpportunity = findings.reduce((sum, finding) => {
    const codePoints = (
      AUDIT_SCORING.opportunityCodePoints as Record<string, number | undefined>
    )[finding.code];
    if (codePoints !== undefined) return sum + codePoints;
    const severityPoints = AUDIT_SCORING.opportunityPoints[finding.severity];
    return sum + severityPoints * AUDIT_SCORING.opportunityCategoryMultiplier[finding.category];
  }, 0);
  const healthDrag = overallHealth < 70 ? (70 - overallHealth) * 0.45 : 0;
  let opportunity = clamp(directOpportunity + healthDrag);

  const hasConversionBlocker = findings.some((finding) =>
    AUDIT_SCORING.conversionBlockerCodes.includes(finding.code),
  );
  if (!hasConversionBlocker && overallHealth >= 85) {
    opportunity = Math.min(opportunity, 24);
  } else if (!hasConversionBlocker && overallHealth >= 75) {
    opportunity = Math.min(opportunity, 45);
  }

  return opportunity;
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
      ? `Deterministic ${AUDITOR_VERSION} audit found no material website issues. Website health ${scores.overallAuditScore}, redesign opportunity ${scores.redesignOpportunityScore}.`
      : `Deterministic ${AUDITOR_VERSION} audit: website health ${scores.overallAuditScore}, redesign opportunity ${scores.redesignOpportunityScore}. ${critical} critical, ${high} high, ${findings.length} findings.`;

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

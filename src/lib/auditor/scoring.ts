import { AUDITOR_VERSION } from "./limits";
import type {
  AuditFinding,
  AuditOpportunityBreakdown,
  AuditOpportunityComponent,
  AuditOpportunityComponentId,
  AuditScores,
  AuditSeverity,
  CrawlResult,
} from "./types";

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
    legacy_url_extension: 0,
    legacy_generator_marker: 0,
    deprecated_markup: 0,
    table_layout: 0,
    excessive_inline_style: 0,
    legacy_script_pattern: 0,
    fragmented_legacy_urls: 0,
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
  opportunityComponentWeights: {
    modernization: 0.3,
    conversion: 0.35,
    localMarketing: 0.15,
    contentSeo: 0.12,
    structureNavigation: 0.08,
  } satisfies Record<AuditOpportunityComponentId, number>,
  modernizationOpportunity: {
    legacy_url_extension: 20,
    legacy_generator_marker: 22,
    deprecated_markup: 22,
    table_layout: 24,
    excessive_inline_style: 20,
    legacy_script_pattern: 18,
    fragmented_legacy_urls: 20,
    stale_copyright: 12,
    malformed_html: 8,
  } satisfies Record<string, number>,
  conversionOpportunity: {
    missing_cta: 35,
    broken_cta: 35,
    phone_not_clickable: 16,
    contact_hard_to_find: 30,
    restaurant_phone_missing: 16,
    restaurant_reservation_broken: 28,
    restaurant_reservation_unclear: 14,
    restaurant_order_broken: 28,
    home_service_phone_cta_missing: 35,
    home_service_emergency_cta_missing: 22,
    home_service_contact_form_missing: 8,
  } satisfies Record<string, number>,
  localMarketingOpportunity: {
    weak_local_signals: 24,
    missing_location_information: 22,
    home_service_area_missing: 24,
    restaurant_hours_missing: 14,
  } satisfies Record<string, number>,
  contentSeoOpportunity: {
    missing_title: 18,
    weak_title: 8,
    missing_meta_description: 13,
    missing_h1: 18,
    multiple_h1: 5,
    weak_heading_hierarchy: 8,
    missing_canonical: 4,
    duplicate_title: 12,
    thin_service_information: 24,
    placeholder_text: 26,
    restaurant_menu_missing: 28,
    restaurant_menu_pdf: 16,
    home_service_services_undiscoverable: 26,
  } satisfies Record<string, number>,
  structureNavigationOpportunity: {
    missing_viewport: 24,
    poor_mobile_metadata: 18,
    weak_navigation: 24,
    broken_important_link: 30,
    redirect_limit: 14,
    excessive_page_size: 14,
    slow_response: 12,
    restaurant_menu_broken: 30,
  } satisfies Record<string, number>,
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

  let breakdown = scoreRedesignOpportunity(findings, crawl, overall);

  const unavailable = findings.some((finding) => SITE_UNAVAILABLE_CODES.has(finding.code));
  if (unavailable || (!crawl.homepageOk && crawl.pages.length === 0)) {
    breakdown = withBreakdownScore(breakdown, Math.max(breakdown.score, AUDIT_SCORING.unscoredOpportunity));
    return {
      technicalScore: Math.min(technicalScore, AUDIT_SCORING.unscoredCap),
      seoScore: Math.min(seoScore, AUDIT_SCORING.unscoredCap),
      uxScore: Math.min(uxScore, AUDIT_SCORING.unscoredCap),
      contentScore: Math.min(contentScore, AUDIT_SCORING.unscoredCap),
      overallAuditScore: AUDIT_SCORING.unscoredCap,
      redesignOpportunityScore: breakdown.score,
      redesignOpportunityBreakdown: breakdown,
    };
  }

  if (findings.length === 0) {
    overall = 100;
    breakdown = scoreRedesignOpportunity(findings, crawl, overall);
  }

  return {
    technicalScore,
    seoScore,
    uxScore,
    contentScore,
    overallAuditScore: overall,
    redesignOpportunityScore: breakdown.score,
    redesignOpportunityBreakdown: breakdown,
  };
}

function categoryScore(findings: AuditFinding[], category: AuditFinding["category"]): number {
  const penalty = findings
    .filter((finding) => finding.category === category)
    .reduce((sum, finding) => sum + AUDIT_SCORING.qualityPenalty[finding.severity], 0);
  return clamp(AUDIT_SCORING.qualityStart - penalty);
}

export function scoreRedesignOpportunity(
  findings: AuditFinding[],
  crawl: CrawlResult,
  overallHealth: number,
): AuditOpportunityBreakdown {
  const components: AuditOpportunityComponent[] = [
    component(
      "modernization",
      "Modernization",
      findings,
      crawl,
      AUDIT_SCORING.modernizationOpportunity,
      collectModernizationEvidence,
    ),
    component(
      "conversion",
      "Conversion",
      findings,
      crawl,
      AUDIT_SCORING.conversionOpportunity,
      collectConversionEvidence,
    ),
    component(
      "localMarketing",
      "Local marketing",
      findings,
      crawl,
      AUDIT_SCORING.localMarketingOpportunity,
      collectLocalMarketingEvidence,
    ),
    component(
      "contentSeo",
      "Content/SEO expansion",
      findings,
      crawl,
      AUDIT_SCORING.contentSeoOpportunity,
      collectContentSeoEvidence,
    ),
    component(
      "structureNavigation",
      "Structure/navigation",
      findings,
      crawl,
      AUDIT_SCORING.structureNavigationOpportunity,
      collectStructureEvidence,
    ),
  ];

  const weighted = components.reduce(
    (sum, item) => sum + item.score * AUDIT_SCORING.opportunityComponentWeights[item.id],
    0,
  );
  const healthDrag = overallHealth < 70 ? (70 - overallHealth) * 0.25 : 0;
  const conversionComponent = components.find((item) => item.id === "conversion")?.score ?? 0;
  const unknownCount = components.reduce((sum, item) => sum + item.unknownEvidence.length, 0);
  const observedCount = components.reduce(
    (sum, item) => sum + item.positiveEvidence.length + item.negativeEvidence.length,
    0,
  );
  const sparseEvidenceFloor = unknownCount > observedCount ? 18 : 0;
  const sparseEvidenceCap = unknownCount > observedCount ? 58 : 100;
  const componentFloor = conversionComponent >= 80 ? 45 : conversionComponent >= 55 ? 35 : 0;
  const score = Math.min(
    sparseEvidenceCap,
    Math.max(sparseEvidenceFloor, componentFloor, clamp(weighted + healthDrag)),
  );

  return { score, components };
}

type EvidenceCollector = (findings: AuditFinding[], crawl: CrawlResult) => {
  positive: string[];
  negative: string[];
  unknown: string[];
  comboBonus?: number;
};

function component(
  id: AuditOpportunityComponentId,
  label: string,
  findings: AuditFinding[],
  crawl: CrawlResult,
  codeWeights: Record<string, number>,
  collect: EvidenceCollector,
): AuditOpportunityComponent {
  const evidence = collect(findings, crawl);
  const codeCounts = new Map<string, number>();
  const weightedFindings = findings.reduce((sum, finding) => {
    const exact = codeWeights[finding.code];
    if (exact !== undefined) {
      const count = codeCounts.get(finding.code) ?? 0;
      codeCounts.set(finding.code, count + 1);
      return sum + exact * (count === 0 ? 1 : 0.25);
    }
    return sum;
  }, 0);
  const rawScore = weightedFindings + (evidence.comboBonus ?? 0);
  const unknownAdjustment = evidence.unknown.length > evidence.negative.length ? 6 : 0;
  const positiveCredit = Math.min(12, evidence.positive.length * 2);

  return {
    id,
    label,
    score: clamp(rawScore + unknownAdjustment - positiveCredit),
    positiveEvidence: evidence.positive.slice(0, 6),
    negativeEvidence: evidence.negative.slice(0, 6),
    unknownEvidence: evidence.unknown.slice(0, 6),
  };
}

function collectModernizationEvidence(findings: AuditFinding[], crawl: CrawlResult) {
  const modernCodes = new Set(Object.keys(AUDIT_SCORING.modernizationOpportunity));
  const negatives = findings
    .filter((finding) => modernCodes.has(finding.code))
    .map((finding) => finding.title);
  const pagesWithSignals = crawl.pages.filter((page) => page.signals);
  return {
    positive: pagesWithSignals.some((page) => (page.signals?.modernizationSignals.length ?? 0) === 0)
      ? ["Inspected HTML did not expose configured legacy modernization proxies."]
      : [],
    negative: negatives,
    unknown: pagesWithSignals.length === 0 ? ["No inspectable HTML page for modernization signals."] : [],
  };
}

function collectConversionEvidence(findings: AuditFinding[], crawl: CrawlResult) {
  const home = homepageSignals(crawl);
  const negatives = titlesFor(findings, AUDIT_SCORING.conversionOpportunity);
  const contactPageOk = crawl.pages.some((page) => page.kind === "contact" && page.ok);
  const positives = [
    home?.hasContactCta ? "Primary contact/quote CTA observed." : null,
    home?.hasPhoneLink ? "Clickable phone path observed." : null,
    home?.hasForm ? "Form conversion path observed." : null,
    contactPageOk ? "Reachable contact page observed." : null,
  ].filter(isString);
  const missingSignals = [
    home && !home.hasContactCta ? "primary CTA" : null,
    home && !home.hasPhoneLink ? "clickable phone" : null,
    home && !home.hasForm ? "form" : null,
    !contactPageOk ? "reachable contact page" : null,
  ].filter(isString);
  const comboBonus = missingSignals.length >= 3 ? 16 : missingSignals.length === 2 ? 8 : 0;
  return {
    positive: positives,
    negative: negatives,
    unknown: home ? [] : ["Homepage conversion signals were not available."],
    comboBonus,
  };
}

function collectLocalMarketingEvidence(findings: AuditFinding[], crawl: CrawlResult) {
  const home = homepageSignals(crawl);
  return {
    positive: [
      crawl.pages.some((page) => page.signals?.hasAddressOrLocation)
        ? "Address or location signal observed."
        : null,
      crawl.pages.some((page) => page.signals?.hasServiceArea)
        ? "Service-area copy observed."
        : null,
    ].filter(isString),
    negative: titlesFor(findings, AUDIT_SCORING.localMarketingOpportunity),
    unknown: home ? [] : ["Local-business marketing signals were not available."],
  };
}

function collectContentSeoEvidence(findings: AuditFinding[], crawl: CrawlResult) {
  const home = homepageSignals(crawl);
  return {
    positive: [
      home?.title ? "Document title observed." : null,
      home?.metaDescription ? "Meta description observed." : null,
      (home?.h1Count ?? 0) > 0 ? "Primary H1 observed." : null,
      (home?.h2Count ?? 0) > 0 ? "Section hierarchy observed." : null,
      (home?.visibleTextLength ?? 0) >= AUDIT_SCORING.thinTextChars
        ? "Homepage has non-sparse visible copy."
        : null,
    ].filter(isString),
    negative: titlesFor(findings, AUDIT_SCORING.contentSeoOpportunity),
    unknown: home ? [] : ["Homepage content/SEO signals were not available."],
  };
}

function collectStructureEvidence(findings: AuditFinding[], crawl: CrawlResult) {
  const home = homepageSignals(crawl);
  return {
    positive: [
      home?.hasViewport ? "Viewport metadata observed." : null,
      home?.hasNav ? "Navigation landmark observed." : null,
      home?.servicesLink ? "Service navigation path observed." : null,
      home?.contactLink ? "Contact navigation path observed." : null,
    ].filter(isString),
    negative: titlesFor(findings, AUDIT_SCORING.structureNavigationOpportunity),
    unknown: home ? [] : ["Structural/navigation signals were not available."],
  };
}

function titlesFor(findings: AuditFinding[], weights: Record<string, number>): string[] {
  return findings.filter((finding) => weights[finding.code] !== undefined).map((finding) => finding.title);
}

function homepageSignals(crawl: CrawlResult) {
  return (crawl.pages.find((page) => page.kind === "home") ?? crawl.pages[0])?.signals ?? null;
}

function isString(value: string | null | false): value is string {
  return typeof value === "string" && value.length > 0;
}

function withBreakdownScore(
  breakdown: AuditOpportunityBreakdown,
  score: number,
): AuditOpportunityBreakdown {
  return { ...breakdown, score: clamp(score) };
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

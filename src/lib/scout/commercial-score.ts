import { resolveDesignerCategoryContext } from "@/lib/designer/category";
import type { ContactabilityAssessment } from "./contactability";
import type { InspectionResult, NormalizedBusiness, ScoreBreakdown } from "./types";
import type { WebsiteStatus } from "./website-status";

/**
 * Second-stage commercial ranking on top of Scout's existing, unmodified
 * businessStrengthScore/websiteOpportunityScore (scoring.ts). This module
 * never touches those -- it only adds the dimensions they don't cover
 * (contactability, facts completeness, design potential, Designer coverage)
 * and composes one deterministic 0-100 score plus a BUILD/REVIEW/SKIP
 * recommendation. No LLM authors this score.
 */
export const SCOUT_COMMERCIAL_WEIGHTS = {
  businessStrength: 25,
  websiteOpportunity: 30,
  contactability: 15,
  factsCompleteness: 15,
  designPotential: 10,
  designerCoverage: 5,
} as const;

export type DesignerCoverageLevel = "strong" | "workable" | "weak_unknown";
export type ScoutRecommendation = "BUILD" | "REVIEW" | "SKIP";

export type CommercialScoreInput = {
  business: NormalizedBusiness;
  inspection: InspectionResult;
  score: ScoreBreakdown;
  websiteStatus: WebsiteStatus;
  contactability: ContactabilityAssessment;
};

export type CommercialScoreComponents = {
  businessStrength: number;
  websiteOpportunity: number;
  contactability: number;
  factsCompleteness: number;
  designPotential: number;
  designerCoverage: number;
};

export type CommercialScoreResult = {
  commercialPotentialScore: number;
  recommendation: ScoutRecommendation;
  components: CommercialScoreComponents;
  designerCoverageLevel: DesignerCoverageLevel;
  factsCompletenessCount: number;
  reasons: string[];
};

/**
 * Categories with a REAL end-to-end Designer Worker proof (not just prompt
 * guidance) as of this session -- see HANDOFF.md: landscaping (Cypress &
 * Coast Landscape Co.) and professional_services (Sabal Point Tax &
 * Bookkeeping). Everything else with category-context guidance is
 * "workable" but unproven; anything falling to the generic fallback is
 * "weak_unknown". Deliberately does NOT import the legacy Builder registry
 * (src/lib/builder/registry.ts) as a quality signal, per this session's
 * explicit instruction -- Designer coverage is judged by Designer's own
 * category architecture, not Builder's.
 */
const DESIGNER_PROVEN_CATEGORY_KEYS = new Set(["landscaping", "professional_services"]);

function designerCoverageLevel(industry: string): DesignerCoverageLevel {
  const context = resolveDesignerCategoryContext(industry);
  if (context.key === "general_local_business") return "weak_unknown";
  if (DESIGNER_PROVEN_CATEGORY_KEYS.has(context.key)) return "strong";
  return "workable";
}

function designerCoverageScore(level: DesignerCoverageLevel): number {
  if (level === "strong") return 100;
  if (level === "workable") return 65;
  return 35;
}

function factsCompletenessCount(business: NormalizedBusiness): number {
  let count = 0;
  if (business.city) count += 1;
  if (business.state) count += 1;
  if (business.phone) count += 1;
  if (business.address) count += 1;
  if (business.hours) count += 1;
  if (business.email || business.instagramUrl || business.facebookUrl) count += 1;
  return count;
}

function factsCompletenessScore(count: number): number {
  return Math.round((Math.min(6, count) / 6) * 100);
}

function designPotential(business: NormalizedBusiness): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const context = resolveDesignerCategoryContext(business.industry);
  // PHOTO_ABSENT is a proven-viable Designer strategy for any category (see
  // the Sabal Point proof, HANDOFF.md) -- design potential is never zero
  // merely for lacking photography.
  let score = 62;
  if (context.key !== "general_local_business") {
    score += 18;
    reasons.push(`${context.label} has category-specific Designer guidance.`);
  }
  // Scout never scrapes/downloads prospect photography and never treats a
  // public social page as a reusable asset. This only credits the business
  // for having a page a human could later review for rights-safe imagery.
  if (business.instagramUrl || business.facebookUrl) {
    score += 10;
    reasons.push("Has a public social profile a human could review for rights-safe imagery later (not itself a usable asset).");
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function opportunityInput(input: CommercialScoreInput): { score: number; reason: string } {
  if (input.websiteStatus === "social_or_directory_only") {
    return {
      score: 85,
      reason:
        "No standalone website, but a real public listing with contact info was found -- a strong, moderately-confident SiteForge opportunity (Scout's raw websiteOpportunityScore is left unchanged; this override applies only to the commercial-potential composite).",
    };
  }
  return { score: input.score.websiteOpportunityScore, reason: "Using Scout's existing deterministic website-opportunity score unchanged." };
}

export function assessCommercialScore(input: CommercialScoreInput): CommercialScoreResult {
  const reasons: string[] = [];
  const coverageLevel = designerCoverageLevel(input.business.industry);
  const factsCount = factsCompletenessCount(input.business);
  const design = designPotential(input.business);
  const opportunity = opportunityInput(input);
  reasons.push(opportunity.reason, ...design.reasons);

  const components: CommercialScoreComponents = {
    businessStrength: input.score.businessStrengthScore,
    websiteOpportunity: opportunity.score,
    contactability: input.contactability.score,
    factsCompleteness: factsCompletenessScore(factsCount),
    designPotential: design.score,
    designerCoverage: designerCoverageScore(coverageLevel),
  };

  const w = SCOUT_COMMERCIAL_WEIGHTS;
  const weighted =
    (components.businessStrength * w.businessStrength +
      components.websiteOpportunity * w.websiteOpportunity +
      components.contactability * w.contactability +
      components.factsCompleteness * w.factsCompleteness +
      components.designPotential * w.designPotential +
      components.designerCoverage * w.designerCoverage) /
    100;
  const commercialPotentialScore = Math.max(0, Math.min(100, Math.round(weighted)));

  const factsSufficient = factsCount >= 3;
  if (!factsSufficient) reasons.push("Too few sourced facts to draft an honest site without inventing details.");
  if (!input.contactability.verified) reasons.push("No verified contact channel was found.");

  let recommendation: ScoutRecommendation;
  if (!factsSufficient || !input.contactability.verified) {
    // A gap in facts or contactability caps the recommendation below BUILD
    // regardless of how the weighted score alone would read -- SiteForge
    // must not commit Designer capacity to a lead it cannot honestly build
    // or currently has no safe way to reach.
    recommendation = commercialPotentialScore >= 60 ? "REVIEW" : "SKIP";
  } else if (commercialPotentialScore >= 70) {
    recommendation = "BUILD";
  } else if (commercialPotentialScore >= 45) {
    recommendation = "REVIEW";
  } else {
    recommendation = "SKIP";
  }
  reasons.push(`Commercial potential ${commercialPotentialScore}/100 -> ${recommendation}.`);

  return {
    commercialPotentialScore,
    recommendation,
    components,
    designerCoverageLevel: coverageLevel,
    factsCompletenessCount: factsCount,
    reasons,
  };
}

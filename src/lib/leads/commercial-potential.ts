/**
 * Commercial Potential: a deterministic composite signal for deciding which
 * leads are worth spending limited Designer capacity on. Reuses scores
 * Scout/Auditor already compute (src/lib/scout/scoring.ts,
 * src/lib/auditor/scoring.ts) rather than inventing a second scoring system;
 * this module only adds the two dimensions those don't cover -- contactability
 * and template coverage -- and composes a recommendation.
 *
 * Philosophy (see AGENTS.md commercial design quality principle): the ideal
 * prospect already looks like a real, credible business. Its web presence is
 * what's missing or clearly underselling it. This module does not reward a
 * lead merely for scoring badly in a technical audit -- business strength is
 * a first-class, independent factor, not a tiebreaker.
 *
 * No LLM authors this score. No sensitive or discriminatory attribute is
 * used. This module makes no network call and has $0 cost.
 */

import { needsNewMasterTemplate } from "@/lib/builder/registry";

export type CommercialPotentialTier = "high" | "medium" | "low";
export type RecommendedAction = "build" | "create_designer_job" | "skip";
export type QualitativeStrength = "strong" | "moderate" | "weak" | "unknown";
export type WebsiteOpportunityLevel = "very_strong" | "strong" | "moderate" | "weak" | "unknown";
export type FactsCompletenessLevel = "sufficient" | "partial" | "insufficient";

export type CommercialPotentialInput = {
  industry: string;
  /** Scout's 0-100 business-quality signal (rating, review volume, active public footprint). */
  businessStrengthScore: number | null;
  /**
   * 0-100 opportunity signal. Prefer Auditor's redesign_opportunity_score
   * for audited leads (it already separates health from opportunity, see
   * HANDOFF.md M9.5B.1); fall back to Scout's websiteOpportunityScore,
   * which also covers the explicit no-standalone-website case.
   */
  websiteOpportunityScore: number | null;
  hasVerifiedEmail: boolean;
  hasVerifiedPhone: boolean;
  hasVerifiedSocialProfile: boolean;
  /** Count of independently sourced facts available (name/industry always count; this is the rest). */
  sourcedFactCount: number;
};

export type CommercialPotentialAssessment = {
  tier: CommercialPotentialTier;
  businessStrength: QualitativeStrength;
  websiteOpportunity: WebsiteOpportunityLevel;
  contactability: { verified: boolean; channels: string[] };
  templateCoverage: "approved_master_available" | "missing";
  factsCompleteness: FactsCompletenessLevel;
  recommendedAction: RecommendedAction;
  designerAiRequired: boolean;
  estimatedAdditionalCashCostUsd: 0;
  reasons: string[];
};

export function assessCommercialPotential(input: CommercialPotentialInput): CommercialPotentialAssessment {
  const businessStrength = qualitativeStrength(input.businessStrengthScore);
  const websiteOpportunity = opportunityLevel(input.websiteOpportunityScore);
  const channels = [
    input.hasVerifiedEmail ? "email" : null,
    input.hasVerifiedPhone ? "phone" : null,
    input.hasVerifiedSocialProfile ? "social" : null,
  ].filter((value): value is string => value !== null);
  const contactability = { verified: channels.length > 0, channels };
  const templateCoverage: "approved_master_available" | "missing" = needsNewMasterTemplate(input.industry)
    ? "missing"
    : "approved_master_available";
  const factsCompleteness = factsCompletenessLevel(input.sourcedFactCount);

  const reasons: string[] = [];
  const tier = computeTier({ businessStrength, websiteOpportunity, contactability, factsCompleteness, reasons });

  let recommendedAction: RecommendedAction = "skip";
  if (tier === "low" || !contactability.verified || factsCompleteness === "insufficient") {
    recommendedAction = "skip";
    if (!contactability.verified) reasons.push("No verified contact channel; cannot safely reach this business yet.");
    if (factsCompleteness === "insufficient") reasons.push("Too few sourced facts to draft a credible site without inventing details.");
  } else {
    recommendedAction = templateCoverage === "missing" ? "create_designer_job" : "build";
    reasons.push(
      templateCoverage === "missing"
        ? "No approved master template covers this industry yet."
        : "An approved master template already covers this industry; deterministic Builder can instantiate it at $0.",
    );
  }

  return {
    tier,
    businessStrength,
    websiteOpportunity,
    contactability,
    templateCoverage,
    factsCompleteness,
    recommendedAction,
    designerAiRequired: recommendedAction === "create_designer_job",
    estimatedAdditionalCashCostUsd: 0,
    reasons,
  };
}

function computeTier(input: {
  businessStrength: QualitativeStrength;
  websiteOpportunity: WebsiteOpportunityLevel;
  contactability: { verified: boolean };
  factsCompleteness: FactsCompletenessLevel;
  reasons: string[];
}): CommercialPotentialTier {
  const strengthPoints = { strong: 2, moderate: 1, weak: 0, unknown: 0 }[input.businessStrength];
  const opportunityPoints = { very_strong: 2, strong: 2, moderate: 1, weak: 0, unknown: 0 }[input.websiteOpportunity];
  const points = strengthPoints + opportunityPoints + (input.contactability.verified ? 1 : 0) + (input.factsCompleteness === "sufficient" ? 1 : 0);

  if (input.businessStrength === "weak") {
    input.reasons.push("Business strength is weak; a better site is unlikely to change commercial outcomes here.");
  }
  if (points >= 5 && input.businessStrength !== "weak") return "high";
  if (points >= 3) return "medium";
  return "low";
}

function qualitativeStrength(score: number | null): QualitativeStrength {
  if (score === null) return "unknown";
  if (score >= 70) return "strong";
  if (score >= 40) return "moderate";
  return "weak";
}

function opportunityLevel(score: number | null): WebsiteOpportunityLevel {
  if (score === null) return "unknown";
  if (score >= 75) return "very_strong";
  if (score >= 50) return "strong";
  if (score >= 25) return "moderate";
  return "weak";
}

function factsCompletenessLevel(sourcedFactCount: number): FactsCompletenessLevel {
  if (sourcedFactCount >= 4) return "sufficient";
  if (sourcedFactCount >= 2) return "partial";
  return "insufficient";
}

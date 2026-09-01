import { isRestaurantCategory } from "./categories";
import { classifyRatingTier, classifyReviewVolumeTier } from "./rating-tiers";
import type {
  InspectionResult,
  NormalizedBusiness,
  QualificationTier,
  ScoreBreakdown,
} from "./types";

/**
 * Deterministic Scout scoring weights. Do not scatter these constants.
 * LLMs must not author the authoritative score.
 */
export const SCORING = {
  ratingStrong: 4.2,
  ratingReview: 3.8,
  reviewsStrong: 50,
  reviewsMeaningful: 15,
  reviewsWeak: 5,
  business: {
    ratingMax: 36,
    reviewsMax: 28,
    websiteListed: 12,
    independent: 12,
    localPresence: 12,
  },
  opportunity: {
    unreachable: 42,
    noHttps: 12,
    missingViewport: 14,
    missingTitle: 8,
    missingMeta: 6,
    noCta: 10,
    brokenImportantLink: 14,
    outdatedCopyright: 6,
    weakNav: 6,
    restaurantMissingMenu: 16,
    restaurantAwkwardMenu: 10,
    restaurantBrokenBooking: 12,
    restaurantConfusingBooking: 8,
  },
  overall: {
    businessHigh: 70,
    opportunityHigh: 55,
    businessQualified: 55,
    opportunityQualified: 40,
    rejectBusinessBelow: 35,
    rejectOpportunityBelow: 18,
  },
} as const;

const CHAIN_HINTS = [
  "mcdonald",
  "subway",
  "starbucks",
  "dunkin",
  "burger king",
  "wendy",
  "kfc",
  "taco bell",
  "pizza hut",
  "domino",
  "chipotle",
  "home depot",
  "lowe's",
  "lowes",
  "walmart",
  "target",
  "great clips",
  "jiffy lube",
  "valvoline",
  "servpro",
  "roto-rooter",
  "roto rooter",
];

export function looksLikeChain(name: string, flagged?: boolean): boolean {
  if (flagged) return true;
  const hay = name.toLowerCase();
  return CHAIN_HINTS.some((hint) => hay.includes(hint));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function currentYear(): number {
  return new Date().getUTCFullYear();
}

export function scoreBusinessStrength(business: NormalizedBusiness): {
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;
  // Missing rating/review-count must never be coerced to zero -- a real
  // zero-review business (EMERGING tier) and an unknown one are different
  // facts and must be scored/labeled differently. See rating-tiers.ts.
  const rating = business.rating ?? null;
  const reviews = business.reviewCount ?? null;
  const ratingTier = classifyRatingTier(rating);
  const reviewTier = classifyReviewVolumeTier(reviews);

  if (rating === null) {
    reasons.push("Google rating unavailable");
  } else if (rating >= SCORING.ratingStrong) {
    score += SCORING.business.ratingMax;
    reasons.push(`Public rating ${rating.toFixed(1)}/5 (${ratingTier} tier) meets the ${SCORING.ratingStrong}+ bar`);
  } else if (rating >= SCORING.ratingReview) {
    score += Math.round(SCORING.business.ratingMax * 0.55);
    reasons.push(`Public rating ${rating.toFixed(1)}/5 (${ratingTier} tier) is only moderate`);
  } else {
    score += Math.round(SCORING.business.ratingMax * 0.2);
    reasons.push(`Public rating ${rating.toFixed(1)}/5 (${ratingTier} tier) is below the commercial-health bar`);
  }

  if (reviews === null) {
    reasons.push("Google review count unavailable");
  } else if (reviews >= SCORING.reviewsStrong) {
    score += SCORING.business.reviewsMax;
    reasons.push(`${reviews} reviews (${reviewTier} tier) indicate an established local presence`);
  } else if (reviews >= SCORING.reviewsMeaningful) {
    score += Math.round(SCORING.business.reviewsMax * 0.65);
    reasons.push(`${reviews} reviews (${reviewTier} tier) is a meaningful but not deep sample`);
  } else if (reviews >= SCORING.reviewsWeak) {
    score += Math.round(SCORING.business.reviewsMax * 0.3);
    reasons.push(`${reviews} reviews (${reviewTier} tier) is a thin public sample`);
  } else {
    reasons.push(`${reviews} reviews (${reviewTier} tier) is too low to treat the business as established`);
  }

  if (business.websiteUrl) {
    score += SCORING.business.websiteListed;
  } else {
    reasons.push("No public website listed");
  }

  if (looksLikeChain(business.name, business.likelyChain)) {
    reasons.push("Name matches a major chain/franchise pattern");
  } else {
    score += SCORING.business.independent;
    reasons.push("Does not match major-chain name patterns");
  }

  if (business.city && business.industry) {
    score += SCORING.business.localPresence;
  }

  // Google's own operational-status signal. Absent/unknown is never
  // penalized -- only an explicit closed status counts, and permanently
  // closed caps the score hard since such a business is not a real
  // prospect regardless of its historical rating/review evidence.
  if (business.businessStatus === "CLOSED_PERMANENTLY") {
    score = Math.min(score, 10);
    reasons.push("Google marks this business as permanently closed -- not a real prospect");
  } else if (business.businessStatus === "CLOSED_TEMPORARILY") {
    score = Math.round(score * 0.5);
    reasons.push("Google marks this business as temporarily closed");
  } else if (business.businessStatus === "OPERATIONAL") {
    reasons.push("Business operational");
  }

  return { score: clamp(score), reasons };
}

export function scoreWebsiteOpportunity(
  business: NormalizedBusiness,
  inspection: InspectionResult,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const restaurant =
    business.categoryId !== "manual_public" && isRestaurantCategory(business.categoryId);
  const page = inspection.homepage;

  if (!business.websiteUrl) {
    score += SCORING.opportunity.unreachable;
    reasons.push("No website URL listed — a SiteForge site could fill a gap");
    return { score: clamp(score), reasons };
  }

  if (!inspection.reachable || !page) {
    score += SCORING.opportunity.unreachable;
    reasons.push(
      inspection.blockedReason
        ? `Website fetch blocked (${inspection.blockedReason})`
        : "Website unreachable or timed out",
    );
    return { score: clamp(score), reasons };
  }

  if (!page.https) {
    score += SCORING.opportunity.noHttps;
    reasons.push("Site is not served over HTTPS");
  }
  if (!page.hasViewport) {
    score += SCORING.opportunity.missingViewport;
    reasons.push("Missing viewport / mobile metadata");
  }
  if (!page.title) {
    score += SCORING.opportunity.missingTitle;
    reasons.push("Missing document title");
  }
  if (!page.metaDescription) {
    score += SCORING.opportunity.missingMeta;
    reasons.push("Missing meta description");
  }
  if (!page.hasContactCta && !page.hasPhoneLink && !page.hasForm) {
    score += SCORING.opportunity.noCta;
    reasons.push("No obvious contact CTA, phone link, or form");
  }
  if (!page.hasNav || page.headingCount < 2) {
    score += SCORING.opportunity.weakNav;
    reasons.push("Weak heading structure or missing navigation");
  }
  if (page.copyrightYear && page.copyrightYear <= currentYear() - 4) {
    score += SCORING.opportunity.outdatedCopyright;
    reasons.push(`Copyright year ${page.copyrightYear} looks stale`);
  }

  const brokenImportant = inspection.linkChecks.filter(
    (item) => !item.ok && item.kind !== "other",
  );
  if (brokenImportant.length > 0) {
    score += SCORING.opportunity.brokenImportantLink;
    reasons.push(
      `Broken ${brokenImportant.map((item) => item.kind).join(", ")} link(s)`,
    );
  }

  if (restaurant) {
    if (!page.menuLink && !page.mentionsMenu) {
      score += SCORING.opportunity.restaurantMissingMenu;
      reasons.push("Menu is not discoverable from the homepage");
    } else if (page.menuLooksLikePdf || (page.mentionsMenu && !page.menuLink)) {
      score += SCORING.opportunity.restaurantAwkwardMenu;
      reasons.push("Menu looks like a PDF or is hard to find");
    }

    if (page.mentionsReservations) {
      const reservation = inspection.linkChecks.find((item) => item.kind === "reservation");
      if (reservation && !reservation.ok) {
        score += SCORING.opportunity.restaurantBrokenBooking;
        reasons.push("Reservation link is broken");
      } else if (!page.reservationLink) {
        score += SCORING.opportunity.restaurantConfusingBooking;
        reasons.push("Page mentions reservations but no working reservation link");
      }
    }

    if (page.mentionsOrdering) {
      const order = inspection.linkChecks.find((item) => item.kind === "order");
      if (order && !order.ok) {
        score += SCORING.opportunity.restaurantBrokenBooking;
        reasons.push("Online ordering link is broken");
      } else if (!page.orderLink) {
        score += SCORING.opportunity.restaurantConfusingBooking;
        reasons.push("Page mentions ordering but no working order link");
      }
    }
  }

  if (score === 0) {
    reasons.push("Public site already covers the basic technical bar");
  }

  return { score: clamp(score), reasons };
}

export function classifyTier(
  businessScore: number,
  opportunityScore: number,
): QualificationTier {
  const { overall } = SCORING;
  if (
    businessScore >= overall.businessHigh &&
    opportunityScore >= overall.opportunityHigh
  ) {
    return "high_priority";
  }
  if (
    businessScore < overall.rejectBusinessBelow ||
    opportunityScore < overall.rejectOpportunityBelow
  ) {
    return "reject";
  }
  if (
    businessScore >= overall.businessQualified &&
    opportunityScore >= overall.opportunityQualified
  ) {
    return "qualified";
  }
  return "review";
}

export function scoreCandidate(
  business: NormalizedBusiness,
  inspection: InspectionResult,
): ScoreBreakdown {
  const businessPart = scoreBusinessStrength(business);
  const opportunityPart = scoreWebsiteOpportunity(business, inspection);
  const tier = classifyTier(businessPart.score, opportunityPart.score);
  const overall = clamp(
    businessPart.score * 0.48 + opportunityPart.score * 0.52,
  );
  const reasons = [
    `Business strength ${businessPart.score}`,
    `Website opportunity ${opportunityPart.score}`,
    `Tier ${tier}`,
    ...businessPart.reasons,
    ...opportunityPart.reasons,
  ];
  if (tier !== "high_priority" && opportunityPart.score >= SCORING.overall.opportunityHigh) {
    if (businessPart.score < SCORING.overall.businessHigh) {
      reasons.push(
        "Website is weak, but public business signals are not strong enough for high priority",
      );
    }
  }
  return {
    businessStrengthScore: businessPart.score,
    websiteOpportunityScore: opportunityPart.score,
    overallQualificationScore: overall,
    tier,
    reasons,
  };
}

export function leadStatusForTier(tier: QualificationTier): "rejected" | "discovered" | "qualified" {
  if (tier === "reject") return "rejected";
  if (tier === "review") return "discovered";
  return "qualified";
}

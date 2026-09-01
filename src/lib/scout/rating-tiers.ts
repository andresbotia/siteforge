/**
 * Deterministic rating/review-volume classification. Provider-neutral in
 * code (any source could in principle supply rating/reviewCount), but in
 * practice this is meaningful today only for Google-sourced candidates --
 * OpenStreetMap has no rating/review concept at all, so an OSM-sourced
 * business is always UNKNOWN/UNKNOWN here, correctly.
 *
 * These tiers are a labeling/display layer on top of the existing
 * businessStrength scoring math (scoring.ts), not a replacement for it --
 * scoring.ts's own point thresholds already produce the correct qualitative
 * ordering (e.g. 4.6/487 outranks 4.9/11) and are left unchanged.
 */

export const REVIEW_VOLUME_TIERS = ["EMERGING", "ESTABLISHED", "STRONG", "VERY_STRONG", "MAJOR_LOCAL_PRESENCE"] as const;
export type ReviewVolumeTier = (typeof REVIEW_VOLUME_TIERS)[number];

export const RATING_TIERS = ["EXCELLENT", "STRONG", "VIABLE", "LOWER_PRIORITY", "WEAK"] as const;
export type RatingTier = (typeof RATING_TIERS)[number];

/**
 * `null` means "no review count is known" -- distinct from an explicit `0`,
 * which is a real, reportable fact (EMERGING, not UNKNOWN). Never coerce a
 * missing count to zero before calling this.
 */
export function classifyReviewVolumeTier(reviewCount: number | null): ReviewVolumeTier | "UNKNOWN" {
  if (reviewCount === null || !Number.isFinite(reviewCount)) return "UNKNOWN";
  if (reviewCount >= 1000) return "MAJOR_LOCAL_PRESENCE";
  if (reviewCount >= 500) return "VERY_STRONG";
  if (reviewCount >= 100) return "STRONG";
  if (reviewCount >= 25) return "ESTABLISHED";
  return "EMERGING";
}

/** `null` means "no rating is known" -- never coerce a missing rating to zero stars before calling this. */
export function classifyRatingTier(rating: number | null): RatingTier | "UNKNOWN" {
  if (rating === null || !Number.isFinite(rating)) return "UNKNOWN";
  if (rating >= 4.5) return "EXCELLENT";
  if (rating >= 4.0) return "STRONG";
  if (rating >= 3.5) return "VIABLE";
  if (rating >= 3.0) return "LOWER_PRIORITY";
  return "WEAK";
}

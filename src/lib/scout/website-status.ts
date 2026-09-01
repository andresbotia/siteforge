import { GOOGLE_PLACES_PROVIDER_ID } from "./limits";
import type { InspectionResult, NormalizedBusiness } from "./types";

/**
 * A deterministic, conservative classification of website presence.
 * Deliberately does NOT collapse "source omitted a URL" into a single "no
 * website" bucket -- see HANDOFF.md's Scout V1.1 session for the real
 * failure this fixes: OpenStreetMap omitting a website field for three real
 * businesses (Perfect Choice Nursery, The Time Is Now Design & Build,
 * Verdant Lyfe) was previously scored as if it were strong evidence of "no
 * website," when all three had real, working, official sites.
 *
 * `website_not_listed_by_provider` vs `no_standalone_website_unverified`:
 * the two "no URL found" buckets are split by source confidence.
 * Google Business Profile data is business-controlled (owners actively
 * manage it, and Google surfaces a website field when the owner has
 * supplied one), so Google explicitly having no `websiteUri` is a real,
 * moderately-trustworthy signal. OpenStreetMap is community-maintained and
 * frequently just incomplete -- silence there proves nothing. Only a
 * source in HIGH_CONFIDENCE_WEBSITE_PROVIDERS earns the stronger bucket;
 * everything else (including no source data at all) stays in the weakest,
 * most conservative bucket. Neither bucket is treated as "no website" with
 * high confidence -- see commercial-score.ts's opportunity-input weighting,
 * which deliberately keeps both well below social_or_directory_only.
 */
export const WEBSITE_STATUSES = [
  "working_standalone_website",
  "website_unreachable",
  "social_or_directory_only",
  "website_not_listed_by_provider",
  "no_standalone_website_unverified",
] as const;
export type WebsiteStatus = (typeof WEBSITE_STATUSES)[number];

const HIGH_CONFIDENCE_WEBSITE_PROVIDERS = new Set<string>([GOOGLE_PLACES_PROVIDER_ID]);

export function isHighConfidenceWebsiteProvider(source: string): boolean {
  return HIGH_CONFIDENCE_WEBSITE_PROVIDERS.has(source);
}

export function classifyWebsiteStatus(business: NormalizedBusiness, inspection: InspectionResult): WebsiteStatus {
  if (business.websiteUrl) {
    return inspection.reachable ? "working_standalone_website" : "website_unreachable";
  }
  if (business.instagramUrl || business.facebookUrl) return "social_or_directory_only";
  if (isHighConfidenceWebsiteProvider(business.source)) return "website_not_listed_by_provider";
  return "no_standalone_website_unverified";
}

export function websiteStatusLabel(status: WebsiteStatus): string {
  switch (status) {
    case "working_standalone_website":
      return "Working standalone website";
    case "website_unreachable":
      return "Website listed but unreachable";
    case "social_or_directory_only":
      return "Social/directory presence only -- no standalone website verified";
    case "website_not_listed_by_provider":
      return "No website listed by a high-confidence provider (e.g. Google) -- not yet a confirmed no-website business";
    case "no_standalone_website_unverified":
      return "No standalone website verified (source did not list one)";
  }
}

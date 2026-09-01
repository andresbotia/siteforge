import type { InspectionResult, NormalizedBusiness } from "./types";

/**
 * A deterministic, conservative classification of website presence.
 * Deliberately does NOT collapse "source omitted a URL" and "we confirmed
 * no site exists" into one "no website" bucket -- Scout V1 has no $0 search
 * mechanism that can affirmatively prove absence, so the weakest bucket
 * stays labeled as unverified rather than a confident claim.
 */
export const WEBSITE_STATUSES = [
  "working_standalone_website",
  "website_unreachable",
  "social_or_directory_only",
  "no_standalone_website_unverified",
] as const;
export type WebsiteStatus = (typeof WEBSITE_STATUSES)[number];

export function classifyWebsiteStatus(business: NormalizedBusiness, inspection: InspectionResult): WebsiteStatus {
  if (business.websiteUrl) {
    return inspection.reachable ? "working_standalone_website" : "website_unreachable";
  }
  if (business.instagramUrl || business.facebookUrl) return "social_or_directory_only";
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
    case "no_standalone_website_unverified":
      return "No standalone website verified (source did not list one)";
  }
}

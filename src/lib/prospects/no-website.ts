import { asRecord } from "@/lib/json";

export const NO_STANDALONE_WEBSITE_STATUS = "verified_no_standalone_website";

export type NoStandaloneWebsiteSummary = {
  website_status: typeof NO_STANDALONE_WEBSITE_STATUS;
  no_standalone_website: true;
  website_inspection: "not_applicable_no_standalone_website";
  verification_method: "operator_manual_public_search";
  public_data_only: true;
};

export function noStandaloneWebsiteSummary(): NoStandaloneWebsiteSummary {
  return {
    website_status: NO_STANDALONE_WEBSITE_STATUS,
    no_standalone_website: true,
    website_inspection: "not_applicable_no_standalone_website",
    verification_method: "operator_manual_public_search",
    public_data_only: true,
  };
}

export function isNoStandaloneWebsiteSummary(value: unknown): boolean {
  const summary = asRecord(value);
  return (
    summary.no_standalone_website === true &&
    summary.website_status === NO_STANDALONE_WEBSITE_STATUS &&
    summary.website_inspection === "not_applicable_no_standalone_website"
  );
}

export function isNoStandaloneWebsiteLead(lead: {
  websiteUrl?: string | null;
  website_url?: string | null;
  inspectionSummary?: unknown;
  inspection_summary?: unknown;
}): boolean {
  const websiteUrl = lead.websiteUrl ?? lead.website_url ?? null;
  return !websiteUrl && isNoStandaloneWebsiteSummary(lead.inspectionSummary ?? lead.inspection_summary);
}

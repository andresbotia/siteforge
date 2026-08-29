/** Centralized Auditor bounds. Do not scatter these constants. */

export const AUDITOR_VERSION = "auditor.v1";

export const AUDITOR_USER_AGENT =
  "SiteForge-Auditor/0.1 (+https://github.com/andresbotia/siteforge)";

export const AUDITOR_FETCH_TIMEOUT_MS = 8_000;
export const AUDITOR_MAX_RESPONSE_BYTES = 512_000;
export const AUDITOR_MAX_REDIRECTS = 4;
/** Homepage plus up to 5 additional internal pages. */
export const AUDITOR_MAX_PAGES = 6;
export const AUDITOR_MAX_INTERNAL_PAGES = 5;
export const AUDITOR_MAX_LINK_CHECKS = 8;

export const AUDITOR_COST_USD = 0;
export const AUDITOR_PROVIDER_ID = "deterministic_inspect" as const;
export const AUDITOR_PROVIDER_LABEL = "Deterministic website inspection";

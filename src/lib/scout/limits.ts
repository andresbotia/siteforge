/** Centralized Scout bounds. No magic numbers in fetch/score paths. */

export const SCOUT_USER_AGENT =
  "SiteForge-Scout/0.1 (+https://github.com/andresbotia/siteforge)";

export const SCOUT_FETCH_TIMEOUT_MS = 8_000;
export const SCOUT_MAX_RESPONSE_BYTES = 512_000;
export const SCOUT_MAX_REDIRECTS = 4;
export const SCOUT_MAX_PAGES = 3;
export const SCOUT_MAX_LINKS_TO_CHECK = 8;
export const SCOUT_MAX_CANDIDATES = 25;
export const SCOUT_DEFAULT_CANDIDATES = 10;

export const SCOUT_DISCOVERY_COST_USD = 0;
export const SCOUT_PROVIDER_ID = "mock_catalog" as const;
export const SCOUT_PROVIDER_LABEL = "Local public catalog (demo)";

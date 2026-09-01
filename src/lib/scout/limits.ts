/** Centralized Scout bounds. No magic numbers in fetch/score paths. */

export const SCOUT_USER_AGENT =
  "SiteForge-Scout/0.1 (+https://github.com/andresbotia/siteforge)";

export const SCOUT_FETCH_TIMEOUT_MS = 8_000;
export const SCOUT_MAX_RESPONSE_BYTES = 512_000;
export const SCOUT_MAX_REDIRECTS = 4;
export const SCOUT_MAX_PAGES = 3;
export const SCOUT_MAX_LINKS_TO_CHECK = 8;
export const SCOUT_MAX_CANDIDATES = 50;
export const SCOUT_DEFAULT_CANDIDATES = 25;

/** Bounded concurrency for website inspection during a real Scout run. */
export const SCOUT_INSPECTION_CONCURRENCY = 4;

/**
 * Hard ceiling on total external HTTP requests (discovery + website
 * inspection) for one Scout run. Worst case per candidate is
 * 1 (homepage) + SCOUT_MAX_LINKS_TO_CHECK, so this bounds how many
 * discovered candidates get inspected -- the rest are reported as
 * "not inspected due to the run's request ceiling" rather than inspected
 * without limit. This is a real-request budget, not a display limit.
 */
export const SCOUT_MAX_EXTERNAL_REQUESTS_PER_RUN = 300;

export const SCOUT_DISCOVERY_COST_USD = 0;
export const SCOUT_PROVIDER_ID = "mock_catalog" as const;
export const SCOUT_PROVIDER_LABEL = "Local public catalog (demo)";

/** Real, $0, keyless discovery provider for Scout V1 -- see providers/overpass.ts. */
export const SCOUT_REAL_PROVIDER_ID = "openstreetmap_overpass" as const;
export const SCOUT_REAL_PROVIDER_LABEL = "OpenStreetMap (Overpass API, public, keyless)";
export const SCOUT_DISCOVERY_FETCH_TIMEOUT_MS = 20_000;
export const SCOUT_DISCOVERY_MAX_RESPONSE_BYTES = 2_000_000;

/**
 * Official Google Places API (New) provider -- see providers/google-places.ts.
 * Preferred over Overpass when GOOGLE_PLACES_API_KEY is configured, because
 * Google Business Profile data is business-controlled (rating, review
 * count, and website presence/absence are far more reliable than OSM's
 * community-maintained tags). This is a billable Google Cloud API, so every
 * bound here is deliberately conservative -- see HANDOFF.md's Scout V1.1
 * session for the false-opportunity failure this provider fixes.
 */
export const GOOGLE_PLACES_PROVIDER_ID = "google_places" as const;
export const GOOGLE_PLACES_PROVIDER_LABEL = "Google Places API (New) -- Text Search";
/** Exactly one Text Search request per Scout run. No pagination, no retries. Enforced by construction, named here for clarity/reporting. */
export const GOOGLE_PLACES_MAX_REQUESTS_PER_RUN = 1;
/** Google Text Search (New) caps a single page at 20 results. */
export const GOOGLE_PLACES_MAX_RESULTS_PER_REQUEST = 20;
/** Conservative default monthly ceiling on Google Places requests across all Scout runs, operator-overridable via GOOGLE_PLACES_MONTHLY_REQUEST_CEILING. */
export const GOOGLE_PLACES_DEFAULT_MONTHLY_REQUEST_CEILING = 300;

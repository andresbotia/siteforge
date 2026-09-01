import { getScoutCategory, type ScoutCategoryId } from "../categories";
import type { BusinessDiscoveryProvider, DiscoveryCost, DiscoveryResult } from "../discovery";
import {
  GOOGLE_PLACES_MAX_RESULTS_PER_REQUEST,
  GOOGLE_PLACES_PROVIDER_ID,
  GOOGLE_PLACES_PROVIDER_LABEL,
  SCOUT_DISCOVERY_FETCH_TIMEOUT_MS,
  SCOUT_DISCOVERY_MAX_RESPONSE_BYTES,
  SCOUT_USER_AGENT,
} from "../limits";
import { parseLocation } from "../normalize";
import type { DiscoveredBusiness, DiscoverySource, GoogleBusinessStatus, ScoutRunConfig } from "../types";
import { getGooglePlacesConfigFromEnv } from "./google-config";

/**
 * Real discovery/qualification via the official Google Places API (New) --
 * Text Search. https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Preferred over OpenStreetMap Overpass when GOOGLE_PLACES_API_KEY is
 * configured: Google Business Profile data is business-controlled (an
 * owner actively manages it), while OpenStreetMap is community-maintained
 * and frequently just incomplete. This directly fixes a real Scout V1
 * failure documented in HANDOFF.md's Scout V1.1 session: real, established
 * Broward County landscaping businesses with working official websites
 * that OSM simply had no website tag for, which Scout treated as a "no
 * website" opportunity signal. This module resolves websites generically
 * from whatever a provider's response contains -- it has no branch keyed
 * to any specific business name or URL (see google-places.test.ts's
 * regression coverage, which supplies real examples only as mock response
 * data, never as production logic).
 *
 * No scraping: only the documented Text Search (New) HTTP endpoint is
 * used, with an explicit, minimal field mask (never a wildcard). Exactly
 * ONE request per Scout run -- no pagination, no automatic retries. See
 * checkGoogleMonthlyUsageGuard() in src/data/scout.ts for the additional
 * monthly ceiling layered on top of this in the production Scout run path.
 */

const GOOGLE_TEXT_SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/**
 * Explicit, minimal field mask -- every field is one SiteForge actually
 * uses downstream. Never `X-Goog-FieldMask: *`.
 *   - id: Google Place ID (dedupe, provenance)
 *   - displayName: business name
 *   - formattedAddress: address/facts-completeness (city/state parsed from it)
 *   - businessStatus: OPERATIONAL/CLOSED_* -- a real businessStrength signal
 *   - rating, userRatingCount: the whole reason this provider exists
 *   - websiteUri: the official-website candidate (still independently
 *     inspected by SiteForge -- never trusted blindly, never bypasses SSRF)
 *   - nationalPhoneNumber: contactability
 *   - location: geographic confidence
 *   - primaryType: category confidence
 * Deliberately excludes review text, photos, generative summaries, and
 * atmosphere fields -- SiteForge never needs review content, and keeping
 * the mask narrow keeps the billing surface narrow too. Opening hours are
 * also excluded for the same reason (not required for V1.1 scoring).
 */
export const GOOGLE_PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.location",
  "places.primaryType",
].join(",");

export type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
};

export type GoogleFetchResult = { status: number; body: string };
/** Injectable so tests never need a live network call or a real API key. */
export type GoogleFetcher = (apiKey: string, requestBody: string) => Promise<GoogleFetchResult>;

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * The real HTTP call. Not routed through the shared SafeHttpClient
 * (src/lib/http/fetch.ts) because that interface is GET/HEAD-only with no
 * custom-header support, and Google's Text Search (New) requires a POST
 * with an API-key header and a JSON body. The endpoint itself is a fixed,
 * first-party Google domain (not user-supplied), so SSRF checks -- which
 * exist to validate untrusted/redirect-driven URLs -- do not apply here
 * the way they do to inspecting a prospect's own website. Mirrors
 * createLiveHttpClient's own timeout/size-bound pattern.
 */
function defaultGoogleFetcher(): GoogleFetcher {
  return async (apiKey, requestBody) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCOUT_DISCOVERY_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(GOOGLE_TEXT_SEARCH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
          "User-Agent": SCOUT_USER_AGENT,
        },
        body: requestBody,
        signal: controller.signal,
      });
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > SCOUT_DISCOVERY_MAX_RESPONSE_BYTES) {
            await reader.cancel();
            throw new Error("google_places_response_too_large");
          }
          chunks.push(value);
        }
      }
      const text = new TextDecoder("utf-8", { fatal: false }).decode(concatChunks(chunks));
      return { status: response.status, body: text };
    } finally {
      clearTimeout(timer);
    }
  };
}

export const GOOGLE_PLACES_COST: DiscoveryCost = {
  usd: 0,
  paid: true,
  providerId: GOOGLE_PLACES_PROVIDER_ID,
  providerLabel: GOOGLE_PLACES_PROVIDER_LABEL,
  notes:
    "Billable Google Cloud API even within a free monthly allowance. usd is reported as 0 here because SiteForge does not assert a specific live per-request price -- consult Google Cloud Console billing for actual cost. Usage is bounded by a per-run request cap and an operator-configurable monthly ceiling (see checkGoogleMonthlyUsageGuard in src/data/scout.ts).",
};

export function buildGoogleTextSearchQuery(categoryLabel: string, location: string): string {
  return `${categoryLabel} in ${location}`;
}

const VALID_BUSINESS_STATUSES = new Set<string>(["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]);

/**
 * Best-effort city/state extraction from Google's formattedAddress string
 * (e.g. "1234 Main St, Fort Lauderdale, FL 33301, USA"). Never invents a
 * value: falls back to the city/state the operator actually searched for
 * (a real fact -- "this business was found searching this area"), never to
 * a fabricated placeholder.
 */
export function parseCityStateFromFormattedAddress(
  address: string | null | undefined,
  fallback: { city: string; state: string },
): { city: string; state: string } {
  if (!address) return fallback;
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const stateZipIndex = parts.findIndex((part) => /^[A-Za-z]{2}\s*\d{0,5}$/.test(part));
  if (stateZipIndex > 0) {
    const city = parts[stateZipIndex - 1];
    const stateMatch = parts[stateZipIndex].match(/^([A-Za-z]{2})/);
    return {
      city: city || fallback.city,
      state: stateMatch ? stateMatch[1].toUpperCase() : fallback.state,
    };
  }
  return fallback;
}

export function parseGooglePlace(
  place: GooglePlace,
  config: {
    categoryId: ScoutCategoryId;
    industry: string;
    query: string;
    retrievedAt: string;
    fallbackCity: string;
    fallbackState: string;
  },
): DiscoveredBusiness | null {
  const name = place.displayName?.text?.trim();
  if (!name) return null; // Never invent a business name for an unnamed place.

  const { city, state } = parseCityStateFromFormattedAddress(place.formattedAddress, { city: config.fallbackCity, state: config.fallbackState });
  const businessStatus: GoogleBusinessStatus | null =
    place.businessStatus && VALID_BUSINESS_STATUSES.has(place.businessStatus) ? (place.businessStatus as GoogleBusinessStatus) : null;
  const source: DiscoverySource = { provider: GOOGLE_PLACES_PROVIDER_ID, query: config.query, retrievedAt: config.retrievedAt };

  return {
    name,
    categoryId: config.categoryId,
    industry: config.industry,
    city,
    state,
    address: place.formattedAddress?.trim() || null,
    websiteUrl: place.websiteUri?.trim() || null,
    phone: place.nationalPhoneNumber?.trim() || null,
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    source: GOOGLE_PLACES_PROVIDER_ID,
    placeId: place.id ?? null,
    businessStatus,
    sourceUrl: place.id ? `https://www.google.com/maps/place/?q=place_id:${place.id}` : null,
    sources: [source],
  };
}

function classifyHttpDiagnostic(status: number): string {
  if (status === 429) {
    return "google_places_quota_exceeded (HTTP 429): the configured Google Cloud project's quota was exhausted for this request. No retry was attempted.";
  }
  if (status === 401 || status === 403) {
    // Never include the key value itself, even redacted-looking, in a diagnostic.
    return `google_places_auth_error (HTTP ${status}): the configured GOOGLE_PLACES_API_KEY was rejected. Check the key, its restrictions, and that Places API (New) is enabled for the project.`;
  }
  return `google_places_http_${status}: the Google Places API returned an unexpected status.`;
}

export function createGooglePlacesDiscoveryProvider(deps?: { fetcher?: GoogleFetcher; env?: NodeJS.ProcessEnv }): BusinessDiscoveryProvider {
  const env = deps?.env ?? process.env;
  const config = getGooglePlacesConfigFromEnv(env);
  const fetcher = deps?.fetcher ?? defaultGoogleFetcher();

  return {
    id: GOOGLE_PLACES_PROVIDER_ID,
    label: GOOGLE_PLACES_PROVIDER_LABEL,
    cost: GOOGLE_PLACES_COST,
    async search(runConfig: ScoutRunConfig): Promise<DiscoveryResult> {
      if (!config) {
        return {
          businesses: [],
          diagnostic: "google_places_not_configured: GOOGLE_PLACES_API_KEY is not set server-side. Configure it to use Google Places discovery; falling back to OpenStreetMap Overpass.",
        };
      }
      const category = getScoutCategory(runConfig.categoryId);
      if (!category) return { businesses: [], diagnostic: "unknown_category" };

      const query = buildGoogleTextSearchQuery(category.label, runConfig.location);
      const retrievedAt = new Date().toISOString();
      const requestBody = JSON.stringify({
        textQuery: query,
        maxResultCount: Math.min(runConfig.limit, GOOGLE_PLACES_MAX_RESULTS_PER_REQUEST),
      });

      let result: GoogleFetchResult;
      try {
        result = await fetcher(config.apiKey, requestBody);
      } catch (error) {
        return { businesses: [], diagnostic: `google_places_network_error: ${error instanceof Error ? error.message : "unknown_error"}` };
      }

      if (result.status !== 200) {
        return { businesses: [], diagnostic: classifyHttpDiagnostic(result.status) };
      }

      let parsed: { places?: GooglePlace[] };
      try {
        parsed = JSON.parse(result.body);
      } catch {
        return { businesses: [], diagnostic: "google_places_invalid_response: could not parse the Google Places JSON response." };
      }

      const places = parsed.places ?? [];
      const fallbackLocation = parseLocation(runConfig.location);
      const seen = new Set<string>();
      const businesses: DiscoveredBusiness[] = [];
      for (const place of places) {
        const business = parseGooglePlace(place, {
          categoryId: runConfig.categoryId,
          industry: category.industry,
          query,
          retrievedAt,
          fallbackCity: fallbackLocation.city,
          fallbackState: fallbackLocation.state,
        });
        if (!business) continue;
        // Deduplicate by Place ID first (the strongest identity signal);
        // fall back to name+address only for the rare place with no id.
        const dedupeKey = business.placeId ?? `${business.name.toLowerCase()}|${business.address ?? ""}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        businesses.push(business);
        if (businesses.length >= runConfig.limit) break;
      }

      return {
        businesses,
        diagnostic: businesses.length === 0 ? `no_results_found: 0 named places matched "${query}".` : null,
      };
    },
  };
}

import { createLiveHttpClient, SafeFetchError, type SafeHttpClient } from "@/lib/http/fetch";
import { getScoutCategory, type ScoutCategoryId } from "../categories";
import type { BusinessDiscoveryProvider, DiscoveryCost, DiscoveryResult } from "../discovery";
import {
  SCOUT_DISCOVERY_FETCH_TIMEOUT_MS,
  SCOUT_DISCOVERY_MAX_RESPONSE_BYTES,
  SCOUT_REAL_PROVIDER_ID,
  SCOUT_REAL_PROVIDER_LABEL,
  SCOUT_USER_AGENT,
} from "../limits";
import { resolveScoutLocation, type ScoutLocationBounds } from "../locations";
import type { DiscoveredBusiness, DiscoverySource, ScoutRunConfig } from "../types";
import { osmTagsForCategory, type OsmTagFilter } from "./osm-tags";

/**
 * Real, $0, keyless discovery via the public OpenStreetMap Overpass API
 * (https://overpass-api.de/api/interpreter, ODbL data, MIT-adjacent public
 * usage policy -- no account, no API key). Chosen over search-engine HTML
 * scraping because it is a genuine public API with a documented usage
 * policy for exactly this kind of bounded, keyless query, not a scrape of a
 * search results page. It does NOT provide ratings/review counts (OSM has
 * no such concept) -- those are always null here, which is correct, not a
 * bug: Scout must never invent them.
 *
 * A real connectivity test during this session found: GET with a small,
 * short-timeout query is fast and reliable; POST and large/slow area-based
 * queries against this shared free instance repeatedly hit its own
 * dispatcher timeout (504) or per-IP rate limit (429) even for modest
 * requests. This provider therefore always uses GET with a small bounding
 * box (see ../locations.ts) and a single request per Scout run, and fails
 * soft (empty result + diagnostic) rather than retrying against a busy
 * shared resource.
 */

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export const OVERPASS_DISCOVERY_COST: DiscoveryCost = {
  usd: 0,
  paid: false,
  providerId: SCOUT_REAL_PROVIDER_ID,
  providerLabel: SCOUT_REAL_PROVIDER_LABEL,
  notes: "Public OpenStreetMap Overpass API. No API key, no paid tier. Subject to the shared public instance's own rate limits.",
};

export function buildOverpassQuery(bounds: ScoutLocationBounds, tags: OsmTagFilter[], limit: number): string {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const clauses = tags.map((tag) => `  node["${tag.key}"="${tag.value}"](${bbox});\n  way["${tag.key}"="${tag.value}"](${bbox});`).join("\n");
  const outCount = Math.max(5, Math.min(150, limit * 3));
  return `[out:json][timeout:20];\n(\n${clauses}\n);\nout center ${outCount};`;
}

function stripLeadingAt(value: string): string {
  return value.trim().replace(/^@/, "");
}

function socialUrl(rawValue: string | undefined, host: string): string | null {
  if (!rawValue) return null;
  const value = rawValue.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const handle = stripLeadingAt(value);
  if (!handle) return null;
  return `https://${host}/${handle}`;
}

function normalizeWebsite(rawValue: string | undefined): string | null {
  if (!rawValue) return null;
  const value = rawValue.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function parseOverpassElement(
  element: OverpassElement,
  config: { categoryId: ScoutCategoryId; industry: string; query: string; retrievedAt: string },
): DiscoveredBusiness | null {
  const tags = element.tags ?? {};
  const name = tags.name?.trim();
  if (!name) return null; // Never invent a business name for an unnamed OSM object.

  const city = tags["addr:city"]?.trim() || "";
  const state = (tags["addr:state"]?.trim() || "FL").toUpperCase();
  const streetParts = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim();
  const address = streetParts || null;
  const phone = (tags.phone || tags["contact:phone"] || "").trim() || null;
  const email = (tags.email || tags["contact:email"] || "").trim() || null;
  const website = normalizeWebsite(tags.website || tags["contact:website"]);
  const instagram = socialUrl(tags["contact:instagram"] || tags.instagram, "www.instagram.com");
  const facebook = socialUrl(tags["contact:facebook"] || tags.facebook, "www.facebook.com");
  const hours = tags.opening_hours?.trim() || null;
  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
  const source: DiscoverySource = { provider: SCOUT_REAL_PROVIDER_ID, query: config.query, retrievedAt: config.retrievedAt };

  return {
    name,
    categoryId: config.categoryId,
    industry: config.industry,
    city: city || "Unknown",
    state,
    address,
    websiteUrl: website,
    phone,
    rating: null,
    reviewCount: null,
    source: SCOUT_REAL_PROVIDER_ID,
    likelyChain: tags.brand ? true : undefined,
    email,
    instagramUrl: instagram,
    facebookUrl: facebook,
    hours,
    sourceUrl,
    sources: [source],
  };
}

function classifyHttpDiagnostic(status: number): string {
  if (status === 429) {
    return "provider_rate_limited (HTTP 429): the free public Overpass instance is shared and temporarily rate-limited this run. Try again later.";
  }
  if (status === 504 || status === 503) {
    return `provider_busy (HTTP ${status}): the free public Overpass instance's dispatcher timed out or was unavailable. Try again later.`;
  }
  return `provider_http_${status}: the discovery provider returned an unexpected status.`;
}

export function createOverpassDiscoveryProvider(deps?: { http?: SafeHttpClient }): BusinessDiscoveryProvider {
  const http = deps?.http ?? createLiveHttpClient(SCOUT_USER_AGENT);
  return {
    id: SCOUT_REAL_PROVIDER_ID,
    label: SCOUT_REAL_PROVIDER_LABEL,
    cost: OVERPASS_DISCOVERY_COST,
    async search(config: ScoutRunConfig): Promise<DiscoveryResult> {
      const category = getScoutCategory(config.categoryId);
      if (!category) return { businesses: [], diagnostic: "unknown_category" };

      const tags = osmTagsForCategory(config.categoryId);
      if (tags.length === 0) {
        return {
          businesses: [],
          diagnostic: `no_discovery_mapping: no OpenStreetMap tag mapping exists yet for category "${config.categoryId}". This is a real V1 coverage gap, not an error.`,
        };
      }

      const location = resolveScoutLocation(config.location);
      if (!location.ok) {
        return {
          businesses: [],
          diagnostic: `${location.reason} Supported: ${location.supportedLocations.join(", ")}.`,
        };
      }

      const query = buildOverpassQuery(location.bounds, tags, config.limit);
      const retrievedAt = new Date().toISOString();
      const queryLabel = `${tags.map((t) => `${t.key}=${t.value}`).join(",")} near ${location.bounds.label}`;

      let body: string;
      try {
        const url = `${OVERPASS_ENDPOINT}?data=${encodeURIComponent(query)}`;
        const result = await http.fetch(url, {
          timeoutMs: SCOUT_DISCOVERY_FETCH_TIMEOUT_MS,
          maxBytes: SCOUT_DISCOVERY_MAX_RESPONSE_BYTES,
          method: "GET",
        });
        if (result.status !== 200) {
          return { businesses: [], diagnostic: classifyHttpDiagnostic(result.status) };
        }
        body = result.body;
      } catch (error) {
        const message = error instanceof SafeFetchError ? error.code : error instanceof Error ? error.message : "unknown_error";
        return { businesses: [], diagnostic: `provider_network_error: ${message}` };
      }

      let parsed: { elements?: OverpassElement[] };
      try {
        parsed = JSON.parse(body);
      } catch {
        return { businesses: [], diagnostic: "provider_invalid_response: could not parse the Overpass JSON response." };
      }

      const elements = parsed.elements ?? [];
      const seen = new Set<string>();
      const businesses: DiscoveredBusiness[] = [];
      for (const element of elements) {
        const business = parseOverpassElement(element, {
          categoryId: config.categoryId,
          industry: category.industry,
          query: queryLabel,
          retrievedAt,
        });
        if (!business) continue;
        const dedupeKey = `${business.name.toLowerCase()}|${business.address ?? ""}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        businesses.push(business);
        if (businesses.length >= config.limit) break;
      }

      return {
        businesses,
        diagnostic: businesses.length === 0 ? `no_results_found: 0 named businesses matched ${queryLabel} in the OpenStreetMap data.` : null,
      };
    },
  };
}

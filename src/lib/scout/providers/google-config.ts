import { GOOGLE_PLACES_DEFAULT_MONTHLY_REQUEST_CEILING as DEFAULT_MONTHLY_CEILING } from "../limits";

/**
 * Server-only configuration reader for the Google Places API (New)
 * provider. Mirrors src/lib/supabase/config-core.ts's pattern: a pure
 * function reading directly from a plain env object, no "server-only"
 * import marker (so a standalone tsx script can use it too), no caching,
 * no side effects. GOOGLE_PLACES_API_KEY is deliberately NOT prefixed
 * NEXT_PUBLIC_ -- it must never reach a client bundle.
 *
 * The app builds and every test passes with this variable absent. When
 * absent, Google Places discovery reports itself unavailable with a clear
 * diagnostic (see providers/google-places.ts) rather than throwing, and
 * Scout falls back to the OpenStreetMap Overpass provider.
 */
export type GooglePlacesConfig = {
  apiKey: string;
};

export function getGooglePlacesConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GooglePlacesConfig | null {
  const apiKey = env.GOOGLE_PLACES_API_KEY?.trim() ?? "";
  if (!apiKey) return null;
  return { apiKey };
}

export function isGooglePlacesConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getGooglePlacesConfigFromEnv(env) !== null;
}

export function getGooglePlacesMonthlyCeiling(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.GOOGLE_PLACES_MONTHLY_REQUEST_CEILING?.trim();
  if (!raw) return DEFAULT_MONTHLY_CEILING;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MONTHLY_CEILING;
}

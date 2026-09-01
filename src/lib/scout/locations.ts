/**
 * Static, deterministic geography table for Scout V1's real discovery
 * provider. Overpass supports resolving an OSM administrative-boundary
 * "area" by name, but that resolution proved slow/unreliable against the
 * free shared instance during real testing (repeated timeouts); a small
 * bounding box for each explicitly-supported location is fast, deterministic,
 * and honest about what Scout V1 actually covers. This is a real, disclosed
 * V1 limitation, not a placeholder pretending to be general-purpose.
 *
 * The operator is not limited to Broward County -- add another entry here
 * to extend coverage. An unsupported location fails closed with the list of
 * what IS supported, rather than silently returning nothing or guessing a
 * bounding box.
 */
export type ScoutLocationBounds = {
  key: string;
  label: string;
  south: number;
  west: number;
  north: number;
  east: number;
};

export const SUPPORTED_SCOUT_LOCATIONS: ScoutLocationBounds[] = [
  { key: "broward_county_fl", label: "Broward County, FL", south: 25.95, west: -80.87, north: 26.33, east: -80.05 },
  { key: "fort_lauderdale_fl", label: "Fort Lauderdale, FL", south: 26.06, west: -80.21, north: 26.2, east: -80.09 },
  { key: "coconut_creek_fl", label: "Coconut Creek, FL", south: 26.24, west: -80.23, north: 26.3, east: -80.14 },
  { key: "pompano_beach_fl", label: "Pompano Beach, FL", south: 26.2, west: -80.19, north: 26.29, east: -80.06 },
  { key: "coral_springs_fl", label: "Coral Springs, FL", south: 26.24, west: -80.28, north: 26.31, east: -80.2 },
  { key: "boca_raton_fl", label: "Boca Raton, FL", south: 26.31, west: -80.16, north: 26.42, east: -80.05 },
  { key: "hollywood_fl", label: "Hollywood, FL", south: 25.98, west: -80.22, north: 26.03, east: -80.1 },
];

export type LocationResolution = { ok: true; bounds: ScoutLocationBounds } | { ok: false; reason: string; supportedLocations: string[] };

function shortName(label: string): string {
  return label.replace(/,\s*FL$/i, "").trim().toLowerCase();
}

export function resolveScoutLocation(rawLocation: string): LocationResolution {
  const query = rawLocation
    .trim()
    .toLowerCase()
    .replace(/,?\s*florida$/i, "")
    .replace(/,\s*fl$/i, "")
    .trim();
  const match = SUPPORTED_SCOUT_LOCATIONS.find((location) => {
    const short = shortName(location.label);
    if (short === query || short.startsWith(query) || query.startsWith(short)) return true;
    if (location.key === "broward_county_fl" && /^broward\b/.test(query)) return true;
    return false;
  });
  if (match) return { ok: true, bounds: match };
  return {
    ok: false,
    reason: `"${rawLocation}" is not yet a supported Scout V1 location.`,
    supportedLocations: SUPPORTED_SCOUT_LOCATIONS.map((location) => location.label),
  };
}

export function listSupportedScoutLocations(): string[] {
  return SUPPORTED_SCOUT_LOCATIONS.map((location) => location.label);
}

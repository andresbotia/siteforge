import type { ScoutCategoryId } from "../categories";

export type OsmTagFilter = { key: string; value: string };

/**
 * Category -> OpenStreetMap tag mapping for the real discovery provider.
 * Real-world OSM coverage varies a lot by category: food/retail/personal
 * services are usually well mapped; home-service trades without a public
 * storefront (pool services, detailing, general cleaning) are sparsely or
 * inconsistently tagged and are deliberately left unmapped here rather than
 * guessing a tag that would return noise. A category with no entry returns
 * zero discovery results with an explicit diagnostic (see providers/overpass.ts)
 * instead of silently substituting a wrong tag.
 */
const CATEGORY_OSM_TAGS: Partial<Record<ScoutCategoryId, OsmTagFilter[]>> = {
  plumbers: [{ key: "craft", value: "plumber" }],
  hvac: [{ key: "craft", value: "hvac" }],
  electricians: [{ key: "craft", value: "electrician" }],
  roofers: [{ key: "craft", value: "roofer" }],
  landscapers: [
    { key: "craft", value: "gardener" },
    { key: "shop", value: "garden_centre" },
  ],
  pest_control: [{ key: "craft", value: "pest_control" }],
  general_contractors: [{ key: "craft", value: "builder" }],
  auto_repair: [{ key: "shop", value: "car_repair" }],
  salons: [
    { key: "shop", value: "hairdresser" },
    { key: "shop", value: "beauty" },
  ],
  spas: [
    { key: "leisure", value: "spa" },
    { key: "shop", value: "massage" },
  ],
  professional_services: [
    { key: "office", value: "lawyer" },
    { key: "office", value: "accountant" },
    { key: "office", value: "insurance" },
    { key: "office", value: "estate_agent" },
  ],
  restaurants: [{ key: "amenity", value: "restaurant" }],
  cafes: [{ key: "amenity", value: "cafe" }],
  bakeries: [{ key: "shop", value: "bakery" }],
  casual_dining: [{ key: "amenity", value: "fast_food" }],
};

export function osmTagsForCategory(categoryId: ScoutCategoryId): OsmTagFilter[] {
  return CATEGORY_OSM_TAGS[categoryId] ?? [];
}

export function isDiscoveryTagMappingAvailable(categoryId: ScoutCategoryId): boolean {
  return osmTagsForCategory(categoryId).length > 0;
}

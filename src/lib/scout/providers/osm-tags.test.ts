import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isDiscoveryTagMappingAvailable, osmTagsForCategory } from "./osm-tags";

describe("OSM tag mapping", () => {
  it("maps common categories to at least one real OSM tag", () => {
    for (const category of ["plumbers", "hvac", "electricians", "landscapers", "restaurants", "salons", "professional_services"] as const) {
      assert.ok(osmTagsForCategory(category).length > 0, `expected a tag mapping for ${category}`);
      assert.equal(isDiscoveryTagMappingAvailable(category), true);
    }
  });

  it("honestly reports no mapping for categories with no reliable OSM coverage, rather than guessing", () => {
    for (const category of ["pool_services", "detailing", "cleaning"] as const) {
      assert.deepEqual(osmTagsForCategory(category), []);
      assert.equal(isDiscoveryTagMappingAvailable(category), false);
    }
  });
});

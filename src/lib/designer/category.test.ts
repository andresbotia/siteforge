import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDesignerCategoryContext } from "./category";

describe("designer category context (deterministic, Builder-independent)", () => {
  it("classifies a restaurant-family industry string", () => {
    const context = resolveDesignerCategoryContext("Taqueria");
    assert.equal(context.key, "restaurant");
    assert.ok(context.informationPriorities.some((item) => /menu/i.test(item)));
  });

  it("classifies landscaping distinctly from home trades", () => {
    assert.equal(resolveDesignerCategoryContext("Residential landscaping and lawn care").key, "landscaping");
    assert.equal(resolveDesignerCategoryContext("HVAC").key, "home_trades");
    assert.equal(resolveDesignerCategoryContext("Electrical").key, "home_trades");
  });

  it("classifies professional services and beauty/lifestyle categories", () => {
    assert.equal(resolveDesignerCategoryContext("Estate Planning Law Firm").key, "professional_services");
    assert.equal(resolveDesignerCategoryContext("Hair Salon").key, "beauty_lifestyle");
  });

  it("falls back to a generic context for an unrecognized category rather than guessing", () => {
    const context = resolveDesignerCategoryContext("Artisanal Kite Repair");
    assert.equal(context.key, "general_local_business");
    assert.ok(context.informationPriorities.length > 0);
  });

  it("never returns an empty priorities list for any resolved category", () => {
    for (const industry of ["Restaurant", "Landscaping", "Plumbing", "Law Firm", "Spa", "Artisanal Kite Repair"]) {
      assert.ok(resolveDesignerCategoryContext(industry).informationPriorities.length > 0);
    }
  });
});

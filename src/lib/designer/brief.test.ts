import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDesignerBrief } from "./brief";

describe("designer brief (Builder-agnostic)", () => {
  it("never references Builder's own design-system vocabulary", () => {
    const brief = buildDesignerBrief({
      industry: "Plumbing",
      exampleBusiness: {
        name: "Atlantic Drain Plumbing",
        city: "Boca Raton",
        region: "FL",
        hasPhone: true,
        hasAddress: true,
        hasRating: false,
        hasHours: false,
      },
    });
    // These are Builder's own preset/hero-treatment vocabulary
    // (src/lib/builder/design-system.ts, design-brief.ts) and must never
    // leak into a Designer Job's brief.
    for (const forbidden of ["designPreset", "image-overlay", "split-editorial", "trade-trust", "oklch(", "DESIGN_PRESETS"]) {
      assert.doesNotMatch(brief.markdown, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("lists available and unavailable fact categories without inventing any", () => {
    const brief = buildDesignerBrief({
      industry: "Landscaping",
      exampleBusiness: {
        name: "Cypress & Coast Landscape Co.",
        city: "Delray Beach",
        region: "FL",
        hasPhone: true,
        hasAddress: true,
        hasRating: false,
        hasHours: false,
      },
    });
    assert.match(brief.markdown, /Facts available.*phone.*street address/i);
    assert.match(brief.markdown, /Facts NOT available.*public rating.*opening hours/i);
    assert.match(brief.markdown, /never implied, never invented/i);
  });

  it("requires design thinking before coding", () => {
    const brief = buildDesignerBrief({ industry: "Electrical" });
    assert.match(brief.markdown, /Establish before coding/i);
    assert.match(brief.markdown, /visual personality specific to THIS category/i);
    assert.match(brief.markdown, /one distinctive visual moment/i);
  });

  it("falls back cleanly with no example business", () => {
    const brief = buildDesignerBrief({ industry: "Pool Service" });
    assert.match(brief.markdown, /Pool Service/);
    assert.doesNotMatch(brief.markdown, /Facts available/);
  });
});

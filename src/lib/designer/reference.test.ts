import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DESIGNER_REFERENCE_KINDS, resolveDesignerReference } from "./reference";

describe("designer reference architecture", () => {
  it("names all four reference kinds the architecture is scoped to support", () => {
    assert.deepEqual([...DESIGNER_REFERENCE_KINDS].sort(), ["approved_master", "category_reference", "gold_standard", "prior_revision"].sort());
  });

  it("V1 always resolves to the single approved gold-standard reference", () => {
    const reference = resolveDesignerReference();
    assert.equal(reference.kind, "gold_standard");
    assert.ok(reference.label.length > 0);
  });
});

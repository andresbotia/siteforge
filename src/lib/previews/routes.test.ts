import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPreviewEventPath,
  isPublicOutreachPreviewPath,
  isPublicPreviewPath,
} from "./routes";

describe("preview route helpers", () => {
  it("identifies only tokenized public preview pages", () => {
    assert.equal(isPublicPreviewPath("/p/sfp_example"), true);
    assert.equal(isPublicPreviewPath("/p/sfp_example/extra"), false);
    assert.equal(isPublicPreviewPath("/websites/123/preview"), false);
  });

  it("identifies the tracking endpoint for proxy bypass", () => {
    assert.equal(isPreviewEventPath("/api/preview-events"), true);
    assert.equal(isPreviewEventPath("/api/preview-events/extra"), false);
  });

  it("identifies only tokenized public outreach preview pages", () => {
    assert.equal(isPublicOutreachPreviewPath("/o/sfo_example"), true);
    assert.equal(isPublicOutreachPreviewPath("/o/sfo_example/extra"), false);
    assert.equal(isPublicOutreachPreviewPath("/p/sfp_example"), false);
  });
});

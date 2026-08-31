import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contrastPairs,
  contrastRatio,
  DESIGN_PRESET_KEYS,
  DESIGN_PRESETS,
  isDesignPresetKey,
  presetCssVariables,
} from "./design-system";
import { ACTIVE_TEMPLATES, TEMPLATE_REGISTRY, selectTemplateForIndustry, needsNewMasterTemplate } from "./registry";

describe("design presets", () => {
  it("exposes every declared key", () => {
    for (const key of DESIGN_PRESET_KEYS) {
      assert.equal(DESIGN_PRESETS[key].key, key);
      assert.ok(isDesignPresetKey(key));
    }
    assert.equal(isDesignPresetKey("neon-chaos"), false);
  });

  it("meets accessible contrast on every curated pair", () => {
    for (const key of DESIGN_PRESET_KEYS) {
      const preset = DESIGN_PRESETS[key];
      for (const pair of contrastPairs(preset)) {
        const ratio = contrastRatio(pair.foreground, pair.background);
        assert.ok(ratio !== null, `${key}: ${pair.label} colors must be 6-digit hex`);
        assert.ok(
          (ratio as number) >= pair.minimum,
          `${key}: ${pair.label} is ${(ratio as number).toFixed(2)}:1, below ${pair.minimum}:1`,
        );
      }
    }
  });

  it("computes known contrast ratios", () => {
    assert.equal(contrastRatio("#000000", "#ffffff"), 21);
    assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
    assert.equal(contrastRatio("not-a-color", "#ffffff"), null);
  });

  it("emits css variables for every token", () => {
    const vars = presetCssVariables(DESIGN_PRESETS["trade-trust"]);
    assert.equal(vars["--sf-accent"], DESIGN_PRESETS["trade-trust"].accent);
    assert.ok(vars["--sf-radius-control"]);
    assert.ok(vars["--sf-section-y"]);
    for (const [name, value] of Object.entries(vars)) {
      assert.ok(name.startsWith("--sf-"), `${name} must be namespaced`);
      assert.ok(value.trim().length > 0, `${name} must have a value`);
    }
  });
});

describe("template registry", () => {
  it("keeps registry keys, ids, and presets consistent", () => {
    for (const [key, definition] of Object.entries(TEMPLATE_REGISTRY)) {
      assert.equal(definition.key, key);
      assert.ok(definition.id.startsWith(`${key}@`), `${key} id must be versioned`);
      assert.ok(isDesignPresetKey(definition.designPreset));
      assert.ok(definition.requiredFacts.length > 0);
      assert.ok(definition.ctaCapabilities.length > 0);
      assert.ok(definition.industryKeywords.every((word) => word === word.toLowerCase()));
    }
  });

  it("selects templates deterministically from real-world industry labels", () => {
    assert.equal(selectTemplateForIndustry("Plumbing").template, "home-services-modern");
    assert.equal(
      selectTemplateForIndustry("Air Conditioning & Heating").template,
      "home-services-modern",
    );
    assert.equal(selectTemplateForIndustry("Taqueria").template, "restaurant-modern");
    assert.equal(selectTemplateForIndustry("Restaurant").template, "restaurant-modern");
    assert.equal(selectTemplateForIndustry("Dentistry").template, "professional-services-modern");
  });

  it("is stable across repeated calls", () => {
    const first = selectTemplateForIndustry("HVAC");
    const second = selectTemplateForIndustry("HVAC");
    assert.deepEqual(first, second);
  });

  it("reports a fallback rather than pretending an industry is covered", () => {
    const selection = selectTemplateForIndustry("Artisanal Widget Foundry");
    assert.equal(selection.confidence, "fallback");
    assert.equal(selection.matchedKeyword, null);
    assert.equal(selection.template, "professional-services-modern");
    assert.ok(needsNewMasterTemplate("Artisanal Widget Foundry"));
    assert.equal(needsNewMasterTemplate("Plumbing"), false);
  });

  it("prefers the most specific keyword match", () => {
    const selection = selectTemplateForIndustry("Commercial Air Conditioning");
    assert.equal(selection.matchedKeyword, "air condition");
  });

  it("only exposes active templates for selection", () => {
    assert.ok(ACTIVE_TEMPLATES.length > 0);
    assert.ok(ACTIVE_TEMPLATES.every((definition) => definition.status === "active"));
  });
});

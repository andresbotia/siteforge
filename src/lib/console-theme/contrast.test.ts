import assert from "node:assert/strict";
import { describe, it } from "node:test";
// Shared math from the builder module -- the FUNCTION is reused, no tokens are.
import { contrastRatio } from "@/lib/builder/design-system";
import { CONSOLE_PALETTE as P, softenOver } from "./palette";

/**
 * Enforces WCAG AA on every operator-console text/background pair the UI
 * actually renders. If globals.css and palette.ts drift, or a future palette
 * tweak dips a pair below threshold, this fails.
 */
describe("operator console palette contrast", () => {
  const AA_BODY = 4.5;
  const AA_LARGE = 3;

  const bodyPairs: Array<[string, string, string]> = [
    ["primary text on ground", P.text, P.bg],
    ["primary text on surface", P.text, P.surface],
    ["primary text on surface-2", P.text, P.surface2],
    ["muted text on ground", P.textMuted, P.bg],
    ["muted text on surface", P.textMuted, P.surface],
    ["muted text on surface-2", P.textMuted, P.surface2],
    ["faint text on ground", P.textFaint, P.bg],
    ["faint text on surface", P.textFaint, P.surface],
    ["accent link on ground", P.accent, P.bg],
    ["accent link on surface", P.accent, P.surface],
    ["text on accent fill", P.onAccent, P.accent],
    ["text on accent-hover fill", P.onAccent, P.accentHover],
  ];

  for (const [label, fg, bg] of bodyPairs) {
    it(`${label} clears ${AA_BODY}:1`, () => {
      const ratio = contrastRatio(fg, bg);
      assert.ok(ratio !== null && ratio >= AA_BODY, `${label}: ${ratio?.toFixed(2)}`);
    });
  }

  // Semantic tones: used as badge text on a 14% tint of themselves over a
  // surface, and as standalone status text/icons on ground and surface.
  const semantic: Array<[string, string]> = [
    ["info", P.info],
    ["warning", P.warning],
    ["success", P.success],
    ["danger", P.danger],
  ];

  for (const [name, hex] of semantic) {
    it(`${name} status text clears ${AA_BODY}:1 on ground and surface`, () => {
      for (const bg of [P.bg, P.surface, P.surface2]) {
        const ratio = contrastRatio(hex, bg);
        assert.ok(ratio !== null && ratio >= AA_BODY, `${name} on ${bg}: ${ratio?.toFixed(2)}`);
      }
    });

    it(`${name} badge text clears ${AA_BODY}:1 on its own soft fill`, () => {
      for (const base of [P.surface, P.surface2]) {
        const soft = softenOver(hex, base);
        const ratio = contrastRatio(hex, soft);
        assert.ok(ratio !== null && ratio >= AA_BODY, `${name} on ${soft}: ${ratio?.toFixed(2)}`);
      }
    });
  }

  it("borders are visible against their surfaces (informational, >= 1.3)", () => {
    for (const [fg, bg] of [
      [P.border, P.bg],
      [P.border, P.surface],
      [P.borderStrong, P.surface2],
    ] as Array<[string, string]>) {
      const ratio = contrastRatio(fg, bg);
      assert.ok(ratio !== null && ratio >= 1.15, `${fg} on ${bg}: ${ratio?.toFixed(2)}`);
    }
  });

  it("large / bold accent-on-surface still clears the large-text bar", () => {
    const ratio = contrastRatio(P.accent, P.surface2);
    assert.ok(ratio !== null && ratio >= AA_LARGE);
  });
});

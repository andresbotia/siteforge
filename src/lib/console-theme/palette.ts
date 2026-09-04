/**
 * TS mirror of the operator-console `--sf-*` hex values in
 * src/app/globals.css. Kept in sync by hand; `contrast.test.ts` is what
 * catches drift and enforces WCAG AA on every pair the UI actually renders.
 *
 * This is the admin console theme. It is NOT the builder website-generation
 * design system (src/lib/builder/design-system.ts) -- separate surface,
 * separate tokens, never merged. See DESIGN-SYSTEM.md.
 */
export const CONSOLE_PALETTE = {
  bg: "#09090b",
  surface: "#111114",
  surface2: "#17171b",
  border: "#26262b",
  borderStrong: "#3a3a42",
  text: "#f4f4f5",
  textMuted: "#a1a1aa",
  textFaint: "#8b8b95",
  accent: "#5b9dff",
  accentHover: "#7db2ff",
  onAccent: "#08111f",
  info: "#2dd4bf",
  warning: "#e8b23a",
  success: "#3ecf8e",
  danger: "#f26d6d",
} as const;

export type ConsoleColorName = keyof typeof CONSOLE_PALETTE;

/** 14% tint of a hex over an opaque backdrop -- mirrors `color-mix(... 14%, transparent)` composited on `backdrop`. */
export function softenOver(hex: string, backdrop: string, amount = 0.14): string {
  const f = hexToRgb(hex);
  const b = hexToRgb(backdrop);
  const mix = (c: "r" | "g" | "b") => Math.round(f[c] * amount + b[c] * (1 - amount));
  return rgbToHex(mix("r"), mix("g"), mix("b"));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = hex.replace("#", "");
  return {
    r: Number.parseInt(v.slice(0, 2), 16),
    g: Number.parseInt(v.slice(2, 4), 16),
    b: Number.parseInt(v.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

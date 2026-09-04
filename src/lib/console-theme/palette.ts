/**
 * TS mirror of the operator-console `--sf-*` hex values in
 * src/app/globals.css. Kept in sync by hand; `contrast.test.ts` is what
 * catches drift and enforces WCAG AA on every pair the UI actually renders.
 *
 * This is the admin console theme. It is NOT the builder website-generation
 * design system (src/lib/builder/design-system.ts) -- separate surface,
 * separate tokens, never merged. See DESIGN-SYSTEM.md.
 *
 * M10.6 Task 3: light neutral ramp (was dark through M10.5). No theme
 * toggle -- this replaced the dark values, it did not add a second set.
 */
export const CONSOLE_PALETTE = {
  bg: "#f8f8f9",
  surface: "#ffffff",
  surface2: "#eef0f2",
  border: "#e2e2e6",
  borderStrong: "#c9c9d1",
  text: "#1a1a1e",
  textMuted: "#5b5b63",
  textFaint: "#6b6b74",
  accent: "#2555c7",
  accentHover: "#1c469f",
  onAccent: "#ffffff",
  info: "#086b7a",
  warning: "#7a4a05",
  success: "#0a6a3d",
  danger: "#ab2530",
} as const;

export type ConsoleColorName = keyof typeof CONSOLE_PALETTE;

/**
 * Soft-fill tint amount for status badges. Lighter than the dark theme's 14%
 * on purpose: light mode's semantic colors are already dark/saturated (they
 * have to be, to clear 4.5:1 on a near-white ground), so mixing at the same
 * 14% strength darkens the fill enough to erode the badge text's own
 * contrast against it. 10% keeps the fill light while still visibly tinted.
 */
export const SOFT_FILL_AMOUNT = 0.1;

/** Tint of a hex over an opaque backdrop -- mirrors `color-mix(... amount, transparent)` composited on `backdrop`. */
export function softenOver(hex: string, backdrop: string, amount = SOFT_FILL_AMOUNT): string {
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

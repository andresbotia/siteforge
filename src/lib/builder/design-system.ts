/**
 * SiteForge design presets.
 *
 * A preset is a curated, complete look: colors, type, rhythm, hero treatment.
 * Presets are deliberately enumerated, never randomized. Adding a preset is a
 * design decision, not a runtime parameter, so generated prospect sites cannot
 * land on an ugly combination.
 *
 * Renderers consume presets as CSS custom properties, so a single section
 * system can serve many templates without duplicating layout code.
 */

export const DESIGN_PRESET_KEYS = [
  "trade-trust",
  "contractor-premium",
  "advisory-authority",
  "advisory-clean",
  "kitchen-warm",
] as const;

export type DesignPresetKey = (typeof DESIGN_PRESET_KEYS)[number];

export type HeroTreatment = "image-overlay" | "split-editorial" | "architectural";
export type Density = "comfortable" | "generous";
export type RadiusScale = "sharp" | "soft" | "round";

export type DesignPreset = {
  key: DesignPresetKey;
  label: string;
  /** Page ground and primary text. */
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkMuted: string;
  /** Dark anchor section (hero scrim, final CTA, footer band). */
  deep: string;
  deepInk: string;
  deepInkMuted: string;
  /** Primary action color. Must clear 4.5:1 against accentInk. */
  accent: string;
  accentHover: string;
  accentInk: string;
  /** Quiet tint used for trust bands and cards. */
  band: string;
  /** Small editorial highlight used on eyebrows over dark ground. */
  highlight: string;
  hairline: string;
  displayFont: string;
  bodyFont: string;
  radius: RadiusScale;
  density: Density;
  heroTreatment: HeroTreatment;
};

const SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";

export const DESIGN_PRESETS: Record<DesignPresetKey, DesignPreset> = {
  "trade-trust": {
    key: "trade-trust",
    label: "Trade Trust",
    surface: "#f6f4f0",
    surfaceAlt: "#ffffff",
    ink: "#151b23",
    inkMuted: "#4b5563",
    deep: "#111c2b",
    deepInk: "#f6f8fb",
    deepInkMuted: "#c3cfdd",
    accent: "#b4530f",
    accentHover: "#943f06",
    accentInk: "#ffffff",
    band: "#eceef2",
    highlight: "#f0b429",
    hairline: "rgba(21,27,35,0.12)",
    displayFont: SANS,
    bodyFont: SANS,
    radius: "soft",
    density: "comfortable",
    heroTreatment: "image-overlay",
  },
  "contractor-premium": {
    key: "contractor-premium",
    label: "Contractor Premium",
    surface: "#f4f2ee",
    surfaceAlt: "#ffffff",
    ink: "#1b1a17",
    inkMuted: "#57534e",
    deep: "#1c1b18",
    deepInk: "#faf8f4",
    deepInkMuted: "#cec8bd",
    accent: "#2f5d50",
    accentHover: "#234639",
    accentInk: "#ffffff",
    band: "#eae6df",
    highlight: "#c8a15a",
    hairline: "rgba(27,26,23,0.12)",
    displayFont: SERIF,
    bodyFont: SANS,
    radius: "sharp",
    density: "generous",
    heroTreatment: "split-editorial",
  },
  "advisory-authority": {
    key: "advisory-authority",
    label: "Advisory Authority",
    surface: "#f7f7f6",
    surfaceAlt: "#ffffff",
    ink: "#15211f",
    inkMuted: "#4d5a58",
    deep: "#10201e",
    deepInk: "#f4f8f7",
    deepInkMuted: "#bdcfcc",
    accent: "#0f5f57",
    accentHover: "#0a4740",
    accentInk: "#ffffff",
    band: "#e9efee",
    highlight: "#8fd0c3",
    hairline: "rgba(21,33,31,0.12)",
    displayFont: SERIF,
    bodyFont: SANS,
    radius: "sharp",
    density: "generous",
    heroTreatment: "architectural",
  },
  "advisory-clean": {
    key: "advisory-clean",
    label: "Advisory Clean",
    surface: "#f7f8fa",
    surfaceAlt: "#ffffff",
    ink: "#131a26",
    inkMuted: "#4c5567",
    deep: "#16203a",
    deepInk: "#f5f7fb",
    deepInkMuted: "#c2cade",
    accent: "#2c4bc2",
    accentHover: "#22399a",
    accentInk: "#ffffff",
    band: "#eaeef7",
    highlight: "#9db4f5",
    hairline: "rgba(19,26,38,0.12)",
    displayFont: SANS,
    bodyFont: SANS,
    radius: "soft",
    density: "comfortable",
    heroTreatment: "split-editorial",
  },
  "kitchen-warm": {
    key: "kitchen-warm",
    label: "Kitchen Warm",
    surface: "#faf7f0",
    surfaceAlt: "#ffffff",
    ink: "#211f1b",
    inkMuted: "#4f493f",
    deep: "#211f1b",
    deepInk: "#fffaf0",
    deepInkMuted: "#e0d5c0",
    accent: "#a6492d",
    accentHover: "#8e3923",
    accentInk: "#ffffff",
    band: "#efe6d5",
    highlight: "#f3c96b",
    hairline: "rgba(33,31,27,0.12)",
    displayFont: SANS,
    bodyFont: SANS,
    radius: "soft",
    density: "comfortable",
    heroTreatment: "image-overlay",
  },
};

const PRESET_SET = new Set<string>(DESIGN_PRESET_KEYS);

export function isDesignPresetKey(value: string): value is DesignPresetKey {
  return PRESET_SET.has(value);
}

const RADIUS_VALUES: Record<RadiusScale, { control: string; card: string; panel: string }> = {
  sharp: { control: "4px", card: "4px", panel: "6px" },
  soft: { control: "8px", card: "10px", panel: "14px" },
  round: { control: "9999px", card: "16px", panel: "24px" },
};

const DENSITY_VALUES: Record<Density, { section: string; sectionTight: string; gap: string }> = {
  comfortable: { section: "4rem", sectionTight: "3rem", gap: "1.5rem" },
  generous: { section: "6rem", sectionTight: "4rem", gap: "2rem" },
};

/**
 * Flatten a preset into inline CSS custom properties. Renderers reference these
 * with static Tailwind arbitrary values (`bg-[var(--sf-accent)]`), which keeps
 * class names static and safe while colors stay data-driven.
 */
export function presetCssVariables(preset: DesignPreset): Record<string, string> {
  const radius = RADIUS_VALUES[preset.radius];
  const density = DENSITY_VALUES[preset.density];
  return {
    "--sf-surface": preset.surface,
    "--sf-surface-alt": preset.surfaceAlt,
    "--sf-ink": preset.ink,
    "--sf-ink-muted": preset.inkMuted,
    "--sf-deep": preset.deep,
    "--sf-deep-ink": preset.deepInk,
    "--sf-deep-ink-muted": preset.deepInkMuted,
    "--sf-accent": preset.accent,
    "--sf-accent-hover": preset.accentHover,
    "--sf-accent-ink": preset.accentInk,
    "--sf-band": preset.band,
    "--sf-highlight": preset.highlight,
    "--sf-hairline": preset.hairline,
    "--sf-display-font": preset.displayFont,
    "--sf-body-font": preset.bodyFont,
    "--sf-radius-control": radius.control,
    "--sf-radius-card": radius.card,
    "--sf-radius-panel": radius.panel,
    "--sf-section-y": density.section,
    "--sf-section-y-tight": density.sectionTight,
    "--sf-gap": density.gap,
  };
}

/** sRGB relative luminance per WCAG 2.x. */
function relativeLuminance(hex: string): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground: string, background: string): number | null {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  if (a === null || b === null) return null;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastPair = { label: string; foreground: string; background: string; minimum: number };

/** Pairs every preset must clear. Body text uses 4.5:1; large display text 3:1. */
export function contrastPairs(preset: DesignPreset): ContrastPair[] {
  return [
    { label: "body on surface", foreground: preset.ink, background: preset.surface, minimum: 4.5 },
    { label: "muted on surface", foreground: preset.inkMuted, background: preset.surface, minimum: 4.5 },
    { label: "muted on band", foreground: preset.inkMuted, background: preset.band, minimum: 4.5 },
    { label: "body on card", foreground: preset.ink, background: preset.surfaceAlt, minimum: 4.5 },
    { label: "accent label on surface", foreground: preset.accent, background: preset.surface, minimum: 4.5 },
    { label: "action text on accent", foreground: preset.accentInk, background: preset.accent, minimum: 4.5 },
    { label: "action text on accent hover", foreground: preset.accentInk, background: preset.accentHover, minimum: 4.5 },
    { label: "deep body text", foreground: preset.deepInk, background: preset.deep, minimum: 4.5 },
    { label: "deep muted text", foreground: preset.deepInkMuted, background: preset.deep, minimum: 4.5 },
    { label: "highlight eyebrow on deep", foreground: preset.highlight, background: preset.deep, minimum: 3 },
  ];
}

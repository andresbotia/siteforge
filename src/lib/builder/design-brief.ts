/**
 * Provider-neutral designer brief generator.
 *
 * When the registry has no purpose-built template for a lead's industry,
 * SiteForge should not silently ship a fallback. It should say so and hand an
 * operator or design agent a brief precise enough to produce ONE new master
 * template that then enters the reusable library.
 *
 * The output is plain text with no provider-specific syntax, so it can be
 * pasted into any design tool. Generating a brief is free and has no external
 * side effect: it neither calls nor authorizes a paid generation.
 */

import { DESIGN_PRESETS, type DesignPresetKey } from "./design-system";
import {
  ACTIVE_TEMPLATES,
  selectTemplateForIndustry,
  type TemplateDefinition,
  type TemplateFamily,
} from "./registry";
import type { BuilderLeadInput } from "./types";

export type DesignBriefRequest = {
  industry: string;
  /** Optional real example that motivated the brief. Facts only. */
  exampleBusiness?: {
    name: string;
    city: string | null;
    region: string | null;
    hasPhone: boolean;
    hasAddress: boolean;
    hasRating: boolean;
    hasHours: boolean;
  } | null;
  /** Preferred look. Defaults to the fallback template's preset. */
  presetKey?: DesignPresetKey;
  conversionObjective?: string;
};

export type DesignBrief = {
  /** True when the library genuinely lacks a template for this industry. */
  newTemplateNeeded: boolean;
  industry: string;
  suggestedTemplateKey: string;
  suggestedFamily: TemplateFamily;
  presetKey: DesignPresetKey;
  nearestExistingTemplate: TemplateDefinition;
  selectionReason: string;
  /** Provider-neutral brief, ready to paste into any design tool. */
  markdown: string;
};

const DEFAULT_OBJECTIVE =
  "A local visitor on a phone calls or messages the business within one screen of scrolling.";

export function buildDesignBrief(request: DesignBriefRequest): DesignBrief {
  const selection = selectTemplateForIndustry(request.industry);
  const nearest = selection.definition;
  const presetKey = request.presetKey ?? nearest.designPreset;
  const preset = DESIGN_PRESETS[presetKey];
  const objective = request.conversionObjective?.trim() || DEFAULT_OBJECTIVE;
  const slug = slugify(request.industry);
  const suggestedTemplateKey =
    selection.confidence === "fallback" ? `${slug}-modern` : nearest.key;

  const markdown = [
    `# Master template brief: ${titleCase(request.industry)}`,
    "",
    `**Status:** ${
      selection.confidence === "fallback"
        ? "No existing SiteForge template covers this industry. Design ONE new reusable master template."
        : `An existing template (${nearest.label}) covers this industry. Only design a new one if this brief describes a genuinely different layout need.`
    }`,
    `**Proposed template key:** \`${suggestedTemplateKey}\``,
    `**Nearest existing template:** ${nearest.label} (\`${nearest.id}\`)`,
    `**Conversion objective:** ${objective}`,
    "",
    "## What this template is for",
    "",
    `A single-location ${titleCase(request.industry)} business in a US metro area. Most will have a poor site or no standalone site at all. The template is instantiated from structured facts for many different businesses, so every design decision must survive a business that has fewer facts than the example below.`,
    "",
    ...exampleSection(request),
    "## Required sections, in order",
    "",
    ...sectionPlan(nearest, request.industry),
    "",
    "## Design direction",
    "",
    `- Palette: surface \`${preset.surface}\`, ink \`${preset.ink}\`, deep anchor \`${preset.deep}\`, accent \`${preset.accent}\` on \`${preset.accentInk}\` text, quiet band \`${preset.band}\`, editorial highlight \`${preset.highlight}\`.`,
    `- Hero treatment: ${describeHero(preset.heroTreatment)}`,
    `- Type: ${preset.displayFont === preset.bodyFont ? "one family, separated by weight and scale" : "display serif paired with a neutral sans for body"}. Headline scale must reach at least 3.5rem on desktop.`,
    `- Rhythm: ${preset.density} vertical spacing. Alternate section grounds between surface, quiet band, and the deep anchor so the page has cadence rather than a uniform stack.`,
    `- Radius: ${preset.radius}. Keep it consistent across buttons, cards, and panels.`,
    "- Composition: use asymmetric grids (roughly 0.6fr label column / 1.4fr content column). Avoid three equal rounded cards in a row, which reads as a template rather than designed work.",
    "",
    "## Hard requirements",
    "",
    "- Static export only. The build must produce `dist/index.html` plus static assets. No SSR, no server runtime, no database, no API routes.",
    "- Mobile is the primary target. Design the 390px width first; nothing may scroll horizontally at any width.",
    "- Every interactive target is at least 44px tall.",
    "- Body text clears 4.5:1 contrast; large display text clears 3:1.",
    "- Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, images have real alt text.",
    "- No analytics, no third-party embeds, no external fonts that block first paint, no tracking pixels.",
    "",
    "## Content rules (non-negotiable)",
    "",
    "Every visible fact comes from the structured business data passed into the template. Any field can be absent, and the layout must stay composed when it is.",
    "",
    "- Do NOT invent: testimonials, reviews, review text, star ratings, years in business, staff names or photos, awards, certifications, licence numbers, insurance claims, guarantees, prices, service areas, menu items, or statistics.",
    "- Do NOT include placeholder copy (`Lorem ipsum`, `Your text here`, sample testimonials) even temporarily. A missing fact means the section is omitted, not filled.",
    "- Do NOT reference SiteForge, the design tool used, or any internal review language anywhere in the output.",
    "- Rating and review count may be shown ONLY when supplied, and must be labelled with their public source.",
    "- Every section must degrade: if the facts for it are absent, the section disappears cleanly and the sections around it still read correctly.",
    "",
    "## Imagery",
    "",
    "- Ship rights-safe illustrative artwork bundled with the template. It is illustrative of the category only.",
    "- Never present template artwork as a photo of this business's premises, staff, food, or completed work, and never scrape imagery from Google, Yelp, Instagram, Facebook, or any listing site.",
    "- Structure image slots so a customer-supplied or operator-verified photo can replace template artwork later without a layout change.",
    "- Design a composed no-image state for the hero. An empty grey box is a defect, not a fallback.",
    "",
    "## SEO",
    "",
    `- Title pattern: \`<Business Name> | ${titleCase(request.industry)} in <City>\`, trimmed to 70 characters, with the city omitted when unknown.`,
    "- One meta description under 160 characters, built from sourced facts only.",
    "- LocalBusiness structured data, populated only with fields that are actually present.",
    "",
    "## Deliverable",
    "",
    "A Vite + React static project that builds clean with no console errors, uses only the structured props described above, and renders correctly for three cases: full facts, facts without imagery, and a minimal business with name, industry, and phone only.",
    "",
  ].join("\n");

  return {
    newTemplateNeeded: selection.confidence === "fallback",
    industry: request.industry,
    suggestedTemplateKey,
    suggestedFamily: nearest.family,
    presetKey,
    nearestExistingTemplate: nearest,
    selectionReason: selection.reason,
    markdown,
  };
}

/** Build a brief request from a lead without copying private or unsourced data. */
export function designBriefRequestFromLead(lead: BuilderLeadInput): DesignBriefRequest {
  return {
    industry: lead.industry,
    exampleBusiness: {
      name: lead.businessName,
      city: lead.city,
      region: lead.state,
      hasPhone: Boolean(lead.phone),
      hasAddress: Boolean(lead.address),
      hasRating: lead.rating !== null,
      hasHours: false,
    },
  };
}

/** Industries currently served by an active template, for operator display. */
export function coveredIndustryKeywords(): Array<{ template: string; keywords: string[] }> {
  return ACTIVE_TEMPLATES.map((definition) => ({
    template: definition.label,
    keywords: definition.industryKeywords,
  }));
}

function exampleSection(request: DesignBriefRequest): string[] {
  const example = request.exampleBusiness;
  if (!example) return [];
  const available = [
    "business name",
    "industry",
    example.city || example.region ? "city or region" : null,
    example.hasPhone ? "phone" : null,
    example.hasAddress ? "street address" : null,
    example.hasRating ? "public rating and review count" : null,
    example.hasHours ? "opening hours" : null,
  ].filter(Boolean);
  const missing = [
    example.hasPhone ? null : "phone",
    example.hasAddress ? null : "street address",
    example.hasRating ? null : "public rating",
    example.hasHours ? null : "opening hours",
  ].filter(Boolean);

  return [
    "## Example lead (facts available today)",
    "",
    `- Business: ${example.name}`,
    `- Location: ${example.city ?? example.region ?? "not sourced"}`,
    `- Facts available: ${available.join(", ")}`,
    `- Facts NOT available: ${missing.length ? missing.join(", ") : "none"}`,
    "",
    "Design so the missing facts above are simply absent, not implied or fabricated.",
    "",
  ];
}

function sectionPlan(nearest: TemplateDefinition, industry: string): string[] {
  const label = titleCase(industry);
  return [
    "1. **Sticky header** - business name, 3-5 nav links, one primary action. Collapses to name plus action on mobile.",
    "2. **Hero** - eyebrow (`" + label + " in <City>`), business name as the h1, one-sentence sourced description, and one or two actions with a clear primary. Full-bleed, bottom-aligned content, never a centered box on an empty ground.",
    "3. **Credibility strip** - public rating, review count, and service location. Renders only what is sourced; disappears entirely when nothing is.",
    "4. **" +
      (nearest.family === "restaurant" ? "Offering" : "Services") +
      "** - a numbered editorial list of what a business of this kind is set up to do. Generic capability language only, never a specific claim about this business.",
    "5. **About** - short sourced prose. Omitted when no description exists.",
    "6. **Location and hours** - address with a Google Maps directions link (link only, no embedded map, no paid Maps API) and a structured hours table. Each half omits independently.",
    "7. **Closing action block** - on the deep anchor colour, restating the primary action.",
    "8. **Footer** - business name, location, phone. Quiet, no link farm.",
  ];
}

function describeHero(treatment: string): string {
  if (treatment === "image-overlay") {
    return "full-bleed photograph with a directional dark scrim from the text side, content bottom-aligned, with a floating credibility panel on the opposite side at desktop widths.";
  }
  if (treatment === "split-editorial") {
    return "asymmetric split: large display type on the deep ground against a supporting panel, with a fine rule grid rather than a flat fill.";
  }
  return "architectural composition built from type, rules, and a single accent block. It must look intentional with no photography at all.";
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "custom"
  );
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

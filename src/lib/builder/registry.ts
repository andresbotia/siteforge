/**
 * Template registry.
 *
 * One record per master template describing what it needs, what it can express,
 * and how it should look. Builder selection, template QA, and the designer brief
 * generator all read from here, so template capability lives in exactly one place.
 *
 * Selection is deterministic keyword matching. No paid AI is involved.
 */

import type { DesignPresetKey } from "./design-system";
import { DESIGN_PRESETS } from "./design-system";
import type { PaletteKey, TemplateKey } from "./limits";
import type { CtaKind, ImageRole } from "./types";

export type TemplateFamily = "home_services" | "restaurant" | "professional";

export type TemplateRenderer = "restaurant-modern-v2" | "local-business-v2";

export type TemplateStatus = "active" | "deprecated";

/**
 * Fact keys a template reads. These mirror `WebsiteSpec.business` fields and are
 * used by QA and the designer brief; they are not a second source of truth for
 * the spec shape.
 */
export type TemplateFactKey =
  | "name"
  | "industry"
  | "city"
  | "region"
  | "address"
  | "phone"
  | "email"
  | "rating"
  | "reviewCount"
  | "description"
  | "cuisine"
  | "hours"
  | "dailyHours"
  | "socialProfiles"
  | "menuUrl"
  | "orderUrl"
  | "reservationUrl"
  | "services"
  | "highlights";

export type TemplateDefinition = {
  key: TemplateKey;
  /** Stable versioned identifier recorded on drafts and briefs. */
  id: string;
  label: string;
  family: TemplateFamily;
  version: string;
  status: TemplateStatus;
  renderer: TemplateRenderer;
  designPreset: DesignPresetKey;
  /** Legacy palette key retained for `WebsiteSpec.palette` compatibility. */
  palette: PaletteKey;
  summary: string;
  /** Lowercase keyword fragments matched against the lead industry. */
  industryKeywords: string[];
  requiredFacts: TemplateFactKey[];
  optionalFacts: TemplateFactKey[];
  /** Image roles the layout has a designed slot for. */
  imageRoles: ImageRole[];
  /** Fixture family under `public/fixtures/<family>` for illustrative imagery. */
  imageFamily: string;
  ctaCapabilities: CtaKind[];
  /** Designed narrative order, used by the brief generator. */
  sectionOrder: string[];
};

export const TEMPLATE_REGISTRY: Record<TemplateKey, TemplateDefinition> = {
  "home-services-modern": {
    key: "home-services-modern",
    id: "home-services-modern@2.0.0",
    label: "Home Services Pro",
    family: "home_services",
    version: "2.0.0",
    status: "active",
    renderer: "local-business-v2",
    designPreset: "trade-trust",
    palette: "navy-amber",
    summary:
      "Trust-forward local trade site: full-bleed work hero, call-first CTA hierarchy, service grid, coverage area, and reputation band.",
    industryKeywords: [
      "plumb",
      "hvac",
      "air condition",
      "heating",
      "cooling",
      "roof",
      "landscap",
      "lawn",
      "electric",
      "pest",
      "pool",
      "contractor",
      "pressure wash",
      "garage door",
      "fencing",
      "handyman",
      "remodel",
      "flooring",
      "painting",
      "septic",
      "irrigation",
      "tree service",
      "junk removal",
      "cleaning",
      "restoration",
      "solar",
      "window",
      "gutter",
      "concrete",
      "paving",
      "contracting",
    ],
    requiredFacts: ["name", "industry"],
    optionalFacts: [
      "city",
      "region",
      "address",
      "phone",
      "email",
      "rating",
      "reviewCount",
      "description",
      "hours",
      "services",
      "socialProfiles",
      "highlights",
    ],
    imageRoles: ["hero", "service", "project"],
    imageFamily: "home-services",
    ctaCapabilities: ["phone", "emergency", "quote", "contact", "directions", "social"],
    sectionOrder: [
      "announcement",
      "header",
      "hero",
      "trust",
      "services",
      "about",
      "serviceArea",
      "hoursLocation",
      "cta",
      "footer",
    ],
  },
  "restaurant-modern": {
    key: "restaurant-modern",
    id: "restaurant-modern@2.1.0",
    label: "Restaurant Modern",
    family: "restaurant",
    version: "2.1.0",
    status: "active",
    renderer: "restaurant-modern-v2",
    designPreset: "kitchen-warm",
    palette: "ink-cream",
    summary:
      "Warm editorial restaurant site: full-bleed food hero with rating badge, cuisine feature, gallery mosaic, and visit panel with hours and directions.",
    industryKeywords: [
      "restaurant",
      "cafe",
      "café",
      "bakery",
      "casual dining",
      "pizzeria",
      "taqueria",
      "taco",
      "grill",
      "diner",
      "bistro",
      "eatery",
      "food truck",
      "coffee",
      "deli",
      "steakhouse",
      "sushi",
      "juice bar",
      "ice cream",
      "catering",
    ],
    requiredFacts: ["name", "industry"],
    optionalFacts: [
      "city",
      "region",
      "address",
      "phone",
      "rating",
      "reviewCount",
      "description",
      "cuisine",
      "hours",
      "dailyHours",
      "socialProfiles",
      "menuUrl",
      "orderUrl",
      "reservationUrl",
      "highlights",
    ],
    imageRoles: ["hero", "gallery"],
    imageFamily: "restaurant",
    ctaCapabilities: ["phone", "directions", "menu", "order", "reservation", "contact", "social"],
    sectionOrder: [
      "header",
      "hero",
      "intro",
      "gallery",
      "cuisine",
      "reputation",
      "visit",
      "cta",
      "footer",
    ],
  },
  "professional-services-modern": {
    key: "professional-services-modern",
    id: "professional-services-modern@2.0.0",
    label: "Professional Authority",
    family: "professional",
    version: "2.0.0",
    status: "active",
    renderer: "local-business-v2",
    designPreset: "advisory-authority",
    palette: "slate-teal",
    summary:
      "Credibility-forward practice site: editorial split hero, capability list, reputation proof, and a consultation-oriented CTA hierarchy.",
    industryKeywords: [
      "law",
      "attorney",
      "legal",
      "account",
      "cpa",
      "tax",
      "dental",
      "dentist",
      "medical",
      "clinic",
      "chiropract",
      "therapy",
      "insurance",
      "real estate",
      "financial",
      "advisor",
      "consult",
      "veterinar",
      "optometr",
      "notary",
      "title",
      "staffing",
      "agency",
      "salon",
      "spa",
      "barber",
      "fitness",
      "studio",
    ],
    requiredFacts: ["name", "industry"],
    optionalFacts: [
      "city",
      "region",
      "address",
      "phone",
      "email",
      "rating",
      "reviewCount",
      "description",
      "hours",
      "services",
      "socialProfiles",
      "highlights",
    ],
    imageRoles: ["hero", "service", "team"],
    imageFamily: "professional",
    ctaCapabilities: ["phone", "quote", "contact", "directions", "social"],
    sectionOrder: [
      "header",
      "hero",
      "trust",
      "services",
      "about",
      "serviceArea",
      "hoursLocation",
      "cta",
      "footer",
    ],
  },
};

export const ACTIVE_TEMPLATES: TemplateDefinition[] = Object.values(TEMPLATE_REGISTRY).filter(
  (definition) => definition.status === "active",
);

export function templateDefinition(key: TemplateKey): TemplateDefinition {
  return TEMPLATE_REGISTRY[key];
}

export function templatePreset(key: TemplateKey) {
  return DESIGN_PRESETS[TEMPLATE_REGISTRY[key].designPreset];
}

export type TemplateMatchConfidence = "matched" | "fallback";

export type TemplateSelection = {
  template: TemplateKey;
  definition: TemplateDefinition;
  confidence: TemplateMatchConfidence;
  /** Keyword that produced the match, or null on fallback. */
  matchedKeyword: string | null;
  reason: string;
};

/** Deterministic keyword selection. Longest keyword wins so "air condition" beats "condition". */
export function selectTemplateForIndustry(industry: string): TemplateSelection {
  const normalized = industry.trim().toLowerCase();
  let best: { definition: TemplateDefinition; keyword: string } | null = null;

  for (const definition of ACTIVE_TEMPLATES) {
    for (const keyword of definition.industryKeywords) {
      if (!normalized.includes(keyword)) continue;
      if (!best || keyword.length > best.keyword.length) {
        best = { definition, keyword };
      }
    }
  }

  if (best) {
    return {
      template: best.definition.key,
      definition: best.definition,
      confidence: "matched",
      matchedKeyword: best.keyword,
      reason: `Industry "${industry}" matched template family ${best.definition.family} on "${best.keyword}".`,
    };
  }

  const fallback = TEMPLATE_REGISTRY["professional-services-modern"];
  return {
    template: fallback.key,
    definition: fallback,
    confidence: "fallback",
    matchedKeyword: null,
    reason: `No template family claims industry "${industry}". Falling back to ${fallback.label}; consider generating a designer brief for a new master template.`,
  };
}

/** True when the library has no purpose-built template for this industry. */
export function needsNewMasterTemplate(industry: string): boolean {
  return selectTemplateForIndustry(industry).confidence === "fallback";
}

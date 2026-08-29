/** Centralized Builder bounds. Do not scatter these constants. */

export const BUILDER_VERSION = "builder.v1";

export const BUILDER_COST_USD = 0;
export const BUILDER_PROVIDER_ID = "deterministic_template" as const;
export const BUILDER_PROVIDER_LABEL = "Deterministic template builder";

export const TEMPLATE_KEYS = [
  "home-services-modern",
  "restaurant-modern",
  "professional-services-modern",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const PALETTE_KEYS = ["navy-amber", "ink-cream", "slate-teal"] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

export const PAGE_IDS = ["home", "services", "about", "contact", "menu"] as const;
export type PageId = (typeof PAGE_IDS)[number];

export const SECTION_TYPES = [
  "announcement",
  "header",
  "hero",
  "trust",
  "services",
  "about",
  "serviceArea",
  "menuPreview",
  "hoursLocation",
  "cta",
  "contact",
  "footer",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const MAX_SPEC_STRING = 400;
export const MAX_SERVICES = 8;
export const MAX_NAV_ITEMS = 8;
export const MAX_PAGES = 6;
export const MAX_SECTIONS_PER_PAGE = 12;

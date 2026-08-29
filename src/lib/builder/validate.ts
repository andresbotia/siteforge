import {
  BUILDER_VERSION,
  MAX_NAV_ITEMS,
  MAX_PAGES,
  MAX_SECTIONS_PER_PAGE,
  MAX_SERVICES,
  MAX_SPEC_STRING,
  PAGE_IDS,
  SECTION_TYPES,
  type PageId,
  type SectionType,
} from "./limits";
import { isPaletteKey, isTemplateKey } from "./templates";
import type { Section, WebsiteSpec } from "./types";

const PAGE_SET = new Set<string>(PAGE_IDS);
const SECTION_SET = new Set<string>(SECTION_TYPES);
const CTA_KINDS = new Set(["phone", "quote", "contact", "emergency", "reservation", "order", "menu"]);

export type SpecValidation =
  | { ok: true; spec: WebsiteSpec }
  | { ok: false; error: string };

export function validateWebsiteSpec(input: unknown): SpecValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "spec_not_object" };
  }
  const spec = input as WebsiteSpec;
  if (spec.version !== BUILDER_VERSION) return { ok: false, error: "unknown_spec_version" };
  if (!isTemplateKey(spec.template)) return { ok: false, error: "unknown_template" };
  if (!isPaletteKey(spec.palette)) return { ok: false, error: "unknown_palette" };
  if (!spec.business || typeof spec.business.name !== "string" || !spec.business.name.trim()) {
    return { ok: false, error: "missing_business_name" };
  }
  if (containsUnsafe(spec.business.name)) return { ok: false, error: "unsafe_business_name" };
  if (!Array.isArray(spec.navigation) || spec.navigation.length > MAX_NAV_ITEMS) {
    return { ok: false, error: "invalid_navigation" };
  }
  if (!Array.isArray(spec.pages) || spec.pages.length === 0 || spec.pages.length > MAX_PAGES) {
    return { ok: false, error: "invalid_pages" };
  }
  if (!spec.pages.some((page) => page.id === "home")) return { ok: false, error: "missing_home_page" };
  if (hasExecutable(spec)) return { ok: false, error: "executable_code_forbidden" };

  for (const page of spec.pages) {
    if (!PAGE_SET.has(page.id)) return { ok: false, error: "unknown_page_id" };
    if (!safeString(page.title) || !safeString(page.description)) {
      return { ok: false, error: "unsafe_page_copy" };
    }
    if (!Array.isArray(page.sections) || page.sections.length > MAX_SECTIONS_PER_PAGE) {
      return { ok: false, error: "invalid_sections" };
    }
    for (const section of page.sections) {
      const sectionError = validateSection(section);
      if (sectionError) return { ok: false, error: sectionError };
    }
  }
  return { ok: true, spec };
}

function validateSection(section: Section): string | null {
  if (!section || !SECTION_SET.has(section.type)) return "unknown_section";
  switch (section.type) {
    case "announcement":
      return safeString(section.text) ? null : "unsafe_announcement";
    case "header":
      if (!safeString(section.businessName)) return "unsafe_header";
      if (section.phone && !safeString(section.phone)) return "unsafe_phone";
      return validateCtas(section.ctas);
    case "hero":
      if (!safeString(section.headline) || !safeString(section.lede)) return "unsafe_hero";
      return validateCtas(section.ctas);
    case "trust":
      return null;
    case "services":
      if (!Array.isArray(section.items) || section.items.length > MAX_SERVICES) return "too_many_services";
      for (const item of section.items) {
        if (!safeString(item.name) || !safeString(item.summary)) return "unsafe_service";
      }
      return null;
    case "about":
    case "serviceArea":
      return safeString(section.heading) && safeString(section.body) ? null : "unsafe_copy";
    case "menuPreview":
      if (!safeString(section.heading) || !safeString(section.body)) return "unsafe_menu";
      if (section.href && !safeHref(section.href)) return "unsafe_menu_href";
      return null;
    case "hoursLocation":
      if (section.hours) return "hours_must_be_sourced";
      return null;
    case "cta":
      if (!safeString(section.heading) || !safeString(section.body)) return "unsafe_cta";
      return validateCtas(section.ctas);
    case "contact":
      if (section.phone && !safeString(section.phone)) return "unsafe_phone";
      if (section.email && !safeString(section.email)) return "unsafe_email";
      return null;
    case "footer":
      return safeString(section.businessName) && safeString(section.note) ? null : "unsafe_footer";
    default:
      return "unknown_section";
  }
}

function validateCtas(ctas: { kind: string; label: string; href: string }[]): string | null {
  if (!Array.isArray(ctas) || ctas.length > 6) return "invalid_ctas";
  for (const cta of ctas) {
    if (!CTA_KINDS.has(cta.kind)) return "unknown_cta_kind";
    if (!safeString(cta.label) || !safeHref(cta.href)) return "unsafe_cta_href";
  }
  return null;
}

function safeString(value: string): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_SPEC_STRING && !containsUnsafe(value);
}

function containsUnsafe(value: string): boolean {
  return /<\s*script|javascript:|onerror\s*=|onload\s*=/i.test(value);
}

function safeHref(value: string): boolean {
  if (typeof value !== "string" || value.length > 300) return false;
  if (containsUnsafe(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return PAGE_SET.has(value.slice(1) || "home") || value === "/contact" || value === "/services" || value === "/about" || value === "/menu" || value === "/";
  if (value.startsWith("tel:") || value.startsWith("mailto:")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function hasExecutable(spec: WebsiteSpec): boolean {
  const blob = JSON.stringify(spec);
  return /function\s*\(|=>\s*\{|eval\(|new Function|<\/?[a-z][\s\S]*>/i.test(blob);
}

export function isPageId(value: string): value is PageId {
  return PAGE_SET.has(value);
}

export function isKnownSectionType(value: string): value is SectionType {
  return SECTION_SET.has(value);
}

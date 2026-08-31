import {
  BUILDER_VERSION,
  MAX_SPEC_STRING,
  MAX_NAV_ITEMS,
  MAX_PAGES,
  MAX_SECTIONS_PER_PAGE,
  MAX_SERVICES,
  PAGE_IDS,
  SECTION_TYPES,
  type PageId,
  type SectionType,
} from "./limits";
import { canRenderImage } from "./images";
import { isPaletteKey, isTemplateKey } from "./templates";
import type { Section, WebsiteImageAsset, WebsiteSpec } from "./types";

const PAGE_SET = new Set<string>(PAGE_IDS);
const SECTION_SET = new Set<string>(SECTION_TYPES);
const CTA_KINDS = new Set([
  "phone",
  "quote",
  "contact",
  "emergency",
  "reservation",
  "order",
  "menu",
  "social",
  "directions",
]);
const SOCIAL_HOSTS = {
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  youtube: ["youtube.com", "www.youtube.com", "youtu.be"],
  x: ["x.com", "www.x.com"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
} as const;
const DAY_KEYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
const MAX_BUSINESS_DESCRIPTION = 500;

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
  const businessError = validateBusiness(spec.business);
  if (businessError) return { ok: false, error: businessError };
  const assetError = validateAssets(spec.assets);
  if (assetError) return { ok: false, error: assetError };
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

function validateBusiness(spec: WebsiteSpec["business"]): string | null {
  if (!safeString(spec.name)) return "unsafe_business_name";
  const optionalFields = [
    spec.industry,
    spec.city,
    spec.region,
    spec.address,
    spec.phone,
    spec.email,
    spec.cuisine,
    spec.hours,
    spec.shortName,
  ];
  for (const value of optionalFields) {
    if (value !== null && value !== undefined && !safeString(value)) return "unsafe_business_copy";
  }
  if (
    spec.description !== null &&
    spec.description !== undefined &&
    !safeBoundedString(spec.description, MAX_BUSINESS_DESCRIPTION)
  ) {
    return "unsafe_business_description";
  }
  for (const value of [spec.websiteUrl, spec.socialUrl, spec.menuUrl, spec.orderUrl, spec.reservationUrl]) {
    if (value !== null && value !== undefined && !safeHttpHref(value)) return "unsafe_business_url";
  }
  if (spec.rating !== null && spec.rating !== undefined && (!Number.isFinite(spec.rating) || spec.rating < 0 || spec.rating > 5)) {
    return "invalid_rating";
  }
  if (
    spec.reviewCount !== null &&
    spec.reviewCount !== undefined &&
    (!Number.isInteger(spec.reviewCount) || spec.reviewCount < 0 || spec.reviewCount > 1_000_000)
  ) {
    return "invalid_review_count";
  }
  if (
    spec.ratingSource !== null &&
    spec.ratingSource !== undefined &&
    spec.ratingSource !== "google" &&
    spec.ratingSource !== "public"
  ) {
    return "invalid_rating_source";
  }
  if (spec.highlights !== undefined) {
    if (!Array.isArray(spec.highlights) || spec.highlights.length > 6) return "invalid_highlights";
    for (const item of spec.highlights) {
      if (!safeString(item)) return "unsafe_highlight";
    }
  }
  if (spec.dailyHours !== undefined) {
    if (!Array.isArray(spec.dailyHours) || spec.dailyHours.length > 7) return "invalid_daily_hours";
    for (const row of spec.dailyHours) {
      if (!DAY_KEYS.has(row.day)) return "invalid_daily_hours";
      if (!safeString(row.label) || !safeString(row.value)) return "unsafe_daily_hours";
      if (typeof row.closed !== "boolean") return "invalid_daily_hours";
    }
  }
  if (spec.socialProfiles !== undefined) {
    if (!Array.isArray(spec.socialProfiles) || spec.socialProfiles.length > 6) return "invalid_social_profiles";
    for (const profile of spec.socialProfiles) {
      if (profile.verificationStatus !== "operator_verified") return "unverified_social_profile";
      if (!isExpectedSocialUrl(profile.platform, profile.url)) return "unsafe_social_profile";
    }
  }
  return null;
}

function validateAssets(assets: WebsiteSpec["assets"]): string | null {
  if (!assets) return null;
  if (!Array.isArray(assets.images) || assets.images.length > 12) return "invalid_images";
  for (const image of assets.images) {
    const error = validateImage(image);
    if (error) return error;
  }
  return null;
}

function validateImage(image: WebsiteImageAsset): string | null {
  if (!image || typeof image !== "object") return "invalid_image";
  if (!canRenderImage(image)) return "unapproved_image";
  if (!safeString(image.alt)) return "unsafe_image_alt";
  if (image.sourceUrl !== null && image.sourceUrl !== undefined && !safeHref(image.sourceUrl)) {
    return "unsafe_image_source";
  }
  if (image.attribution !== null && image.attribution !== undefined && !safeString(image.attribution)) {
    return "unsafe_image_attribution";
  }
  return null;
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
      if (section.location && !safeString(section.location)) return "unsafe_location";
      if (section.hours && !safeString(section.hours)) return "unsafe_hours";
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
  return safeBoundedString(value, MAX_SPEC_STRING);
}

function safeBoundedString(value: string, max: number): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= max && !containsUnsafe(value);
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

function safeHttpHref(value: string): boolean {
  if (typeof value !== "string" || value.length > 300) return false;
  if (containsUnsafe(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isExpectedSocialUrl(platform: string, value: string): boolean {
  if (!(platform in SOCIAL_HOSTS)) return false;
  if (!safeHttpHref(value)) return false;
  const url = new URL(value);
  return (SOCIAL_HOSTS[platform as keyof typeof SOCIAL_HOSTS] as readonly string[]).includes(
    url.hostname.toLowerCase(),
  );
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

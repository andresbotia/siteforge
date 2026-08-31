import type { BuilderAuditInput, BuilderLeadInput, ProvenanceRecord } from "./types";
import type { DailyHours, SocialProfile, WebsiteImageAsset } from "./types";
import { readApprovedImages } from "./images";
import { isNoStandaloneWebsiteLead } from "@/lib/prospects/no-website";
import { DAY_ORDER, inferVerifiedSocialProfile, readDailyHours, readSocialProfiles, readVerifiedPublicFacts } from "@/lib/prospects/verified-public-facts";

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function summaryString(summary: Record<string, unknown> | null, key: string): string | null {
  if (!summary) return null;
  const value = summary[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export type BuilderFacts = {
  name: string;
  industry: string;
  city: string | null;
  state: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  description: string | null;
  cuisine: string | null;
  hours: string | null;
  dailyHours: DailyHours[];
  menuLink: string | null;
  reservationUrl: string | null;
  orderUrl: string | null;
  socialUrl: string | null;
  socialProfiles: SocialProfile[];
  ratingSource: "google" | "public" | null;
  shortName: string | null;
  highlights: string[];
  images: WebsiteImageAsset[];
  reservationsOffered: boolean;
  orderingOffered: boolean;
  emergencyOffered: boolean;
  provenance: ProvenanceRecord[];
};

export function extractFacts(
  lead: BuilderLeadInput,
  audit: BuilderAuditInput,
): BuilderFacts {
  const provenance: ProvenanceRecord[] = [];
  const city = blankToNull(lead.city);
  const state = blankToNull(lead.state);
  const address = blankToNull(lead.address);
  const phone = blankToNull(lead.phone);
  const email = blankToNull(lead.email);
  const websiteUrl = blankToNull(lead.websiteUrl);
  const noStandaloneWebsite = isNoStandaloneWebsiteLead(lead);
  const region = [city, state].filter(Boolean).join(", ") || null;
  const verified = readVerifiedPublicFacts(lead.inspectionSummary);
  const verifiedFacts = verified?.facts ?? null;
  const rating = verifiedFacts?.rating ?? (lead.rating && lead.rating > 0 ? lead.rating : null);
  const reviewCount =
    verifiedFacts?.reviewCount ?? (lead.reviewCount > 0 ? lead.reviewCount : null);
  const codes = new Set(audit.findings.map((item) => item.code));
  const rawDescription = verifiedFacts?.description ?? summaryString(lead.inspectionSummary, "public_description");
  const description = sanitizePublicSummary(rawDescription);
  const cuisine = verifiedFacts?.cuisine ?? summaryString(lead.inspectionSummary, "cuisine");
  const hours = verifiedFacts?.hours ?? summaryString(lead.inspectionSummary, "public_hours");
  const dailyHours =
    verifiedFacts?.hoursByDay.length
      ? verifiedFacts.hoursByDay
      : readDailyHours(lead.inspectionSummary?.public_hours_by_day).length
        ? readDailyHours(lead.inspectionSummary?.public_hours_by_day)
        : extractLegacyDailyHours(rawDescription);
  const menuLinkRaw = verifiedFacts?.menuUrl ?? summaryString(lead.inspectionSummary, "menu_link");
  const reservationLink = summaryString(lead.inspectionSummary, "reservation_link");
  const orderLink = summaryString(lead.inspectionSummary, "order_link");
  const reservationUrlRaw = verifiedFacts?.reservationUrl ?? reservationLink;
  const orderUrlRaw = verifiedFacts?.orderUrl ?? orderLink;
  const socialUrlRaw = verifiedFacts?.socialUrl ?? summaryString(lead.inspectionSummary, "social_url");
  const menuLink =
    menuLinkRaw && isHttpUrl(menuLinkRaw) && !menuLinkRaw.toLowerCase().startsWith("javascript:")
      ? menuLinkRaw
      : null;
  const reservationUrl =
    reservationUrlRaw && isHttpUrl(reservationUrlRaw) ? reservationUrlRaw : null;
  const orderUrl = orderUrlRaw && isHttpUrl(orderUrlRaw) ? orderUrlRaw : null;
  const socialUrl = socialUrlRaw && isHttpUrl(socialUrlRaw) ? socialUrlRaw : null;
  const structuredSocialProfiles =
    verifiedFacts?.socialProfiles.length
      ? verifiedFacts.socialProfiles
      : readSocialProfiles(lead.inspectionSummary?.social_profiles);
  const legacySocialProfile = structuredSocialProfiles.length === 0
    ? inferVerifiedSocialProfile(socialUrl, "lead.inspection_summary.social_url")
    : null;
  const socialProfiles = legacySocialProfile ? [legacySocialProfile] : structuredSocialProfiles;
  const ratingSourceRaw = summaryString(lead.inspectionSummary, "rating_source");
  const ratingSource = rating || reviewCount
    ? ratingSourceRaw === "google"
      ? "google"
      : "public"
    : null;
  const images = readApprovedImages(lead.inspectionSummary);
  const shortName = deriveShortName(lead.businessName);
  const highlights = deriveRestaurantHighlights([cuisine, description].filter(Boolean).join(" "));

  const reservationsOffered =
    Boolean(reservationUrl) ||
    codes.has("restaurant_reservation_broken") ||
    codes.has("restaurant_reservation_unclear");
  const orderingOffered =
    Boolean(orderUrl) || codes.has("restaurant_order_broken");
  const emergencyOffered = codes.has("home_service_emergency_cta_missing");

  const record = (field: string, provenanceKind: ProvenanceRecord["provenance"], source: string | null) => {
    provenance.push({ field, provenance: provenanceKind, source });
  };
  const verifiedSource = (field: string) =>
    `manual_public_verification:lead.inspection_summary.verified_public_facts.${field}`;

  record("businessName", "sourced", "lead.business_name");
  record("industry", "sourced", "lead.industry");
  record("city", city ? "sourced" : "omitted", city ? "lead.city" : null);
  record("phone", phone ? "sourced" : "omitted", phone ? "lead.phone" : null);
  record("email", email ? "sourced" : "omitted", email ? "lead.email" : null);
  record("address", address ? "sourced" : "omitted", address ? "lead.address" : null);
  record("websiteUrl", websiteUrl ? "sourced" : noStandaloneWebsite ? "omitted" : "omitted", websiteUrl ? "lead.website_url" : null);
  if (noStandaloneWebsite) {
    record("websiteStatus", "sourced", "lead.inspection_summary.no_standalone_website");
  }
  record("rating", rating ? "sourced" : "omitted", rating ? (verifiedFacts?.rating === rating ? verifiedSource("rating") : "lead.google_rating") : null);
  record("reviewCount", reviewCount ? "sourced" : "omitted", reviewCount ? (verifiedFacts?.reviewCount === reviewCount ? verifiedSource("reviewCount") : "lead.review_count") : null);
  record("description", description ? "sourced" : "omitted", description ? (verifiedFacts?.description === description ? verifiedSource("description") : "lead.inspection_summary.public_description") : null);
  record("cuisine", cuisine ? "sourced" : "omitted", cuisine ? (verifiedFacts?.cuisine === cuisine ? verifiedSource("cuisine") : "lead.inspection_summary.cuisine") : null);
  record("hours", hours ? "sourced" : "omitted", hours ? (verifiedFacts?.hours === hours ? verifiedSource("hours") : "lead.inspection_summary.public_hours") : null);
  record("dailyHours", dailyHours.length > 0 ? "sourced" : "omitted", dailyHours.length > 0 ? "lead.inspection_summary.public_hours_by_day" : null);
  record("menuLink", menuLink ? "sourced" : "omitted", menuLink ? (verifiedFacts?.menuUrl === menuLink ? verifiedSource("menuUrl") : "lead.inspection_summary.menu_link") : null);
  record("reservationUrl", reservationUrl ? "sourced" : "omitted", reservationUrl ? (verifiedFacts?.reservationUrl === reservationUrl ? verifiedSource("reservationUrl") : "lead.inspection_summary.reservation_link") : null);
  record("orderUrl", orderUrl ? "sourced" : "omitted", orderUrl ? (verifiedFacts?.orderUrl === orderUrl ? verifiedSource("orderUrl") : "lead.inspection_summary.order_link") : null);
  record("socialUrl", socialUrl ? "sourced" : "omitted", socialUrl ? (verifiedFacts?.socialUrl === socialUrl ? verifiedSource("socialUrl") : "lead.inspection_summary.social_url") : null);
  record("socialProfiles", socialProfiles.length > 0 ? "sourced" : "omitted", socialProfiles.length > 0 ? "manual_public_verification:lead.inspection_summary.social_profiles" : null);
  record("ratingSource", ratingSource ? "sourced" : "omitted", ratingSource ? (ratingSourceRaw ? "lead.inspection_summary.rating_source" : "manual_public_verification") : null);
  record("images", images.length > 0 ? "sourced" : "omitted", images.length > 0 ? "manual_public_verification:lead.inspection_summary.approved_images" : null);
  record("restaurantHighlights", highlights.length > 0 ? "derived" : "omitted", highlights.length > 0 ? "verified_public_facts.description+cuisine" : null);
  record("reservationsOffered", reservationsOffered ? "sourced" : "omitted", reservationsOffered ? "inspection_or_audit" : null);
  record("orderingOffered", orderingOffered ? "sourced" : "omitted", orderingOffered ? "inspection_or_audit" : null);
  record("emergencyOffered", emergencyOffered ? "sourced" : "omitted", emergencyOffered ? "audit.findings" : null);
  record("testimonials", "omitted", null);
  record("licenses", "omitted", null);

  return {
    name: lead.businessName.trim(),
    industry: lead.industry,
    city,
    state,
    region,
    address,
    phone,
    email,
    websiteUrl,
    rating,
    reviewCount,
    description,
    cuisine,
    hours,
    dailyHours,
    menuLink,
    reservationUrl,
    orderUrl,
    socialUrl,
    socialProfiles,
    ratingSource,
    shortName,
    highlights,
    images,
    reservationsOffered,
    orderingOffered,
    emergencyOffered,
    provenance,
  };
}

export function sanitizePublicSummary(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!hasStructuredLabels(cleaned)) return cleaned;
  const match = cleaned.match(/\bDescription:\s*(.*?)(?=\s+(Cuisine\/category|Cuisine|Rating|Review count|Hours|Phone|Address|Menu|Ordering|Reservation):|$)/i);
  return match?.[1]?.trim() || null;
}

function hasStructuredLabels(value: string): boolean {
  return /\b(Cuisine\/category|Cuisine|Rating|Review count|Description|Hours|Phone|Address|Menu|Ordering|Reservation):/i.test(value);
}

function extractLegacyDailyHours(value: string | null): DailyHours[] {
  if (!value || !hasStructuredLabels(value)) return [];
  const source = value.replace(/\s+/g, " ");
  const rows: DailyHours[] = [];
  for (let index = 0; index < DAY_ORDER.length; index += 1) {
    const { key, label } = DAY_ORDER[index];
    const next = DAY_ORDER[index + 1]?.label;
    const pattern = new RegExp(`${label}:\\s*(.*?)(?=${next ? `\\s+${next}:` : "\\s*$"})`, "i");
    const match = source.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const valueText = raw.replace(/^(closed)$/i, "Closed").slice(0, 60);
    rows.push({ day: key, label, value: valueText, closed: /^closed$/i.test(valueText) });
  }
  return rows;
}

function deriveShortName(name: string): string | null {
  const cleaned = name
    .replace(/\b(restaurant|cafe|coffee|grill|bar|kitchen|llc|inc)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned && cleaned.length >= 2 && cleaned.length < name.trim().length
    ? cleaned
    : null;
}

function deriveRestaurantHighlights(source: string): string[] {
  const lower = source.toLowerCase();
  const supported = [
    ["Salvadoran restaurant", /\bsalvadoran\b/],
    ["Pupusas", /\bpupusas?\b/],
    ["Soups", /\bsoups?\b/],
    ["Seafood", /\bseafood\b/],
    ["Traditional dishes", /\btraditional\b/],
  ] as const;
  return supported
    .filter(([, pattern]) => pattern.test(lower))
    .map(([label]) => label)
    .slice(0, 4);
}

export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}

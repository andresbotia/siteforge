import type { BuilderAuditInput, BuilderLeadInput, ProvenanceRecord } from "./types";
import { isNoStandaloneWebsiteLead } from "@/lib/prospects/no-website";
import { readVerifiedPublicFacts } from "@/lib/prospects/verified-public-facts";

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
  menuLink: string | null;
  reservationUrl: string | null;
  orderUrl: string | null;
  socialUrl: string | null;
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
  const description = verifiedFacts?.description ?? summaryString(lead.inspectionSummary, "public_description");
  const cuisine = verifiedFacts?.cuisine ?? summaryString(lead.inspectionSummary, "cuisine");
  const hours = verifiedFacts?.hours ?? summaryString(lead.inspectionSummary, "public_hours");
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
  record("menuLink", menuLink ? "sourced" : "omitted", menuLink ? (verifiedFacts?.menuUrl === menuLink ? verifiedSource("menuUrl") : "lead.inspection_summary.menu_link") : null);
  record("reservationUrl", reservationUrl ? "sourced" : "omitted", reservationUrl ? (verifiedFacts?.reservationUrl === reservationUrl ? verifiedSource("reservationUrl") : "lead.inspection_summary.reservation_link") : null);
  record("orderUrl", orderUrl ? "sourced" : "omitted", orderUrl ? (verifiedFacts?.orderUrl === orderUrl ? verifiedSource("orderUrl") : "lead.inspection_summary.order_link") : null);
  record("socialUrl", socialUrl ? "sourced" : "omitted", socialUrl ? (verifiedFacts?.socialUrl === socialUrl ? verifiedSource("socialUrl") : "lead.inspection_summary.social_url") : null);
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
    menuLink,
    reservationUrl,
    orderUrl,
    socialUrl,
    reservationsOffered,
    orderingOffered,
    emergencyOffered,
    provenance,
  };
}

export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}

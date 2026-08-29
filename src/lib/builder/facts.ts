import type { BuilderAuditInput, BuilderLeadInput, ProvenanceRecord } from "./types";

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
  menuLink: string | null;
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
  const region = [city, state].filter(Boolean).join(", ") || null;
  const rating = lead.rating && lead.rating > 0 ? lead.rating : null;
  const reviewCount = lead.reviewCount > 0 ? lead.reviewCount : null;
  const codes = new Set(audit.findings.map((item) => item.code));
  const menuLinkRaw = summaryString(lead.inspectionSummary, "menu_link");
  const reservationLink = summaryString(lead.inspectionSummary, "reservation_link");
  const orderLink = summaryString(lead.inspectionSummary, "order_link");
  const menuLink =
    menuLinkRaw && isHttpUrl(menuLinkRaw) && !menuLinkRaw.toLowerCase().startsWith("javascript:")
      ? menuLinkRaw
      : null;

  const reservationsOffered =
    Boolean(reservationLink) ||
    codes.has("restaurant_reservation_broken") ||
    codes.has("restaurant_reservation_unclear");
  const orderingOffered =
    Boolean(orderLink) || codes.has("restaurant_order_broken");
  const emergencyOffered = codes.has("home_service_emergency_cta_missing");

  const record = (field: string, provenanceKind: ProvenanceRecord["provenance"], source: string | null) => {
    provenance.push({ field, provenance: provenanceKind, source });
  };

  record("businessName", "sourced", "lead.business_name");
  record("industry", "sourced", "lead.industry");
  record("city", city ? "sourced" : "omitted", city ? "lead.city" : null);
  record("phone", phone ? "sourced" : "omitted", phone ? "lead.phone" : null);
  record("email", email ? "sourced" : "omitted", email ? "lead.email" : null);
  record("address", address ? "sourced" : "omitted", address ? "lead.address" : null);
  record("rating", rating ? "sourced" : "omitted", rating ? "lead.google_rating" : null);
  record("reviewCount", reviewCount ? "sourced" : "omitted", reviewCount ? "lead.review_count" : null);
  record("hours", "omitted", null);
  record("menuLink", menuLink ? "sourced" : "omitted", menuLink ? "lead.inspection_summary.menu_link" : null);
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
    menuLink,
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

import { assertSafeHttpUrl, type DnsLookup } from "@/lib/http/ssrf";
import { asNumber, asRecord } from "@/lib/json";
import type { DailyHours, DayKey, SocialPlatform, SocialProfile, WebsiteImageAsset } from "@/lib/builder/types";
import { canRenderImage } from "@/lib/builder/images";

export const VERIFIED_PUBLIC_FACT_SOURCE = "manual_public_verification";

export type VerifiedPublicFactKey =
  | "sourceUrl"
  | "description"
  | "cuisine"
  | "hours"
  | "hoursByDay"
  | "rating"
  | "reviewCount"
  | "socialUrl"
  | "socialProfiles"
  | "imageAssets"
  | "menuUrl"
  | "orderUrl"
  | "reservationUrl";

type StringFactInputKey = Exclude<VerifiedPublicFactKey, "hoursByDay" | "socialProfiles" | "imageAssets">;

export type VerifiedPublicFactsInput = Partial<Record<StringFactInputKey, string>> & {
  dailyHours?: Partial<Record<DayKey, { value: string; closed: boolean }>>;
  socialProfiles?: Partial<Record<SocialPlatform, string>>;
  imageAssets?: Array<{
    url: string;
    role: string;
    alt: string;
    sourceType: string;
    sourceUrl: string;
    rightsStatus: string;
    approvalStatus: string;
  }>;
};

export type VerifiedPublicFacts = {
  description: string | null;
  cuisine: string | null;
  hours: string | null;
  hoursByDay: DailyHours[];
  rating: number | null;
  reviewCount: number | null;
  socialUrl: string | null;
  socialProfiles: SocialProfile[];
  menuUrl: string | null;
  orderUrl: string | null;
  reservationUrl: string | null;
};

export type VerifiedPublicFactProvenance = {
  source_type: typeof VERIFIED_PUBLIC_FACT_SOURCE;
  source_url: string | null;
  verified_at: string;
  verified_by: "admin";
};

export type VerifiedPublicFactsSummary = {
  source_type: typeof VERIFIED_PUBLIC_FACT_SOURCE;
  source_url: string | null;
  verified_at: string;
  verified_by: "admin";
  facts: VerifiedPublicFacts;
  imageAssets: WebsiteImageAsset[];
  provenance: Partial<Record<VerifiedPublicFactKey, VerifiedPublicFactProvenance>>;
};

export type VerifiedPublicFactsValidation =
  | { ok: true; summary: VerifiedPublicFactsSummary }
  | { ok: false; error: string; field: VerifiedPublicFactKey };

type PersistedFactKey = keyof VerifiedPublicFacts;

const TEXT_LIMITS: Record<"description" | "cuisine" | "hours", number> = {
  description: 500,
  cuisine: 80,
  hours: 220,
};
export const DAY_ORDER: Array<{ key: DayKey; label: string }> = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];
const SOCIAL_HOSTS: Record<SocialPlatform, string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  youtube: ["youtube.com", "www.youtube.com", "youtu.be"],
  x: ["x.com", "www.x.com"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
};

function cleanText(value: string | null | undefined, max: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function hasUnsafeText(value: string): boolean {
  return /<[^>]+>|javascript:|data:|file:|onerror\s*=|onload\s*=|<\s*script/i.test(value);
}

function withDefaultScheme(raw: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
}

async function safeOptionalUrl(
  raw: string | null | undefined,
  field: VerifiedPublicFactKey,
  lookup?: DnsLookup,
): Promise<{ ok: true; value: string | null } | { ok: false; error: string; field: VerifiedPublicFactKey }> {
  const text = cleanText(raw, 300);
  if (!text) return { ok: true, value: null };
  try {
    return { ok: true, value: (await assertSafeHttpUrl(withDefaultScheme(text), lookup)).toString() };
  } catch {
    return { ok: false, error: "Enter a public http or https URL.", field };
  }
}

function validateSocialUrl(raw: string, platform: SocialPlatform): string | null {
  const text = cleanText(raw, 300);
  if (!text) return null;
  const candidate = withDefaultScheme(text);
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!SOCIAL_HOSTS[platform].includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function inferVerifiedSocialProfile(raw: string | null, sourceUrl: string | null = null): SocialProfile | null {
  if (!raw) return null;
  for (const platform of Object.keys(SOCIAL_HOSTS) as SocialPlatform[]) {
    const url = validateSocialUrl(raw, platform);
    if (url) {
      return { platform, url, sourceUrl, verificationStatus: "operator_verified" };
    }
  }
  return null;
}

export function readSocialProfiles(value: unknown): SocialProfile[] {
  const rows = Array.isArray(value) ? value : [];
  return rows.flatMap((row) => {
    const item = asRecord(row);
    const platform = String(item.platform ?? "") as SocialPlatform;
    if (!(platform in SOCIAL_HOSTS)) return [];
    const url = typeof item.url === "string" ? validateSocialUrl(item.url, platform) : null;
    if (!url || item.verificationStatus !== "operator_verified") return [];
    return [{
      platform,
      url,
      sourceUrl: typeof item.sourceUrl === "string" && item.sourceUrl.trim() ? item.sourceUrl.trim() : null,
      verificationStatus: "operator_verified" as const,
    }];
  });
}

function normalizeDailyHours(input: VerifiedPublicFactsInput["dailyHours"]): DailyHours[] {
  if (!input) return [];
  return DAY_ORDER.flatMap(({ key, label }) => {
    const row = input[key];
    const value = cleanText(row?.value, 60);
    const closed = row?.closed === true;
    if (!value && !closed) return [];
    return [{ day: key, label, value: closed ? "Closed" : value, closed }];
  });
}

function normalizeImageAssets(input: VerifiedPublicFactsInput["imageAssets"]): WebsiteImageAsset[] {
  if (!input) return [];
  return input.flatMap((item) => {
    const image: WebsiteImageAsset = {
      url: cleanText(item.url, 300),
      alt: cleanText(item.alt, 160),
      role: item.role === "gallery" ? "gallery" : item.role === "hero" ? "hero" : "project",
      sourceType:
        item.sourceType === "business_owned" ||
        item.sourceType === "operator_uploaded" ||
        item.sourceType === "licensed_stock" ||
        item.sourceType === "approved_public_asset"
          ? item.sourceType
          : "third_party_reference",
      sourceUrl: cleanText(item.sourceUrl, 300) || null,
      rightsStatus: item.rightsStatus === "approved" ? "approved" : "unknown",
      approvalStatus: item.approvalStatus === "approved" ? "approved" : "pending",
      attribution: null,
    };
    if (!image.url || !image.alt) return [];
    return canRenderImage(image) ? [image] : [];
  });
}

export async function validateVerifiedPublicFacts(
  input: VerifiedPublicFactsInput,
  options: { verifiedAt?: string; lookup?: DnsLookup } = {},
): Promise<VerifiedPublicFactsValidation> {
  const sourceUrl = await safeOptionalUrl(input.sourceUrl, "sourceUrl", options.lookup);
  if (!sourceUrl.ok) return sourceUrl;

  const description = cleanText(input.description, TEXT_LIMITS.description);
  const cuisine = cleanText(input.cuisine, TEXT_LIMITS.cuisine);
  const hours = cleanText(input.hours, TEXT_LIMITS.hours);
  const hoursByDay = normalizeDailyHours(input.dailyHours);

  for (const [field, value] of Object.entries({ description, cuisine, hours }) as Array<[
    "description" | "cuisine" | "hours",
    string,
  ]>) {
    if (value && hasUnsafeText(value)) {
      return { ok: false, error: "Use plain public text only.", field };
    }
  }

  const ratingText = cleanText(input.rating, 20);
  const rating = ratingText ? Number(ratingText) : null;
  if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
    return { ok: false, error: "Rating must be between 0 and 5.", field: "rating" };
  }

  const reviewText = cleanText(input.reviewCount, 20);
  const reviewCount = reviewText ? Number(reviewText) : null;
  if (
    reviewCount !== null &&
    (!Number.isInteger(reviewCount) || reviewCount < 0 || reviewCount > 1_000_000)
  ) {
    return { ok: false, error: "Review count must be a non-negative whole number.", field: "reviewCount" };
  }

  const socialUrl = await safeOptionalUrl(input.socialUrl, "socialUrl", options.lookup);
  if (!socialUrl.ok) return socialUrl;
  const socialProfiles: SocialProfile[] = [];
  for (const platform of Object.keys(SOCIAL_HOSTS) as SocialPlatform[]) {
    const raw = input.socialProfiles?.[platform];
    if (!raw) continue;
    const url = validateSocialUrl(raw, platform);
    if (!url) {
      return { ok: false, error: "Enter a verified profile URL for the selected platform.", field: "socialProfiles" };
    }
    socialProfiles.push({
      platform,
      url,
      sourceUrl: sourceUrl.value,
      verificationStatus: "operator_verified",
    });
  }
  const menuUrl = await safeOptionalUrl(input.menuUrl, "menuUrl", options.lookup);
  if (!menuUrl.ok) return menuUrl;
  const orderUrl = await safeOptionalUrl(input.orderUrl, "orderUrl", options.lookup);
  if (!orderUrl.ok) return orderUrl;
  const reservationUrl = await safeOptionalUrl(input.reservationUrl, "reservationUrl", options.lookup);
  if (!reservationUrl.ok) return reservationUrl;
  const imageAssets = normalizeImageAssets(input.imageAssets);

  const facts: VerifiedPublicFacts = {
    description: description || null,
    cuisine: cuisine || null,
    hours: hours || null,
    hoursByDay,
    rating,
    reviewCount,
    socialUrl: socialUrl.value,
    socialProfiles,
    menuUrl: menuUrl.value,
    orderUrl: orderUrl.value,
    reservationUrl: reservationUrl.value,
  };
  const verifiedAt = options.verifiedAt ?? new Date().toISOString();
  const provenance: VerifiedPublicFactsSummary["provenance"] = {};
  for (const key of Object.keys(facts) as PersistedFactKey[]) {
    const value = facts[key];
    if (value === null || (Array.isArray(value) && value.length === 0)) continue;
    provenance[key] = {
      source_type: VERIFIED_PUBLIC_FACT_SOURCE,
      source_url:
        typeof value === "string" && /^https?:\/\//i.test(value)
          ? value
          : sourceUrl.value,
      verified_at: verifiedAt,
      verified_by: "admin",
    };
  }

  return {
    ok: true,
    summary: {
      source_type: VERIFIED_PUBLIC_FACT_SOURCE,
      source_url: sourceUrl.value,
      verified_at: verifiedAt,
      verified_by: "admin",
      facts,
      imageAssets,
      provenance,
    },
  };
}

export function readVerifiedPublicFacts(summary: unknown): VerifiedPublicFactsSummary | null {
  const root = asRecord(summary);
  const value = asRecord(root.verified_public_facts);
  const factsRow = asRecord(value.facts);
  if (value.source_type !== VERIFIED_PUBLIC_FACT_SOURCE) return null;
  const facts: VerifiedPublicFacts = {
    description: stringOrNull(factsRow.description),
    cuisine: stringOrNull(factsRow.cuisine),
    hours: stringOrNull(factsRow.hours),
    hoursByDay: readDailyHours(factsRow.hoursByDay),
    rating: asNumber(factsRow.rating),
    reviewCount: asNumber(factsRow.reviewCount),
    socialUrl: stringOrNull(factsRow.socialUrl),
    socialProfiles: readSocialProfiles(factsRow.socialProfiles),
    menuUrl: stringOrNull(factsRow.menuUrl),
    orderUrl: stringOrNull(factsRow.orderUrl),
    reservationUrl: stringOrNull(factsRow.reservationUrl),
  };
  return {
    source_type: VERIFIED_PUBLIC_FACT_SOURCE,
    source_url: stringOrNull(value.source_url),
    verified_at: typeof value.verified_at === "string" ? value.verified_at : "",
    verified_by: "admin",
    facts,
    imageAssets: Array.isArray(value.imageAssets)
      ? normalizePersistedImages(value.imageAssets)
      : Array.isArray(root.approved_images)
        ? normalizePersistedImages(root.approved_images)
        : [],
    provenance: asRecord(value.provenance) as VerifiedPublicFactsSummary["provenance"],
  };
}

export function buildVerifiedPublicFactsInspectionSummary(
  previousSummary: unknown,
  summary: VerifiedPublicFactsSummary,
): Record<string, unknown> {
  const previous = asRecord(previousSummary);
  const facts = summary.facts;
  return {
    ...previous,
    verified_public_facts: summary,
    menu_link: facts.menuUrl,
    order_link: facts.orderUrl,
    reservation_link: facts.reservationUrl,
    social_url: facts.socialUrl,
    social_profiles: facts.socialProfiles,
    public_hours: facts.hours,
    public_hours_by_day: facts.hoursByDay,
    public_description: facts.description,
    cuisine: facts.cuisine,
    approved_images: summary.imageAssets,
  };
}

function normalizePersistedImages(value: unknown[]): WebsiteImageAsset[] {
  return value.flatMap((item) => {
    const row = asRecord(item);
    const image: WebsiteImageAsset = {
      url: stringOrNull(row.url) ?? "",
      alt: stringOrNull(row.alt) ?? "",
      role: row.role === "gallery" ? "gallery" : row.role === "hero" ? "hero" : "project",
      sourceType:
        row.sourceType === "business_owned" ||
        row.sourceType === "operator_uploaded" ||
        row.sourceType === "licensed_stock" ||
        row.sourceType === "approved_public_asset" ||
        row.sourceType === "managed_asset"
          ? row.sourceType
          : "third_party_reference",
      sourceUrl: stringOrNull(row.sourceUrl),
      rightsStatus: row.rightsStatus === "approved" ? "approved" : "unknown",
      approvalStatus: row.approvalStatus === "approved" ? "approved" : "pending",
      attribution: stringOrNull(row.attribution),
    };
    return canRenderImage(image) ? [image] : [];
  });
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readDailyHours(value: unknown): DailyHours[] {
  const rows = Array.isArray(value) ? value : [];
  return rows.flatMap((row) => {
    const item = asRecord(row);
    const day = String(item.day ?? "") as DayKey;
    const known = DAY_ORDER.find((entry) => entry.key === day);
    const valueText = stringOrNull(item.value);
    if (!known || !valueText || hasUnsafeText(valueText) || valueText.length > 60) return [];
    return [{
      day,
      label: known.label,
      value: valueText,
      closed: item.closed === true || valueText.toLowerCase() === "closed",
    }];
  });
}

import { assertSafeHttpUrl, type DnsLookup } from "@/lib/http/ssrf";
import { asNumber, asRecord } from "@/lib/json";

export const VERIFIED_PUBLIC_FACT_SOURCE = "manual_public_verification";

export type VerifiedPublicFactKey =
  | "sourceUrl"
  | "description"
  | "cuisine"
  | "hours"
  | "rating"
  | "reviewCount"
  | "socialUrl"
  | "menuUrl"
  | "orderUrl"
  | "reservationUrl";

export type VerifiedPublicFactsInput = Partial<Record<VerifiedPublicFactKey, string>>;

export type VerifiedPublicFacts = {
  description: string | null;
  cuisine: string | null;
  hours: string | null;
  rating: number | null;
  reviewCount: number | null;
  socialUrl: string | null;
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
  provenance: Partial<Record<VerifiedPublicFactKey, VerifiedPublicFactProvenance>>;
};

export type VerifiedPublicFactsValidation =
  | { ok: true; summary: VerifiedPublicFactsSummary }
  | { ok: false; error: string; field: VerifiedPublicFactKey };

type PersistedFactKey = Exclude<VerifiedPublicFactKey, "sourceUrl">;

const TEXT_LIMITS: Record<"description" | "cuisine" | "hours", number> = {
  description: 500,
  cuisine: 80,
  hours: 220,
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

export async function validateVerifiedPublicFacts(
  input: VerifiedPublicFactsInput,
  options: { verifiedAt?: string; lookup?: DnsLookup } = {},
): Promise<VerifiedPublicFactsValidation> {
  const sourceUrl = await safeOptionalUrl(input.sourceUrl, "sourceUrl", options.lookup);
  if (!sourceUrl.ok) return sourceUrl;

  const description = cleanText(input.description, TEXT_LIMITS.description);
  const cuisine = cleanText(input.cuisine, TEXT_LIMITS.cuisine);
  const hours = cleanText(input.hours, TEXT_LIMITS.hours);

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
  const menuUrl = await safeOptionalUrl(input.menuUrl, "menuUrl", options.lookup);
  if (!menuUrl.ok) return menuUrl;
  const orderUrl = await safeOptionalUrl(input.orderUrl, "orderUrl", options.lookup);
  if (!orderUrl.ok) return orderUrl;
  const reservationUrl = await safeOptionalUrl(input.reservationUrl, "reservationUrl", options.lookup);
  if (!reservationUrl.ok) return reservationUrl;

  const facts: VerifiedPublicFacts = {
    description: description || null,
    cuisine: cuisine || null,
    hours: hours || null,
    rating,
    reviewCount,
    socialUrl: socialUrl.value,
    menuUrl: menuUrl.value,
    orderUrl: orderUrl.value,
    reservationUrl: reservationUrl.value,
  };
  const verifiedAt = options.verifiedAt ?? new Date().toISOString();
  const provenance: VerifiedPublicFactsSummary["provenance"] = {};
  for (const key of Object.keys(facts) as PersistedFactKey[]) {
    const value = facts[key];
    if (value === null) continue;
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
    rating: asNumber(factsRow.rating),
    reviewCount: asNumber(factsRow.reviewCount),
    socialUrl: stringOrNull(factsRow.socialUrl),
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
    public_hours: facts.hours,
    public_description: facts.description,
    cuisine: facts.cuisine,
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

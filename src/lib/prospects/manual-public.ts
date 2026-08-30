import { assertSafeHttpUrl } from "@/lib/http/ssrf";
import { industries } from "@/lib/constants";
import { MANUAL_PUBLIC_PROSPECT_SOURCE } from "@/lib/prospects/constants";
import { findDuplicate } from "@/lib/scout/dedupe";
import {
  normalizeBusinessName,
  normalizeDomain,
  normalizePhone,
  parseLocation,
} from "@/lib/scout/normalize";
import type { DnsLookup } from "@/lib/scout/ssrf";
import type { ExistingLeadRecord, NormalizedBusiness } from "@/lib/scout/types";
import type { Industry } from "@/types";

export { MANUAL_PUBLIC_PROSPECT_SOURCE };

export type ManualPublicProspectInput = {
  businessName: string;
  websiteUrl: string;
  location: string;
  industry: string;
  phone?: string | null;
  address?: string | null;
  sourceNote?: string | null;
};

export type ManualPublicProspectDraft = {
  business: NormalizedBusiness;
  duplicateId: string | null;
  source: typeof MANUAL_PUBLIC_PROSPECT_SOURCE;
  sourceNote: string | null;
};

export type ManualPublicProspectValidation =
  | { ok: true; draft: ManualPublicProspectDraft }
  | { ok: false; error: string };

const MAX_TEXT_LENGTH = 160;
const MAX_NOTE_LENGTH = 300;

function cleanText(value: string | null | undefined, max = MAX_TEXT_LENGTH): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function isIndustry(value: string): value is Industry {
  return (industries as readonly string[]).includes(value);
}

function withDefaultScheme(raw: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export async function validateManualPublicProspect(
  input: ManualPublicProspectInput,
  existingLeads: ExistingLeadRecord[],
  lookup?: DnsLookup,
): Promise<ManualPublicProspectValidation> {
  const businessName = cleanText(input.businessName);
  if (businessName.length < 2) {
    return { ok: false, error: "Enter a public business name." };
  }

  const websiteUrl = withDefaultScheme(cleanText(input.websiteUrl, 220));
  let safeUrl: URL;
  try {
    safeUrl = await assertSafeHttpUrl(websiteUrl, lookup);
  } catch {
    return { ok: false, error: "Enter a public http or https website URL." };
  }

  const location = parseLocation(input.location);
  if (!location.city || !location.state) {
    return { ok: false, error: "Enter city and state, for example Fort Lauderdale, FL." };
  }

  const industry = cleanText(input.industry);
  if (!isIndustry(industry)) {
    return { ok: false, error: "Choose a supported public business category." };
  }

  const normalizedPhone = normalizePhone(input.phone);
  if (input.phone && !normalizedPhone) {
    return { ok: false, error: "Enter a valid public phone number or leave it blank." };
  }

  const normalizedDomain = normalizeDomain(safeUrl.toString());
  if (!normalizedDomain) {
    return { ok: false, error: "Enter a public business website URL." };
  }

  const business: NormalizedBusiness = {
    name: businessName,
    categoryId: "manual_public",
    industry,
    city: location.city,
    state: location.state,
    address: cleanText(input.address) || null,
    websiteUrl: safeUrl.toString(),
    phone: cleanText(input.phone) || null,
    rating: null,
    reviewCount: 0,
    source: MANUAL_PUBLIC_PROSPECT_SOURCE,
    likelyChain: false,
    normalizedName: normalizeBusinessName(businessName),
    normalizedDomain,
    normalizedPhone,
  };

  const duplicate = findDuplicate(business, existingLeads);
  return {
    ok: true,
    draft: {
      business,
      duplicateId: duplicate?.id ?? null,
      source: MANUAL_PUBLIC_PROSPECT_SOURCE,
      sourceNote: cleanText(input.sourceNote, MAX_NOTE_LENGTH) || null,
    },
  };
}

export function isManualPublicProspectSource(source: string | null | undefined): boolean {
  return source === MANUAL_PUBLIC_PROSPECT_SOURCE;
}

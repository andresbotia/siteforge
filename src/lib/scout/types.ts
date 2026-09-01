import type { ScoutCategoryId } from "./categories";

export const QUALIFICATION_TIERS = [
  "reject",
  "review",
  "qualified",
  "high_priority",
] as const;

export type QualificationTier = (typeof QUALIFICATION_TIERS)[number];

export type DiscoverySource = {
  provider: string;
  query: string;
  retrievedAt: string;
};

export const GOOGLE_BUSINESS_STATUSES = ["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"] as const;
export type GoogleBusinessStatus = (typeof GOOGLE_BUSINESS_STATUSES)[number];

export type DiscoveredBusiness = {
  name: string;
  categoryId: ScoutCategoryId | "manual_public";
  industry: string;
  city: string;
  state: string;
  address?: string | null;
  websiteUrl?: string | null;
  phone?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  source: string;
  likelyChain?: boolean;
  /** Only ever set from data a source directly and explicitly provided. Never guessed/inferred. */
  email?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  hours?: string | null;
  /** A public page a human can open to see the raw source record (e.g. the OSM object page, or a Google Maps place link). */
  sourceUrl?: string | null;
  sources?: DiscoverySource[];
  /** Google Place ID, when the source is Google Places. Used for dedupe and provenance. Null for non-Google sources. */
  placeId?: string | null;
  /** Google's own operational-status signal. Absent/null must never be treated as "closed" -- only an explicit value counts. */
  businessStatus?: GoogleBusinessStatus | null;
};

export type NormalizedBusiness = DiscoveredBusiness & {
  normalizedName: string;
  normalizedDomain: string | null;
  normalizedPhone: string | null;
};

export type PageSignals = {
  url: string;
  status: number | null;
  https: boolean;
  elapsedMs: number | null;
  title: string | null;
  metaDescription: string | null;
  hasViewport: boolean;
  hasCanonical: boolean;
  canonicalHref: string | null;
  headingCount: number;
  h1Count: number;
  h1Texts: string[];
  h2Count: number;
  hasNav: boolean;
  hasPhoneLink: boolean;
  hasMailto: boolean;
  hasForm: boolean;
  hasContactCta: boolean;
  copyrightYear: number | null;
  menuLink: string | null;
  menuLooksLikePdf: boolean;
  reservationLink: string | null;
  orderLink: string | null;
  contactLink: string | null;
  servicesLink: string | null;
  aboutLink: string | null;
  mentionsMenu: boolean;
  mentionsReservations: boolean;
  mentionsOrdering: boolean;
  visibleTextLength: number;
  hasHours: boolean;
  hasAddressOrLocation: boolean;
  hasServiceArea: boolean;
  mentionsEmergency: boolean;
  hasPlaceholderText: boolean;
  hasPlainPhoneText: boolean;
  looksMalformed: boolean;
  modernizationSignals: Array<{
    code: string;
    title: string;
    evidence: string;
    strength: "low" | "medium" | "high";
  }>;
  sameSiteHrefs: string[];
  sameOriginHrefs: string[];
};

export type LinkCheck = {
  url: string;
  kind: "menu" | "reservation" | "order" | "contact" | "other";
  status: number | null;
  ok: boolean;
};

export type InspectionResult = {
  reachable: boolean;
  finalUrl: string | null;
  blockedReason: string | null;
  error: string | null;
  homepage: PageSignals | null;
  linkChecks: LinkCheck[];
  pagesFetched: number;
};

export type ScoreBreakdown = {
  businessStrengthScore: number;
  websiteOpportunityScore: number;
  overallQualificationScore: number;
  tier: QualificationTier;
  reasons: string[];
};

export type ExistingLeadRecord = {
  id: string;
  businessName: string;
  websiteUrl: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  notes: string | null;
  normalizedDomain?: string | null;
  normalizedPhone?: string | null;
  /** Read back from a prior run's inspection_summary.google_place_id -- no dedicated leads column/migration. */
  googlePlaceId?: string | null;
};

export type PersistDecision = {
  action: "insert" | "update" | "skip";
  existingId?: string;
  reason: string;
};

export type ScoutRunConfig = {
  location: string;
  categoryId: ScoutCategoryId;
  limit: number;
};

export type ScoutCandidateResult = {
  business: NormalizedBusiness;
  inspection: InspectionResult;
  score: ScoreBreakdown;
  persist: PersistDecision;
  leadId?: string;
};

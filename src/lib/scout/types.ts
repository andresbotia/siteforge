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

export type DiscoveredBusiness = {
  name: string;
  categoryId: ScoutCategoryId;
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

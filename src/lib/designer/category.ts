/**
 * Deterministic, non-Builder category-context classification for Designer
 * Jobs. Intentionally a small standalone keyword table, NOT an import from
 * src/lib/builder/registry.ts -- that registry drives Builder's own
 * template/preset selection (legacy visual system) and must stay out of the
 * Designer Worker's reach per prompt.ts's HARD VISUAL ISOLATION RULE. This
 * table only ever produces plain-language information-architecture guidance
 * (what a category typically needs to communicate), never a palette,
 * layout, or component choice.
 */
export type DesignerCategoryContext = {
  key: string;
  label: string;
  informationPriorities: string[];
};

const CATEGORY_TABLE: { key: string; keywords: string[]; label: string; informationPriorities: string[] }[] = [
  {
    key: "restaurant",
    keywords: ["restaurant", "cafe", "café", "bakery", "bar", "grill", "kitchen", "eatery", "diner", "bistro", "pizzeria", "taqueria", "food truck"],
    label: "Restaurant / food & beverage",
    informationPriorities: ["food and atmosphere", "cuisine identity", "menu or category highlights", "hours (only if verified)", "reviews (only if verified)", "visit / directions"],
  },
  {
    key: "landscaping",
    keywords: ["landscap", "lawn", "garden", "tree service", "irrigation", "hardscap"],
    label: "Landscaping / outdoor services",
    informationPriorities: ["completed work", "services offered", "how the process works", "service area", "how to request a consultation", "visual proof of work (only if imagery exists)"],
  },
  {
    key: "home_trades",
    keywords: [
      "hvac",
      "plumb",
      "electric",
      "roofing",
      "roof",
      "air condition",
      "heating",
      "cooling",
      "contractor",
      "handyman",
      "pest control",
      "pool service",
      "pool",
      "cleaning service",
    ],
    label: "Home services / skilled trades",
    informationPriorities: ["services offered", "trust and credentials (only if verified)", "availability (only if verified)", "service area", "how to request an estimate or call", "verified credentials only"],
  },
  {
    key: "professional_services",
    keywords: ["law", "attorney", "legal", "account", "financial", "advisor", "consult", "insurance", "real estate", "realtor", "notary", "tax"],
    label: "Professional services",
    informationPriorities: ["expertise and credibility", "how the process works", "services offered", "how to make contact", "restrained, purposeful imagery"],
  },
  {
    key: "beauty_lifestyle",
    keywords: ["salon", "spa", "barber", "nail", "beauty", "wellness", "fitness", "gym", "yoga", "massage", "studio"],
    label: "Beauty / lifestyle / personal services",
    informationPriorities: ["atmosphere and experience", "services or menu of offerings", "how to book or make contact", "practitioner trust (only if verified)", "location and hours (only if verified)"],
  },
];

const GENERIC_CATEGORY_CONTEXT: DesignerCategoryContext = {
  key: "general_local_business",
  label: "General local business",
  informationPriorities: ["what the business does", "who it serves", "services offered", "trust signals (only if verified)", "how to make contact and where to find it"],
};

/** Longest-match-first is unnecessary here since the table's keywords do not overlap across categories; first match wins. */
export function resolveDesignerCategoryContext(industry: string): DesignerCategoryContext {
  const normalized = industry.toLowerCase();
  const match = CATEGORY_TABLE.find((entry) => entry.keywords.some((keyword) => normalized.includes(keyword)));
  if (!match) return GENERIC_CATEGORY_CONTEXT;
  return { key: match.key, label: match.label, informationPriorities: match.informationPriorities };
}

import { createHash } from "node:crypto";
import { createVerifiedFactSnapshot, type VerifiedFactSnapshot } from "@/lib/builder/external-sites";
import type { LeadRow } from "@/types/database";

/**
 * Sanitized, minimal business facts sent to the Designer Worker. This is
 * deliberately narrower than a raw LeadRow: no internal ids beyond what the
 * worker needs to label its own output, no scoring internals, no operator
 * notes, no qualification reasoning. Reuses the same VerifiedFactSnapshot
 * shape the external-generated-site pipeline already fingerprints and
 * compares for staleness (src/lib/builder/external-sites.ts), so a promoted
 * candidate's provenance stays consistent with the rest of Builder.
 */
export type DesignerBusinessFacts = {
  businessName: string;
  industry: string;
  city: string | null;
  region: string | null;
  snapshot: VerifiedFactSnapshot;
};

/**
 * The five approved imagery-provenance categories for Designer Jobs. An
 * image with no acceptable provenance must never be used -- see prompt.ts's
 * IMAGERY PROVENANCE CONTRACT section, which the worker is instructed to
 * follow exactly. "generated" covers a clearly illustrative AI-generated
 * asset an operator has explicitly approved and attached here; the worker
 * itself never generates or fetches imagery on its own.
 */
export const DESIGNER_IMAGE_PROVENANCE = ["customer_supplied", "operator_verified", "licensed", "generated", "template_illustrative"] as const;
export type DesignerImageProvenance = (typeof DESIGNER_IMAGE_PROVENANCE)[number];

export type DesignerImageAsset = {
  role: "hero" | "gallery" | "service" | "team" | "project";
  sourceType: DesignerImageProvenance;
  url: string;
  alt: string;
  note: string;
};

/** Bounded imagery manifest. Only assets an operator has explicitly approved may appear here. */
export type DesignerImageryManifest = {
  images: DesignerImageAsset[];
  policy: string;
};

const NO_IMAGERY_POLICY =
  "No operator-approved imagery is attached to this job. Do not source, scrape, rehost, or invent images from " +
  "Google, Google Maps, Yelp, Instagram, Facebook, TikTok, business directories, or any other business's website. " +
  "Design a strong CSS/typography-led or original-SVG-illustration composition that needs no photography, rather " +
  "than an empty placeholder block.";

export function businessFactsFromLead(
  lead: Pick<LeadRow, "business_name" | "industry" | "city" | "state" | "address" | "phone" | "website_url" | "google_rating" | "review_count" | "inspection_summary">,
): DesignerBusinessFacts {
  return {
    businessName: lead.business_name,
    industry: lead.industry,
    city: lead.city,
    region: lead.state,
    snapshot: createVerifiedFactSnapshot(lead),
  };
}

/**
 * A fixture business for QA/smoke-test use only. Fixture facts are clearly
 * marked (see designer_jobs.is_fixture) and must never be treated as a real
 * commercial candidate, promoted to master, or entered into the lead
 * pipeline -- the same rule /visual-qa fixtures already follow.
 */
export function fixtureBusinessFacts(input: {
  businessName: string;
  industry: string;
  city: string;
  region: string;
  phone?: string | null;
  address?: string | null;
}): DesignerBusinessFacts {
  return {
    businessName: input.businessName,
    industry: input.industry,
    city: input.city,
    region: input.region,
    snapshot: {
      businessName: input.businessName,
      category: input.industry,
      address: input.address ?? null,
      phone: input.phone ?? null,
      rating: null,
      reviewCount: null,
      hours: null,
      dailyHours: [],
      socials: [],
      menuUrl: null,
      orderUrl: null,
      reservationUrl: null,
      websiteStatus: "unknown",
      approvedAssetUrls: [],
    },
  };
}

export function emptyImageryManifest(): DesignerImageryManifest {
  return { images: [], policy: NO_IMAGERY_POLICY };
}

/**
 * How much legitimate photography this job has to work with. Computed
 * deterministically from the manifest already on the job row -- never
 * stored separately, so it can't drift from the manifest it describes.
 * Mirrors the PHOTO_RICH/PHOTO_LIGHT/PHOTO_ABSENT distinction the Designer
 * Worker must reason about explicitly (see prompt.ts's IMAGE STRATEGY
 * section): 3+ usable images is enough to genuinely compose with, 1-2 means
 * one strong image used deliberately rather than a gallery, 0 means an
 * honest non-photographic treatment.
 */
export const DESIGNER_IMAGERY_MODES = ["photo_rich", "photo_light", "photo_absent"] as const;
export type DesignerImageryMode = (typeof DESIGNER_IMAGERY_MODES)[number];

export function computeImageryMode(manifest: DesignerImageryManifest): DesignerImageryMode {
  const usable = manifest.images.filter((image) => image.url.trim().length > 0);
  if (usable.length >= 3) return "photo_rich";
  if (usable.length >= 1) return "photo_light";
  return "photo_absent";
}

export function fingerprintFacts(facts: DesignerBusinessFacts): string {
  return createHash("sha256").update(stableJson(facts)).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

import { asRecord } from "@/lib/json";
import type { ImageRole, ImageSourceType, WebsiteImageAsset } from "./types";

const IMAGE_ROLES = new Set<ImageRole>(["hero", "gallery", "service", "team", "project"]);
const IMAGE_SOURCE_TYPES = new Set<ImageSourceType>([
  "manual_upload",
  "operator_uploaded",
  "managed_asset",
  "business_owned",
  "licensed_stock",
  "approved_public_asset",
  "template_illustrative",
  "third_party_reference",
]);

/**
 * Locally bundled template artwork families. Only paths under
 * `public/fixtures/<family>/` are renderable; nothing is fetched or rehosted
 * from a remote host, a listing site, or a social platform.
 */
export const TEMPLATE_IMAGE_FAMILIES = ["restaurant", "home-services", "professional"] as const;

const FIXTURE_PATH = new RegExp(
  `^/fixtures/(${TEMPLATE_IMAGE_FAMILIES.join("|")})/[a-z0-9-]+\\.svg$`,
  "i",
);

export function readApprovedImages(summary: unknown): WebsiteImageAsset[] {
  const root = asRecord(summary);
  const rows = Array.isArray(root.approved_images) ? root.approved_images : [];
  return rows.flatMap((row) => {
    const image = parseImageAsset(row);
    return image && canRenderImage(image) ? [image] : [];
  });
}

export function canRenderImage(image: WebsiteImageAsset): boolean {
  return (
    image.approvalStatus === "approved" &&
    image.rightsStatus === "approved" &&
    isRenderableImageUrl(image.url) &&
    image.sourceType !== "third_party_reference"
  );
}

export function isRenderableImageUrl(value: string): boolean {
  if (!value || value.length > 300) return false;
  if (/[\s<>"'`]|javascript:|data:|file:|onerror\s*=|onload\s*=/i.test(value)) {
    return false;
  }
  return FIXTURE_PATH.test(value);
}

/**
 * Human-facing provenance label. Template artwork must stay visibly
 * illustrative wherever provenance is surfaced to an operator or reviewer.
 */
export function imageProvenanceLabel(image: WebsiteImageAsset): string {
  switch (image.sourceType) {
    case "template_illustrative":
      return "Template illustration (not a photo of this business)";
    case "business_owned":
      return "Supplied by the business";
    case "operator_uploaded":
    case "manual_upload":
      return "Operator supplied";
    case "managed_asset":
      return "Managed SiteForge asset";
    case "licensed_stock":
      return "Licensed stock";
    case "approved_public_asset":
      return "Approved public asset";
    default:
      return "Third-party reference (not renderable)";
  }
}

function parseImageAsset(value: unknown): WebsiteImageAsset | null {
  const row = asRecord(value);
  if (typeof row.url !== "string" || typeof row.alt !== "string") return null;
  if (!IMAGE_ROLES.has(row.role as ImageRole)) return null;
  if (!IMAGE_SOURCE_TYPES.has(row.sourceType as ImageSourceType)) return null;
  return {
    url: row.url,
    alt: row.alt.trim().slice(0, 160),
    role: row.role as ImageRole,
    sourceType: normalizeSourceType(row.sourceType as ImageSourceType),
    sourceUrl: typeof row.sourceUrl === "string" && row.sourceUrl.trim() ? row.sourceUrl.trim() : null,
    rightsStatus: row.rightsStatus === "approved" ? "approved" : "unknown",
    approvalStatus: row.approvalStatus === "approved" ? "approved" : "pending",
    attribution: typeof row.attribution === "string" && row.attribution.trim() ? row.attribution.trim().slice(0, 160) : null,
  };
}

function normalizeSourceType(value: ImageSourceType): ImageSourceType {
  if (value === "manual_upload") return "operator_uploaded";
  return value;
}

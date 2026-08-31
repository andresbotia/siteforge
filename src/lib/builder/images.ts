import { asRecord } from "@/lib/json";
import type { ImageRole, ImageSourceType, WebsiteImageAsset } from "./types";

const IMAGE_ROLES = new Set<ImageRole>(["hero", "gallery", "service", "team", "project"]);
const IMAGE_SOURCE_TYPES = new Set<ImageSourceType>([
  "manual_upload",
  "managed_asset",
  "business_owned",
  "licensed_stock",
  "third_party_reference",
]);

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
  return /^\/fixtures\/restaurant\/[a-z0-9-]+\.svg$/i.test(value);
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
    sourceType: row.sourceType as ImageSourceType,
    sourceUrl: typeof row.sourceUrl === "string" && row.sourceUrl.trim() ? row.sourceUrl.trim() : null,
    rightsStatus: row.rightsStatus === "approved" ? "approved" : "unknown",
    approvalStatus: row.approvalStatus === "approved" ? "approved" : "pending",
    attribution: typeof row.attribution === "string" && row.attribution.trim() ? row.attribution.trim().slice(0, 160) : null,
  };
}

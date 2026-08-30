import type { Lead, PreviewDeployment } from "@/types";

export function isLeadEligibleForSales(
  lead: Pick<Lead, "status"> | null | undefined,
  website: { id: string } | null | undefined,
  preview: Pick<PreviewDeployment, "id" | "status" | "revokedAt"> | null | undefined,
): boolean {
  if (!lead || lead.status === "rejected") return false;
  if (!website || !website.id) return false;
  if (!preview || preview.status !== "active" || Boolean(preview.revokedAt)) {
    return false;
  }
  return true;
}

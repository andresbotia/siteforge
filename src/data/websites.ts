import "server-only";

import { asNumber, asRecord } from "@/lib/json";
import { readTable } from "@/lib/supabase/server";
import type { GeneratedWebsite, GeneratedWebsiteStatus } from "@/types";
import type { LeadRow, WebsiteRow } from "@/types/database";

const statuses = new Set<GeneratedWebsiteStatus>([
  "building",
  "review_required",
  "approved",
  "live",
  "failed",
]);

export async function listWebsites(): Promise<GeneratedWebsite[]> {
  const [sites, leads] = await Promise.all([
    readTable<WebsiteRow[]>((client) =>
      client
        .from("generated_websites")
        .select("*")
        .order("created_at", { ascending: false }),
    ),
    readTable<Pick<LeadRow, "id" | "business_name">[]>((client) =>
      client.from("leads").select("id, business_name"),
    ),
  ]);

  const nameById = new Map(
    (leads ?? []).map((lead) => [lead.id, lead.business_name]),
  );

  return (sites ?? []).map((row) => {
    const metadata = asRecord(row.metadata);
    return {
      id: row.id,
      leadId: row.lead_id,
      businessName: nameById.get(row.lead_id) ?? "Unknown business",
      status: statuses.has(row.status as GeneratedWebsiteStatus)
        ? (row.status as GeneratedWebsiteStatus)
        : "building",
      template: row.template ?? "",
      beforeScore: asNumber(metadata.before_score) ?? 0,
      afterScore: asNumber(metadata.after_score),
      previewUrl: row.preview_url ?? "",
      productionUrl: row.production_url,
      createdAt: row.created_at,
    };
  });
}

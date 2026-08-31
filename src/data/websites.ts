import "server-only";

import {
  generationSourceFromMetadata,
  mergeExternalArtifactMetadata,
  parseExternalGeneratedSiteMetadata,
} from "@/lib/builder/external-sites";
import { asNumber, asRecord } from "@/lib/json";
import { readTable } from "@/lib/supabase/server";
import type { GeneratedWebsite, GeneratedWebsiteStatus } from "@/types";
import type { ExternalSiteArtifactRow, LeadRow, WebsiteRow } from "@/types/database";

const statuses = new Set<GeneratedWebsiteStatus>([
  "building",
  "review_required",
  "approved",
  "live",
  "failed",
]);

function mapWebsite(row: WebsiteRow, businessName: string, artifact?: ExternalSiteArtifactRow | null): GeneratedWebsite {
  const metadata = asRecord(row.metadata);
  const spec = asRecord(row.spec);
  const fixes = Array.isArray(row.audit_fixes) ? row.audit_fixes : [];
  const provenance = Array.isArray(row.content_provenance) ? row.content_provenance : [];
  return {
    id: row.id,
    leadId: row.lead_id,
    businessName,
    status: statuses.has(row.status as GeneratedWebsiteStatus)
      ? (row.status as GeneratedWebsiteStatus)
      : "building",
    generationSource: generationSourceFromMetadata(row.metadata),
    externalGeneratedSite: mergeExternalArtifactMetadata(
      parseExternalGeneratedSiteMetadata(row.metadata),
      artifact ?? null,
    ),
    template: row.template ?? "",
    templateKey: row.template_key,
    beforeScore: asNumber(metadata.before_score) ?? 0,
    afterScore: asNumber(metadata.after_score),
    previewUrl: row.preview_url ?? "",
    productionUrl: row.production_url,
    createdAt: row.created_at,
    spec: Object.keys(spec).length ? spec : null,
    buildVersion: row.build_version,
    sourceAuditId: row.source_audit_id,
    sourceRunId: row.source_run_id,
    auditFixes: fixes.flatMap((item) => {
      const rowFix = asRecord(item);
      if (typeof rowFix.findingCode !== "string" && typeof rowFix.finding_code !== "string") {
        return [];
      }
      return [
        {
          findingCode: String(rowFix.findingCode ?? rowFix.finding_code),
          addressed: rowFix.addressed === true,
          builderAction: String(rowFix.builderAction ?? rowFix.builder_action ?? ""),
        },
      ];
    }),
    contentProvenance: provenance.flatMap((item) => {
      const rowItem = asRecord(item);
      if (typeof rowItem.field !== "string") return [];
      return [
        {
          field: rowItem.field,
          provenance: String(rowItem.provenance ?? "derived"),
          source: typeof rowItem.source === "string" ? rowItem.source : null,
        },
      ];
    }),
  };
}

export async function listWebsites(): Promise<GeneratedWebsite[]> {
  const [sites, leads, artifacts] = await Promise.all([
    readTable<WebsiteRow[]>((client) =>
      client
        .from("generated_websites")
        .select("*")
        .order("created_at", { ascending: false }),
    ),
    readTable<Pick<LeadRow, "id" | "business_name">[]>((client) =>
      client.from("leads").select("id, business_name"),
    ),
    readTable<ExternalSiteArtifactRow[]>((client) =>
      client
        .from("external_site_artifacts")
        .select("*")
        .order("created_at", { ascending: false }),
    ),
  ]);

  const nameById = new Map(
    (leads ?? []).map((lead) => [lead.id, lead.business_name]),
  );

  const artifactByWebsiteId = new Map<string, ExternalSiteArtifactRow>();
  for (const artifact of artifacts ?? []) {
    if (!artifactByWebsiteId.has(artifact.generated_website_id)) {
      artifactByWebsiteId.set(artifact.generated_website_id, artifact);
    }
  }

  return (sites ?? []).map((row) =>
    mapWebsite(row, nameById.get(row.lead_id) ?? "Unknown business", artifactByWebsiteId.get(row.id)),
  );
}

export async function getWebsiteById(id: string): Promise<GeneratedWebsite | null> {
  const [row, artifact] = await Promise.all([
    readTable<WebsiteRow | null>((client) =>
    client.from("generated_websites").select("*").eq("id", id).maybeSingle(),
    ),
    readTable<ExternalSiteArtifactRow | null>((client) =>
      client
        .from("external_site_artifacts")
        .select("*")
        .eq("generated_website_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  ]);
  if (!row) return null;
  const lead = await readTable<Pick<LeadRow, "business_name"> | null>((client) =>
    client.from("leads").select("business_name").eq("id", row.lead_id).maybeSingle(),
  );
  return mapWebsite(row, lead?.business_name ?? "Unknown business", artifact);
}

export async function getLatestWebsiteForLead(
  leadId: string,
): Promise<GeneratedWebsite | null> {
  const row = await readTable<WebsiteRow | null>((client) =>
    client
      .from("generated_websites")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (!row) return null;
  const lead = await readTable<Pick<LeadRow, "business_name"> | null>((client) =>
    client.from("leads").select("business_name").eq("id", leadId).maybeSingle(),
  );
  return mapWebsite(row, lead?.business_name ?? "Unknown business");
}

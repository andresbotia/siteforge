import "server-only";

import { randomUUID } from "node:crypto";
import { recordActivityEvent } from "@/data/activity";
import { getLatestAuditForLead } from "@/data/leads";
import {
  buildExternalReviewSpec,
  buildExternalSiteMetadata,
  createVerifiedFactSnapshot,
  parseExternalProvider,
  validateExternalSiteSource,
  type ExternalProvider,
  type ExternalSiteImportManifest,
} from "@/lib/builder/external-sites";
import { BUILDER_COST_USD, BUILDER_VERSION } from "@/lib/builder/limits";
import { runBuilderPipeline } from "@/lib/builder/run";
import { asRecord } from "@/lib/json";
import { isNoStandaloneWebsiteLead } from "@/lib/prospects/no-website";
import { mutateTable, readTable } from "@/lib/supabase/server";
import type { AgentRow, AgentRunRow, Json, LeadRow, WebsiteRow } from "@/types/database";

const BUILDER_AGENT_SLUG = "builder";
const EXTERNAL_PROVIDER_ID = "external_generated_site";

export type ExternalSiteImportResult =
  | { ok: true; websiteId: string; runId: string; validationStatus: "passed" | "failed" }
  | { ok: false; error: string; field?: string };

export type ExternalSiteImportInput = {
  leadId: string;
  provider: string;
  providerProjectId?: string | null;
  providerCommitSha?: string | null;
  providerPreviewUrl?: string | null;
  controlledPreviewUrl?: string | null;
  generationCostCredits?: string | null;
  generationCostUsdEstimate?: string | null;
  providerCostNotes?: string | null;
  manifest: ExternalSiteImportManifest & { leadId?: string };
};

export async function importExternalGeneratedSite(
  input: ExternalSiteImportInput,
): Promise<ExternalSiteImportResult> {
  const leadId = input.leadId.trim();
  if (!leadId) return { ok: false, error: "A lead is required.", field: "leadId" };
  const provider = parseExternalProvider(input.provider.trim());
  if (!provider) return { ok: false, error: "Choose a supported external provider.", field: "provider" };
  if (input.manifest.leadId && input.manifest.leadId !== leadId) {
    return { ok: false, error: "Import manifest lead association does not match the selected lead.", field: "manifest" };
  }

  const [lead, agent] = await Promise.all([
    readTable<LeadRow | null>((client) =>
      client.from("leads").select("*").eq("id", leadId).maybeSingle(),
    ),
    readTable<Pick<AgentRow, "id"> | null>((client) =>
      client.from("agents").select("id").eq("slug", BUILDER_AGENT_SLUG).maybeSingle(),
    ),
  ]);
  if (!lead) return { ok: false, error: "Lead was not found.", field: "leadId" };
  if (!agent) return { ok: false, error: "Builder agent record was not found." };

  await recordActivityEvent({
    eventType: "external_site_import_started",
    title: "External generated site import started",
    description: lead.business_name,
    actorType: "admin",
    leadId: lead.id,
    metadata: { provider },
  });

  const now = new Date().toISOString();
  const snapshot = createVerifiedFactSnapshot(lead);
  const currentSnapshot = createVerifiedFactSnapshot(lead);
  const checked = validateExternalSiteSource({
    provider,
    controlledPreviewUrl: normalizeOptionalUrl(input.controlledPreviewUrl),
    providerPreviewUrl: normalizeOptionalUrl(input.providerPreviewUrl),
    manifest: input.manifest,
  });

  const audit = await getLatestAuditForLead(lead.id);
  const noStandaloneWebsite = isNoStandaloneWebsiteLead(lead);
  if (!audit && !noStandaloneWebsite) {
    return { ok: false, error: "External import requires an audited lead or explicit no-website verified prospect." };
  }

  const run = await mutateTable<AgentRunRow | null>((client) =>
    client
      .from("agent_runs")
      .insert({
        agent_id: agent.id,
        lead_id: lead.id,
        status: "succeeded",
        trigger_type: "manual",
        provider: EXTERNAL_PROVIDER_ID,
        purpose: `Import external generated website for ${lead.business_name}`,
        estimated_cost_usd: BUILDER_COST_USD,
        input: {
          lead_id: lead.id,
          provider,
          paid_ai: "not_required",
          external_side_effects: "none",
          version: BUILDER_VERSION,
        },
        output: {
          summary: "External generated site source imported for admin review. No email, payment, paid AI, DNS, or deployment action executed.",
          validation_status: checked.validation.status,
          build_status: checked.build.status,
        },
        started_at: now,
        completed_at: now,
      })
      .select("*")
      .maybeSingle(),
  );
  if (!run) return { ok: false, error: "Could not create the external import run." };

  const pipeline = runBuilderPipeline(
    {
      id: lead.id,
      businessName: lead.business_name,
      industry: lead.industry,
      city: lead.city,
      state: lead.state,
      address: lead.address,
      phone: lead.phone,
      email: lead.email,
      websiteUrl: lead.website_url,
      rating: lead.google_rating === null ? null : Number(lead.google_rating),
      reviewCount: lead.review_count,
      status: lead.status,
      inspectionSummary: Object.keys(asRecord(lead.inspection_summary)).length
        ? asRecord(lead.inspection_summary)
        : null,
    },
    audit
      ? {
          id: audit.id,
          overallScore: audit.overallScore,
          redesignOpportunityScore: audit.redesignOpportunityScore,
          findings: audit.findings.map((item) => ({ code: item.code, title: item.title })),
          opportunityType: "redesign",
        }
      : {
          id: null,
          overallScore: null,
          redesignOpportunityScore: null,
          findings: [],
          opportunityType: "new_website",
        },
  );

  const externalMetadata = buildExternalSiteMetadata({
    provider,
    providerProjectId: input.providerProjectId,
    providerCommitSha: input.providerCommitSha,
    providerPreviewUrl: normalizeOptionalUrl(input.providerPreviewUrl),
    controlledPreviewUrl: normalizeOptionalUrl(input.controlledPreviewUrl),
    importedAt: now,
    generationCostCredits: numericOrNull(input.generationCostCredits),
    generationCostUsdEstimate: numericOrNull(input.generationCostUsdEstimate),
    providerCostNotes: input.providerCostNotes,
    snapshot,
    currentSnapshot,
    validation: checked.validation,
    build: checked.build,
  });

  const websiteId = randomUUID();
  const metadata: Json = {
    before_score: audit?.overallScore ?? null,
    after_score: null,
    paid_ai: "not_required",
    cost_usd: 0,
    generation_source: "external_generated",
    external_generated_site: externalMetadata as unknown as Json,
  };
  const site = await mutateTable<WebsiteRow | null>((client) =>
    client
      .from("generated_websites")
      .insert({
        id: websiteId,
        lead_id: lead.id,
        status: "review_required",
        template: `External generated (${providerLabel(provider)})`,
        template_key: pipeline.template,
        preview_url: `/websites/${websiteId}/preview`,
        production_url: null,
        repository_url: null,
        seo_score: null,
        metadata,
        spec: buildExternalReviewSpec(pipeline.spec) as unknown as Json,
        build_version: BUILDER_VERSION,
        source_audit_id: audit?.id ?? null,
        source_run_id: run.id,
        audit_fixes: pipeline.spec.auditFixes as unknown as Json,
        content_provenance: [
          ...pipeline.spec.provenance,
          {
            field: "externalSite",
            provenance: "sourced",
            source: "operator_imported_external_generated_site",
          },
        ] as unknown as Json,
      })
      .select("*")
      .maybeSingle(),
  );
  if (!site) return { ok: false, error: "Could not persist the external generated website." };

  await recordActivityEvent({
    eventType: externalMetadata.validation.ok ? "external_site_validation_passed" : "external_site_validation_failed",
    title: externalMetadata.validation.ok ? "External site validation passed" : "External site validation failed",
    description: lead.business_name,
    actorType: "admin",
    leadId: lead.id,
    metadata: {
      provider,
      generated_website_id: site.id,
      severe_findings: externalMetadata.validation.findings.filter((finding) => finding.severity === "severe").length,
      build_status: externalMetadata.build.status,
    },
  });
  await recordActivityEvent({
    eventType: "external_site_import_completed",
    title: "External generated site import completed",
    description: lead.business_name,
    actorType: "admin",
    leadId: lead.id,
    metadata: {
      provider,
      generated_website_id: site.id,
      lifecycle_status: externalMetadata.lifecycleStatus,
    },
  });

  return {
    ok: true,
    websiteId: site.id,
    runId: run.id,
    validationStatus: externalMetadata.validation.status,
  };
}

function providerLabel(provider: ExternalProvider): string {
  if (provider === "lovable") return "Lovable";
  if (provider === "manual") return "Manual";
  return "Other";
}

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function numericOrNull(value: string | null | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildExternalSiteMetadata } from "@/lib/builder/external-sites";
import { createExternalSourceArtifact, type ExternalSourceArtifact } from "@/lib/builder/external-artifacts";
import { BUILDER_VERSION } from "@/lib/builder/limits";
import { runBuilderPipeline } from "@/lib/builder/run";
// Imports config-core directly (not ./config), because ./config carries the
// `import "server-only"` marker. That marker only means anything under
// Next.js's webpack bundling (it swaps the module for a no-op on the server
// build and an error on the client build); under this worker's plain Node
// process there is no bundler, so the package throws unconditionally on
// import. config-core.ts is the pure env-parsing logic ./config wraps, with
// no such marker, so it is safe to use directly from a standalone script.
import { getSupabaseServerConfigFromEnv } from "@/lib/supabase/config-core";
import type { Database, DesignerJobRow, Json } from "@/types/database";
import { fingerprintFacts, type DesignerBusinessFacts, type DesignerImageryManifest } from "./facts";
import type { ParsedDesignerWorkerReport } from "./report";
import { assertDesignerJobTransition, type DesignerFailureCode } from "./state-machine";
import type { ExternalSiteValidationResult, ExternalSiteBuildResult, ExternalSiteImportManifest } from "@/lib/builder/external-sites";

/**
 * Direct Supabase access for the standalone local Designer Worker
 * orchestrator process (scripts/designer-worker.ts). This deliberately does
 * NOT go through src/lib/supabase/server.ts's readTable/mutateTable, because
 * those call requireAdminSession(), which reads an HTTP cookie via
 * next/headers -- there is no HTTP request here. The worker process itself
 * is the trusted backend context (started locally by the operator, holding
 * SUPABASE_SECRET_KEY from local .env like any other server-side SiteForge
 * code); the untrusted part is the Claude Code subprocess it spawns, which
 * never sees this module or any credential (see security.ts).
 *
 * requireDesignerWorkerContext() is a belt-and-suspenders guard: every
 * exported function here refuses to run unless SITEFORGE_DESIGNER_WORKER=true
 * is set, which only scripts/designer-worker.ts sets. A Next.js request
 * process will not have that variable set, so an accidental import from an
 * app/ route fails closed instead of silently bypassing requireAdminSession().
 */
function requireDesignerWorkerContext(): void {
  if (process.env.SITEFORGE_DESIGNER_WORKER !== "true") {
    throw new Error(
      "designer/worker-db.ts may only be used by the local Designer Worker process (scripts/designer-worker.ts), not by a web request handler.",
    );
  }
}

let cachedClient: SupabaseClient<Database> | null = null;

function workerClient(): SupabaseClient<Database> {
  requireDesignerWorkerContext();
  if (cachedClient) return cachedClient;
  const config = getSupabaseServerConfigFromEnv(process.env);
  if (!config) throw new Error("Supabase server configuration is missing for the Designer Worker.");
  cachedClient = createClient<Database>(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cachedClient;
}

export type EnqueueFixtureDesignerJobInput = {
  mode: "new_master" | "adaptation";
  templateFamily: string | null;
  reason: string;
  facts: DesignerBusinessFacts;
  imagery: DesignerImageryManifest;
  designBriefMarkdown: string;
};

/**
 * Direct designer_jobs insert for the local operator smoke-test script
 * (scripts/designer-smoke-test-enqueue.ts). Mirrors exactly what
 * src/data/designer.ts's createDesignerJobRequest inserts through the
 * requireAdminSession-gated web path; this exists only because a standalone
 * script has no HTTP request/cookies to satisfy requireAdminSession(). Hard
 * limited to is_fixture=true: a real lead's Designer Job must always go
 * through the admin-authenticated web UI (requestDesignerJobAction), never
 * this script path.
 */
export async function enqueueFixtureDesignerJob(input: EnqueueFixtureDesignerJobInput): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const client = workerClient();
  const inserted = await client
    .from("designer_jobs")
    .insert({
      lead_id: null,
      is_fixture: true,
      mode: input.mode,
      template_family: input.templateFamily,
      reason: input.reason.slice(0, 500),
      design_brief: { markdown: input.designBriefMarkdown } as unknown as Json,
      input_facts_snapshot: input.facts as unknown as Json,
      input_facts_fingerprint: fingerprintFacts(input.facts),
      imagery_manifest: input.imagery as unknown as Json,
    })
    .select("id")
    .maybeSingle();
  if (inserted.error || !inserted.data) return { ok: false, error: inserted.error?.message ?? "insert_failed" };
  return { ok: true, jobId: inserted.data.id };
}

export async function claimNextDesignerJob(workerId: string): Promise<DesignerJobRow | null> {
  const client = workerClient();
  const queued = await client
    .from("designer_jobs")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (queued.error || !queued.data) return null;

  const claimed = await client.rpc("siteforge_claim_designer_job", {
    p_job_id: queued.data.id,
    p_claimed_by: workerId,
  });
  if (claimed.error || !claimed.data) return null;
  return claimed.data as unknown as DesignerJobRow;
}

export async function updateDesignerJobStatus(
  jobId: string,
  from: string,
  to: string,
  patch: Record<string, unknown> = {},
): Promise<void> {
  const client = workerClient();
  assertDesignerJobTransition(from as never, to as never);
  await client
    .from("designer_jobs")
    .update({ status: to, updated_at: new Date().toISOString(), ...patch })
    .eq("id", jobId)
    .eq("status", from);
}

export async function recordWorkerFailure(
  jobId: string,
  fromStatus: string,
  failureCode: DesignerFailureCode,
  reason: string,
): Promise<void> {
  const client = workerClient();
  await client
    .from("designer_jobs")
    .update({
      status: "failed",
      failure_code: failureCode,
      failure_reason: reason.slice(0, 2000),
      completed_at: new Date().toISOString(),
      subscription_usage_status:
        failureCode === "subscription_capacity_unavailable" || failureCode === "auth_unavailable" || failureCode === "api_billing_required"
          ? "blocked"
          : "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", fromStatus);
  await insertActivityEvent(client, {
    eventType: "designer_job_failed",
    title: "Designer Job failed",
    description: reason.slice(0, 300),
    leadId: null,
    metadata: { job_id: jobId, failure_code: failureCode },
  });
}

export type FinalizeSuccessInput = {
  jobId: string;
  leadId: string | null;
  isFixture: boolean;
  facts: DesignerBusinessFacts;
  templateFamily: string | null;
  manifest: ExternalSiteImportManifest;
  validation: ExternalSiteValidationResult;
  build: ExternalSiteBuildResult;
  report: ParsedDesignerWorkerReport;
};

/**
 * Persists a successfully-validated candidate as a new generated_websites
 * version plus an immutable external_site_artifacts row, reusing the exact
 * same metadata/artifact shape the M9.5D external-generated-site import path
 * already produces (src/lib/builder/external-sites.ts,
 * src/lib/builder/external-artifacts.ts) so the existing preview-deployment
 * approval flow (src/data/external-sites.ts) works on Designer Worker output
 * unchanged. Moves the job to technical_qa_passed then immediately
 * visual_review_required -- it can never reach `approved` from here.
 *
 * Fixture/QA jobs (input.leadId === null) are a deliberate exception: both
 * generated_websites.lead_id and external_site_artifacts.lead_id are `not
 * null references public.leads` (see
 * supabase/migrations/20260829100000_initial_schema.sql). A fixture has no
 * real leads row, and inventing one just to satisfy that foreign key would
 * leak a synthetic business into the real lead pipeline (Sales eligibility,
 * customer conversion, /leads listings) -- worse than not persisting a
 * website row at all. So a fixture's technical QA result is written
 * directly onto its designer_jobs row (still transitioning through
 * technical_qa_passed -> visual_review_required exactly like a real job)
 * and it never gets output_generated_website_id/output_artifact_id; its
 * built output stays on disk under the job's own workspace for a human to
 * open directly. This is a data-layer decision, not a schema change --
 * see AGENTS.md on not creating migrations unless genuinely required.
 */
export async function finalizeDesignerJobSuccess(
  input: FinalizeSuccessInput,
): Promise<{ ok: true; websiteId: string | null; artifactId: string | null } | { ok: false; error: string }> {
  const client = workerClient();
  const now = new Date().toISOString();
  const snapshot = input.facts.snapshot;
  const qaPassed = input.validation.ok && input.build.ok;

  if (!input.leadId) {
    await client
      .from("designer_jobs")
      .update({
        status: qaPassed ? "technical_qa_passed" : "technical_qa_failed",
        technical_qa_report: {
          validation: input.validation,
          build: { ok: input.build.ok, status: input.build.status, reason: input.build.reason },
        } as unknown as Json,
        completed_at: now,
        subscription_usage_status: "completed",
        updated_at: now,
      })
      .eq("id", input.jobId);

    if (qaPassed) {
      await client
        .from("designer_jobs")
        .update({ status: "visual_review_required", visual_review_status: "pending", updated_at: new Date().toISOString() })
        .eq("id", input.jobId)
        .eq("status", "technical_qa_passed");
    }

    await insertActivityEvent(client, {
      eventType: qaPassed ? "designer_job_technical_qa_passed" : "designer_job_technical_qa_failed",
      title: qaPassed ? "Designer Job (fixture) passed technical QA" : "Designer Job (fixture) failed technical QA",
      description: input.facts.businessName,
      leadId: null,
      metadata: { job_id: input.jobId, fixture: true },
    });

    return { ok: true, websiteId: null, artifactId: null };
  }

  const leadInput = {
    id: input.leadId,
    businessName: input.facts.businessName,
    industry: input.facts.industry,
    city: input.facts.city,
    state: input.facts.region,
    address: snapshot.address,
    phone: snapshot.phone,
    email: null,
    websiteUrl: null,
    rating: snapshot.rating,
    reviewCount: snapshot.reviewCount ?? 0,
    status: "audited",
    inspectionSummary: null,
  };
  let baselineSpec;
  try {
    baselineSpec = runBuilderPipeline(leadInput, {
      id: null,
      overallScore: null,
      redesignOpportunityScore: null,
      findings: [],
      opportunityType: "new_website",
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "baseline_spec_failed" };
  }

  const websiteId = randomUUID();
  const artifactId = randomUUID();
  const artifact = createExternalSourceArtifact({
    id: artifactId,
    generatedWebsiteId: websiteId,
    leadId: input.leadId,
    provider: "claude_code_worker",
    manifest: input.manifest,
    importedAt: now,
    validation: input.validation,
    build: input.build,
  });

  const externalMetadata = buildExternalSiteMetadata({
    provider: "claude_code_worker",
    importedAt: now,
    generationCostCredits: null,
    generationCostUsdEstimate: 0,
    providerCostNotes: "Claude Code subscription session; no per-run cash cost.",
    sourceArtifact: sourceArtifactSummary(artifact),
    snapshot,
    currentSnapshot: snapshot,
    validation: input.validation,
    build: input.build,
  });

  const metadata: Json = {
    before_score: null,
    after_score: null,
    paid_ai: "not_required",
    cost_usd: 0,
    generation_source: "external_generated",
    designer_job_id: input.jobId,
    is_fixture: input.isFixture,
    worker_report: {
      summary: input.report.ok ? input.report.report.summary : null,
      candidateForMaster: input.report.ok ? input.report.report.candidateForMaster : false,
      recommendedMasterFamily: input.report.ok ? input.report.report.recommendedMasterFamily : null,
    },
    external_generated_site: { ...externalMetadata, artifactId: artifact.id, sourceManifestFingerprint: artifact.sourceManifestFingerprint, deploymentStatus: artifact.deploymentStatus } as unknown as Json,
  };

  const siteInsert = await client
    .from("generated_websites")
    .insert({
      id: websiteId,
      lead_id: input.leadId,
      status: "review_required",
      template: `Designer Worker candidate (${input.templateFamily ?? "unassigned family"})`,
      template_key: baselineSpec.template,
      preview_url: `/websites/${websiteId}/preview`,
      production_url: null,
      repository_url: null,
      seo_score: null,
      metadata,
      spec: baselineSpec.spec as unknown as Json,
      build_version: BUILDER_VERSION,
      source_audit_id: null,
      source_run_id: null,
      audit_fixes: baselineSpec.spec.auditFixes as unknown as Json,
      content_provenance: [
        ...baselineSpec.spec.provenance,
        { field: "designerJob", provenance: "sourced", source: "designer_worker.claude_code" },
      ] as unknown as Json,
    })
    .select("id")
    .maybeSingle();
  if (siteInsert.error || !siteInsert.data) {
    return { ok: false, error: siteInsert.error?.message ?? "could_not_persist_generated_website" };
  }

  const artifactInsert = await client
    .from("external_site_artifacts")
    .insert({
      id: artifact.id,
      generated_website_id: websiteId,
      lead_id: input.leadId,
      provider: artifact.provider,
      source_manifest_fingerprint: artifact.sourceManifestFingerprint,
      source_manifest: artifact.manifest as unknown as Json,
      created_by: "admin",
      validation_status: artifact.validationStatus,
      build_status: artifact.buildStatus,
      deployment_status: artifact.deploymentStatus,
      artifact_metadata: artifact.metadata as unknown as Json,
    })
    .select("id")
    .maybeSingle();
  if (artifactInsert.error || !artifactInsert.data) {
    return { ok: false, error: artifactInsert.error?.message ?? "could_not_persist_external_artifact" };
  }

  await client
    .from("designer_jobs")
    .update({
      status: qaPassed ? "technical_qa_passed" : "technical_qa_failed",
      technical_qa_report: {
        validation: input.validation,
        build: { ok: input.build.ok, status: input.build.status, reason: input.build.reason },
      } as unknown as Json,
      output_generated_website_id: websiteId,
      output_artifact_id: artifactId,
      completed_at: now,
      subscription_usage_status: "completed",
      updated_at: now,
    })
    .eq("id", input.jobId);

  if (qaPassed) {
    await client
      .from("designer_jobs")
      .update({ status: "visual_review_required", visual_review_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", input.jobId)
      .eq("status", "technical_qa_passed");
  }

  await insertActivityEvent(client, {
    eventType: qaPassed ? "designer_job_technical_qa_passed" : "designer_job_technical_qa_failed",
    title: qaPassed ? "Designer Job passed technical QA" : "Designer Job failed technical QA",
    description: input.facts.businessName,
    leadId: input.leadId,
    metadata: { job_id: input.jobId, generated_website_id: websiteId, artifact_id: artifactId },
  });

  return { ok: true, websiteId, artifactId };
}

function sourceArtifactSummary(artifact: ExternalSourceArtifact) {
  return {
    sourceType: artifact.manifest.sourceType ?? "json_manifest",
    archiveFileName: null,
    fileCount: artifact.manifest.fileCount,
    totalBytes: artifact.manifest.totalBytes,
    assetCount: artifact.manifest.assetCount,
    detectedFramework: artifact.metadata.packageSummary.framework,
    packageManager: artifact.metadata.packageSummary.packageManager,
  };
}

async function insertActivityEvent(
  client: SupabaseClient<Database>,
  input: { eventType: string; title: string; description?: string | null; leadId: string | null; metadata?: Json },
): Promise<void> {
  await client.from("activity_events").insert({
    event_type: input.eventType,
    actor_type: "designer_worker",
    title: input.title,
    description: input.description ?? null,
    lead_id: input.leadId,
    metadata: input.metadata ?? {},
  });
}

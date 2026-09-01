import "server-only";

import { buildDesignerBrief, type DesignerBriefRequest } from "@/lib/designer/brief";
import { emptyImageryManifest, fingerprintFacts, type DesignerBusinessFacts, type DesignerImageryManifest } from "@/lib/designer/facts";
import { assertDesignerJobTransition, canPromoteToMaster, type DesignerJobMode } from "@/lib/designer/state-machine";
import { mutateTable, readTable } from "@/lib/supabase/server";
import type { DesignerJobRow, Json } from "@/types/database";

export type CreateDesignerJobInput = {
  leadId?: string | null;
  isFixture?: boolean;
  mode: DesignerJobMode;
  templateFamily?: string | null;
  baseTemplateKey?: string | null;
  reason: string;
  facts: DesignerBusinessFacts;
  imagery?: DesignerImageryManifest;
  requestedByAgentRunId?: string | null;
};

export type CreateDesignerJobResult = { ok: true; job: DesignerJobRow } | { ok: false; error: string };

/**
 * Creates a queued Designer Job for the local worker to pick up. This never
 * calls the Claude Code CLI, spends a dollar, or touches paid AI -- it only
 * writes a work order plus a category brief.
 *
 * Deliberately uses buildDesignerBrief() from src/lib/designer/brief.ts, NOT
 * buildDesignBrief() from src/lib/builder/design-brief.ts. The Builder brief
 * reads src/lib/builder/design-system.ts's DESIGN_PRESETS (specific palette
 * hex/oklch values, named hero treatments, a fixed section plan) -- exactly
 * the "legacy Builder visual context" the Designer Worker must never see.
 * template_family is therefore no longer pre-classified via the Builder
 * registry either; it stays whatever the caller explicitly passes (or null),
 * and the worker's own post-hoc recommendedMasterFamily self-report
 * (src/lib/designer/report.ts) is the real signal for grouping.
 */
export async function createDesignerJobRequest(input: CreateDesignerJobInput): Promise<CreateDesignerJobResult> {
  if (!input.reason.trim()) return { ok: false, error: "A reason is required." };
  const briefRequest: DesignerBriefRequest = {
    industry: input.facts.industry,
    exampleBusiness: {
      name: input.facts.businessName,
      city: input.facts.city,
      region: input.facts.region,
      hasPhone: Boolean(input.facts.snapshot.phone),
      hasAddress: Boolean(input.facts.snapshot.address),
      hasRating: input.facts.snapshot.rating !== null,
      hasHours: input.facts.snapshot.dailyHours.length > 0,
    },
  };
  const brief = buildDesignerBrief(briefRequest);
  const imagery = input.imagery ?? emptyImageryManifest();

  const inserted = await mutateTable<DesignerJobRow | null>((client) =>
    client
      .from("designer_jobs")
      .insert({
        lead_id: input.leadId ?? null,
        is_fixture: input.isFixture ?? false,
        requested_by_agent_run_id: input.requestedByAgentRunId ?? null,
        mode: input.mode,
        template_family: input.templateFamily ?? null,
        base_template_key: input.baseTemplateKey ?? null,
        reason: input.reason.slice(0, 500),
        design_brief: { markdown: brief.markdown } as unknown as Json,
        input_facts_snapshot: input.facts as unknown as Json,
        input_facts_fingerprint: fingerprintFacts(input.facts),
        imagery_manifest: imagery as unknown as Json,
      })
      .select("*")
      .maybeSingle(),
  );
  if (!inserted) return { ok: false, error: "Could not create the Designer Job." };
  return { ok: true, job: inserted };
}

export async function listDesignerJobs(limit = 50): Promise<DesignerJobRow[]> {
  const rows = await readTable<DesignerJobRow[]>((client) =>
    client.from("designer_jobs").select("*").order("created_at", { ascending: false }).limit(limit),
  );
  return rows ?? [];
}

export async function getDesignerJob(id: string): Promise<DesignerJobRow | null> {
  return await readTable<DesignerJobRow | null>((client) => client.from("designer_jobs").select("*").eq("id", id).maybeSingle());
}

export type RecordVisualReviewInput = {
  jobId: string;
  status: "approved" | "needs_revision" | "rejected";
  notes: string;
  reviewedBy: string;
};

export type RecordVisualReviewResult = { ok: true } | { ok: false; error: string };

/**
 * The only path by which a Designer Job can reach `approved`. Only an admin
 * session (readTable/mutateTable enforce requireAdminSession) reaches this
 * function; no worker code path calls it. This is the structural
 * "AI cannot approve its own design" boundary.
 *
 * `needs_revision` takes the visual_review_required -> queued edge (see
 * state-machine.ts) instead of staying parked in visual_review_required
 * forever. It resets only the worker-owned execution fields, not
 * visual_review_notes -- the runner reads that back on its next claim of
 * this same job id and forwards it to Claude as revision feedback, and
 * because the job id (and therefore its on-disk workspace) is unchanged,
 * the worker can read its own previous output back rather than starting
 * over. This still cannot bypass human approval: the job returns to
 * visual_review_required after the next run, and only this function, called
 * again by an admin, can ever set status to `approved`.
 */
export async function recordVisualReview(input: RecordVisualReviewInput): Promise<RecordVisualReviewResult> {
  const job = await getDesignerJob(input.jobId);
  if (!job) return { ok: false, error: "Designer Job was not found." };
  if (job.status !== "visual_review_required") {
    return { ok: false, error: `Job is not awaiting visual review (status: ${job.status}).` };
  }
  if (input.status === "needs_revision" && !input.notes.trim()) {
    return { ok: false, error: "Revision notes are required so the worker knows what to change." };
  }

  const nextJobStatus =
    input.status === "approved" ? "approved" : input.status === "rejected" ? "rejected" : input.status === "needs_revision" ? "queued" : job.status;
  if (nextJobStatus !== job.status) {
    try {
      assertDesignerJobTransition(job.status as never, nextJobStatus as never);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Illegal transition." };
    }
  }

  const revisionReset =
    input.status === "needs_revision"
      ? {
          claimed_by: null,
          claimed_at: null,
          workspace_path: null,
          started_at: null,
          completed_at: null,
          technical_qa_report: null,
          failure_code: null,
          failure_reason: null,
        }
      : {};

  const updated = await mutateTable<Pick<DesignerJobRow, "id"> | null>((client) =>
    client
      .from("designer_jobs")
      .update({
        status: nextJobStatus,
        visual_review_status: input.status,
        visual_review_notes: input.notes.slice(0, 4000),
        visual_reviewed_by: input.reviewedBy,
        visual_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...revisionReset,
      })
      .eq("id", input.jobId)
      .eq("status", "visual_review_required")
      .select("id")
      .maybeSingle(),
  );
  if (!updated) return { ok: false, error: "Could not record visual review." };
  return { ok: true };
}

export type PromoteToMasterResult = { ok: true } | { ok: false; error: string };

export async function promoteDesignerJobToMaster(jobId: string, masterTemplateKey: string): Promise<PromoteToMasterResult> {
  const job = await getDesignerJob(jobId);
  if (!job) return { ok: false, error: "Designer Job was not found." };
  if (job.is_fixture) return { ok: false, error: "Fixture/QA jobs may never be promoted to a commercial master." };
  if (!canPromoteToMaster({ status: job.status, visualReviewStatus: job.visual_review_status, mode: job.mode })) {
    return { ok: false, error: "Job must be approved (status=approved, visual_review_status=approved, mode=new_master) before promotion." };
  }
  const updated = await mutateTable<Pick<DesignerJobRow, "id"> | null>((client) =>
    client
      .from("designer_jobs")
      .update({ promoted_to_master: true, master_template_key: masterTemplateKey.slice(0, 120), updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("status", "approved")
      .select("id")
      .maybeSingle(),
  );
  if (!updated) return { ok: false, error: "Could not promote job to master." };
  return { ok: true };
}

export async function cancelDesignerJob(jobId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const job = await getDesignerJob(jobId);
  if (!job) return { ok: false, error: "Designer Job was not found." };
  const cancellable = new Set(["queued", "claimed", "preparing", "generating"]);
  if (!cancellable.has(job.status)) {
    return { ok: false, error: `Job in status ${job.status} can no longer be cancelled.` };
  }
  const updated = await mutateTable<Pick<DesignerJobRow, "id"> | null>((client) =>
    client
      .from("designer_jobs")
      .update({ status: "cancelled", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("status", job.status)
      .select("id")
      .maybeSingle(),
  );
  if (!updated) return { ok: false, error: "Could not cancel job." };
  return { ok: true };
}

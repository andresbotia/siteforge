/**
 * SiteForge local Designer Worker orchestrator.
 *
 * Run with `npm run designer:worker` (loop) or `npm run designer:worker:once`
 * (claim and process exactly one queued job, then exit -- used for the
 * smoke test). This process itself is trusted: it holds SUPABASE_SECRET_KEY
 * from local .env like any other server-side SiteForge code. The Claude Code
 * CLI subprocess it spawns is NOT trusted with that or any other SiteForge
 * secret -- see src/lib/designer/security.ts.
 *
 * This file, not the Claude Code subprocess it invokes, is what AGENTS.md
 * means by "privileged actions must go through backend-controlled tools":
 * it is a backend-controlled tool the operator starts locally, and it is the
 * only thing in this pipeline that ever touches Supabase or the filesystem
 * outside a job's own isolated workspace.
 */

// Must be set before any src/lib/designer/worker-db.ts function runs; see
// requireDesignerWorkerContext() there for why.
process.env.SITEFORGE_DESIGNER_WORKER = "true";

import { hostname } from "node:os";
import { createExternalSourceArtifact, buildExternalSourceArtifact } from "@/lib/builder/external-artifacts";
import { checkClaudeAuthHealth, checkClaudeCliVersion, locateClaudeCli } from "@/lib/designer/cli";
import { collectDesignerWorkerOutput, validateCollectedManifest } from "@/lib/designer/collect";
import type { DesignerBusinessFacts, DesignerImageryManifest } from "@/lib/designer/facts";
import { DESIGNER_WORKER_SYSTEM_PROMPT, buildDesignerUserPrompt } from "@/lib/designer/prompt";
import { boundLog } from "@/lib/designer/security";
import { runDesignerWorker } from "@/lib/designer/runner";
import { createDesignerJobWorkspace, writeJobInputFile, writeJobLog, writeJobOutputFile } from "@/lib/designer/sandbox";
import { claimNextDesignerJob, finalizeDesignerJobSuccess, recordWorkerFailure, updateDesignerJobStatus } from "@/lib/designer/worker-db";
import type { DesignerJobRow } from "@/types/database";

const POLL_INTERVAL_MS = Number(process.env.SITEFORGE_DESIGNER_POLL_MS ?? 15_000);
const RUN_TIMEOUT_MS = Number(process.env.SITEFORGE_DESIGNER_RUN_TIMEOUT_MS ?? 600_000);
const BUILD_TIMEOUT_MS = Number(process.env.SITEFORGE_DESIGNER_BUILD_TIMEOUT_MS ?? 90_000);
const WORKER_ID = `${hostname()}:${process.pid}`;

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  log(`SiteForge Designer Worker starting (${WORKER_ID}, mode: ${once ? "single job" : "poll loop"}).`);

  const cli = locateClaudeCli();
  if (!cli) {
    log("BLOCKED: Claude Code CLI was not found. Set SITEFORGE_CLAUDE_CLI_PATH or confirm Claude Code is installed.");
    process.exitCode = 1;
    return;
  }
  log(`Claude CLI located at ${cli.path} (source: ${cli.source}).`);

  const version = await checkClaudeCliVersion(cli.path);
  if (!version.ok) {
    log(`BLOCKED: could not read Claude CLI version (${version.reason}).`);
    process.exitCode = 1;
    return;
  }
  log(`Claude CLI version ${version.version}.`);

  const auth = await checkClaudeAuthHealth(cli.path);
  if (!auth.ok || auth.subscriptionAuth !== true) {
    log(`BLOCKED: Claude CLI is not authenticated with a subscription session (${JSON.stringify(auth)}). Refusing to run rather than fall back to API billing.`);
    process.exitCode = 1;
    return;
  }
  log(`Authenticated via Claude subscription (${auth.subscriptionType ?? "unknown plan"}). No API key billing will be used.`);

  let keepGoing = true;
  process.on("SIGINT", () => {
    keepGoing = false;
    log("Received interrupt; will stop after the current job (no new job will be claimed).");
  });

  while (keepGoing) {
    const job = await claimNextDesignerJob(WORKER_ID);
    if (!job) {
      if (once) {
        log("No queued Designer Jobs.");
        break;
      }
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    log(`Claimed job ${job.id} (${job.mode}, lead ${job.lead_id ?? "none"}, fixture=${job.is_fixture}).`);
    await processJob(job, cli.path);
    if (once) break;
  }
  log("Designer Worker stopped.");
}

async function processJob(job: DesignerJobRow, cliPath: string): Promise<void> {
  const facts = job.input_facts_snapshot as unknown as DesignerBusinessFacts;
  const imagery = job.imagery_manifest as unknown as DesignerImageryManifest;
  const brief = (job.design_brief as { markdown?: string } | null)?.markdown ?? "";

  const workspace = await createDesignerJobWorkspace(job.id);
  await writeJobInputFile(workspace, "business.json", JSON.stringify(facts, null, 2));
  await writeJobInputFile(workspace, "imagery.json", JSON.stringify(imagery, null, 2));
  await writeJobInputFile(workspace, "brief.md", brief);
  await writeJobInputFile(
    workspace,
    "job.json",
    JSON.stringify({ id: job.id, mode: job.mode, templateFamily: job.template_family, reason: job.reason }, null, 2),
  );

  await updateDesignerJobStatus(job.id, "claimed", "preparing");
  await updateDesignerJobStatus(job.id, "preparing", "generating", {
    workspace_path: workspace.root,
    started_at: new Date().toISOString(),
  });

  const userPrompt = buildDesignerUserPrompt({
    jobId: job.id,
    mode: job.mode as "new_master" | "adaptation",
    templateFamily: job.template_family,
    reason: job.reason,
    facts,
    imagery,
    designBriefText: brief,
  });

  const result = await runDesignerWorker({
    cliPath,
    workspaceDir: workspace.workspaceDir,
    sessionId: job.id,
    systemPromptAppend: DESIGNER_WORKER_SYSTEM_PROMPT,
    userPrompt,
    model: process.env.SITEFORGE_DESIGNER_MODEL,
    timeoutMs: RUN_TIMEOUT_MS,
  });
  await writeJobLog(workspace, "cli-stdout.log", boundLog(result.stdout));
  await writeJobLog(workspace, "cli-stderr.log", boundLog(result.stderr));

  if (!result.ok) {
    log(`Job ${job.id} FAILED during generation: ${result.failureCode} - ${result.reason}`);
    await recordWorkerFailure(job.id, "generating", result.failureCode, result.reason);
    return;
  }

  await updateDesignerJobStatus(job.id, "generating", "generated");
  await updateDesignerJobStatus(job.id, "generated", "validating");

  const collected = await collectDesignerWorkerOutput(workspace, job.id);
  await writeJobOutputFile(workspace, "report.json", JSON.stringify(collected.report, null, 2));

  if (!collected.report.ok) {
    log(`Job ${job.id} FAILED: invalid worker report (${collected.report.reason}).`);
    await recordWorkerFailure(job.id, "validating", "invalid_report", collected.report.reason);
    return;
  }
  if (collected.fileCount === 0) {
    log(`Job ${job.id} FAILED: worker produced no source files under workspace/site/.`);
    await recordWorkerFailure(job.id, "validating", "build_failed", "No source files were found under workspace/site/.");
    return;
  }

  const checked = validateCollectedManifest(collected.manifest);
  const artifact = createExternalSourceArtifact({
    id: job.id,
    generatedWebsiteId: job.id,
    leadId: job.lead_id ?? job.id,
    provider: "claude_code_worker",
    manifest: collected.manifest,
    importedAt: new Date().toISOString(),
    validation: checked.validation,
    build: checked.build,
  });
  const build = checked.validation.ok ? await buildExternalSourceArtifact({ artifact, timeoutMs: BUILD_TIMEOUT_MS }) : null;
  const buildResult = build
    ? { ok: build.ok, status: build.status, command: checked.build.command, reason: build.summary }
    : { ok: false, status: "blocked" as const, command: checked.build.command, reason: "Static validation failed before build." };

  const finalized = await finalizeDesignerJobSuccess({
    jobId: job.id,
    leadId: job.lead_id,
    isFixture: job.is_fixture,
    facts,
    templateFamily: job.template_family,
    manifest: collected.manifest,
    validation: checked.validation,
    build: buildResult,
    report: collected.report,
  });

  if (!finalized.ok) {
    log(`Job ${job.id} FAILED to persist: ${finalized.error}`);
    await recordWorkerFailure(job.id, "validating", "workspace_error", finalized.error);
    return;
  }

  const qaPassed = checked.validation.ok && buildResult.ok;
  log(
    `Job ${job.id} ${qaPassed ? "PASSED technical QA and is now visual_review_required" : "FAILED technical QA (see designer_jobs.technical_qa_report)"}. ` +
      `Generated website ${finalized.websiteId}, artifact ${finalized.artifactId}.`,
  );

  // Workspace is left on disk for operator debugging/review of exactly what
  // the worker wrote; it is gitignored and only ever contains this one job's
  // output. Cleanup here is intentionally NOT automatic -- see HANDOFF.md.
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function log(message: string): void {
  process.stdout.write(`[designer-worker] ${new Date().toISOString()} ${message}\n`);
}

main().catch((error) => {
  process.stderr.write(`[designer-worker] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});

/**
 * Local Designer Worker smoke test (Mission 9). Exercises the full pipeline
 * for real -- CLI discovery, subscription auth check, sandboxed workspace,
 * prompt generation, a REAL non-interactive Claude Code invocation, output
 * collection, and the same static validation + isolated fixed-command build
 * the M9.5D external-generated-site import path already uses -- against a
 * synthetic fixture business only.
 *
 * Deliberately stops short of src/lib/designer/worker-db.ts (Supabase
 * persistence): the designer_jobs / external_site_artifacts.provider
 * migrations created this session are committed to supabase/migrations/ but
 * NOT applied to the hosted project. `npx supabase db push` failed with
 * LegacyDbPushMissingLocalError because the remote migration history
 * contains two versions (20260831113741, 20260831125533) with no matching
 * local migration file -- schema drift this session did not create and will
 * not silently repair or overwrite. See HANDOFF.md. No Docker is available
 * on this machine either, so there is no local Postgres to persist into
 * instead. This script proves everything up to and including "candidate is
 * built and ready for human visual review" without a database at all.
 *
 * Run with: npm run designer:smoke-test
 * No prospect is contacted. No public deployment occurs. Nothing here spends
 * money: billing_mode stays subscription throughout, verified by
 * checkClaudeAuthHealth() before anything is spent.
 */

import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createExternalSourceArtifact, buildExternalSourceArtifact } from "@/lib/builder/external-artifacts";
import { buildDesignerBrief } from "@/lib/designer/brief";
import { checkClaudeAuthHealth, checkClaudeCliVersion, locateClaudeCli } from "@/lib/designer/cli";
import { collectDesignerWorkerOutput, validateCollectedManifest } from "@/lib/designer/collect";
import { fixtureBusinessFacts, emptyImageryManifest } from "@/lib/designer/facts";
import { DESIGNER_WORKER_SYSTEM_PROMPT, buildDesignerUserPrompt } from "@/lib/designer/prompt";
import { runDesignerWorker } from "@/lib/designer/runner";
import { createDesignerJobWorkspace, writeJobInputFile, writeJobLog, writeJobOutputFile } from "@/lib/designer/sandbox";

const RUN_TIMEOUT_MS = Number(process.env.SITEFORGE_DESIGNER_RUN_TIMEOUT_MS ?? 480_000);
const BUILD_TIMEOUT_MS = 90_000;

function log(message: string): void {
  process.stdout.write(`[smoke-test] ${new Date().toISOString()} ${message}\n`);
}

async function main(): Promise<void> {
  log("Starting Designer Worker smoke test against a SYNTHETIC fixture business only.");
  log("This is not a real lead, will never be promoted to master, and nothing is persisted to Supabase.");

  const cli = locateClaudeCli();
  if (!cli) {
    log("BLOCKED: Claude Code CLI was not found.");
    process.exitCode = 1;
    return;
  }
  log(`Claude CLI: ${cli.path} (source: ${cli.source})`);

  const version = await checkClaudeCliVersion(cli.path);
  if (!version.ok) {
    log(`BLOCKED: ${version.reason}`);
    process.exitCode = 1;
    return;
  }
  log(`CLI version: ${version.version}`);

  const auth = await checkClaudeAuthHealth(cli.path);
  if (!auth.ok || auth.subscriptionAuth !== true) {
    log(`BLOCKED: not authenticated with a subscription session (${JSON.stringify(auth)}).`);
    process.exitCode = 1;
    return;
  }
  log(`Subscription auth confirmed (${auth.subscriptionType ?? "unknown plan"}). billing_mode=subscription, cash_cost=$0.`);

  const jobId = randomUUID();
  const facts = fixtureBusinessFacts({
    businessName: "Coral Ridge Cooling Co.",
    industry: "HVAC repair and installation",
    city: "Fort Lauderdale",
    region: "FL",
    phone: "(954) 555-0142",
    address: "410 NE 20th St, Fort Lauderdale, FL",
  });
  const imagery = emptyImageryManifest();
  const brief = buildDesignerBrief({
    industry: facts.industry,
    exampleBusiness: {
      name: facts.businessName,
      city: facts.city,
      region: facts.region,
      hasPhone: true,
      hasAddress: true,
      hasRating: false,
      hasHours: false,
    },
  });

  log(`Job ${jobId}: fixture business "${facts.businessName}" (${facts.industry}).`);

  const workspace = await createDesignerJobWorkspace(jobId);
  log(`Workspace: ${workspace.root}`);
  await writeJobInputFile(workspace, "business.json", JSON.stringify(facts, null, 2));
  await writeJobInputFile(workspace, "imagery.json", JSON.stringify(imagery, null, 2));
  await writeJobInputFile(workspace, "brief.md", brief.markdown);
  await writeJobInputFile(workspace, "job.json", JSON.stringify({ id: jobId, mode: "new_master", reason: "Designer Worker smoke test" }, null, 2));

  const userPrompt = buildDesignerUserPrompt({
    jobId,
    mode: "new_master",
    templateFamily: null,
    reason:
      "Local smoke test proving the Designer Job -> Worker -> Claude -> build -> validate pipeline works end to end. " +
      "Keep scope small: a single static HTML+CSS page only (no build tooling, no framework, no package.json) so this " +
      "runs quickly. It still needs a real hero, real business facts, a real CTA, and no invented facts or imagery.",
    facts,
    imagery,
    designBriefText: brief.markdown,
    isFixture: true,
  });

  log(`Invoking Claude Code CLI (timeout ${RUN_TIMEOUT_MS}ms). This uses real subscription capacity...`);
  const started = Date.now();
  const result = await runDesignerWorker({
    cliPath: cli.path,
    workspaceDir: workspace.workspaceDir,
    sessionId: jobId,
    systemPromptAppend: DESIGNER_WORKER_SYSTEM_PROMPT,
    userPrompt,
    model: process.env.SITEFORGE_DESIGNER_MODEL,
    timeoutMs: RUN_TIMEOUT_MS,
  });
  await writeJobLog(workspace, "cli-stdout.log", result.stdout);
  await writeJobLog(workspace, "cli-stderr.log", result.stderr);
  log(`CLI run finished in ${Date.now() - started}ms.`);

  if (!result.ok) {
    log(`FAILED during generation: ${result.failureCode} - ${result.reason}`);
    log(`See ${workspace.logsDir} for full stdout/stderr.`);
    process.exitCode = 1;
    return;
  }
  log("CLI run completed with exit code 0. Collecting output...");

  const collected = await collectDesignerWorkerOutput(workspace, jobId);
  await writeJobOutputFile(workspace, "report.json", JSON.stringify(collected.report, null, 2));
  log(`Collected ${collected.fileCount} source file(s) under workspace/site/.`);

  if (!collected.report.ok) {
    log(`FAILED: worker report invalid (${collected.report.reason}). This is still useful signal -- SiteForge never trusts a report blindly.`);
    process.exitCode = 1;
    return;
  }
  log(`Worker self-report: ${collected.report.report.summary}`);
  log(`Worker candidateForMaster claim: ${collected.report.report.candidateForMaster} (not trusted -- human review decides).`);

  if (collected.fileCount === 0) {
    log("FAILED: no source files were produced under workspace/site/.");
    process.exitCode = 1;
    return;
  }

  const checked = validateCollectedManifest(collected.manifest);
  log(`Static validation: ${checked.validation.status} (${checked.validation.findings.length} finding(s)).`);
  for (const finding of checked.validation.findings) {
    log(`  [${finding.severity}] ${finding.code}: ${finding.message}${finding.path ? ` (${finding.path})` : ""}`);
  }

  const artifact = createExternalSourceArtifact({
    id: jobId,
    generatedWebsiteId: jobId,
    leadId: jobId,
    provider: "claude_code_worker",
    manifest: collected.manifest,
    importedAt: new Date().toISOString(),
    validation: checked.validation,
    build: checked.build,
  });

  const build = checked.validation.ok ? await buildExternalSourceArtifact({ artifact, timeoutMs: BUILD_TIMEOUT_MS }) : null;
  log(`Build: ${build ? build.status : "skipped (validation failed)"} - ${build ? build.summary : "n/a"}`);

  const qaPassed = checked.validation.ok && Boolean(build?.ok);
  const summary = {
    jobId,
    fixture: true,
    business: facts.businessName,
    cliVersion: version.version,
    subscriptionType: auth.subscriptionType,
    cashCostUsd: 0,
    fileCount: collected.fileCount,
    validation: { status: checked.validation.status, findingCount: checked.validation.findings.length },
    build: build ? { status: build.status, ok: build.ok } : { status: "skipped", ok: false },
    technicalQaPassed: qaPassed,
    finalStatus: qaPassed ? "visual_review_required (would be, pending hosted schema)" : "technical_qa_failed",
    workerReport: collected.report.report,
    workspace: workspace.root,
    note:
      "Not persisted to Supabase: designer_jobs / external_site_artifacts.provider migrations are committed but not " +
      "yet applied to the hosted project (see HANDOFF.md). No prospect contacted, no public deployment.",
  };
  await writeFile(`${workspace.outputDir}/smoke-test-summary.json`, JSON.stringify(summary, null, 2), "utf8");

  log(`RESULT: ${qaPassed ? "PASSED technical QA" : "FAILED technical QA"}.`);
  log(`Human visual review needed before this candidate could ever be promoted: YES (structural, unchanged by this test).`);
  log(`Full artifacts: ${workspace.root}`);
}

main().catch((error) => {
  process.stderr.write(`[smoke-test] fatal: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});

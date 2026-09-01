import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateExternalSourceArtifact } from "@/lib/builder/external-artifacts";
import type { ExternalSiteImportManifest } from "@/lib/builder/external-sites";
import { collectWorkspaceFiles, type DesignerJobWorkspace } from "./sandbox";
import { parseDesignerWorkerReport, type ParsedDesignerWorkerReport } from "./report";

const COLLECT_LIMITS = { maxFiles: 160, maxFileBytes: 5_000_000, maxTotalBytes: 25_000_000 };

export type CollectedDesignerOutput = {
  manifest: ExternalSiteImportManifest;
  report: ParsedDesignerWorkerReport;
  fileCount: number;
};

/**
 * Reads the worker's own report (workspace/report.json) and its generated
 * source (workspace/site/**) back out of the isolated workspace. Nothing
 * here is trusted yet -- the caller still runs validateExternalSourceArtifact
 * / buildExternalSourceArtifact (external-artifacts.ts, already used by the
 * M9.5D external-generated-site import path) on the returned manifest before
 * any of it can become a generated_websites row.
 */
export async function collectDesignerWorkerOutput(
  workspace: DesignerJobWorkspace,
  expectedJobId: string,
): Promise<CollectedDesignerOutput> {
  const reportRaw = await readFile(join(workspace.workspaceDir, "report.json"), "utf8").catch(() => null);
  const report: ParsedDesignerWorkerReport =
    reportRaw === null ? { ok: false, reason: "report_file_missing" } : parseDesignerWorkerReport(reportRaw, expectedJobId);

  const siteDir = join(workspace.workspaceDir, "site");
  const files = await collectWorkspaceFilesFromSubdirectory(siteDir, workspace, COLLECT_LIMITS);
  const packageJsonFile = files.find((file) => file.path === "package.json");
  let packageJson: Record<string, unknown> | null = null;
  if (packageJsonFile) {
    try {
      packageJson = JSON.parse(packageJsonFile.content);
    } catch {
      packageJson = null;
    }
  }

  return {
    manifest: { files: files.map((file) => ({ path: file.path, content: file.content })), packageJson },
    report,
    fileCount: files.length,
  };
}

async function collectWorkspaceFilesFromSubdirectory(
  siteDir: string,
  workspace: DesignerJobWorkspace,
  limits: typeof COLLECT_LIMITS,
): Promise<{ path: string; content: string }[]> {
  const scoped: DesignerJobWorkspace = { ...workspace, workspaceDir: siteDir };
  try {
    return await collectWorkspaceFiles(scoped, limits);
  } catch {
    return [];
  }
}

/** Runs the same static validation the external-generated-site import path already enforces. */
export function validateCollectedManifest(manifest: ExternalSiteImportManifest): ReturnType<typeof validateExternalSourceArtifact> {
  return validateExternalSourceArtifact({
    provider: "claude_code_worker",
    controlledPreviewUrl: null,
    providerPreviewUrl: null,
    manifest,
  });
}

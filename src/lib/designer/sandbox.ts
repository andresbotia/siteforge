import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve, join, relative } from "node:path";

/**
 * Isolated per-job workspace under <repo>/.siteforge/designer-jobs/<job-id>/.
 * This directory is gitignored and never committed (see .gitignore); it
 * exists only on the operator's machine while a job runs.
 *
 * The Designer Worker (Claude Code, invoked with --restricted --add-dir
 * <workspace>) only ever sees the `workspace/` subdirectory. `input/` holds
 * the sanitized brief/facts SiteForge wrote before invocation and is not
 * inside the --add-dir the worker is confined to, so the worker cannot read
 * its own input files back as if they were untrusted-editable source, and
 * cannot write outside `workspace/`. `output/` is where SiteForge itself
 * (not the worker) writes the collected report after the run.
 */
export type DesignerJobWorkspace = {
  jobId: string;
  root: string;
  inputDir: string;
  workspaceDir: string;
  outputDir: string;
  logsDir: string;
};

const WORKSPACE_ROOT_MARKER = "designer-jobs";

export function designerJobsRoot(repoRoot: string = process.cwd()): string {
  return resolve(repoRoot, ".siteforge", WORKSPACE_ROOT_MARKER);
}

export async function createDesignerJobWorkspace(jobId: string, repoRoot: string = process.cwd()): Promise<DesignerJobWorkspace> {
  if (!/^[0-9a-f-]{8,64}$/i.test(jobId)) {
    throw new Error("unsafe_job_id");
  }
  const root = resolve(designerJobsRoot(repoRoot), jobId);
  const workspace: DesignerJobWorkspace = {
    jobId,
    root,
    inputDir: join(root, "input"),
    workspaceDir: join(root, "workspace"),
    outputDir: join(root, "output"),
    logsDir: join(root, "logs"),
  };
  for (const dir of [workspace.inputDir, workspace.workspaceDir, workspace.outputDir, workspace.logsDir]) {
    await mkdir(dir, { recursive: true });
  }
  return workspace;
}

export async function writeJobInputFile(workspace: DesignerJobWorkspace, fileName: string, content: string): Promise<void> {
  await writeSafeFile(workspace.inputDir, fileName, content);
}

export async function writeJobLog(workspace: DesignerJobWorkspace, fileName: string, content: string): Promise<void> {
  await writeSafeFile(workspace.logsDir, fileName, content);
}

export async function writeJobOutputFile(workspace: DesignerJobWorkspace, fileName: string, content: string): Promise<void> {
  await writeSafeFile(workspace.outputDir, fileName, content);
}

/** Recursively collects text files from the worker's writable workspace directory, bounded and path-safe. */
export async function collectWorkspaceFiles(
  workspace: DesignerJobWorkspace,
  limits: { maxFiles: number; maxFileBytes: number; maxTotalBytes: number },
): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  let totalBytes = 0;
  await walk(workspace.workspaceDir, workspace.workspaceDir);
  return files;

  async function walk(root: string, current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        await walk(root, full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (files.length >= limits.maxFiles) return;
      const info = await stat(full);
      if (info.size > limits.maxFileBytes) continue;
      totalBytes += info.size;
      if (totalBytes > limits.maxTotalBytes) return;
      const relPath = relative(root, full).replace(/\\/g, "/");
      const content = await readFile(full, "utf8").catch(() => null);
      if (content === null) continue;
      files.push({ path: relPath, content });
    }
  }
}

/** Deletes a job workspace. Only ever called with a path this module itself produced. */
export async function removeDesignerJobWorkspace(workspace: Pick<DesignerJobWorkspace, "root">): Promise<void> {
  if (!workspace.root.includes(WORKSPACE_ROOT_MARKER)) return;
  await rm(workspace.root, { recursive: true, force: true });
}

async function writeSafeFile(dir: string, fileName: string, content: string): Promise<void> {
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("unsafe_file_name");
  }
  await writeFile(join(dir, fileName), content, "utf8");
}

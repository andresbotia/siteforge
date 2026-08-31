import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { asRecord } from "@/lib/json";
import {
  type ExternalProvider,
  type ExternalSiteBuildResult,
  type ExternalSiteFile,
  type ExternalSiteFinding,
  type ExternalSiteImportManifest,
  type ExternalSitePackageSummary,
  type ExternalSiteValidationResult,
  validateExternalSiteSource,
} from "./external-sites";

export const EXTERNAL_SOURCE_ARTIFACT_LIMITS = {
  maxFiles: 80,
  maxFileBytes: 160_000,
  maxTotalBytes: 900_000,
  maxOutputBytes: 1_500_000,
  buildTimeoutMs: 60_000,
} as const;

export const ALLOWED_EXTERNAL_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".css",
  ".html",
  ".svg",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

const UNSUPPORTED_EXTENSIONS = /\.(exe|dll|so|dylib|sh|bat|cmd|ps1|zip|tar|gz|7z|rar)$/i;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

export type ExternalSourceArtifactManifest = {
  schemaVersion: 1;
  leadId?: string;
  files: ExternalSiteFile[];
  packageJson: Record<string, unknown> | null;
  fingerprint: string;
  fileCount: number;
  totalBytes: number;
  fileFingerprints: Array<{ path: string; sha256: string; bytes: number }>;
};

export type ExternalSourceArtifact = {
  id: string;
  generatedWebsiteId: string;
  leadId: string;
  provider: ExternalProvider;
  providerProjectId: string | null;
  providerCommitSha: string | null;
  sourceManifestFingerprint: string;
  manifest: ExternalSourceArtifactManifest;
  createdAt: string;
  createdBy: "admin";
  validationStatus: ExternalSiteValidationResult["status"];
  buildStatus: ExternalSiteBuildResult["status"] | "pending" | "failed";
  deploymentStatus: "not_requested" | "pending_approval" | "deploying" | "deployed" | "failed";
  deploymentId: string | null;
  deploymentUrl: string | null;
  failureSummary: string | null;
  metadata: {
    packageSummary: ExternalSitePackageSummary;
    buildCommand: ExternalSiteBuildResult["command"];
    outputDirectory: "dist" | "source";
    ctaTrackingLimitation: string;
  };
};

export type ExternalSourceBuildExecutionResult =
  | { ok: true; status: "passed"; outputDirectory: string; outputBytes: number; summary: string }
  | { ok: false; status: "blocked" | "failed" | "unsupported"; summary: string; findings?: ExternalSiteFinding[] };

export type BuildCommandRunner = (input: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
}) => Promise<{ ok: boolean; exitCode: number | null; stdout: string; stderr: string; timedOut?: boolean }>;

export function createExternalSourceArtifact(input: {
  id: string;
  generatedWebsiteId: string;
  leadId: string;
  provider: ExternalProvider;
  providerProjectId?: string | null;
  providerCommitSha?: string | null;
  manifest: ExternalSiteImportManifest & { leadId?: string };
  importedAt: string;
  validation: ExternalSiteValidationResult;
  build: ExternalSiteBuildResult;
}): ExternalSourceArtifact {
  const manifest = normalizeExternalSourceManifest(input.manifest);
  return {
    id: input.id,
    generatedWebsiteId: input.generatedWebsiteId,
    leadId: input.leadId,
    provider: input.provider,
    providerProjectId: cleanOptional(input.providerProjectId, 120),
    providerCommitSha: cleanOptional(input.providerCommitSha, 80),
    sourceManifestFingerprint: manifest.fingerprint,
    manifest,
    createdAt: input.importedAt,
    createdBy: "admin",
    validationStatus: input.validation.status,
    buildStatus: input.validation.ok ? input.build.status : "blocked",
    deploymentStatus: "not_requested",
    deploymentId: null,
    deploymentUrl: null,
    failureSummary: null,
    metadata: {
      packageSummary: input.validation.packageSummary,
      buildCommand: input.build.command,
      outputDirectory: input.validation.packageSummary.framework === "static" ? "source" : "dist",
      ctaTrackingLimitation:
        "SiteForge tracks preview opens before redirect. Deep CTA tracking inside arbitrary external source is unavailable unless links are intentionally instrumented.",
    },
  };
}

export function normalizeExternalSourceManifest(
  manifest: ExternalSiteImportManifest & { leadId?: string },
): ExternalSourceArtifactManifest {
  const files = manifest.files
    .map((file) => ({ path: normalizePath(file.path), content: String(file.content ?? "") }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const packageJson = readPackageJson(manifest.packageJson, files);
  const fileFingerprints = files.map((file) => ({
    path: file.path,
    sha256: sha256(file.content),
    bytes: Buffer.byteLength(file.content, "utf8"),
  }));
  const totalBytes = fileFingerprints.reduce((sum, file) => sum + file.bytes, 0);
  const stable = stableJson({
    schemaVersion: 1,
    leadId: manifest.leadId,
    files,
    packageJson,
  });
  return {
    schemaVersion: 1,
    leadId: manifest.leadId,
    files,
    packageJson,
    fingerprint: sha256(stable),
    fileCount: files.length,
    totalBytes,
    fileFingerprints,
  };
}

export function validateExternalSourceArtifact(input: {
  provider: ExternalProvider;
  controlledPreviewUrl: string | null;
  providerPreviewUrl: string | null;
  manifest: ExternalSiteImportManifest;
}): { validation: ExternalSiteValidationResult; build: ExternalSiteBuildResult } {
  const checked = validateExternalSiteSource(input);
  const findings = [...checked.validation.findings];
  const files = input.manifest.files ?? [];
  for (const file of files) {
    const path = normalizePath(String(file.path ?? ""));
    const extension = extensionFor(path);
    const content = String(file.content ?? "");
    if (!extension || !ALLOWED_EXTERNAL_SOURCE_EXTENSIONS.has(extension)) {
      findings.push({ code: "unsupported_file_type", severity: "severe", message: "External source file type is not allowlisted.", path });
    }
    if (UNSUPPORTED_EXTENSIONS.test(path)) {
      findings.push({ code: "unsupported_binary_or_script", severity: "severe", message: "Executable files, shell scripts, and nested archives are not accepted.", path });
    }
    if (IMAGE_EXTENSIONS.test(path)) {
      findings.push({ code: "binary_image_manifest_unsupported", severity: "severe", message: "Binary image files must not be pasted into the JSON source manifest in this milestone.", path });
    }
    if (hasBinaryControlCharacters(content)) {
      findings.push({ code: "unexpected_binary_blob", severity: "severe", message: "Unexpected binary data is not accepted in text-centric source manifests.", path });
    }
  }
  const severe = findings.some((finding) => finding.severity === "severe");
  return {
    validation: {
      ...checked.validation,
      ok: !severe,
      status: severe ? "failed" : "passed",
      findings,
    },
    build: severe
      ? {
          ok: false,
          status: "blocked",
          command: checked.build.command,
          reason: "Severe source artifact validation findings block build.",
        }
      : checked.build,
  };
}

export async function buildExternalSourceArtifact(input: {
  artifact: Pick<ExternalSourceArtifact, "manifest" | "metadata">;
  runner?: BuildCommandRunner;
  timeoutMs?: number;
  cleanup?: boolean;
}): Promise<ExternalSourceBuildExecutionResult> {
  const validation = validateExternalSourceArtifact({
    provider: "manual",
    controlledPreviewUrl: null,
    providerPreviewUrl: null,
    manifest: input.artifact.manifest,
  });
  if (!validation.validation.ok) {
    return {
      ok: false,
      status: "blocked",
      summary: "Source artifact failed validation before build.",
      findings: validation.validation.findings,
    };
  }

  const framework = input.artifact.metadata.packageSummary.framework;
  const root = await mkdtemp(join(tmpdir(), "siteforge-external-"));
  try {
    await writeManifestFiles(root, input.artifact.manifest.files);
    if (framework === "static") {
      const indexPath = resolve(root, "index.html");
      await readFile(indexPath, "utf8");
      const outputBytes = await directoryBytes(root);
      const outputCheck = await validateBuildOutput(root, outputBytes);
      if (!outputCheck.ok) return outputCheck;
      return { ok: true, status: "passed", outputDirectory: root, outputBytes, summary: "Static source output is ready for deployment." };
    }
    if (framework !== "vite-react") {
      return { ok: false, status: "unsupported", summary: "Unsupported external generated site stack." };
    }

    const runner = input.runner ?? defaultBuildCommandRunner;
    const env = minimalBuildEnvironment();
    const install = await runner({
      command: "npm",
      args: ["ci", "--ignore-scripts"],
      cwd: root,
      env,
      timeoutMs: input.timeoutMs ?? EXTERNAL_SOURCE_ARTIFACT_LIMITS.buildTimeoutMs,
    });
    if (!install.ok) return commandFailure("dependency install failed", install);

    const vite = await runner({
      command: process.execPath,
      args: [join(root, "node_modules", "vite", "bin", "vite.js"), "build"],
      cwd: root,
      env,
      timeoutMs: input.timeoutMs ?? EXTERNAL_SOURCE_ARTIFACT_LIMITS.buildTimeoutMs,
    });
    if (!vite.ok) return commandFailure("build failed", vite);

    const dist = resolve(root, "dist");
    const outputBytes = await directoryBytes(dist);
    const outputCheck = await validateBuildOutput(dist, outputBytes);
    if (!outputCheck.ok) return outputCheck;
    return { ok: true, status: "passed", outputDirectory: dist, outputBytes, summary: "Vite React source built successfully with the fixed SiteForge command sequence." };
  } catch {
    return { ok: false, status: "failed", summary: "Build failed while preparing isolated source files." };
  } finally {
    if (input.cleanup !== false) {
      await rm(root, { recursive: true, force: true });
    }
  }
}

export async function removeExternalBuildDirectory(path: string): Promise<void> {
  if (!path.includes("siteforge-external-")) return;
  await rm(path, { recursive: true, force: true });
}

export type PreviewDeploymentProvider = {
  deployStaticOutput(input: {
    artifactId: string;
    generatedWebsiteId: string;
    leadId: string;
    outputDirectory: string;
  }): Promise<{ ok: true; deploymentId: string; deploymentUrl: string } | { ok: false; error: string }>;
};

export function createFakePreviewDeploymentProvider(
  result:
    | { ok: true; deploymentId: string; deploymentUrl: string }
    | { ok: false; error: string } = {
    ok: true,
    deploymentId: "fake-dpl-external",
    deploymentUrl: "https://fake-siteforge-preview.vercel.app",
  },
): PreviewDeploymentProvider {
  return {
    async deployStaticOutput() {
      return result;
    },
  };
}

export function createVercelPreviewDeploymentProvider(): PreviewDeploymentProvider {
  return {
    async deployStaticOutput(input) {
      const projectId = process.env.SITEFORGE_EXTERNAL_PREVIEW_PROJECT_ID?.trim();
      const token = process.env.VERCEL_TOKEN?.trim();
      const teamId = process.env.VERCEL_TEAM_ID?.trim();
      if (!projectId || !token) {
        return {
          ok: false,
          error:
            "Vercel generated-site preview deployment is not configured. Set SITEFORGE_EXTERNAL_PREVIEW_PROJECT_ID and a backend-only VERCEL_TOKEN.",
        };
      }
      const files = await readDeploymentFiles(input.outputDirectory);
      if (!files.ok) return files;
      const url = new URL("https://api.vercel.com/v13/deployments");
      url.searchParams.set("forceNew", "1");
      url.searchParams.set("skipAutoDetectionConfirmation", "1");
      if (teamId) url.searchParams.set("teamId", teamId);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "siteforge-generated-preview",
          project: projectId,
          target: "staging",
          files: files.files,
          projectSettings: {
            framework: null,
            buildCommand: null,
            installCommand: null,
            outputDirectory: null,
            rootDirectory: null,
          },
          meta: {
            siteforgeArtifactId: input.artifactId,
            siteforgeGeneratedWebsiteId: input.generatedWebsiteId,
            siteforgeLeadId: input.leadId,
          },
        }),
      });
      const body = asRecord(await response.json().catch(() => ({})));
      if (!response.ok) {
        return { ok: false, error: safeVercelError(body) };
      }
      const deploymentId = typeof body.id === "string" ? body.id : null;
      const urlValue = typeof body.url === "string" ? body.url : null;
      if (!deploymentId || !urlValue) {
        return { ok: false, error: "Vercel deployment response did not include a deployment id and URL." };
      }
      return {
        ok: true,
        deploymentId,
        deploymentUrl: urlValue.startsWith("https://") ? urlValue : `https://${urlValue}`,
      };
    },
  };
}

async function writeManifestFiles(root: string, files: ExternalSiteFile[]): Promise<void> {
  for (const file of files) {
    const relative = normalizePath(file.path);
    const target = resolve(root, relative);
    if (!target.startsWith(resolve(root) + sep)) throw new Error("unsafe_path");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
}

async function validateBuildOutput(
  outputDirectory: string,
  outputBytes: number,
): Promise<ExternalSourceBuildExecutionResult> {
  if (outputBytes > EXTERNAL_SOURCE_ARTIFACT_LIMITS.maxOutputBytes) {
    return { ok: false, status: "failed", summary: "Build output exceeds the external preview size limit." };
  }
  try {
    await readFile(resolve(outputDirectory, "index.html"), "utf8");
  } catch {
    return { ok: false, status: "failed", summary: "Build output is missing dist/index.html." };
  }
  const findings: ExternalSiteFinding[] = [];
  await scanOutput(outputDirectory, outputDirectory, findings);
  if (findings.some((finding) => finding.severity === "severe")) {
    return { ok: false, status: "failed", summary: "Build output contains blocked references.", findings };
  }
  return { ok: true, status: "passed", outputDirectory, outputBytes, summary: "Build output passed deployment validation." };
}

async function scanOutput(root: string, current: string, findings: ExternalSiteFinding[]): Promise<void> {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      findings.push({ code: "symlink_output", severity: "severe", message: "Symlinks are not allowed in build output." });
      continue;
    }
    const full = resolve(current, entry.name);
    if (entry.isDirectory()) {
      await scanOutput(root, full, findings);
      continue;
    }
    if (!entry.isFile()) continue;
    const relative = full.slice(resolve(root).length + 1).replace(/\\/g, "/");
    const content = await readFile(full, "utf8").catch(() => "");
    validateExternalSiteSource({
      provider: "manual",
      controlledPreviewUrl: null,
      providerPreviewUrl: null,
      manifest: { files: [{ path: relative, content }] },
    }).validation.findings.forEach((finding) => findings.push(finding));
  }
}

async function readDeploymentFiles(
  outputDirectory: string,
): Promise<
  | { ok: true; files: Array<{ file: string; data: string; encoding: "base64" }> }
  | { ok: false; error: string }
> {
  const files: Array<{ file: string; data: string; encoding: "base64" }> = [];
  const root = resolve(outputDirectory);
  try {
    await collectDeploymentFiles(root, root, files);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not read static deployment output." };
  }
  if (files.length === 0 || files.length > EXTERNAL_SOURCE_ARTIFACT_LIMITS.maxFiles) {
    return { ok: false, error: "Static deployment output has an invalid file count." };
  }
  return { ok: true, files };
}

async function collectDeploymentFiles(
  root: string,
  current: string,
  files: Array<{ file: string; data: string; encoding: "base64" }>,
): Promise<void> {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("Static deployment output contains a symlink.");
    const full = resolve(current, entry.name);
    if (entry.isDirectory()) {
      await collectDeploymentFiles(root, full, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const relative = full.slice(root.length + 1).replace(/\\/g, "/");
    if (!relative || relative.includes("..") || relative.startsWith("/") || /^[A-Za-z]:/.test(relative)) {
      throw new Error("Static deployment output contains an unsafe path.");
    }
    const bytes = await readFile(full);
    if (bytes.byteLength > EXTERNAL_SOURCE_ARTIFACT_LIMITS.maxFileBytes) {
      throw new Error("Static deployment output contains a file over the per-file size limit.");
    }
    files.push({ file: relative, data: bytes.toString("base64"), encoding: "base64" });
  }
}

async function directoryBytes(path: string): Promise<number> {
  const info = await stat(path);
  if (info.isFile()) return info.size;
  if (!info.isDirectory()) return 0;
  const entries = await readdir(path, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    total += await directoryBytes(join(path, entry.name));
  }
  return total;
}

function defaultBuildCommandRunner(input: Parameters<BuildCommandRunner>[0]): ReturnType<BuildCommandRunner> {
  return new Promise((resolveCommand) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      env: input.env,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      resolveCommand({ ok: false, exitCode: null, stdout: boundLog(stdout), stderr: boundLog(stderr), timedOut: true });
    }, input.timeoutMs);
    child.stdout?.on("data", (chunk) => {
      stdout = boundLog(stdout + String(chunk));
    });
    child.stderr?.on("data", (chunk) => {
      stderr = boundLog(stderr + String(chunk));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolveCommand({ ok: code === 0, exitCode: code, stdout: boundLog(stdout), stderr: boundLog(stderr) });
    });
  });
}

function minimalBuildEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    Path: process.env.Path ?? process.env.PATH ?? "",
    SystemRoot: process.env.SystemRoot,
    ComSpec: process.env.ComSpec,
    CI: "true",
    NODE_ENV: "production",
    npm_config_ignore_scripts: "true",
    npm_config_fund: "false",
    npm_config_audit: "false",
  };
}

function commandFailure(prefix: string, result: Awaited<ReturnType<BuildCommandRunner>>): ExternalSourceBuildExecutionResult {
  return {
    ok: false,
    status: result.timedOut ? "failed" : "failed",
    summary: result.timedOut ? `${prefix}: timed out.` : `${prefix}: ${sanitizeLog(result.stderr || result.stdout || "command failed")}`,
  };
}

function readPackageJson(
  explicit: Record<string, unknown> | null | undefined,
  files: ExternalSiteFile[],
): Record<string, unknown> | null {
  if (explicit && typeof explicit === "object") return explicit;
  const packageFile = files.find((file) => file.path === "package.json");
  if (!packageFile) return null;
  try {
    return asRecord(JSON.parse(packageFile.content));
  } catch {
    return null;
  }
}

function normalizePath(value: string): string {
  return String(value ?? "").replace(/\\/g, "/").trim();
}

function extensionFor(path: string): string | null {
  const match = path.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? null;
}

function hasBinaryControlCharacters(content: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function cleanOptional(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.slice(0, max) : null;
}

function boundLog(value: string): string {
  return value.slice(-2_000);
}

function sanitizeLog(value: string): string {
  return boundLog(value).replace(/(sk_(live|test)_[A-Za-z0-9]+)/g, "[redacted_secret]");
}

function safeVercelError(body: Record<string, unknown>): string {
  const error = asRecord(body.error);
  const message = typeof error.message === "string" ? error.message : typeof body.message === "string" ? body.message : "Vercel deployment failed.";
  return message.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]");
}

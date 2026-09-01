import { createHash } from "node:crypto";
import { asNumber, asRecord } from "@/lib/json";
import { readDailyHours, readSocialProfiles, readVerifiedPublicFacts } from "@/lib/prospects/verified-public-facts";
import type { LeadRow } from "@/types/database";
import type { WebsiteSpec } from "./types";

export const EXTERNAL_SITE_METADATA_KEY = "external_generated_site";

export const GENERATION_SOURCES = ["deterministic_builder", "external_generated"] as const;
export const EXTERNAL_PROVIDERS = ["lovable", "manual", "claude_code_worker", "grok_worker", "other"] as const;
export const EXTERNAL_SITE_STATUSES = [
  "imported",
  "validating",
  "validation_failed",
  "ready_for_review",
  "deployment_approval_required",
  "deployment_approval_pending",
  "deploying",
  "approved_for_preview",
  "preview_deployed",
  "deployment_failed",
  "revoked",
] as const;

export type GenerationSource = (typeof GENERATION_SOURCES)[number];
export type ExternalProvider = (typeof EXTERNAL_PROVIDERS)[number];
export type ExternalSiteLifecycleStatus = (typeof EXTERNAL_SITE_STATUSES)[number];
export type ExternalFindingSeverity = "warning" | "severe";

export type ExternalSiteFile = {
  path: string;
  content: string;
};

export type ExternalSiteImportManifest = {
  files: ExternalSiteFile[];
  packageJson?: Record<string, unknown> | null;
};

export type VerifiedFactSnapshot = {
  businessName: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  hours: string | null;
  dailyHours: unknown[];
  socials: unknown[];
  menuUrl: string | null;
  orderUrl: string | null;
  reservationUrl: string | null;
  websiteStatus: "verified_no_standalone_website" | "has_website" | "unknown";
  approvedAssetUrls: string[];
};

export type ExternalSiteFinding = {
  code: string;
  severity: ExternalFindingSeverity;
  message: string;
  path?: string;
};

export type ExternalSitePackageSummary = {
  framework: "vite-react" | "vite-tanstack-start" | "static" | "unknown";
  packageManager: "npm" | "bun" | "none" | "unsupported";
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  lockfiles: string[];
};

export type ExternalSiteValidationResult = {
  ok: boolean;
  status: "passed" | "failed";
  findings: ExternalSiteFinding[];
  packageSummary: ExternalSitePackageSummary;
};

export type ExternalSiteBuildResult = {
  ok: boolean;
  status: "pending" | "passed" | "blocked" | "failed" | "unsupported";
  command:
    | "npm ci --ignore-scripts && node node_modules/vite/bin/vite.js build"
    | "bun install --frozen-lockfile --ignore-scripts && bun run build"
    | "static source inspection only";
  reason: string;
};

export type ExternalGeneratedSiteMetadata = {
  generationSource: "external_generated";
  externalProvider: ExternalProvider;
  providerProjectId: string | null;
  providerCommitSha: string | null;
  providerPreviewUrl: string | null;
  controlledPreviewUrl: string | null;
  artifactId: string | null;
  sourceManifestFingerprint: string | null;
  deploymentStatus: "not_requested" | "pending_approval" | "deploying" | "deployed" | "failed";
  deploymentId: string | null;
  deploymentUrl: string | null;
  deploymentFailureSummary: string | null;
  importedAt: string;
  importedBy: "admin";
  provenance: "operator_imported_external_generated_site";
  lifecycleStatus: ExternalSiteLifecycleStatus;
  generationCostCredits: number | null;
  generationCostUsdEstimate: number | null;
  providerCostNotes: string | null;
  sourceArtifact: {
    sourceType: "json_manifest" | "zip_archive";
    archiveFileName: string | null;
    fileCount: number | null;
    totalBytes: number | null;
    assetCount: number | null;
    detectedFramework: ExternalSitePackageSummary["framework"];
    packageManager: ExternalSitePackageSummary["packageManager"];
  };
  verifiedFactSnapshot: VerifiedFactSnapshot;
  verifiedFactFingerprint: string;
  staleFactWarnings: string[];
  validation: ExternalSiteValidationResult;
  build: ExternalSiteBuildResult;
};

type ExternalApprovalMetadata = {
  controlledPreviewUrl: string | null;
  deploymentStatus?: string | null;
  deploymentUrl?: string | null;
  lifecycleStatus: ExternalSiteLifecycleStatus;
  validation: { ok: boolean };
  build: { ok: boolean };
};

const PROVIDER_SET = new Set<string>(EXTERNAL_PROVIDERS);
const STATUS_SET = new Set<string>(EXTERNAL_SITE_STATUSES);
const SAFE_FILE_PATH = /^[A-Za-z0-9._/@+-]+$/;
const MAX_FILES = 160;
const MAX_FILE_BYTES = 5_000_000;
const MAX_TOTAL_BYTES = 25_000_000;
const SECRET_PATTERNS = [
  /\b[A-Za-z0-9_]*API[_-]?KEY\b\s*[:=]/i,
  /\b[A-Za-z0-9_]*SECRET\b\s*[:=]/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk_(live|test)_[A-Za-z0-9]+/,
  /\bsb_secret_[A-Za-z0-9._-]+/,
  /\bSUPABASE_SERVICE_ROLE_KEY\b/i,
  /\bRESEND_API_KEY\b/i,
];
const URL_REFERENCE = /\bhttps?:\/\/[^\s"'<>`\\)]+/gi;
const HOST_PORT_REFERENCE =
  /(?<![\w.])(?:localhost|metadata\.google\.internal|(?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-f:.]+\]|::1):\d{1,5}\b/gi;
const CIDR_REFERENCE = /(?<![\w.])((?:\d{1,3}\.){3}\d{1,3})\/(\d{1,2})\b/g;
const REACT_JAVASCRIPT_URL_SENTINELS = [
  "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')",
  "javascript:throw new Error('A React form was unexpectedly submitted.",
] as const;
const EXACT_REPOSITORY_METADATA_FILES = new Set([".gitignore", ".prettierignore", ".prettierrc", ".prettierrc.json"]);
const PACKAGE_METADATA_FILES = new Set(["package.json", "package-lock.json", "bun.lock", "bun.lockb"]);

type ExternalSourceFileCategory =
  | "runtime_source"
  | "static_asset"
  | "build_config"
  | "package_metadata"
  | "repository_metadata"
  | "documentation";

export function parseExternalProvider(value: string): ExternalProvider | null {
  return PROVIDER_SET.has(value) ? (value as ExternalProvider) : null;
}

export function parseExternalGeneratedSiteMetadata(value: unknown): ExternalGeneratedSiteMetadata | null {
  const root = asRecord(value);
  const raw = asRecord(root[EXTERNAL_SITE_METADATA_KEY]);
  if (raw.generationSource !== "external_generated") return null;
  if (!parseExternalProvider(String(raw.externalProvider ?? ""))) return null;
  if (!STATUS_SET.has(String(raw.lifecycleStatus ?? ""))) return null;
  const validation = asRecord(raw.validation);
  const build = asRecord(raw.build);
  return {
    generationSource: "external_generated",
    externalProvider: raw.externalProvider as ExternalProvider,
    providerProjectId: stringOrNull(raw.providerProjectId),
    providerCommitSha: stringOrNull(raw.providerCommitSha),
    providerPreviewUrl: stringOrNull(raw.providerPreviewUrl),
    controlledPreviewUrl: stringOrNull(raw.controlledPreviewUrl),
    artifactId: stringOrNull(raw.artifactId),
    sourceManifestFingerprint: stringOrNull(raw.sourceManifestFingerprint),
    deploymentStatus:
      raw.deploymentStatus === "pending_approval" ||
      raw.deploymentStatus === "deploying" ||
      raw.deploymentStatus === "deployed" ||
      raw.deploymentStatus === "failed"
        ? raw.deploymentStatus
        : "not_requested",
    deploymentId: stringOrNull(raw.deploymentId),
    deploymentUrl: stringOrNull(raw.deploymentUrl),
    deploymentFailureSummary: stringOrNull(raw.deploymentFailureSummary),
    importedAt: String(raw.importedAt ?? ""),
    importedBy: "admin",
    provenance: "operator_imported_external_generated_site",
    lifecycleStatus: raw.lifecycleStatus as ExternalSiteLifecycleStatus,
    generationCostCredits: asNumber(raw.generationCostCredits),
    generationCostUsdEstimate: asNumber(raw.generationCostUsdEstimate),
    providerCostNotes: stringOrNull(raw.providerCostNotes),
    sourceArtifact: readSourceArtifactSummary(raw.sourceArtifact, validation.packageSummary),
    verifiedFactSnapshot: asRecord(raw.verifiedFactSnapshot) as VerifiedFactSnapshot,
    verifiedFactFingerprint: String(raw.verifiedFactFingerprint ?? ""),
    staleFactWarnings: Array.isArray(raw.staleFactWarnings)
      ? raw.staleFactWarnings.filter((item): item is string => typeof item === "string")
      : [],
    validation: {
      ok: validation.ok === true,
      status: validation.status === "passed" ? "passed" : "failed",
      findings: Array.isArray(validation.findings)
        ? validation.findings.flatMap(readFinding)
        : [],
      packageSummary: readPackageSummary(validation.packageSummary),
    },
    build: {
      ok: build.ok === true,
      status:
        build.status === "passed" ||
        build.status === "blocked" ||
        build.status === "unsupported" ||
        build.status === "pending" ||
        build.status === "failed"
          ? build.status
          : "blocked",
      command:
        build.command === "npm ci --ignore-scripts && node node_modules/vite/bin/vite.js build"
          ? "npm ci --ignore-scripts && node node_modules/vite/bin/vite.js build"
          : build.command === "bun install --frozen-lockfile --ignore-scripts && bun run build"
            ? "bun install --frozen-lockfile --ignore-scripts && bun run build"
          : "static source inspection only",
      reason: String(build.reason ?? ""),
    },
  };
}

export function generationSourceFromMetadata(metadata: unknown): GenerationSource {
  return parseExternalGeneratedSiteMetadata(metadata) ? "external_generated" : "deterministic_builder";
}

export function mergeExternalArtifactMetadata(
  metadata: ExternalGeneratedSiteMetadata | null,
  artifact: {
    id: string;
    source_manifest_fingerprint: string;
    build_status: string;
    deployment_status: string;
    deployment_id: string | null;
    deployment_url: string | null;
    failure_summary: string | null;
    artifact_metadata?: unknown;
    source_manifest?: unknown;
  } | null,
): ExternalGeneratedSiteMetadata | null {
  if (!metadata || !artifact) return metadata;
  const deploymentStatus =
    artifact.deployment_status === "pending_approval" ||
    artifact.deployment_status === "deploying" ||
    artifact.deployment_status === "deployed" ||
    artifact.deployment_status === "failed"
      ? artifact.deployment_status
      : "not_requested";
  const buildStatus =
    artifact.build_status === "passed" ||
    artifact.build_status === "blocked" ||
    artifact.build_status === "unsupported" ||
    artifact.build_status === "pending" ||
    artifact.build_status === "failed"
      ? artifact.build_status
      : metadata.build.status;
  const deploymentUrl = stringOrNull(artifact.deployment_url);
  const artifactSummary = readArtifactStorageSummary(artifact.artifact_metadata, artifact.source_manifest, metadata.validation.packageSummary);
  return {
    ...metadata,
    artifactId: artifact.id,
    sourceManifestFingerprint: artifact.source_manifest_fingerprint,
    controlledPreviewUrl: deploymentStatus === "deployed" ? deploymentUrl : null,
    deploymentStatus,
    deploymentId: stringOrNull(artifact.deployment_id),
    deploymentUrl,
    deploymentFailureSummary: stringOrNull(artifact.failure_summary),
    sourceArtifact: artifactSummary ?? metadata.sourceArtifact,
    lifecycleStatus: lifecycleStatusFor(metadata.validation.ok, buildStatus === "passed", deploymentStatus),
    build: {
      ...metadata.build,
      ok: buildStatus === "passed",
      status: buildStatus,
    },
  };
}

export function createVerifiedFactSnapshot(lead: Pick<LeadRow, "business_name" | "industry" | "address" | "phone" | "website_url" | "google_rating" | "review_count" | "inspection_summary">): VerifiedFactSnapshot {
  const summary = asRecord(lead.inspection_summary);
  const verified = readVerifiedPublicFacts(summary);
  const facts = verified?.facts;
  return {
    businessName: lead.business_name,
    category: facts?.cuisine ?? stringOrNull(summary.cuisine) ?? lead.industry,
    address: lead.address,
    phone: lead.phone,
    rating: facts?.rating ?? (lead.google_rating === null ? null : Number(lead.google_rating)),
    reviewCount: facts?.reviewCount ?? lead.review_count,
    hours: facts?.hours ?? stringOrNull(summary.public_hours),
    dailyHours: facts?.hoursByDay.length ? facts.hoursByDay : readDailyHours(summary.public_hours_by_day),
    socials: facts?.socialProfiles.length ? facts.socialProfiles : readSocialProfiles(summary.social_profiles),
    menuUrl: facts?.menuUrl ?? stringOrNull(summary.menu_link),
    orderUrl: facts?.orderUrl ?? stringOrNull(summary.order_link),
    reservationUrl: facts?.reservationUrl ?? stringOrNull(summary.reservation_link),
    websiteStatus:
      summary.website_status === "verified_no_standalone_website"
        ? "verified_no_standalone_website"
        : lead.website_url
          ? "has_website"
          : "unknown",
    approvedAssetUrls: Array.isArray(summary.approved_images)
      ? summary.approved_images.flatMap((item) => {
          const row = asRecord(item);
          return typeof row.url === "string" ? [row.url] : [];
        })
      : [],
  };
}

export function fingerprintVerifiedFactSnapshot(snapshot: VerifiedFactSnapshot): string {
  return createHash("sha256").update(stableJson(snapshot)).digest("hex");
}

export function compareVerifiedFactSnapshot(
  previous: VerifiedFactSnapshot,
  current: VerifiedFactSnapshot,
): string[] {
  const warnings: string[] = [];
  for (const key of ["address", "phone", "hours", "dailyHours", "socials", "menuUrl", "orderUrl", "reservationUrl", "websiteStatus"] as const) {
    if (stableJson(previous[key]) !== stableJson(current[key])) {
      warnings.push(`Website was generated from an older verified-facts snapshot: ${key} changed.`);
    }
  }
  return warnings;
}

export function validateExternalSiteSource(input: {
  provider: ExternalProvider;
  controlledPreviewUrl: string | null;
  providerPreviewUrl: string | null;
  manifest: ExternalSiteImportManifest;
}): { validation: ExternalSiteValidationResult; build: ExternalSiteBuildResult } {
  const findings: ExternalSiteFinding[] = [];
  const files = Array.isArray(input.manifest.files) ? input.manifest.files : [];
  if (files.length === 0 || files.length > MAX_FILES) {
    findings.push({ code: "invalid_file_count", severity: "severe", message: "Import manifest must include a bounded source file list." });
  }
  let totalBytes = 0;
  for (const file of files) {
    const path = String(file.path ?? "");
    const content = String(file.content ?? "");
    totalBytes += Buffer.byteLength(content, "utf8");
    if (!isSafeRelativePath(path)) {
      findings.push({ code: "unsafe_path", severity: "severe", message: "Source path must be relative and must not escape the import root.", path });
    }
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES || totalBytes > MAX_TOTAL_BYTES) {
      findings.push({ code: "source_too_large", severity: "severe", message: "Source manifest exceeds the import size limit.", path });
    }
    inspectFile(path, content, findings);
  }
  if (input.providerPreviewUrl && /lovable\.app/i.test(input.providerPreviewUrl)) {
    findings.push({ code: "provider_preview_not_controlled", severity: "warning", message: "Provider preview URL is recorded for admin review only and is not prospect-facing." });
  }
  if (input.controlledPreviewUrl && !isControlledPreviewUrl(input.controlledPreviewUrl)) {
    findings.push({ code: "uncontrolled_preview_target", severity: "severe", message: "External preview target must be a Vercel-controlled HTTPS URL." });
  }
  const packageSummary = summarizePackage(input.manifest.packageJson ?? null, files.map((file) => String(file.path ?? "")));
  if (packageSummary.lockfiles.includes("package-lock.json") && packageSummary.lockfiles.some((file) => file === "bun.lock" || file === "bun.lockb")) {
    findings.push({ code: "mixed_lockfiles", severity: "severe", message: "Mixed npm and Bun lockfiles are not accepted for external generated sites." });
  }
  for (const script of ["preinstall", "install", "postinstall", "prepare"]) {
    if (packageSummary.scripts[script]) {
      findings.push({ code: "arbitrary_lifecycle_script", severity: "severe", message: `Package lifecycle script ${script} is not allowed.` });
    }
  }
  if (packageSummary.scripts.build && packageSummary.scripts.build !== "vite build") {
    findings.push({ code: "unsupported_build_script", severity: "severe", message: "Only the allowlisted Vite build command is accepted for external generated sites." });
  }
  const severe = findings.some((finding) => finding.severity === "severe");
  return {
    validation: {
      ok: !severe,
      status: severe ? "failed" : "passed",
      findings,
      packageSummary,
    },
    build: buildResultFor(packageSummary, severe),
  };
}

export function canApproveExternalGeneratedSite(metadata: ExternalApprovalMetadata | null): { ok: true } | { ok: false; error: string } {
  if (!metadata) return { ok: true };
  if (metadata.lifecycleStatus === "validation_failed" || !metadata.validation.ok) {
    return { ok: false, error: "External generated site failed static safety validation." };
  }
  if (!metadata.build.ok) {
    return { ok: false, error: "External generated site build validation has not passed." };
  }
  if (metadata.deploymentStatus !== "deployed") {
    return { ok: false, error: "External generated site preview deployment has not completed." };
  }
  const deploymentUrl = metadata.deploymentUrl;
  if (!deploymentUrl || !isControlledPreviewUrl(deploymentUrl)) {
    return { ok: false, error: "External generated site needs an approved SiteForge-controlled Vercel preview deployment before public preview approval." };
  }
  return { ok: true };
}

export function getExternalPreviewTarget(metadata: ExternalApprovalMetadata | null): string | null {
  if (!metadata) return null;
  if (!metadata.validation.ok || !metadata.build.ok) return null;
  if (metadata.deploymentStatus !== "deployed") return null;
  const deploymentUrl = metadata.deploymentUrl;
  if (!deploymentUrl || !isControlledPreviewUrl(deploymentUrl)) return null;
  return deploymentUrl;
}

export function buildExternalSiteMetadata(input: {
  provider: ExternalProvider;
  providerProjectId?: string | null;
  providerCommitSha?: string | null;
  providerPreviewUrl?: string | null;
  importedAt: string;
  generationCostCredits?: number | null;
  generationCostUsdEstimate?: number | null;
  providerCostNotes?: string | null;
  sourceArtifact?: ExternalGeneratedSiteMetadata["sourceArtifact"];
  artifactId?: string | null;
  sourceManifestFingerprint?: string | null;
  deploymentStatus?: ExternalGeneratedSiteMetadata["deploymentStatus"];
  deploymentId?: string | null;
  deploymentUrl?: string | null;
  deploymentFailureSummary?: string | null;
  snapshot: VerifiedFactSnapshot;
  currentSnapshot: VerifiedFactSnapshot;
  validation: ExternalSiteValidationResult;
  build: ExternalSiteBuildResult;
}): ExternalGeneratedSiteMetadata {
  const staleFactWarnings = compareVerifiedFactSnapshot(input.snapshot, input.currentSnapshot);
  return {
    generationSource: "external_generated",
    externalProvider: input.provider,
    providerProjectId: cleanOptional(input.providerProjectId, 120),
    providerCommitSha: cleanOptional(input.providerCommitSha, 80),
    providerPreviewUrl: cleanOptional(input.providerPreviewUrl, 300),
    controlledPreviewUrl: cleanOptional(input.deploymentUrl, 300),
    artifactId: cleanOptional(input.artifactId, 80),
    sourceManifestFingerprint: cleanOptional(input.sourceManifestFingerprint, 80),
    deploymentStatus: input.deploymentStatus ?? "not_requested",
    deploymentId: cleanOptional(input.deploymentId, 120),
    deploymentUrl: cleanOptional(input.deploymentUrl, 300),
    deploymentFailureSummary: cleanOptional(input.deploymentFailureSummary, 300),
    importedAt: input.importedAt,
    importedBy: "admin",
    provenance: "operator_imported_external_generated_site",
    lifecycleStatus: lifecycleStatusFor(
      input.validation.ok,
      input.build.ok,
      input.deploymentStatus ?? "not_requested",
    ),
    generationCostCredits: input.generationCostCredits ?? null,
    generationCostUsdEstimate: input.generationCostUsdEstimate ?? null,
    providerCostNotes: cleanOptional(input.providerCostNotes, 300),
    sourceArtifact: input.sourceArtifact ?? {
      sourceType: "json_manifest",
      archiveFileName: null,
      fileCount: null,
      totalBytes: null,
      assetCount: null,
      detectedFramework: input.validation.packageSummary.framework,
      packageManager: input.validation.packageSummary.packageManager,
    },
    verifiedFactSnapshot: input.snapshot,
    verifiedFactFingerprint: fingerprintVerifiedFactSnapshot(input.snapshot),
    staleFactWarnings,
    validation: input.validation,
    build: input.build,
  };
}

export function buildExternalReviewSpec(baseSpec: WebsiteSpec): WebsiteSpec {
  return {
    ...baseSpec,
    provenance: [
      ...baseSpec.provenance,
      {
        field: "generationSource",
        provenance: "sourced",
        source: "external_generated.operator_import",
      },
    ],
  };
}

function buildResultFor(
  summary: ExternalSitePackageSummary,
  severe: boolean,
): ExternalSiteBuildResult {
  if (severe) {
    return {
      ok: false,
      status: "blocked",
      command: summary.packageManager === "npm" ? "npm ci --ignore-scripts && node node_modules/vite/bin/vite.js build" : "static source inspection only",
      reason: "Severe validation findings block build approval.",
    };
  }
  if (summary.framework === "vite-react" && summary.packageManager === "npm" && summary.scripts.build === "vite build") {
    return {
      ok: true,
      status: "passed",
      command: "npm ci --ignore-scripts && node node_modules/vite/bin/vite.js build",
      reason: "Supported Vite React source with fixed SiteForge build commands; install lifecycle scripts are disabled.",
    };
  }
  if (
    summary.framework === "vite-react" &&
    summary.packageManager === "bun" &&
    summary.scripts.build === "vite build" &&
    summary.lockfiles.includes("bun.lock")
  ) {
    return {
      ok: true,
      status: "passed",
      command: "bun install --frozen-lockfile --ignore-scripts && bun run build",
      reason: "Supported static Vite React source with Bun lockfile and fixed SiteForge build commands; install lifecycle scripts are disabled.",
    };
  }
  if (summary.framework === "vite-tanstack-start" && summary.packageManager === "bun" && summary.scripts.build === "vite build") {
    return {
      ok: true,
      status: "passed",
      command: "bun install --frozen-lockfile --ignore-scripts && bun run build",
      reason: "Supported Lovable-style Vite/TanStack Start source with Bun lockfile and fixed SiteForge build commands; install lifecycle scripts are disabled.",
    };
  }
  if (summary.framework === "static") {
    return {
      ok: true,
      status: "passed",
      command: "static source inspection only",
      reason: "Static source requires no executable build step.",
    };
  }
  return {
    ok: false,
    status: "unsupported",
    command: "static source inspection only",
    reason: "Unsupported external generated site stack.",
  };
}

function lifecycleStatusFor(
  validationOk: boolean,
  buildOk: boolean,
  deploymentStatus: ExternalGeneratedSiteMetadata["deploymentStatus"],
): ExternalSiteLifecycleStatus {
  if (!validationOk) return "validation_failed";
  if (!buildOk) return "ready_for_review";
  if (deploymentStatus === "pending_approval") return "deployment_approval_pending";
  if (deploymentStatus === "deploying") return "deploying";
  if (deploymentStatus === "deployed") return "preview_deployed";
  if (deploymentStatus === "failed") return "deployment_failed";
  return "deployment_approval_required";
}

function inspectFile(path: string, content: string, findings: ExternalSiteFinding[]): void {
  const lowerPath = path.toLowerCase();
  const category = classifyExternalSourceFile(path);
  if (/(^|\/)\.env(\.|$)|\.pem$|\.key$/i.test(lowerPath)) {
    findings.push({ code: "secret_file", severity: "severe", message: "Secret-bearing files are not allowed in imported site source.", path });
  }
  if (shouldScanProviderLeak(category) && hasProviderEditorLeak(content)) {
    findings.push({ code: "provider_editor_leak", severity: "severe", message: "Provider editor links or metadata must not leak into imported source.", path });
  }
  if (hasDangerousInlineScript(content)) {
    findings.push({ code: "dangerous_inline_script", severity: "severe", message: "Inline script blocks are not allowed in imported external source.", path });
  }
  if (hasUnsafeJavascriptUrlReference(content)) {
    findings.push({ code: "javascript_url", severity: "severe", message: "javascript: URLs are forbidden.", path });
  }
  if (hasPrivateNetworkReference(content)) {
    findings.push({ code: "private_network_reference", severity: "severe", message: "Localhost, private, link-local, or metadata URLs are forbidden.", path });
  }
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      findings.push({ code: "secret_reference", severity: "severe", message: "Secrets and backend provider credentials are forbidden in imported source.", path });
      break;
    }
  }
  if (/stripe\.com|@stripe|stripe-js|STRIPE_/i.test(content)) {
    findings.push({ code: "payment_integration_detected", severity: "severe", message: "Stripe/payment integration is not allowed in prospect preview source.", path });
  }
  if (/<script[^>]+src=["']https?:\/\//i.test(content)) {
    findings.push({ code: "external_script_reference", severity: "warning", message: "External scripts require manual operator review.", path });
  }
}

const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

/**
 * Flags any inline <script> block except two narrow, non-executable-in-place
 * cases: an external module script (type="module" with a src, already
 * exempted before this function existed) and inline JSON-LD structured data
 * (type="application/ld+json") -- the SEO pattern design-brief.ts itself
 * tells every template/Designer Worker to emit -- whose content contains no
 * `<` character at all, so it cannot smuggle a `</script>`-breakout payload
 * regardless of whether it happens to also be syntactically valid JSON.
 */
function hasDangerousInlineScript(content: string): boolean {
  for (const match of content.matchAll(SCRIPT_TAG)) {
    const attributes = match[1] ?? "";
    const inner = match[2] ?? "";
    const isExternalModule = /\btype\s*=\s*["']module["']/i.test(attributes) && /\bsrc\s*=/i.test(attributes);
    if (isExternalModule) continue;
    const isSafeJsonLd = /\btype\s*=\s*["']application\/ld\+json["']/i.test(attributes) && !inner.includes("<");
    if (isSafeJsonLd) continue;
    return true;
  }
  return false;
}

function hasUnsafeJavascriptUrlReference(content: string): boolean {
  let remaining = content;
  for (const sentinel of REACT_JAVASCRIPT_URL_SENTINELS) {
    remaining = remaining.split(sentinel).join("");
  }
  return /javascript:/i.test(remaining);
}

function classifyExternalSourceFile(path: string): ExternalSourceFileCategory {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  const fileName = normalized.split("/").pop() ?? normalized;
  if (normalized.startsWith("public/")) return "static_asset";
  if (PACKAGE_METADATA_FILES.has(fileName)) return "package_metadata";
  if (EXACT_REPOSITORY_METADATA_FILES.has(fileName)) return "repository_metadata";
  if (fileName === "readme.md" || fileName === "agents.md" || normalized.endsWith(".md")) return "documentation";
  if (
    fileName === "components.json" ||
    fileName === "tsconfig.json" ||
    fileName === "bunfig.toml" ||
    fileName === "vite.config.ts" ||
    fileName === "eslint.config.js" ||
    normalized === ".lovable/project.json"
  ) {
    return "build_config";
  }
  return "runtime_source";
}

function shouldScanProviderLeak(category: ExternalSourceFileCategory): boolean {
  return category === "runtime_source" || category === "static_asset";
}

function hasProviderEditorLeak(content: string): boolean {
  return /https?:\/\/[^"'\s]*lovable\.(?:app|dev)|data-lovable|lovable editor|built with lovable/i.test(content);
}

function hasPrivateNetworkReference(content: string): boolean {
  for (const match of content.matchAll(URL_REFERENCE)) {
    if (isPrivateUrl(match[0])) return true;
  }
  for (const match of content.matchAll(HOST_PORT_REFERENCE)) {
    const host = match[0].replace(/:\d{1,5}$/, "");
    if (isPrivateHost(host)) return true;
  }
  for (const match of content.matchAll(CIDR_REFERENCE)) {
    const host = match[1];
    const prefix = Number(match[2]);
    if (Number.isInteger(prefix) && prefix >= 0 && prefix <= 32 && isPrivateIpv4(host)) return true;
  }
  return false;
}

function isPrivateUrl(value: string): boolean {
  try {
    return isPrivateHost(new URL(value).hostname);
  } catch {
    return false;
  }
}

function isPrivateHost(value: string): boolean {
  const host = value.trim().replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (host === "localhost" || host === "metadata.google.internal") return true;
  if (host.includes(":")) {
    return host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd");
  }
  return isPrivateIpv4(host);
}

function isPrivateIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second, third, fourth] = octets;
  return (
    first === 127 ||
    (first === 0 && second === 0 && third === 0 && fourth === 0) ||
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function summarizePackage(value: Record<string, unknown> | null, paths: string[] = []): ExternalSitePackageSummary {
  const row = asRecord(value);
  const deps = sortedKeys(asRecord(row.dependencies));
  const devDeps = sortedKeys(asRecord(row.devDependencies));
  const scripts = Object.fromEntries(
    Object.entries(asRecord(row.scripts)).flatMap(([key, raw]) =>
      typeof raw === "string" ? [[key, raw.trim()]] : [],
    ),
  );
  const normalizedPaths = paths.map((path) => path.replace(/\\/g, "/"));
  const lockfiles = normalizedPaths.filter((path) => path === "package-lock.json" || path === "bun.lock" || path === "bun.lockb").sort();
  const hasVite = deps.includes("vite") || devDeps.includes("vite");
  const hasReact = deps.includes("react") || devDeps.includes("react");
  const hasTanstackStart =
    deps.includes("@tanstack/react-start") ||
    devDeps.includes("@tanstack/react-start") ||
    devDeps.includes("@lovable.dev/vite-tanstack-config") ||
    normalizedPaths.includes("src/routes/__root.tsx") ||
    normalizedPaths.includes("src/routeTree.gen.ts");
  const hasBunLock = lockfiles.includes("bun.lock") || lockfiles.includes("bun.lockb");
  const hasNpmLock = lockfiles.includes("package-lock.json");
  return {
    framework: hasVite && hasReact && hasTanstackStart ? "vite-tanstack-start" : hasVite && hasReact ? "vite-react" : value ? "unknown" : "static",
    packageManager: value ? (hasBunLock && !hasNpmLock ? "bun" : hasNpmLock || !hasBunLock ? "npm" : "unsupported") : "none",
    dependencies: deps,
    devDependencies: devDeps,
    scripts,
    lockfiles,
  };
}

function readPackageSummary(value: unknown): ExternalSitePackageSummary {
  const row = asRecord(value);
  return {
    framework:
      row.framework === "vite-react" || row.framework === "vite-tanstack-start" || row.framework === "static" || row.framework === "unknown"
        ? row.framework
        : "unknown",
    packageManager:
      row.packageManager === "npm" || row.packageManager === "bun" || row.packageManager === "unsupported" || row.packageManager === "none"
        ? row.packageManager
        : "none",
    dependencies: Array.isArray(row.dependencies) ? row.dependencies.filter((item): item is string => typeof item === "string") : [],
    devDependencies: Array.isArray(row.devDependencies) ? row.devDependencies.filter((item): item is string => typeof item === "string") : [],
    scripts: Object.fromEntries(
      Object.entries(asRecord(row.scripts)).flatMap(([key, raw]) =>
        typeof raw === "string" ? [[key, raw]] : [],
      ),
    ),
    lockfiles: Array.isArray(row.lockfiles) ? row.lockfiles.filter((item): item is string => typeof item === "string") : [],
  };
}

function readSourceArtifactSummary(
  value: unknown,
  packageSummary: unknown,
): ExternalGeneratedSiteMetadata["sourceArtifact"] {
  const row = asRecord(value);
  const summary = readPackageSummary(packageSummary);
  return {
    sourceType: row.sourceType === "zip_archive" ? "zip_archive" : "json_manifest",
    archiveFileName: stringOrNull(row.archiveFileName),
    fileCount: asNumber(row.fileCount),
    totalBytes: asNumber(row.totalBytes),
    assetCount: asNumber(row.assetCount),
    detectedFramework:
      row.detectedFramework === "vite-react" ||
      row.detectedFramework === "vite-tanstack-start" ||
      row.detectedFramework === "static" ||
      row.detectedFramework === "unknown"
        ? row.detectedFramework
        : summary.framework,
    packageManager:
      row.packageManager === "npm" || row.packageManager === "bun" || row.packageManager === "unsupported" || row.packageManager === "none"
        ? row.packageManager
        : summary.packageManager,
  };
}

function readArtifactStorageSummary(
  artifactMetadata: unknown,
  sourceManifest: unknown,
  packageSummary: ExternalSitePackageSummary,
): ExternalGeneratedSiteMetadata["sourceArtifact"] | null {
  const metadata = asRecord(artifactMetadata);
  const manifest = asRecord(sourceManifest);
  if (!Object.keys(metadata).length && !Object.keys(manifest).length) return null;
  const archive = asRecord(manifest.archive);
  return {
    sourceType: manifest.sourceType === "zip_archive" || metadata.sourceType === "zip_archive" ? "zip_archive" : "json_manifest",
    archiveFileName: stringOrNull(metadata.archiveFileName) ?? stringOrNull(archive.fileName),
    fileCount: asNumber(metadata.fileCount) ?? asNumber(manifest.fileCount),
    totalBytes: asNumber(metadata.totalBytes) ?? asNumber(manifest.totalBytes),
    assetCount: asNumber(metadata.assetCount) ?? asNumber(manifest.assetCount),
    detectedFramework:
      metadata.detectedFramework === "vite-react" ||
      metadata.detectedFramework === "vite-tanstack-start" ||
      metadata.detectedFramework === "static" ||
      metadata.detectedFramework === "unknown"
        ? metadata.detectedFramework
        : packageSummary.framework,
    packageManager:
      metadata.packageManager === "npm" || metadata.packageManager === "bun" || metadata.packageManager === "unsupported" || metadata.packageManager === "none"
        ? metadata.packageManager
        : packageSummary.packageManager,
  };
}

function readFinding(value: unknown): ExternalSiteFinding[] {
  const row = asRecord(value);
  const code = stringOrNull(row.code);
  const message = stringOrNull(row.message);
  if (!code || !message) return [];
  return [{
    code,
    severity: row.severity === "warning" ? "warning" : "severe",
    message,
    path: stringOrNull(row.path) ?? undefined,
  }];
}

function isSafeRelativePath(path: string): boolean {
  return Boolean(path) && path.length <= 160 && SAFE_FILE_PATH.test(path) && !path.startsWith("/") && !path.startsWith("\\") && !path.includes("..") && !/^[A-Za-z]:/.test(path);
}

function isControlledPreviewUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "vercel.app" || url.hostname.endsWith(".vercel.app"));
  } catch {
    return false;
  }
}

function sortedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort((a, b) => a.localeCompare(b));
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

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

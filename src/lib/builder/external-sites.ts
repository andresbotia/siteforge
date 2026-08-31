import { createHash } from "node:crypto";
import { asNumber, asRecord } from "@/lib/json";
import { readDailyHours, readSocialProfiles, readVerifiedPublicFacts } from "@/lib/prospects/verified-public-facts";
import type { LeadRow } from "@/types/database";
import type { WebsiteSpec } from "./types";

export const EXTERNAL_SITE_METADATA_KEY = "external_generated_site";

export const GENERATION_SOURCES = ["deterministic_builder", "external_generated"] as const;
export const EXTERNAL_PROVIDERS = ["lovable", "manual", "other"] as const;
export const EXTERNAL_SITE_STATUSES = [
  "imported",
  "validating",
  "validation_failed",
  "ready_for_review",
  "approved_for_preview",
  "preview_deployed",
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
  framework: "vite-react" | "static" | "unknown";
  packageManager: "npm" | "none";
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
};

export type ExternalSiteValidationResult = {
  ok: boolean;
  status: "passed" | "failed";
  findings: ExternalSiteFinding[];
  packageSummary: ExternalSitePackageSummary;
};

export type ExternalSiteBuildResult = {
  ok: boolean;
  status: "passed" | "blocked" | "unsupported";
  command: "npm ci --ignore-scripts && npm run build" | "static source inspection only";
  reason: string;
};

export type ExternalGeneratedSiteMetadata = {
  generationSource: "external_generated";
  externalProvider: ExternalProvider;
  providerProjectId: string | null;
  providerCommitSha: string | null;
  providerPreviewUrl: string | null;
  controlledPreviewUrl: string | null;
  importedAt: string;
  importedBy: "admin";
  provenance: "operator_imported_external_generated_site";
  lifecycleStatus: ExternalSiteLifecycleStatus;
  generationCostCredits: number | null;
  generationCostUsdEstimate: number | null;
  providerCostNotes: string | null;
  verifiedFactSnapshot: VerifiedFactSnapshot;
  verifiedFactFingerprint: string;
  staleFactWarnings: string[];
  validation: ExternalSiteValidationResult;
  build: ExternalSiteBuildResult;
};

type ExternalApprovalMetadata = {
  controlledPreviewUrl: string | null;
  lifecycleStatus: ExternalSiteLifecycleStatus;
  validation: { ok: boolean };
  build: { ok: boolean };
};

const PROVIDER_SET = new Set<string>(EXTERNAL_PROVIDERS);
const STATUS_SET = new Set<string>(EXTERNAL_SITE_STATUSES);
const SAFE_FILE_PATH = /^[A-Za-z0-9._/@+-]+$/;
const MAX_FILES = 80;
const MAX_FILE_BYTES = 160_000;
const MAX_TOTAL_BYTES = 900_000;
const PRIVATE_HOST_PATTERNS = [
  /\blocalhost\b/i,
  /\b127\./,
  /\b0\.0\.0\.0\b/,
  /\b10\./,
  /\b172\.(1[6-9]|2\d|3[01])\./,
  /\b192\.168\./,
  /\b169\.254\./,
  /\bmetadata\.google\.internal\b/i,
];
const SECRET_PATTERNS = [
  /\b[A-Za-z0-9_]*API[_-]?KEY\b\s*[:=]/i,
  /\b[A-Za-z0-9_]*SECRET\b\s*[:=]/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk_(live|test)_[A-Za-z0-9]+/,
  /\bsb_secret_[A-Za-z0-9._-]+/,
  /\bSUPABASE_SERVICE_ROLE_KEY\b/i,
  /\bRESEND_API_KEY\b/i,
];

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
    importedAt: String(raw.importedAt ?? ""),
    importedBy: "admin",
    provenance: "operator_imported_external_generated_site",
    lifecycleStatus: raw.lifecycleStatus as ExternalSiteLifecycleStatus,
    generationCostCredits: asNumber(raw.generationCostCredits),
    generationCostUsdEstimate: asNumber(raw.generationCostUsdEstimate),
    providerCostNotes: stringOrNull(raw.providerCostNotes),
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
        build.status === "passed" || build.status === "blocked" || build.status === "unsupported"
          ? build.status
          : "blocked",
      command:
        build.command === "npm ci --ignore-scripts && npm run build"
          ? "npm ci --ignore-scripts && npm run build"
          : "static source inspection only",
      reason: String(build.reason ?? ""),
    },
  };
}

export function generationSourceFromMetadata(metadata: unknown): GenerationSource {
  return parseExternalGeneratedSiteMetadata(metadata) ? "external_generated" : "deterministic_builder";
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
  const packageSummary = summarizePackage(input.manifest.packageJson ?? null);
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
  if (!metadata.controlledPreviewUrl || !isControlledPreviewUrl(metadata.controlledPreviewUrl)) {
    return { ok: false, error: "External generated site needs a Vercel-controlled preview URL before approval." };
  }
  return { ok: true };
}

export function getExternalPreviewTarget(metadata: ExternalApprovalMetadata | null): string | null {
  if (!metadata) return null;
  if (!metadata.controlledPreviewUrl || !isControlledPreviewUrl(metadata.controlledPreviewUrl)) return null;
  if (!metadata.validation.ok || !metadata.build.ok) return null;
  return metadata.controlledPreviewUrl;
}

export function buildExternalSiteMetadata(input: {
  provider: ExternalProvider;
  providerProjectId?: string | null;
  providerCommitSha?: string | null;
  providerPreviewUrl?: string | null;
  controlledPreviewUrl?: string | null;
  importedAt: string;
  generationCostCredits?: number | null;
  generationCostUsdEstimate?: number | null;
  providerCostNotes?: string | null;
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
    controlledPreviewUrl: cleanOptional(input.controlledPreviewUrl, 300),
    importedAt: input.importedAt,
    importedBy: "admin",
    provenance: "operator_imported_external_generated_site",
    lifecycleStatus: input.validation.ok && input.build.ok ? "ready_for_review" : "validation_failed",
    generationCostCredits: input.generationCostCredits ?? null,
    generationCostUsdEstimate: input.generationCostUsdEstimate ?? null,
    providerCostNotes: cleanOptional(input.providerCostNotes, 300),
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
      command: summary.packageManager === "npm" ? "npm ci --ignore-scripts && npm run build" : "static source inspection only",
      reason: "Severe validation findings block build approval.",
    };
  }
  if (summary.framework === "vite-react" && summary.scripts.build === "vite build") {
    return {
      ok: true,
      status: "passed",
      command: "npm ci --ignore-scripts && npm run build",
      reason: "Supported Vite React source with allowlisted build command; install lifecycle scripts are disabled.",
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

function inspectFile(path: string, content: string, findings: ExternalSiteFinding[]): void {
  const lowerPath = path.toLowerCase();
  if (/(^|\/)\.env(\.|$)|\.pem$|\.key$/i.test(lowerPath)) {
    findings.push({ code: "secret_file", severity: "severe", message: "Secret-bearing files are not allowed in imported site source.", path });
  }
  if (/lovable\.app|lovable\.dev|data-lovable|lovable editor/i.test(content)) {
    findings.push({ code: "provider_editor_leak", severity: "severe", message: "Provider editor links or metadata must not leak into imported source.", path });
  }
  if (/<script\b(?![^>]*\btype=["']module["'][^>]*\bsrc=)[\s\S]*?>[\s\S]*?<\/script>/i.test(content)) {
    findings.push({ code: "dangerous_inline_script", severity: "severe", message: "Inline script blocks are not allowed in imported external source.", path });
  }
  if (/javascript:/i.test(content)) {
    findings.push({ code: "javascript_url", severity: "severe", message: "javascript: URLs are forbidden.", path });
  }
  for (const pattern of PRIVATE_HOST_PATTERNS) {
    if (pattern.test(content)) {
      findings.push({ code: "private_network_reference", severity: "severe", message: "Localhost, private, link-local, or metadata URLs are forbidden.", path });
      break;
    }
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

function summarizePackage(value: Record<string, unknown> | null): ExternalSitePackageSummary {
  const row = asRecord(value);
  const deps = sortedKeys(asRecord(row.dependencies));
  const devDeps = sortedKeys(asRecord(row.devDependencies));
  const scripts = Object.fromEntries(
    Object.entries(asRecord(row.scripts)).flatMap(([key, raw]) =>
      typeof raw === "string" ? [[key, raw.trim()]] : [],
    ),
  );
  const hasVite = deps.includes("vite") || devDeps.includes("vite");
  const hasReact = deps.includes("react") || devDeps.includes("react");
  return {
    framework: hasVite && hasReact ? "vite-react" : value ? "unknown" : "static",
    packageManager: value ? "npm" : "none",
    dependencies: deps,
    devDependencies: devDeps,
    scripts,
  };
}

function readPackageSummary(value: unknown): ExternalSitePackageSummary {
  const row = asRecord(value);
  return {
    framework:
      row.framework === "vite-react" || row.framework === "static" || row.framework === "unknown"
        ? row.framework
        : "unknown",
    packageManager: row.packageManager === "npm" || row.packageManager === "none" ? row.packageManager : "none",
    dependencies: Array.isArray(row.dependencies) ? row.dependencies.filter((item): item is string => typeof item === "string") : [],
    devDependencies: Array.isArray(row.devDependencies) ? row.devDependencies.filter((item): item is string => typeof item === "string") : [],
    scripts: Object.fromEntries(
      Object.entries(asRecord(row.scripts)).flatMap(([key, raw]) =>
        typeof raw === "string" ? [[key, raw]] : [],
      ),
    ),
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

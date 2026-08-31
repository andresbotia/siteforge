import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

import { BUILDER_VERSION } from "@/lib/builder/limits";
import { assertPreviewPublicationAllowed } from "@/lib/previews/policy";
import {
  EXTERNAL_SOURCE_ARTIFACT_LIMITS,
  buildExternalSourceArtifact,
  createExternalSourceArtifact,
  createFakePreviewDeploymentProvider,
  normalizeExternalSourceManifest,
  validateExternalSourceArtifact,
  type BuildCommandRunner,
} from "./external-artifacts";
import {
  buildExternalSiteMetadata,
  canApproveExternalGeneratedSite,
  getExternalPreviewTarget,
  mergeExternalArtifactMetadata,
  type ExternalSiteImportManifest,
} from "./external-sites";

const viteRestaurantManifest: ExternalSiteImportManifest = {
  files: [
    {
      path: "package.json",
      content: JSON.stringify({
        scripts: { build: "vite build" },
        dependencies: { "@vitejs/plugin-react": "latest", vite: "latest", react: "latest", "react-dom": "latest" },
        devDependencies: {},
      }),
    },
    { path: "index.html", content: '<div id="root"></div><script type="module" src="/src/main.tsx"></script>' },
    { path: "src/main.tsx", content: 'import React from "react"; import { createRoot } from "react-dom/client"; import App from "./App"; createRoot(document.getElementById("root")!).render(<App />);' },
    { path: "src/App.tsx", content: "export default function App(){return <main><h1>Mariposa Comedor</h1><p>Salvadoran restaurant</p></main>}" },
    { path: "src/style.css", content: "main{font-family:sans-serif}" },
  ],
  packageJson: {
    scripts: { build: "vite build" },
    dependencies: { "@vitejs/plugin-react": "latest", vite: "latest", react: "latest", "react-dom": "latest" },
    devDependencies: {},
  },
};

const staticManifest: ExternalSiteImportManifest = {
  files: [
    { path: "index.html", content: "<main><h1>Mariposa Comedor</h1><p>Salvadoran restaurant</p></main>" },
    { path: "style.css", content: "main{color:#111}" },
  ],
  packageJson: null,
};

const snapshot = {
  businessName: "Mariposa Comedor",
  category: "Salvadoran restaurant",
  address: "123 Sample Road",
  phone: "(954) 555-0195",
  rating: 4.5,
  reviewCount: 295,
  hours: null,
  dailyHours: [],
  socials: [],
  menuUrl: null,
  orderUrl: null,
  reservationUrl: null,
  websiteStatus: "verified_no_standalone_website" as const,
  approvedAssetUrls: [],
};

describe("external source artifacts", () => {
  it("normalizes and fingerprints persisted source deterministically", () => {
    const first = normalizeExternalSourceManifest({ ...viteRestaurantManifest, leadId: "lead-1" });
    const second = normalizeExternalSourceManifest({
      leadId: "lead-1",
      files: [...viteRestaurantManifest.files].reverse(),
      packageJson: viteRestaurantManifest.packageJson,
    });

    assert.equal(first.fingerprint, second.fingerprint);
    assert.equal(first.fileCount, 5);
    assert.equal(first.files.some((file) => file.content.includes("Mariposa Comedor")), true);
    assert.equal(first.fileFingerprints.some((file) => file.path === "src/App.tsx" && file.sha256.length === 64), true);
  });

  it("creates an immutable artifact record without exposing source in public metadata", () => {
    const checked = validateExternalSourceArtifact({
      provider: "lovable",
      controlledPreviewUrl: null,
      providerPreviewUrl: "https://preview.lovable.app/example",
      manifest: viteRestaurantManifest,
    });
    const artifact = createExternalSourceArtifact({
      id: "artifact-1",
      generatedWebsiteId: "website-1",
      leadId: "lead-1",
      provider: "lovable",
      providerProjectId: "lovable-project",
      providerCommitSha: "abcdef",
      manifest: viteRestaurantManifest,
      importedAt: "2026-08-30T00:00:00.000Z",
      validation: checked.validation,
      build: checked.build,
    });
    const metadata = buildExternalSiteMetadata({
      provider: "lovable",
      artifactId: artifact.id,
      sourceManifestFingerprint: artifact.sourceManifestFingerprint,
      importedAt: artifact.createdAt,
      snapshot,
      currentSnapshot: snapshot,
      validation: checked.validation,
      build: checked.build,
    });

    assert.equal(artifact.manifest.files.length, viteRestaurantManifest.files.length);
    assert.equal(metadata.artifactId, "artifact-1");
    assert.equal(JSON.stringify(metadata).includes("src/App.tsx"), false);
  });

  it("rejects path traversal, unsafe paths, file counts, file size, total size, and unsupported binary entries", () => {
    const tooMany = Array.from({ length: EXTERNAL_SOURCE_ARTIFACT_LIMITS.maxFiles + 1 }, (_, index) => ({
      path: `src/file-${index}.tsx`,
      content: "export default null",
    }));
    const cases: Array<[string, ExternalSiteImportManifest, string]> = [
      ["traversal", { files: [{ path: "../secret.ts", content: "" }] }, "unsafe_path"],
      ["absolute", { files: [{ path: "C:/secret.ts", content: "" }] }, "unsafe_path"],
      ["file count", { files: tooMany }, "invalid_file_count"],
      ["file size", { files: [{ path: "src/large.ts", content: "x".repeat(EXTERNAL_SOURCE_ARTIFACT_LIMITS.maxFileBytes + 1) }] }, "source_too_large"],
      ["total size", { files: Array.from({ length: 7 }, (_, index) => ({ path: `src/big-${index}.ts`, content: "x".repeat(150_000) })) }, "source_too_large"],
      ["binary", { files: [{ path: "public/logo.png", content: "\u0000PNG" }] }, "binary_image_manifest_unsupported"],
      ["script", { files: [{ path: "deploy.sh", content: "echo no" }] }, "unsupported_file_type"],
      ["archive", { files: [{ path: "source.zip", content: "zip" }] }, "unsupported_binary_or_script"],
    ];

    for (const [, manifest, code] of cases) {
      const result = validateExternalSourceArtifact({
        provider: "manual",
        controlledPreviewUrl: null,
        providerPreviewUrl: null,
        manifest,
      });
      assert.equal(result.validation.ok, false);
      assert.equal(result.validation.findings.some((finding) => finding.code === code), true, code);
    }
  });

  it("keeps secret, private key, localhost, lifecycle, and unsupported framework protections intact", () => {
    const result = validateExternalSourceArtifact({
      provider: "manual",
      controlledPreviewUrl: null,
      providerPreviewUrl: null,
      manifest: {
        files: [
          { path: ".env", content: "OPENAI_API_KEY=secret" },
          { path: "src/key.ts", content: "-----BEGIN PRIVATE KEY-----" },
          { path: "src/local.ts", content: "fetch('http://localhost:3000')" },
          { path: "package.json", content: JSON.stringify({ scripts: { prepare: "node x.js", build: "next build" }, dependencies: { next: "latest" } }) },
        ],
        packageJson: { scripts: { prepare: "node x.js", build: "next build" }, dependencies: { next: "latest" } },
      },
    });

    assert.equal(result.validation.ok, false);
    for (const code of ["secret_file", "secret_reference", "private_network_reference", "arbitrary_lifecycle_script", "unsupported_build_script"]) {
      assert.equal(result.validation.findings.some((finding) => finding.code === code), true, code);
    }
    assert.equal(result.validation.packageSummary.framework, "unknown");
  });

  it("records a fixed Vite build command and uses a minimal build environment", async () => {
    const checked = validateExternalSourceArtifact({
      provider: "lovable",
      controlledPreviewUrl: null,
      providerPreviewUrl: null,
      manifest: viteRestaurantManifest,
    });
    const artifact = createExternalSourceArtifact({
      id: "artifact-vite",
      generatedWebsiteId: "website-vite",
      leadId: "lead-vite",
      provider: "lovable",
      manifest: viteRestaurantManifest,
      importedAt: "2026-08-30T00:00:00.000Z",
      validation: checked.validation,
      build: checked.build,
    });
    const commands: string[] = [];
    const envKeys: string[][] = [];
    const runner: BuildCommandRunner = async (input) => {
      commands.push([input.command, ...input.args].join(" "));
      envKeys.push(Object.keys(input.env).sort());
      if (input.args.includes("build")) {
        await mkdir(join(input.cwd, "dist"), { recursive: true });
        await writeFile(join(input.cwd, "dist", "index.html"), "<main>Built restaurant</main>");
      }
      return { ok: true, exitCode: 0, stdout: "", stderr: "" };
    };

    const built = await buildExternalSourceArtifact({ artifact, runner });

    assert.equal(built.ok, true);
    assert.equal(checked.build.command, "npm ci --ignore-scripts && node node_modules/vite/bin/vite.js build");
    assert.equal(commands[0], "npm ci --ignore-scripts");
    assert.match(commands[1], /node_modules[\\/]+vite[\\/]+bin[\\/]+vite\.js build$/);
    assert.equal(envKeys.flat().includes("RESEND_API_KEY"), false);
    assert.equal(envKeys.flat().includes("SUPABASE_SECRET_KEY"), false);
  });

  it("blocks timeout, missing index, and output secret leakage", async () => {
    const checked = validateExternalSourceArtifact({
      provider: "manual",
      controlledPreviewUrl: null,
      providerPreviewUrl: null,
      manifest: staticManifest,
    });
    const artifact = createExternalSourceArtifact({
      id: "artifact-static",
      generatedWebsiteId: "website-static",
      leadId: "lead-static",
      provider: "manual",
      manifest: staticManifest,
      importedAt: "2026-08-30T00:00:00.000Z",
      validation: checked.validation,
      build: checked.build,
    });
    assert.equal((await buildExternalSourceArtifact({ artifact })).ok, true);

    const missingIndex = createExternalSourceArtifact({
      id: "artifact-missing-index",
      generatedWebsiteId: "website-missing-index",
      leadId: "lead-missing-index",
      provider: "manual",
      manifest: { files: [{ path: "about.html", content: "<main>About</main>" }] },
      importedAt: "2026-08-30T00:00:00.000Z",
      validation: validateExternalSourceArtifact({ provider: "manual", controlledPreviewUrl: null, providerPreviewUrl: null, manifest: { files: [{ path: "about.html", content: "<main>About</main>" }] } }).validation,
      build: checked.build,
    });
    assert.equal((await buildExternalSourceArtifact({ artifact: missingIndex })).ok, false);

    const timeoutRunner: BuildCommandRunner = async () => ({ ok: false, exitCode: null, stdout: "", stderr: "", timedOut: true });
    const viteArtifact = createExternalSourceArtifact({
      id: "artifact-timeout",
      generatedWebsiteId: "website-timeout",
      leadId: "lead-timeout",
      provider: "lovable",
      manifest: viteRestaurantManifest,
      importedAt: "2026-08-30T00:00:00.000Z",
      validation: validateExternalSourceArtifact({ provider: "lovable", controlledPreviewUrl: null, providerPreviewUrl: null, manifest: viteRestaurantManifest }).validation,
      build: validateExternalSourceArtifact({ provider: "lovable", controlledPreviewUrl: null, providerPreviewUrl: null, manifest: viteRestaurantManifest }).build,
    });
    assert.equal((await buildExternalSourceArtifact({ artifact: viteArtifact, runner: timeoutRunner })).ok, false);

    const secretRunner: BuildCommandRunner = async (input) => {
      if (input.args.includes("build")) {
        const out = join(input.cwd, "dist");
        await mkdir(dirname(join(out, "index.html")), { recursive: true });
        await writeFile(join(out, "index.html"), "RESEND_API_KEY=re_secret");
      }
      return { ok: true, exitCode: 0, stdout: "", stderr: "" };
    };
    const leaked = await buildExternalSourceArtifact({ artifact: viteArtifact, runner: secretRunner });
    assert.equal(leaked.ok, false);
  });

  it("supports fake deployment success and failure without calling Vercel", async () => {
    const ok = await createFakePreviewDeploymentProvider().deployStaticOutput({
      artifactId: "artifact-1",
      generatedWebsiteId: "website-1",
      leadId: "lead-1",
      outputDirectory: "dist",
    });
    assert.deepEqual(ok, {
      ok: true,
      deploymentId: "fake-dpl-external",
      deploymentUrl: "https://fake-siteforge-preview.vercel.app",
    });
    const failed = await createFakePreviewDeploymentProvider({ ok: false, error: "deployment failed" }).deployStaticOutput({
      artifactId: "artifact-1",
      generatedWebsiteId: "website-1",
      leadId: "lead-1",
      outputDirectory: "dist",
    });
    assert.deepEqual(failed, { ok: false, error: "deployment failed" });
  });

  it("gates public preview approval until artifact deployment is complete", () => {
    const checked = validateExternalSourceArtifact({
      provider: "lovable",
      controlledPreviewUrl: null,
      providerPreviewUrl: null,
      manifest: viteRestaurantManifest,
    });
    const metadata = buildExternalSiteMetadata({
      provider: "lovable",
      artifactId: "artifact-1",
      sourceManifestFingerprint: "fingerprint",
      importedAt: "2026-08-30T00:00:00.000Z",
      snapshot,
      currentSnapshot: snapshot,
      validation: checked.validation,
      build: checked.build,
    });
    assert.equal(canApproveExternalGeneratedSite(metadata).ok, false);
    assert.equal(getExternalPreviewTarget(metadata), null);

    const deployed = mergeExternalArtifactMetadata(metadata, {
      id: "artifact-1",
      source_manifest_fingerprint: "fingerprint",
      build_status: "passed",
      deployment_status: "deployed",
      deployment_id: "dpl_123",
      deployment_url: "https://mariposa-siteforge.vercel.app",
      failure_summary: null,
    });
    assert.deepEqual(canApproveExternalGeneratedSite(deployed), { ok: true });
    assert.equal(getExternalPreviewTarget(deployed), "https://mariposa-siteforge.vercel.app");
    assert.deepEqual(
      assertPreviewPublicationAllowed({
        site: {
          status: "review_required",
          spec: {
            version: BUILDER_VERSION,
            template: "home-services-modern",
            palette: "navy-amber",
            business: { name: "Mariposa Comedor" },
            navigation: [{ id: "home", label: "Home" }],
            pages: [{ id: "home", title: "Home", description: "Restaurant", sections: [{ type: "hero", headline: "Salvadoran food", lede: "Fresh pupusas.", ctas: [] }] }],
          },
          externalGeneratedSite: deployed,
        },
        hasActiveDeployment: false,
        hasPendingApproval: false,
      }),
      { ok: true },
    );
  });

  it("keeps the /websites external import entry point admin-bound", async () => {
    const websitesPage = await readFile("src/app/websites/page.tsx", "utf8");
    const importPage = await readFile("src/app/websites/import-external/page.tsx", "utf8");
    const action = await readFile("src/app/actions/external-sites.ts", "utf8");
    assert.match(websitesPage, /Import External Site/);
    assert.match(websitesPage, /href="\/websites\/import-external"/);
    assert.match(importPage, /listEligibleLeadsForBuild/);
    assert.match(importPage, /ExternalSiteImportForm/);
    assert.match(action, /importExternalGeneratedSite/);
    assert.match(action, /requestExternalPreviewDeployment/);
  });
});

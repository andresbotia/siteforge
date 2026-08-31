import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildExternalSiteMetadata,
  canApproveExternalGeneratedSite,
  compareVerifiedFactSnapshot,
  createVerifiedFactSnapshot,
  fingerprintVerifiedFactSnapshot,
  getExternalPreviewTarget,
  parseExternalProvider,
  validateExternalSiteSource,
  type ExternalSiteImportManifest,
} from "./external-sites";

const fixtureManifest: ExternalSiteImportManifest = {
  files: [
    {
      path: "package.json",
      content: JSON.stringify({
        scripts: { build: "vite build" },
        dependencies: { "@vitejs/plugin-react": "latest", vite: "latest", react: "latest" },
      }),
    },
    {
      path: "src/App.tsx",
      content:
        "export default function App(){return <main><h1>Mariposa Comedor</h1><a href=\"tel:9545550195\">Call</a></main>}",
    },
  ],
  packageJson: {
    scripts: { build: "vite build" },
    dependencies: { "@vitejs/plugin-react": "latest", vite: "latest", react: "latest" },
  },
};

const lead = {
  business_name: "Mariposa Comedor",
  industry: "Restaurant",
  address: "123 Sample Road, Coconut Creek, FL",
  phone: "(954) 555-0195",
  website_url: null,
  google_rating: 4.5,
  review_count: 295,
  inspection_summary: {
    website_status: "verified_no_standalone_website",
    verified_public_facts: {
      source_type: "manual_public_verification",
      source_url: "https://public.example.test/mariposa",
      verified_at: "2026-08-30T00:00:00.000Z",
      verified_by: "admin",
      facts: {
        cuisine: "Salvadoran restaurant",
        rating: 4.5,
        reviewCount: 295,
        hours: null,
        hoursByDay: [
          { day: "monday", label: "Monday", value: "8:00 AM - 10:00 PM", closed: false },
        ],
        socialProfiles: [
          {
            platform: "instagram",
            url: "https://www.instagram.com/mariposa.comedor",
            sourceUrl: "https://public.example.test/mariposa",
            verificationStatus: "operator_verified",
          },
        ],
        description: "Salvadoran restaurant with pupusas and casual dining.",
        socialUrl: null,
        menuUrl: "https://public.example.test/menu",
        orderUrl: null,
        reservationUrl: null,
      },
      imageAssets: [],
      provenance: {},
    },
  },
};

describe("external generated site import validation", () => {
  it("accepts Lovable and manual providers and rejects invalid enum values", () => {
    assert.equal(parseExternalProvider("lovable"), "lovable");
    assert.equal(parseExternalProvider("manual"), "manual");
    assert.equal(parseExternalProvider("figma"), null);
  });

  it("accepts a fictional Lovable-like Vite React restaurant fixture", () => {
    const result = validateExternalSiteSource({
      provider: "lovable",
      controlledPreviewUrl: null,
      providerPreviewUrl: "https://preview.lovable.app/projects/sample",
      manifest: fixtureManifest,
    });
    assert.equal(result.validation.ok, true);
    assert.equal(result.build.ok, true);
    assert.equal(result.build.command, "npm ci --ignore-scripts && node node_modules/vite/bin/vite.js build");
    assert.equal(result.validation.packageSummary.framework, "vite-react");
    assert.equal(
      result.validation.findings.some((finding) => finding.code === "provider_preview_not_controlled"),
      true,
    );
  });

  it("accepts Lovable-like Vite TanStack Start source with a Bun lockfile", () => {
    const result = validateExternalSiteSource({
      provider: "lovable",
      controlledPreviewUrl: null,
      providerPreviewUrl: "https://preview.lovable.app/projects/sample",
      manifest: {
        files: [
          {
            path: "package.json",
            content: JSON.stringify({
              scripts: { build: "vite build" },
              dependencies: { "@tanstack/react-start": "latest", vite: "latest", react: "latest", "react-dom": "latest" },
              devDependencies: { "@lovable.dev/vite-tanstack-config": "latest" },
            }),
          },
          { path: "bun.lock", content: "" },
          { path: "src/routes/__root.tsx", content: "export const Route = {}" },
          { path: "src/routeTree.gen.ts", content: "export const routeTree = {}" },
        ],
        packageJson: {
          scripts: { build: "vite build" },
          dependencies: { "@tanstack/react-start": "latest", vite: "latest", react: "latest", "react-dom": "latest" },
          devDependencies: { "@lovable.dev/vite-tanstack-config": "latest" },
        },
      },
    });

    assert.equal(result.validation.ok, true);
    assert.equal(result.validation.packageSummary.framework, "vite-tanstack-start");
    assert.equal(result.validation.packageSummary.packageManager, "bun");
    assert.equal(result.build.command, "bun install --frozen-lockfile --ignore-scripts && bun run build");
  });

  it("blocks mixed npm and Bun lockfiles", () => {
    const result = validateExternalSiteSource({
      provider: "lovable",
      controlledPreviewUrl: null,
      providerPreviewUrl: null,
      manifest: {
        ...fixtureManifest,
        files: [...fixtureManifest.files, { path: "package-lock.json", content: "{}" }, { path: "bun.lock", content: "" }],
      },
    });

    assert.equal(result.validation.ok, false);
    assert.equal(result.validation.findings.some((finding) => finding.code === "mixed_lockfiles"), true);
  });

  it("blocks severe static safety findings", () => {
    const cases: Array<[string, string]> = [
      [".env", "RESEND_API_KEY=re_123"],
      ["src/key.ts", "const key = '-----BEGIN PRIVATE KEY-----'"],
      ["src/api.ts", "const url = 'http://127.0.0.1:54321'"],
      ["src/metadata.ts", "fetch('http://169.254.169.254/latest/meta-data')"],
      ["src/link.tsx", "<a href=\"javascript:alert(1)\">Bad</a>"],
      ["src/stripe.ts", "const stripe = 'sk_live_123'"],
      ["src/editor.tsx", "<a href=\"https://lovable.app/projects/abc\">Edit</a>"],
    ];

    for (const [path, content] of cases) {
      const result = validateExternalSiteSource({
        provider: "manual",
        controlledPreviewUrl: "https://safe-preview.vercel.app",
        providerPreviewUrl: null,
        manifest: {
          ...fixtureManifest,
          files: [...fixtureManifest.files, { path, content }],
        },
      });
      assert.equal(result.validation.ok, false, path);
      assert.equal(result.build.ok, false, path);
    }
  });

  it("blocks arbitrary lifecycle and non-allowlisted build scripts", () => {
    const result = validateExternalSiteSource({
      provider: "lovable",
      controlledPreviewUrl: "https://safe-preview.vercel.app",
      providerPreviewUrl: null,
      manifest: {
        files: fixtureManifest.files,
        packageJson: {
          scripts: { preinstall: "node steal.js", build: "next build" },
          dependencies: { react: "latest", vite: "latest" },
        },
      },
    });
    assert.equal(result.validation.ok, false);
    assert.equal(
      result.validation.findings.some((finding) => finding.code === "arbitrary_lifecycle_script"),
      true,
    );
    assert.equal(
      result.validation.findings.some((finding) => finding.code === "unsupported_build_script"),
      true,
    );
  });

  it("captures and fingerprints verified public facts without source mutation", () => {
    const snapshot = createVerifiedFactSnapshot(lead);
    const repeated = createVerifiedFactSnapshot(lead);
    assert.equal(snapshot.businessName, "Mariposa Comedor");
    assert.equal(snapshot.category, "Salvadoran restaurant");
    assert.equal(snapshot.rating, 4.5);
    assert.equal(snapshot.reviewCount, 295);
    assert.equal(snapshot.websiteStatus, "verified_no_standalone_website");
    assert.equal(fingerprintVerifiedFactSnapshot(snapshot), fingerprintVerifiedFactSnapshot(repeated));
  });

  it("warns only when material verified facts change", () => {
    const snapshot = createVerifiedFactSnapshot(lead);
    assert.deepEqual(compareVerifiedFactSnapshot(snapshot, { ...snapshot }), []);
    assert.equal(compareVerifiedFactSnapshot(snapshot, { ...snapshot, phone: "(954) 555-0196" }).length, 1);
    assert.equal(compareVerifiedFactSnapshot(snapshot, { ...snapshot, hours: "New hours" }).length, 1);
    assert.equal(compareVerifiedFactSnapshot(snapshot, { ...snapshot, address: "500 New Road" }).length, 1);
    assert.equal(compareVerifiedFactSnapshot(snapshot, { ...snapshot, businessName: "Display Name" }).length, 0);
  });

  it("blocks approval unless validation, build, and Vercel-controlled target pass", () => {
    const snapshot = createVerifiedFactSnapshot(lead);
    const checked = validateExternalSiteSource({
      provider: "lovable",
      controlledPreviewUrl: null,
      providerPreviewUrl: null,
      manifest: fixtureManifest,
    });
    const metadata = buildExternalSiteMetadata({
      provider: "lovable",
      importedAt: "2026-08-30T00:00:00.000Z",
      snapshot,
      currentSnapshot: snapshot,
      validation: checked.validation,
      build: checked.build,
    });
    assert.equal(canApproveExternalGeneratedSite(metadata).ok, false);
    assert.equal(getExternalPreviewTarget(metadata), null);

    const operatorSupplied = {
      ...metadata,
      controlledPreviewUrl: "https://operator-supplied.vercel.app",
      deploymentStatus: "deployed" as const,
    };
    assert.equal(canApproveExternalGeneratedSite(operatorSupplied).ok, false);
    assert.equal(getExternalPreviewTarget(operatorSupplied), null);

    const deployed = {
      ...metadata,
      controlledPreviewUrl: "https://mariposa-siteforge-preview.vercel.app",
      deploymentUrl: "https://mariposa-siteforge-preview.vercel.app",
      deploymentStatus: "deployed" as const,
      deploymentId: "dpl_123",
    };
    assert.deepEqual(canApproveExternalGeneratedSite(deployed), { ok: true });
    assert.equal(getExternalPreviewTarget(deployed), "https://mariposa-siteforge-preview.vercel.app");
  });

  it("keeps provider preview URL as optional metadata and never as the public target", () => {
    const snapshot = createVerifiedFactSnapshot(lead);
    const checked = validateExternalSiteSource({
      provider: "lovable",
      controlledPreviewUrl: null,
      providerPreviewUrl: "https://preview.lovable.app/projects/sample",
      manifest: fixtureManifest,
    });
    const metadata = buildExternalSiteMetadata({
      provider: "lovable",
      providerPreviewUrl: "https://preview.lovable.app/projects/sample",
      importedAt: "2026-08-30T00:00:00.000Z",
      snapshot,
      currentSnapshot: snapshot,
      validation: checked.validation,
      build: checked.build,
    });

    assert.equal(metadata.providerPreviewUrl, "https://preview.lovable.app/projects/sample");
    assert.equal(metadata.controlledPreviewUrl, null);
    assert.equal(metadata.deploymentUrl, null);
    assert.equal(getExternalPreviewTarget(metadata), null);
  });
});

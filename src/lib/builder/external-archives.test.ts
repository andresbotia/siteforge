import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { deflateRawSync } from "node:zlib";

import {
  createExternalSourceArchiveArtifact,
  validateExternalSourceArchive,
  buildExternalSourceArtifact,
  type BuildCommandRunner,
} from "./external-artifacts";
import {
  EXTERNAL_ARCHIVE_LIMITS,
  extractExternalSourceArchiveToDirectory,
  inspectExternalSourceArchive,
} from "./external-archives";

const tanstackPackageJson = {
  scripts: { build: "vite build" },
  dependencies: {
    "@tanstack/react-start": "latest",
    react: "latest",
    "react-dom": "latest",
    vite: "latest",
  },
  devDependencies: {
    "@lovable.dev/vite-tanstack-config": "latest",
  },
};

describe("external source ZIP archives", () => {
  it("accepts Lovable-style TanStack/Vite ZIP exports with binary assets", async () => {
    const archive = zip([
      [".gitignore", "node_modules\n"],
      [".prettierignore", "dist\n"],
      [".prettierrc", "{ \"printWidth\": 100 }\n"],
      ["package.json", JSON.stringify(tanstackPackageJson)],
      ["bun.lock", ""],
      ["vite.config.ts", "export default {}"],
      ["src/routes/__root.tsx", "export const Route = {}"],
      ["src/routeTree.gen.ts", "export const routeTree = {}"],
      ["src/assets/hero-pupusas.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xdb])],
      ["public/favicon.ico", Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00])],
    ]);
    const checked = validateExternalSourceArchive({
      provider: "lovable",
      controlledPreviewUrl: null,
      providerPreviewUrl: "https://antojitos-crafted-visuals.lovable.app",
      archive,
    });

    assert.equal(checked.validation.ok, true);
    assert.equal(checked.validation.packageSummary.framework, "vite-tanstack-start");
    assert.equal(checked.validation.packageSummary.packageManager, "bun");
    assert.equal(checked.validation.packageSummary.lockfiles.includes("bun.lock"), true);
    assert.equal(checked.validation.findings.some((finding) => finding.code === "unsupported_archive_file_type"), false);
    assert.equal(checked.build.command, "bun install --frozen-lockfile --ignore-scripts && bun run build");

    const artifact = createExternalSourceArchiveArtifact({
      id: "artifact-zip",
      generatedWebsiteId: "website-zip",
      leadId: "lead-zip",
      provider: "lovable",
      archive,
      archiveFileName: "lovable-export.zip",
      storagePath: "lead-zip/website-zip/artifact-zip/lovable-export.zip",
      importedAt: "2026-08-31T00:00:00.000Z",
      validation: checked.validation,
      build: checked.build,
    });
    assert.equal(artifact.manifest.sourceType, "zip_archive");
    assert.equal(artifact.manifest.assetCount, 2);
    assert.equal(artifact.manifest.files.some((file) => file.path === "src/assets/hero-pupusas.jpg" && file.binary), true);

    const commands: string[] = [];
    const runner: BuildCommandRunner = async (input) => {
      commands.push([input.command, ...input.args].join(" "));
      if (input.command === "bun" && input.args.join(" ") === "run build") {
        const out = join(input.cwd, ".output", "public");
        await mkdir(out, { recursive: true });
        await writeFile(join(out, "index.html"), "<main>Built Antojitos preview</main>");
        await writeFile(join(out, "hero-pupusas.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xdb]));
      }
      return { ok: true, exitCode: 0, stdout: "", stderr: "" };
    };

    const built = await buildExternalSourceArtifact({ artifact, archiveBuffer: archive, runner });

    assert.equal(built.ok, true);
    assert.deepEqual(commands, ["bun install --frozen-lockfile --ignore-scripts", "bun run build"]);
  });

  it("extracts binary assets without corrupting bytes", async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);
    const archive = zip([["public/photo.jpg", bytes]]);
    const root = await mkdtemp(join(tmpdir(), "siteforge-zip-test-"));
    try {
      await extractExternalSourceArchiveToDirectory(archive, root);
      assert.deepEqual(await readFile(join(root, "public", "photo.jpg")), bytes);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects unsafe paths, symlinks, nested archives, spoofed binaries, and compression abuse", () => {
    const cases: Array<[string, Buffer, string]> = [
      ["traversal", zip([["../secret.ts", "export {}"]]), "unsafe_archive_path"],
      ["absolute", zip([["C:/secret.ts", "export {}"]]), "unsafe_archive_path"],
      ["nested archive", zip([["source.zip", "zip"]]), "unsupported_archive_file_type"],
      ["unknown extensionless", zip([["deploy", "echo no"]]), "unsupported_archive_file_type"],
      ["symlink", zip([["src/link.ts", "target"]], { unixMode: 0o120000 }), "archive_symlink"],
      ["spoofed jpg", zip([["src/assets/photo.jpg", "not-a-jpeg"]]), "invalid_binary_signature"],
      ["compression", zip([["src/large.txt", "x".repeat(1_100_000)]], { deflate: true }), "suspicious_compression_ratio"],
    ];

    for (const [, archive, code] of cases) {
      const result = inspectExternalSourceArchive(archive);
      assert.equal(result.findings.some((finding) => finding.code === code), true, code);
    }
  });

  it("enforces bounded file counts", () => {
    const archive = zip(
      Array.from({ length: EXTERNAL_ARCHIVE_LIMITS.maxFiles + 1 }, (_, index) => [
        `src/file-${index}.ts`,
        "export {}",
      ]),
    );
    const result = inspectExternalSourceArchive(archive);
    assert.equal(result.ok, false);
    assert.equal(result.findings.some((finding) => finding.code === "invalid_archive_file_count"), true);
  });
});

function zip(
  entries: Array<[string, string | Buffer]>,
  options: { deflate?: boolean; unixMode?: number } = {},
): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, raw] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const content = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, "utf8");
    const compressed = options.deflate ? deflateRawSync(content) : content;
    const method = options.deflate ? 8 : 0;
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.byteLength, 18);
    local.writeUInt32LE(content.byteLength, 22);
    local.writeUInt16LE(nameBytes.byteLength, 26);
    localParts.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.byteLength, 20);
    central.writeUInt32LE(content.byteLength, 24);
    central.writeUInt16LE(nameBytes.byteLength, 28);
    central.writeUInt32LE(((options.unixMode ?? 0o100644) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.byteLength + nameBytes.byteLength + compressed.byteLength;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.byteLength, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

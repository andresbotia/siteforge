import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { inflateRawSync } from "node:zlib";

export const EXTERNAL_SOURCE_ARCHIVE_BUCKET = "external-site-artifacts";

export const EXTERNAL_ARCHIVE_LIMITS = {
  maxArchiveBytes: 10_000_000,
  maxFiles: 160,
  maxFileBytes: 5_000_000,
  maxTotalBytes: 25_000_000,
  maxCompressionRatio: 100,
} as const;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const SAFE_FILE_PATH = /^[A-Za-z0-9._/@+-]+$/;
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".svg", ".txt", ".md", ".toml", ".lock"]);
const EXACT_TEXT_FILENAMES = new Set([".gitignore", ".prettierignore", ".prettierrc"]);
const BINARY_SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  ".png": (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".jpg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  ".jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  ".webp": (bytes) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP",
  ".gif": (bytes) => bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a",
  ".ico": (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00])),
  ".woff": (bytes) => bytes.subarray(0, 4).toString("ascii") === "wOFF",
  ".woff2": (bytes) => bytes.subarray(0, 4).toString("ascii") === "wOF2",
  ".ttf": (bytes) =>
    bytes.subarray(0, 4).equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) ||
    bytes.subarray(0, 4).toString("ascii") === "true" ||
    bytes.subarray(0, 4).toString("ascii") === "typ1",
};
const ALLOWED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...Object.keys(BINARY_SIGNATURES)]);
const NESTED_ARCHIVE_OR_EXECUTABLE = /\.(zip|tar|gz|tgz|7z|rar|exe|dll|so|dylib|sh|bat|cmd|ps1)$/i;

export type ExternalArchiveFinding = {
  code: string;
  severity: "warning" | "severe";
  message: string;
  path?: string;
};

export type ExternalArchiveFile = {
  path: string;
  bytes: number;
  compressedBytes: number;
  sha256: string;
  extension: string | null;
  binary: boolean;
  content?: string;
};

export type ExternalArchiveInspection = {
  ok: boolean;
  findings: ExternalArchiveFinding[];
  files: ExternalArchiveFile[];
  packageJson: Record<string, unknown> | null;
  totalBytes: number;
  archiveBytes: number;
  archiveSha256: string;
  assetCount: number;
};

type ZipEntry = {
  path: string;
  flags: number;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  externalAttributes: number;
};

export function inspectExternalSourceArchive(archive: Buffer): ExternalArchiveInspection {
  const findings: ExternalArchiveFinding[] = [];
  if (archive.byteLength === 0 || archive.byteLength > EXTERNAL_ARCHIVE_LIMITS.maxArchiveBytes) {
    findings.push({ code: "archive_too_large", severity: "severe", message: "ZIP archive exceeds the external source upload limit." });
  }
  const entries = readZipEntries(archive, findings);
  if (entries.length === 0 || entries.length > EXTERNAL_ARCHIVE_LIMITS.maxFiles) {
    findings.push({ code: "invalid_archive_file_count", severity: "severe", message: "ZIP archive must contain a bounded number of files." });
  }

  const files: ExternalArchiveFile[] = [];
  let totalBytes = 0;
  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry.path.endsWith("/")) continue;
    const path = normalizeArchivePath(entry.path);
    if (!isSafeRelativePath(path)) {
      findings.push({ code: "unsafe_archive_path", severity: "severe", message: "ZIP entries must be safe relative paths.", path });
      continue;
    }
    if (seen.has(path)) {
      findings.push({ code: "duplicate_archive_path", severity: "severe", message: "ZIP archive contains duplicate source paths.", path });
      continue;
    }
    seen.add(path);
    const extension = extensionFor(path);
    if (!isAllowedArchiveTextOrBinaryPath(path, extension)) {
      findings.push({ code: "unsupported_archive_file_type", severity: "severe", message: "ZIP entry file type is not allowlisted.", path });
    }
    if (NESTED_ARCHIVE_OR_EXECUTABLE.test(path)) {
      findings.push({ code: "unsupported_archive_payload", severity: "severe", message: "Executables, shell scripts, and nested archives are not accepted.", path });
    }
    if (isSymlinkLike(entry.externalAttributes)) {
      findings.push({ code: "archive_symlink", severity: "severe", message: "Symlinks and special files are not accepted in ZIP archives.", path });
      continue;
    }
    if (entry.uncompressedSize > EXTERNAL_ARCHIVE_LIMITS.maxFileBytes) {
      findings.push({ code: "archive_file_too_large", severity: "severe", message: "ZIP entry exceeds the per-file size limit.", path });
    }
    if (
      entry.compressedSize > 0 &&
      entry.uncompressedSize > 1_000_000 &&
      entry.uncompressedSize / entry.compressedSize > EXTERNAL_ARCHIVE_LIMITS.maxCompressionRatio
    ) {
      findings.push({ code: "suspicious_compression_ratio", severity: "severe", message: "ZIP entry compression ratio is too high.", path });
    }
    totalBytes += entry.uncompressedSize;
    if (totalBytes > EXTERNAL_ARCHIVE_LIMITS.maxTotalBytes) {
      findings.push({ code: "archive_contents_too_large", severity: "severe", message: "ZIP archive expands beyond the import limit.", path });
    }

    const contentBytes = extractZipEntry(archive, entry, findings);
    if (!contentBytes) continue;
    const binary = Boolean(extension && BINARY_SIGNATURES[extension]);
    const text = binary ? undefined : decodeTextFile(contentBytes, path, findings);
    if (binary && extension && !BINARY_SIGNATURES[extension](contentBytes)) {
      findings.push({ code: "invalid_binary_signature", severity: "severe", message: "Binary asset does not match its declared file type.", path });
    }
    if (!binary && text !== undefined && hasBinaryControlCharacters(text)) {
      findings.push({ code: "unexpected_binary_blob", severity: "severe", message: "Text source contains binary control characters.", path });
    }
    files.push({
      path,
      bytes: contentBytes.byteLength,
      compressedBytes: entry.compressedSize,
      sha256: sha256(contentBytes),
      extension,
      binary,
      content: text,
    });
  }

  const packageFile = files.find((file) => file.path === "package.json" && typeof file.content === "string");
  return {
    ok: !findings.some((finding) => finding.severity === "severe"),
    findings,
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    packageJson: readPackageJson(packageFile?.content),
    totalBytes,
    archiveBytes: archive.byteLength,
    archiveSha256: sha256(archive),
    assetCount: files.filter((file) => file.binary).length,
  };
}

export async function extractExternalSourceArchiveToDirectory(archive: Buffer, root: string): Promise<void> {
  const findings: ExternalArchiveFinding[] = [];
  const entries = readZipEntries(archive, findings);
  if (findings.some((finding) => finding.severity === "severe")) throw new Error("invalid_archive");
  const resolvedRoot = resolve(root);
  for (const entry of entries) {
    if (entry.path.endsWith("/")) continue;
    const path = normalizeArchivePath(entry.path);
    if (!isSafeRelativePath(path) || isSymlinkLike(entry.externalAttributes)) throw new Error("unsafe_archive_entry");
    const bytes = extractZipEntry(archive, entry, findings);
    if (!bytes || findings.some((finding) => finding.severity === "severe")) throw new Error("invalid_archive_entry");
    const target = resolve(resolvedRoot, path);
    if (!target.startsWith(resolvedRoot + sep)) throw new Error("unsafe_archive_path");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}

function readZipEntries(archive: Buffer, findings: ExternalArchiveFinding[]): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(archive);
  if (eocdOffset < 0) {
    findings.push({ code: "invalid_zip", severity: "severe", message: "ZIP archive is missing its central directory." });
    return [];
  }
  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  const directorySize = archive.readUInt32LE(eocdOffset + 12);
  const directoryOffset = archive.readUInt32LE(eocdOffset + 16);
  if (directoryOffset + directorySize > archive.byteLength) {
    findings.push({ code: "invalid_zip_directory", severity: "severe", message: "ZIP central directory is outside the archive bounds." });
    return [];
  }
  const entries: ZipEntry[] = [];
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > archive.byteLength || archive.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      findings.push({ code: "invalid_zip_directory", severity: "severe", message: "ZIP central directory entry is malformed." });
      return entries;
    }
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const externalAttributes = archive.readUInt32LE(offset + 38);
    const localHeaderOffset = archive.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > archive.byteLength) {
      findings.push({ code: "invalid_zip_path", severity: "severe", message: "ZIP entry path is malformed." });
      return entries;
    }
    const path = archive.subarray(nameStart, nameEnd).toString(flags & 0x0800 ? "utf8" : "utf8");
    if (flags & 0x0001) {
      findings.push({ code: "encrypted_zip_entry", severity: "severe", message: "Encrypted ZIP entries are not accepted.", path });
    }
    if (method !== 0 && method !== 8) {
      findings.push({ code: "unsupported_zip_compression", severity: "severe", message: "ZIP entry uses an unsupported compression method.", path });
    }
    entries.push({ path, flags, method, compressedSize, uncompressedSize, localHeaderOffset, externalAttributes });
    offset = nameEnd + extraLength + commentLength;
  }
  return entries;
}

function extractZipEntry(archive: Buffer, entry: ZipEntry, findings: ExternalArchiveFinding[]): Buffer | null {
  const offset = entry.localHeaderOffset;
  if (offset + 30 > archive.byteLength || archive.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
    findings.push({ code: "invalid_zip_entry", severity: "severe", message: "ZIP local file header is malformed.", path: entry.path });
    return null;
  }
  const nameLength = archive.readUInt16LE(offset + 26);
  const extraLength = archive.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > archive.byteLength) {
    findings.push({ code: "invalid_zip_entry_bounds", severity: "severe", message: "ZIP entry data is outside archive bounds.", path: entry.path });
    return null;
  }
  const data = archive.subarray(dataStart, dataEnd);
  try {
    const extracted = entry.method === 0 ? Buffer.from(data) : inflateRawSync(data);
    if (extracted.byteLength !== entry.uncompressedSize) {
      findings.push({ code: "zip_size_mismatch", severity: "severe", message: "ZIP entry size metadata does not match extracted bytes.", path: entry.path });
      return null;
    }
    return extracted;
  } catch {
    findings.push({ code: "zip_decompression_failed", severity: "severe", message: "ZIP entry could not be decompressed.", path: entry.path });
    return null;
  }
}

function findEndOfCentralDirectory(archive: Buffer): number {
  const min = Math.max(0, archive.byteLength - 65_557);
  for (let offset = archive.byteLength - 22; offset >= min; offset -= 1) {
    if (archive.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

function normalizeArchivePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "").trim();
}

function isSafeRelativePath(path: string): boolean {
  return Boolean(path) && path.length <= 180 && SAFE_FILE_PATH.test(path) && !path.startsWith("/") && !path.includes("..") && !/^[A-Za-z]:/.test(path);
}

function extensionFor(path: string): string | null {
  const match = path.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? null;
}

function isAllowedArchiveTextOrBinaryPath(path: string, extension: string | null): boolean {
  const fileName = path.replace(/\\/g, "/").split("/").pop() ?? path;
  return EXACT_TEXT_FILENAMES.has(fileName) || Boolean(extension && ALLOWED_EXTENSIONS.has(extension));
}

function isSymlinkLike(externalAttributes: number): boolean {
  const unixMode = (externalAttributes >>> 16) & 0xffff;
  if (!unixMode) return false;
  return (unixMode & 0o170000) !== 0o100000 && (unixMode & 0o170000) !== 0o040000;
}

function decodeTextFile(bytes: Buffer, path: string, findings: ExternalArchiveFinding[]): string | undefined {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    findings.push({ code: "invalid_utf8_text", severity: "severe", message: "Text source file must be valid UTF-8.", path });
    return undefined;
  }
}

function readPackageJson(content: string | undefined): Record<string, unknown> | null {
  if (!content) return null;
  try {
    const value = JSON.parse(content) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function hasBinaryControlCharacters(content: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content);
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

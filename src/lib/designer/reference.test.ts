import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  DESIGNER_REFERENCE_KINDS,
  boundDesignMarkdown,
  DESIGN_MARKDOWN_MAX_CHARS,
  readCategoryReferenceFromDisk,
  resolveDesignerReference,
} from "./reference";

describe("designer reference architecture", () => {
  it("names all four reference kinds the architecture is scoped to support", () => {
    assert.deepEqual([...DESIGNER_REFERENCE_KINDS].sort(), ["approved_master", "category_reference", "gold_standard", "prior_revision"].sort());
  });

  it("with no category, or an unrecognized category, resolves to the gold-standard reference", () => {
    assert.equal(resolveDesignerReference().kind, "gold_standard");
    assert.equal(resolveDesignerReference({ category: "totally_unmapped_category" }).kind, "gold_standard");
  });
});

describe("boundDesignMarkdown", () => {
  it("leaves short content untouched", () => {
    assert.equal(boundDesignMarkdown("  # Title\n\nShort content.  "), "# Title\n\nShort content.");
  });

  it("truncates content beyond the bound and says so", () => {
    const huge = "x".repeat(DESIGN_MARKDOWN_MAX_CHARS + 500);
    const bounded = boundDesignMarkdown(huge);
    assert.ok(bounded.length < huge.length);
    assert.match(bounded, /truncated/);
  });
});

describe("readCategoryReferenceFromDisk (scratch-directory tests -- never touch the real reference files)", () => {
  function scratchDir(): string {
    return mkdtempSync(join(tmpdir(), "siteforge-design-reference-"));
  }

  function writeReference(dir: string, slug: string, metadata: Record<string, unknown>, designMd: string): void {
    const refDir = join(dir, slug);
    mkdirSync(refDir, { recursive: true });
    writeFileSync(join(refDir, "metadata.json"), JSON.stringify(metadata));
    writeFileSync(join(refDir, "DESIGN.md"), designMd);
  }

  it("resolves an approved reference with bounded DESIGN.md content", () => {
    const dir = scratchDir();
    writeReference(
      dir,
      "approved-example",
      { id: "category-approved-example-v1", title: "Approved Example", category: "approved_example", approvalStatus: "approved", reviewedBy: "test-reviewer", approvedAt: "2026-01-01" },
      "# Design intent\n\nSome approved principles.",
    );

    const resolved = readCategoryReferenceFromDisk("approved-example", dir);
    assert.ok(resolved);
    assert.equal(resolved!.kind, "category_reference");
    assert.equal(resolved!.designMarkdown, "# Design intent\n\nSome approved principles.");
    assert.deepEqual(resolved!.approval, { reviewedBy: "test-reviewer", approvedAt: "2026-01-01" });

    rmSync(dir, { recursive: true, force: true });
  });

  it("never resolves a pending_human_review reference -- an unreviewed reference cannot masquerade as approved", () => {
    const dir = scratchDir();
    writeReference(dir, "pending-example", { id: "x", title: "x", category: "x", approvalStatus: "pending_human_review", reviewedBy: null, approvedAt: null }, "# Not yet approved");

    assert.equal(readCategoryReferenceFromDisk("pending-example", dir), null);
    rmSync(dir, { recursive: true, force: true });
  });

  it("never resolves a rejected reference", () => {
    const dir = scratchDir();
    writeReference(dir, "rejected-example", { id: "x", title: "x", category: "x", approvalStatus: "rejected", reviewedBy: "someone", approvedAt: "2026-01-01" }, "# Rejected");

    assert.equal(readCategoryReferenceFromDisk("rejected-example", dir), null);
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails closed (null) rather than throwing when metadata.json or DESIGN.md is missing/malformed", () => {
    const dir = scratchDir();
    assert.equal(readCategoryReferenceFromDisk("does-not-exist", dir), null);

    mkdirSync(join(dir, "malformed"), { recursive: true });
    writeFileSync(join(dir, "malformed", "metadata.json"), "not json");
    assert.equal(readCategoryReferenceFromDisk("malformed", dir), null);

    rmSync(dir, { recursive: true, force: true });
  });

  it("bounds an oversized DESIGN.md before it is returned", () => {
    const dir = scratchDir();
    writeReference(dir, "huge", { id: "x", title: "x", category: "x", approvalStatus: "approved", reviewedBy: "r", approvedAt: "2026-01-01" }, "x".repeat(DESIGN_MARKDOWN_MAX_CHARS + 1000));

    const resolved = readCategoryReferenceFromDisk("huge", dir);
    assert.ok(resolved);
    assert.ok(resolved!.designMarkdown!.length <= DESIGN_MARKDOWN_MAX_CHARS + 200);
    assert.match(resolved!.designMarkdown!, /truncated/);

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("the real professional-services-editorial reference on disk", () => {
  const referenceDir = join(process.cwd(), "src", "lib", "designer", "references", "professional-services-editorial");
  const metadata = JSON.parse(readFileSync(join(referenceDir, "metadata.json"), "utf8")) as { approvalStatus: string; category: string };

  it("contains no Sabal Point-specific business facts", () => {
    const markdown = readFileSync(join(referenceDir, "DESIGN.md"), "utf8");
    for (const forbidden of ["Sabal Point", "Boca Raton", "555-0148", "1900 NW Corporate"]) {
      assert.doesNotMatch(markdown, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("resolveDesignerReference()'s behavior matches this file's actual current approval state", () => {
    const resolved = resolveDesignerReference({ category: metadata.category });
    if (metadata.approvalStatus === "approved") {
      assert.equal(resolved.kind, "category_reference");
      assert.ok(resolved.designMarkdown);
    } else {
      // An AI agent authored this file in this same session; it has not
      // been human-reviewed yet, so it must never be live.
      assert.equal(resolved.kind, "gold_standard");
    }
  });
});

describe("Designer reference architecture stays isolated from the legacy Builder registry", () => {
  it("reference.ts never imports src/lib/builder", () => {
    const source = readFileSync(join(process.cwd(), "src", "lib", "designer", "reference.ts"), "utf8");
    assert.doesNotMatch(source, /@\/lib\/builder/);
  });
});

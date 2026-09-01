import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { locateClaudeCli } from "./cli";

describe("designer CLI discovery", () => {
  it("prefers an explicit SITEFORGE_CLAUDE_CLI_PATH override when it exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "siteforge-cli-test-"));
    const fakeCli = join(dir, "claude.exe");
    writeFileSync(fakeCli, "");
    try {
      const located = locateClaudeCli({ SITEFORGE_CLAUDE_CLI_PATH: fakeCli });
      assert.deepEqual(located, { path: fakeCli, source: "env_override" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores an override that does not exist on disk rather than trusting it blindly", () => {
    const located = locateClaudeCli({ SITEFORGE_CLAUDE_CLI_PATH: "C:\\definitely\\not\\a\\real\\path\\claude.exe", PATH: "" });
    assert.notEqual(located?.path, "C:\\definitely\\not\\a\\real\\path\\claude.exe");
  });

  it("returns null when nothing is configured or discoverable", () => {
    const located = locateClaudeCli({ PATH: "", USERPROFILE: undefined, HOME: undefined });
    assert.equal(located, null);
  });
});

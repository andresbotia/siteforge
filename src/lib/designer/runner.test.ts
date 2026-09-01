import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";

import { runDesignerWorker } from "./runner";

type FakeChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: (chunk: string) => void; end: () => void };
  kill: () => void;
  killed: boolean;
};

function createFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.stdin = { write: () => {}, end: () => {} };
  child.kill = () => {
    child.killed = true;
  };
  return child;
}

const baseOptions = {
  cliPath: "C:\\fake\\claude.exe",
  workspaceDir: "C:\\fake\\workspace",
  sessionId: "job-1",
  systemPromptAppend: "system",
  userPrompt: "user prompt",
};

describe("designer worker runner", () => {
  it("resolves ok on a clean exit", async () => {
    let captured: { command: string; args: string[] } | null = null;
    const fakeSpawn = ((command: string, args: string[]) => {
      captured = { command, args };
      const child = createFakeChild();
      queueMicrotask(() => {
        child.stdout.emit("data", Buffer.from("{}"));
        child.emit("close", 0);
      });
      return child;
    }) as unknown as typeof import("node:child_process").spawn;

    const result = await runDesignerWorker({ ...baseOptions, timeoutMs: 5_000, spawnImpl: fakeSpawn });
    assert.equal(result.ok, true);
    assert.equal(captured?.command, baseOptions.cliPath);
    // Confirms the security-relevant flags are always present: restricted,
    // no Bash/WebFetch tools, confined to the job workspace, no session
    // persistence, and never --bare / --dangerously-skip-permissions.
    assert.equal(captured?.args.includes("--restricted"), true);
    assert.equal(captured?.args.includes("--bare"), false);
    assert.equal(captured?.args.includes("--dangerously-skip-permissions"), false);
    assert.equal(captured?.args.includes("--add-dir"), true);
    assert.equal(captured?.args[captured.args.indexOf("--add-dir") + 1], baseOptions.workspaceDir);
    const toolsIndex = captured?.args.indexOf("--tools") ?? -1;
    assert.equal(captured?.args[toolsIndex + 1], "Read,Write,Edit,Glob,Grep");
  });

  it("classifies a non-zero exit mentioning authentication as auth_unavailable, not a generic failure", async () => {
    const fakeSpawn = (() => {
      const child = createFakeChild();
      queueMicrotask(() => {
        child.stderr.emit("data", Buffer.from("Error: not logged in. Please run `claude login`."));
        child.emit("close", 1);
      });
      return child;
    }) as unknown as typeof import("node:child_process").spawn;

    const result = await runDesignerWorker({ ...baseOptions, timeoutMs: 5_000, spawnImpl: fakeSpawn });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.failureCode, "auth_unavailable");
  });

  it("classifies an API-key/billing message as api_billing_required so it never silently spends money", async () => {
    const fakeSpawn = (() => {
      const child = createFakeChild();
      queueMicrotask(() => {
        child.stderr.emit("data", Buffer.from("ANTHROPIC_API_KEY is required for this billing mode."));
        child.emit("close", 1);
      });
      return child;
    }) as unknown as typeof import("node:child_process").spawn;

    const result = await runDesignerWorker({ ...baseOptions, timeoutMs: 5_000, spawnImpl: fakeSpawn });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.failureCode, "api_billing_required");
  });

  it("classifies overload/rate-limit messages as subscription_capacity_unavailable", async () => {
    const fakeSpawn = (() => {
      const child = createFakeChild();
      queueMicrotask(() => {
        child.stderr.emit("data", Buffer.from("Error: overloaded, usage limit reached for this session."));
        child.emit("close", 1);
      });
      return child;
    }) as unknown as typeof import("node:child_process").spawn;

    const result = await runDesignerWorker({ ...baseOptions, timeoutMs: 5_000, spawnImpl: fakeSpawn });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.failureCode, "subscription_capacity_unavailable");
  });

  it("classifies a structured 429 session-limit result as subscription_capacity_unavailable, not unknown", async () => {
    // Discovered via a real production Designer Worker run: the CLI's own
    // --output-format json result reported api_error_status:429 and
    // result:"You've hit your session limit · resets 1pm (America/New_York)"
    // -- text that contains none of "rate limit"/"usage limit"/"capacity"/
    // "overloaded", so prose matching alone missed it and returned
    // "unknown" instead of the fail-closed capacity signal.
    const fakeSpawn = (() => {
      const child = createFakeChild();
      queueMicrotask(() => {
        child.stdout.emit(
          "data",
          Buffer.from(
            JSON.stringify({
              is_error: true,
              terminal_reason: "api_error",
              api_error_status: 429,
              result: "You've hit your session limit · resets 1pm (America/New_York)",
            }),
          ),
        );
        child.emit("close", 1);
      });
      return child;
    }) as unknown as typeof import("node:child_process").spawn;

    const result = await runDesignerWorker({ ...baseOptions, timeoutMs: 5_000, spawnImpl: fakeSpawn });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.failureCode, "subscription_capacity_unavailable");
  });

  it("still classifies structured auth/billing errors correctly, and falls back to unknown only when nothing matches", async () => {
    const authSpawn = (() => {
      const child = createFakeChild();
      queueMicrotask(() => {
        child.stdout.emit("data", Buffer.from(JSON.stringify({ is_error: true, api_error_status: 401, result: "Not logged in." })));
        child.emit("close", 1);
      });
      return child;
    }) as unknown as typeof import("node:child_process").spawn;
    const authResult = await runDesignerWorker({ ...baseOptions, timeoutMs: 5_000, spawnImpl: authSpawn });
    assert.equal(authResult.ok, false);
    if (!authResult.ok) assert.equal(authResult.failureCode, "auth_unavailable");

    const unknownSpawn = (() => {
      const child = createFakeChild();
      queueMicrotask(() => {
        child.stderr.emit("data", Buffer.from("some totally unrelated crash with no recognizable signal"));
        child.emit("close", 1);
      });
      return child;
    }) as unknown as typeof import("node:child_process").spawn;
    const unknownResult = await runDesignerWorker({ ...baseOptions, timeoutMs: 5_000, spawnImpl: unknownSpawn });
    assert.equal(unknownResult.ok, false);
    if (!unknownResult.ok) assert.equal(unknownResult.failureCode, "unknown");
  });

  it("kills the process and fails closed with failureCode timeout when the run exceeds its budget", async () => {
    const fakeSpawn = (() => createFakeChild()) as unknown as typeof import("node:child_process").spawn;
    const result = await runDesignerWorker({ ...baseOptions, timeoutMs: 20, spawnImpl: fakeSpawn });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.failureCode, "timeout");
  });
});

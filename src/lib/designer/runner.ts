import { spawn } from "node:child_process";
import { buildDesignerWorkerEnvironment, boundLog } from "./security";
import type { DesignerFailureCode } from "./state-machine";

export type DesignerRunResult =
  | { ok: true; stdout: string; stderr: string; durationMs: number }
  | { ok: false; failureCode: DesignerFailureCode; reason: string; stdout: string; stderr: string; durationMs: number };

export type DesignerRunOptions = {
  cliPath: string;
  workspaceDir: string;
  sessionId: string;
  systemPromptAppend: string;
  userPrompt: string;
  model?: string;
  timeoutMs: number;
  /** Injection point for tests; defaults to the real Node.js child_process.spawn. */
  spawnImpl?: typeof spawn;
};

/**
 * Invokes the Claude Code CLI once, non-interactively, confined to the job
 * workspace. Flags below are only ones confirmed against `claude --help`
 * output captured from the locally installed CLI (Claude Code 2.1.252) in
 * this session -- see HANDOFF.md for the full --help transcript.
 *
 * Deliberately NOT used:
 *   --bare                    its own --help text says OAuth/keychain auth is
 *                              never read in that mode, only ANTHROPIC_API_KEY
 *                              or apiKeyHelper -- using it would silently
 *                              require API billing, which this worker must
 *                              never do.
 *   --dangerously-skip-permissions / --allow-dangerously-skip-permissions
 *                              --restricted already refuses bypassPermissions;
 *                              we do not need or want a bypass.
 *   Bash / WebFetch / WebSearch tools
 *                              excluded via --tools so the worker can only
 *                              read/write/search inside its own workspace.
 *                              SiteForge's own already-audited build pipeline
 *                              (external-artifacts.ts) installs and builds the
 *                              worker's output afterward with fixed commands,
 *                              rather than letting the agent run its own
 *                              shell commands.
 */
export function runDesignerWorker(options: DesignerRunOptions): Promise<DesignerRunResult> {
  const spawnFn = options.spawnImpl ?? spawn;
  const args = [
    "-p",
    "--output-format",
    "json",
    "--permission-mode",
    "acceptEdits",
    "--restricted",
    "--add-dir",
    options.workspaceDir,
    "--tools",
    "Read,Write,Edit,Glob,Grep",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--session-id",
    options.sessionId,
    "--append-system-prompt",
    options.systemPromptAppend,
  ];
  if (options.model) args.push("--model", options.model);

  const startedAt = Date.now();
  return new Promise((resolvePromise) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let child: ReturnType<typeof spawn>;
    try {
      child = spawnFn(options.cliPath, args, {
        cwd: options.workspaceDir,
        env: buildDesignerWorkerEnvironment(),
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      resolvePromise({
        ok: false,
        failureCode: "cli_not_found",
        reason: error instanceof Error ? error.message : "spawn_failed",
        stdout: "",
        stderr: "",
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolvePromise({
        ok: false,
        failureCode: "timeout",
        reason: `Designer Worker exceeded ${options.timeoutMs}ms and was terminated.`,
        stdout: boundLog(stdout),
        stderr: boundLog(stderr),
        durationMs: Date.now() - startedAt,
      });
    }, options.timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({
        ok: false,
        failureCode: "process_error",
        reason: error.message,
        stdout: boundLog(stdout),
        stderr: boundLog(stderr),
        durationMs: Date.now() - startedAt,
      });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      if (code !== 0) {
        resolvePromise({
          ok: false,
          failureCode: classifyFailure(stderr, stdout),
          reason: `Designer Worker exited with code ${code}.`,
          stdout: boundLog(stdout),
          stderr: boundLog(stderr),
          durationMs,
        });
        return;
      }
      resolvePromise({ ok: true, stdout: boundLog(stdout), stderr: boundLog(stderr), durationMs });
    });

    child.stdin?.write(options.userPrompt, "utf8");
    child.stdin?.end();
  });
}

/**
 * Fail-closed classification: any signal that the CLI wants to bill an API
 * key, needs authentication, or is capacity-limited must never be retried
 * automatically or silently treated as a generic failure.
 */
function classifyFailure(stderr: string, stdout: string): DesignerFailureCode {
  const text = `${stderr}\n${stdout}`.toLowerCase();
  if (text.includes("not logged in") || text.includes("authentication") || text.includes("please run") && text.includes("login")) {
    return "auth_unavailable";
  }
  if (text.includes("api key") || text.includes("anthropic_api_key") || text.includes("billing")) {
    return "api_billing_required";
  }
  if (text.includes("overloaded") || text.includes("rate limit") || text.includes("capacity") || text.includes("usage limit")) {
    return "subscription_capacity_unavailable";
  }
  return "unknown";
}

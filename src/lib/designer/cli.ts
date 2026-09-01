import { existsSync, readdirSync } from "node:fs";
import { delimiter, join } from "node:path";
import { spawn } from "node:child_process";
import { buildDesignerWorkerEnvironment } from "./security";

export type ClaudeCliLocation = {
  path: string;
  source: "env_override" | "path" | "vscode_extension_bundle" | "claude_local_install";
};

/**
 * Locates the Claude Code CLI without assuming it is on PATH. This machine's
 * `claude` is not on PATH (verified during this session); the working
 * binary was found bundled inside the VS Code extension at
 * resources/native-binary/claude.exe. Search order:
 *   1. SITEFORGE_CLAUDE_CLI_PATH (explicit operator override)
 *   2. PATH (claude / claude.exe / claude.cmd)
 *   3. Native standalone install at ~/.claude/local/claude(.exe)
 *   4. The newest anthropic.claude-code-* VS Code extension's bundled binary
 * Never assumes flags exist; runner.ts only uses flags confirmed against
 * `claude --help` output captured in this session (Claude Code 2.1.252).
 */
export function locateClaudeCli(env: Record<string, string | undefined> = process.env): ClaudeCliLocation | null {
  const override = env.SITEFORGE_CLAUDE_CLI_PATH?.trim();
  if (override && existsSync(override)) return { path: override, source: "env_override" };

  const onPath = findOnPath(process.platform === "win32" ? ["claude.exe", "claude.cmd", "claude"] : ["claude"], env);
  if (onPath) return { path: onPath, source: "path" };

  const home = env.USERPROFILE ?? env.HOME;
  if (home) {
    const localInstall = join(home, ".claude", "local", process.platform === "win32" ? "claude.exe" : "claude");
    if (existsSync(localInstall)) return { path: localInstall, source: "claude_local_install" };

    const bundled = findNewestVscodeExtensionBinary(home);
    if (bundled) return { path: bundled, source: "vscode_extension_bundle" };
  }

  return null;
}

function findOnPath(fileNames: string[], env: Record<string, string | undefined>): string | null {
  const pathValue = env.Path ?? env.PATH ?? "";
  for (const part of pathValue.split(delimiter)) {
    if (!part) continue;
    for (const fileName of fileNames) {
      const candidate = join(part, fileName);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function findNewestVscodeExtensionBinary(home: string): string | null {
  const extensionsDir = join(home, ".vscode", "extensions");
  let entries: string[];
  try {
    entries = readdirSync(extensionsDir);
  } catch {
    return null;
  }
  const candidates = entries
    .filter((name) => name.startsWith("anthropic.claude-code-"))
    .sort()
    .reverse();
  for (const name of candidates) {
    const binary = join(
      extensionsDir,
      name,
      "resources",
      "native-binary",
      process.platform === "win32" ? "claude.exe" : "claude",
    );
    if (existsSync(binary)) return binary;
  }
  return null;
}

export type ClaudeAuthHealth =
  | { ok: true; loggedIn: true; subscriptionAuth: true; subscriptionType: string | null }
  | { ok: true; loggedIn: true; subscriptionAuth: false; reason: string }
  | { ok: false; loggedIn: false; reason: string };

/**
 * Confirms the CLI is logged in via the operator's Claude subscription
 * (authMethod "claude.ai" / apiProvider "firstParty"), not an API key. This
 * intentionally discards email/orgId/orgName/projectsDirectory from `claude
 * auth status` -- SiteForge never persists that account-identifying detail,
 * only the health booleans a job needs.
 */
export async function checkClaudeAuthHealth(cliPath: string, timeoutMs = 15_000): Promise<ClaudeAuthHealth> {
  const result = await runCliCommand(cliPath, ["auth", "status"], timeoutMs);
  if (!result.ok) return { ok: false, loggedIn: false, reason: result.reason };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return { ok: false, loggedIn: false, reason: "auth_status_unparseable" };
  }
  if (parsed.loggedIn !== true) {
    return { ok: false, loggedIn: false, reason: "not_logged_in" };
  }
  if (parsed.authMethod === "claude.ai" && parsed.apiProvider === "firstParty") {
    return {
      ok: true,
      loggedIn: true,
      subscriptionAuth: true,
      subscriptionType: typeof parsed.subscriptionType === "string" ? parsed.subscriptionType : null,
    };
  }
  return {
    ok: true,
    loggedIn: true,
    subscriptionAuth: false,
    reason: `auth method "${String(parsed.authMethod)}" is not the subscription session; refusing to avoid API billing.`,
  };
}

export async function checkClaudeCliVersion(cliPath: string, timeoutMs = 10_000): Promise<{ ok: true; version: string } | { ok: false; reason: string }> {
  const result = await runCliCommand(cliPath, ["--version"], timeoutMs);
  if (!result.ok) return { ok: false, reason: result.reason };
  const version = result.stdout.trim();
  return version ? { ok: true, version } : { ok: false, reason: "empty_version_output" };
}

function runCliCommand(
  cliPath: string,
  args: string[],
  timeoutMs: number,
): Promise<{ ok: true; stdout: string } | { ok: false; reason: string }> {
  return new Promise((resolvePromise) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(cliPath, args, {
        cwd: process.cwd(),
        env: buildDesignerWorkerEnvironment(),
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolvePromise({ ok: false, reason: error instanceof Error ? error.message : "spawn_failed" });
      return;
    }
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolvePromise({ ok: false, reason: "timeout" });
    }, timeoutMs);
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
      resolvePromise({ ok: false, reason: error.message });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolvePromise({ ok: false, reason: `exit_${code}: ${stderr.slice(0, 300)}` });
        return;
      }
      resolvePromise({ ok: true, stdout });
    });
  });
}

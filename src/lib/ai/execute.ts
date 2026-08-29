import "server-only";

import { requireAdminSession } from "@/lib/auth/guard";
import { mutateTable, createServerSupabaseClient } from "@/lib/supabase/server";
import { parseTicks } from "./money";
import {
  createLiveXaiProvider,
  isLiveXaiEnabled,
  isXaiKeyConfigured,
  type AiChatRequest,
  type AiProvider,
  type AiProviderResult,
} from "./provider";
import { parseProviderUsage } from "./usage";

/**
 * Execute a paid AI run that already has an approved dollar ceiling.
 * Authorization and budget reservation happen inside the database RPCs.
 * There is no bypass helper such as callXai(prompt).
 *
 * Live inference requires XAI_ALLOW_LIVE_INFERENCE=true. Default is off.
 * Approving a run does not call this function.
 */
export async function executeApprovedAiRun(
  runId: string,
  request: AiChatRequest,
  provider?: AiProvider,
) {
  await requireAdminSession();

  const selected =
    provider ?? (isLiveXaiEnabled() ? createLiveXaiProvider() : null);
  if (!selected) {
    return { ok: false as const, reason: "Live xAI inference is disabled" };
  }
  if (!provider && !isXaiKeyConfigured()) {
    return { ok: false as const, reason: "XAI_API_KEY is not configured" };
  }

  const client = createServerSupabaseClient();
  if (!client) return { ok: false as const, reason: "supabase_not_configured" };

  const reserved = await client.rpc("siteforge_reserve_ai_run", {
    p_run_id: runId,
  });
  if (reserved.error) {
    return { ok: false as const, reason: reserved.error.code ?? "reserve_failed" };
  }
  const payload = reserved.data as { ok?: boolean; reason?: string } | null;
  if (!payload?.ok) {
    const reason = payload?.reason ?? "reserve_failed";
    if (
      reason === "daily_budget_exhausted" ||
      reason === "monthly_budget_exhausted" ||
      reason === "per_run_ceiling"
    ) {
      await logAiEvent("budget_blocked", "Paid AI run blocked by budget", reason, {
        run_id: runId,
        reason,
      });
    }
    return { ok: false as const, reason };
  }

  await logAiEvent("budget_reserved", "Paid AI budget reserved", runId, {
    run_id: runId,
  });
  await logAiEvent("ai_run_started", "Paid AI run started", runId, {
    run_id: runId,
    model: request.model,
  });

  let result: AiProviderResult;
  try {
    result = await selected.complete(request);
  } catch (error) {
    result = {
      ok: false,
      text: null,
      usage: parseProviderUsage(null),
      raw: null,
      error: error instanceof Error ? error.name : "provider_threw",
    };
  }

  const actual = result.usage.costTicks ?? 0n;
  const usage = {
    input_tokens: result.usage.inputTokens,
    cached_input_tokens: result.usage.cachedInputTokens,
    output_tokens: result.usage.outputTokens,
    reasoning_tokens: result.usage.reasoningTokens,
    tool_calls: result.usage.toolCalls,
    cost_in_usd_ticks: result.usage.costTicks
      ? result.usage.costTicks.toString()
      : null,
  };

  const finalizeArgs = {
    p_run_id: runId,
    p_success: result.ok,
    p_actual_ticks: actual.toString(),
    p_failure_reason: result.ok ? null : (result.error ?? "provider_failed"),
    p_usage: usage,
  };

  let finalized = await client.rpc("siteforge_finalize_ai_run", finalizeArgs);
  if (finalized.error) {
    finalized = await client.rpc("siteforge_finalize_ai_run", finalizeArgs);
  }
  if (finalized.error) {
    return { ok: false as const, reason: finalized.error.code ?? "finalize_failed" };
  }

  if (result.ok) {
    await logAiEvent("ai_run_completed", "Paid AI run completed", runId, {
      run_id: runId,
      cost_in_usd_ticks: actual.toString(),
    });
    return { ok: true as const, actualTicks: actual };
  }

  await logAiEvent("ai_run_failed", "Paid AI run failed", runId, {
    run_id: runId,
    reason: result.error ?? "provider_failed",
    cost_in_usd_ticks: actual.toString(),
  });
  return { ok: false as const, reason: result.error ?? "provider_failed" };
}

async function logAiEvent(
  eventType: string,
  title: string,
  description: string,
  metadata: Record<string, string>,
) {
  await mutateTable((client) =>
    client
      .from("activity_events")
      .insert({
        event_type: eventType,
        actor_type: "system",
        title,
        description,
        metadata,
      })
      .select("id")
      .maybeSingle(),
  );
}

export function parseRpcTicks(value: unknown) {
  return parseTicks(value);
}

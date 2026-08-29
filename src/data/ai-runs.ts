import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { estimateAiCost } from "@/lib/ai/estimate";
import { AI_PROVIDER, DEFAULT_XAI_MODEL, PER_RUN_CEILING_TICKS } from "@/lib/ai/limits";
import { minTicks, ticksToUsd } from "@/lib/ai/money";
import { mutateTable, readTable } from "@/lib/supabase/server";
import type { AgentId } from "@/types";
import type { AgentRow, AgentRunRow, ApprovalRow } from "@/types/database";

/**
 * Create an awaiting_approval run and a pending paid_ai_usage approval.
 * Does not call xAI. Agents are not wired to this helper yet.
 */
export async function requestPaidAiRun(input: {
  agentId: AgentId;
  purpose: string;
  model?: string;
  inputTokens: number;
  maxOutputTokens: number;
  leadId?: string;
}): Promise<{ ok: true; runId: string; approvalId: string } | { ok: false; error: string }> {
  const estimate = estimateAiCost({
    model: input.model ?? DEFAULT_XAI_MODEL,
    inputTokens: input.inputTokens,
    maxOutputTokens: input.maxOutputTokens,
  });
  const requested = minTicks(
    estimate.conservativeMaxTicks,
    PER_RUN_CEILING_TICKS[input.agentId],
  );
  if (requested <= 0n) {
    return { ok: false, error: "Estimated maximum must be greater than zero." };
  }

  const agent = await readTable<Pick<AgentRow, "id" | "slug"> | null>((client) =>
    client.from("agents").select("id, slug").eq("slug", input.agentId).maybeSingle(),
  );
  if (!agent) return { ok: false, error: "Agent record was not found." };

  const run = await mutateTable<AgentRunRow | null>((client) =>
    client
      .from("agent_runs")
      .insert({
        agent_id: agent.id,
        lead_id: input.leadId ?? null,
        status: "awaiting_approval",
        trigger_type: "manual",
        provider: AI_PROVIDER,
        model: estimate.model,
        purpose: input.purpose,
        estimated_cost_ticks: estimate.estimatedTicks.toString(),
        estimated_cost_usd: ticksToUsd(estimate.estimatedTicks),
        approved_cost_limit_ticks: 0,
        input: {
          input_tokens: input.inputTokens,
          max_output_tokens: input.maxOutputTokens,
        },
      })
      .select("*")
      .maybeSingle(),
  );
  if (!run) return { ok: false, error: "Could not create the agent run." };

  const approval = await mutateTable<ApprovalRow | null>((client) =>
    client
      .from("approvals")
      .insert({
        agent_run_id: run.id,
        lead_id: input.leadId ?? null,
        approval_type: "paid_ai_usage",
        status: "pending",
        title: `Authorize paid xAI usage for ${input.agentId}`,
        description: input.purpose,
        estimated_cost_usd: ticksToUsd(estimate.estimatedTicks),
        requested_cost_ticks: requested.toString(),
        approved_cost_limit_ticks: 0,
        payload: {
          agent_slug: input.agentId,
          risk_level: "medium",
          model: estimate.model,
          purpose: input.purpose,
          estimated_cost_ticks: estimate.estimatedTicks.toString(),
          requested_cost_ticks: requested.toString(),
          pricing_version: estimate.pricingVersion,
        },
      })
      .select("*")
      .maybeSingle(),
  );
  if (!approval) return { ok: false, error: "Could not create the paid AI approval." };

  await recordActivityEvent({
    eventType: "ai_run_requested",
    title: "Paid AI run requested",
    description: input.purpose,
    actorType: "admin",
    metadata: { run_id: run.id, model: estimate.model },
  });
  await recordActivityEvent({
    eventType: "paid_ai_approval_created",
    title: "Paid AI approval created",
    description: input.purpose,
    actorType: "admin",
    metadata: { approval_id: approval.id, run_id: run.id },
  });

  return { ok: true, runId: run.id, approvalId: approval.id };
}

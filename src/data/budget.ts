import "server-only";

import {
  DEFAULT_XAI_MODEL,
  GLOBAL_DAILY_LIMIT_TICKS,
  GLOBAL_MONTHLY_LIMIT_TICKS,
  PER_RUN_CEILING_TICKS,
} from "@/lib/ai/limits";
import { formatTicksAsUsd, parseTicks, type Ticks } from "@/lib/ai/money";
import { isLiveXaiEnabled, isXaiKeyConfigured } from "@/lib/ai/provider-core";
import { agentName } from "@/lib/labels";
import { readTable } from "@/lib/supabase/server";
import type { AgentId, AiCostControlsView } from "@/types";

export type LiveBudgetSnapshot = {
  dailyLimitTicks: Ticks;
  monthlyLimitTicks: Ticks;
  dailyActualTicks: Ticks;
  monthlyActualTicks: Ticks;
  reservedTicks: Ticks;
  perRunCeilingTicks: Record<AgentId, Ticks>;
  xaiConfigured: boolean;
  liveInferenceEnabled: boolean;
};

export type CostControlsView = AiCostControlsView;

type LimitRow = {
  daily_limit_ticks: number | string;
  monthly_limit_ticks: number | string;
  per_run_ceiling_ticks: Record<string, unknown> | null;
};

type SpendRow = {
  actual_cost_ticks: number | string | null;
  completed_at: string | null;
  started_at: string | null;
  created_at: string;
};
type ReservationRow = { reserved_ticks: number | string; status: string };

export async function getBudgetSnapshot(): Promise<LiveBudgetSnapshot> {
  const [limits, runs, reservations] = await Promise.all([
    readTable<LimitRow | null>((client) =>
      client.from("ai_budget_limits").select("*").eq("id", 1).maybeSingle(),
    ),
    readTable<SpendRow[]>((client) =>
      client
        .from("agent_runs")
        .select("actual_cost_ticks, completed_at, started_at, created_at"),
    ),
    readTable<ReservationRow[]>((client) =>
      client
        .from("ai_budget_reservations")
        .select("reserved_ticks, status")
        .eq("status", "reserved"),
    ),
  ]);

  const now = new Date();
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

  let dailyActual = 0n;
  let monthlyActual = 0n;
  for (const run of runs ?? []) {
    const ticks = parseTicks(run.actual_cost_ticks);
    if (ticks <= 0n) continue;
    const stamp = Date.parse(run.completed_at ?? run.started_at ?? run.created_at);
    if (stamp >= dayStart) dailyActual += ticks;
    if (stamp >= monthStart) monthlyActual += ticks;
  }

  const reserved = (reservations ?? []).reduce(
    (sum, row) => sum + parseTicks(row.reserved_ticks),
    0n,
  );

  return {
    dailyLimitTicks: limits
      ? parseTicks(limits.daily_limit_ticks)
      : GLOBAL_DAILY_LIMIT_TICKS,
    monthlyLimitTicks: limits
      ? parseTicks(limits.monthly_limit_ticks)
      : GLOBAL_MONTHLY_LIMIT_TICKS,
    dailyActualTicks: dailyActual,
    monthlyActualTicks: monthlyActual,
    reservedTicks: reserved,
    perRunCeilingTicks: PER_RUN_CEILING_TICKS,
    xaiConfigured: isXaiKeyConfigured(),
    liveInferenceEnabled: isLiveXaiEnabled(),
  };
}

export function toCostControlsView(snapshot: LiveBudgetSnapshot): CostControlsView {
  const dailyUsed = snapshot.dailyActualTicks + snapshot.reservedTicks;
  const monthlyUsed = snapshot.monthlyActualTicks + snapshot.reservedTicks;
  return {
    provider: "xAI",
    defaultModel: DEFAULT_XAI_MODEL,
    apiKeyConfigured: snapshot.xaiConfigured,
    liveInferenceEnabled: snapshot.liveInferenceEnabled,
    paidApprovalsRequired: true,
    automaticPaidSpending: false,
    dailyLimitUsd: formatTicksAsUsd(snapshot.dailyLimitTicks),
    monthlyLimitUsd: formatTicksAsUsd(snapshot.monthlyLimitTicks),
    dailyActualUsd: formatTicksAsUsd(snapshot.dailyActualTicks),
    monthlyActualUsd: formatTicksAsUsd(snapshot.monthlyActualTicks),
    reservedUsd: formatTicksAsUsd(snapshot.reservedTicks),
    dailyUsedUsd: formatTicksAsUsd(dailyUsed),
    monthlyUsedUsd: formatTicksAsUsd(monthlyUsed),
    perRunCeilings: (Object.keys(snapshot.perRunCeilingTicks) as AgentId[]).map(
      (agentId) => ({
        agentId,
        label: agentName[agentId],
        amountUsd: formatTicksAsUsd(snapshot.perRunCeilingTicks[agentId]),
      }),
    ),
  };
}

export function toApprovalsBudgetView(snapshot: LiveBudgetSnapshot) {
  return {
    dailyLimitTicks: snapshot.dailyLimitTicks.toString(),
    monthlyLimitTicks: snapshot.monthlyLimitTicks.toString(),
    dailyActualTicks: snapshot.dailyActualTicks.toString(),
    monthlyActualTicks: snapshot.monthlyActualTicks.toString(),
    reservedTicks: snapshot.reservedTicks.toString(),
  };
}

import "server-only";

import { agentCatalog, isAgentId } from "@/lib/agents/catalog";
import { readTable } from "@/lib/supabase/server";
import type { Agent, AgentPermission } from "@/types";
import type { AgentRow, AgentRunRow } from "@/types/database";

export async function listAgents(): Promise<Agent[]> {
  const [rows, runs] = await Promise.all([
    readTable<AgentRow[]>((client) =>
      client.from("agents").select("*").order("name", { ascending: true }),
    ),
    readTable<
      Pick<AgentRunRow, "agent_id" | "status" | "actual_cost_usd" | "started_at">[]
    >((client) =>
      client
        .from("agent_runs")
        .select("agent_id, status, actual_cost_usd, started_at"),
    ),
  ]);

  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const preferred = ["scout", "auditor", "builder", "sales", "manager"] as const;
  const mapped = (rows ?? []).flatMap((row) => {
    if (!isAgentId(row.slug)) return [];
    const catalog = agentCatalog[row.slug];
    const agentRuns = (runs ?? []).filter((run) => run.agent_id === row.id);
    const todayRuns = agentRuns.filter(
      (run) => run.started_at && new Date(run.started_at) >= startOfToday,
    );
    const completed = agentRuns.filter((run) => run.status === "completed");
    const last = [...agentRuns].sort((a, b) =>
      (b.started_at ?? "").localeCompare(a.started_at ?? ""),
    )[0];

    return [
      {
        id: row.slug,
        name: row.name,
        status: row.enabled ? ("inactive" as const) : ("not_configured" as const),
        purpose: catalog.purpose,
        description: row.description ?? catalog.description,
        capabilities: catalog.capabilities,
        restrictions: catalog.restrictions,
        runsToday: todayRuns.length,
        successRate:
          agentRuns.length === 0 ? null : completed.length / agentRuns.length,
        costToday: todayRuns.reduce(
          (sum, run) => sum + Number(run.actual_cost_usd ?? 0),
          0,
        ),
        lastRun: last?.started_at ?? null,
      },
    ];
  });

  return mapped.sort(
    (a, b) => preferred.indexOf(a.id) - preferred.indexOf(b.id),
  );
}

export function listAgentPermissions(): AgentPermission[] {
  return (Object.keys(agentCatalog) as Array<keyof typeof agentCatalog>).map(
    (agentId) => ({
      agentId,
      ...agentCatalog[agentId].permissions,
    }),
  );
}

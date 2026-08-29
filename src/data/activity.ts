import "server-only";

import { mutateTable, readTable } from "@/lib/supabase/server";
import type { AgentId, AgentRun, LeadActivity } from "@/types";
import type { ActivityRow, AgentRow, AgentRunRow, Json } from "@/types/database";
import { isAgentId } from "@/lib/agents/catalog";

export async function recordActivityEvent(input: {
  eventType: string;
  title: string;
  description?: string;
  actorType?: string;
  metadata?: Json;
}): Promise<void> {
  await mutateTable((client) =>
    client
      .from("activity_events")
      .insert({
        event_type: input.eventType,
        actor_type: input.actorType ?? "admin",
        title: input.title,
        description: input.description ?? null,
        metadata: input.metadata ?? {},
      })
      .select("id")
      .maybeSingle(),
  );
}

export async function listActivityForLead(
  leadId: string,
): Promise<LeadActivity[]> {
  const rows = await readTable<ActivityRow[]>((client) =>
    client
      .from("activity_events")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false }),
  );

  return (rows ?? []).map((row) => ({
    id: row.id,
    leadId: row.lead_id ?? leadId,
    timestamp: row.created_at,
    title: row.title,
    detail: row.description ?? "",
  }));
}

export async function listRecentAgentRuns(): Promise<AgentRun[]> {
  const [runs, agents] = await Promise.all([
    readTable<AgentRunRow[]>((client) =>
      client
        .from("agent_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12),
    ),
    readTable<Pick<AgentRow, "id" | "slug">[]>((client) =>
      client.from("agents").select("id, slug"),
    ),
  ]);

  const slugById = new Map((agents ?? []).map((agent) => [agent.id, agent.slug]));

  return (runs ?? []).flatMap((run) => {
    const slug = slugById.get(run.agent_id);
    if (!slug || !isAgentId(slug)) return [];
    const output = run.output as { summary?: string } | null;
    return [
      {
        id: run.id,
        agentId: slug,
        leadId: run.lead_id ?? undefined,
        status: run.status as AgentRun["status"],
        startedAt: run.started_at ?? run.created_at,
        completedAt: run.completed_at,
        cost: Number(run.actual_cost_usd ?? run.estimated_cost_usd ?? 0),
        summary:
          (output && typeof output.summary === "string" && output.summary) ||
          `${slug} run ${run.status}`,
      },
    ];
  });
}

export async function getAgentSpend() {
  const [runs, agents] = await Promise.all([
    readTable<
      Pick<
        AgentRunRow,
        "agent_id" | "actual_cost_usd" | "estimated_cost_usd" | "started_at"
      >[]
    >((client) =>
      client
        .from("agent_runs")
        .select("agent_id, actual_cost_usd, estimated_cost_usd, started_at"),
    ),
    readTable<Pick<AgentRow, "id" | "slug">[]>((client) =>
      client.from("agents").select("id, slug"),
    ),
  ]);

  const slugById = new Map((agents ?? []).map((agent) => [agent.id, agent.slug]));
  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const breakdown: Record<AgentId, number> = {
    scout: 0,
    auditor: 0,
    builder: 0,
    sales: 0,
    manager: 0,
  };
  let today = 0;
  let thisMonth = 0;

  for (const run of runs ?? []) {
    const slug = slugById.get(run.agent_id);
    if (!slug || !isAgentId(slug)) continue;
    const amount = Number(run.actual_cost_usd ?? run.estimated_cost_usd ?? 0);
    const started = run.started_at ? new Date(run.started_at) : null;
    if (started && started >= startOfMonth) {
      thisMonth += amount;
      breakdown[slug] += amount;
    }
    if (started && started >= startOfToday) {
      today += amount;
    }
  }

  return {
    today,
    thisMonth,
    breakdown: (Object.keys(breakdown) as AgentId[]).map((agentId) => ({
      agentId,
      amount: breakdown[agentId],
    })),
  };
}

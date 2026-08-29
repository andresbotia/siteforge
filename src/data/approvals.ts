import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { isAgentId } from "@/lib/agents/catalog";
import { parseTicks, ticksToUsdNumber } from "@/lib/ai/money";
import { asRecord } from "@/lib/json";
import { mutateTable, readTable } from "@/lib/supabase/server";
import type { AgentId, Approval, ApprovalStatus, ApprovalType, RiskLevel } from "@/types";
import type { ApprovalRow, LeadRow } from "@/types/database";

const approvalTypes = new Set<ApprovalType>([
  "website_deployment",
  "external_email",
  "website_modification",
  "payment_action",
  "paid_ai_usage",
  "dns_change",
  "destructive_infrastructure_action",
]);

const approvalStatuses = new Set<ApprovalStatus>([
  "pending",
  "approved",
  "rejected",
  "expired",
  "executed",
  "failed",
]);

const risks = new Set<RiskLevel>(["low", "medium", "high"]);

export async function listApprovals(): Promise<Approval[]> {
  const [rows, leads] = await Promise.all([
    readTable<ApprovalRow[]>((client) =>
      client
        .from("approvals")
        .select("*")
        .order("requested_at", { ascending: false }),
    ),
    readTable<Pick<LeadRow, "id" | "business_name">[]>((client) =>
      client.from("leads").select("id, business_name"),
    ),
  ]);

  const nameById = new Map(
    (leads ?? []).map((lead) => [lead.id, lead.business_name]),
  );

  return (rows ?? []).map((row) => {
    const payload = asRecord(row.payload);
    const slug = typeof payload.agent_slug === "string" ? payload.agent_slug : "";
    const risk =
      typeof payload.risk_level === "string" ? payload.risk_level : "medium";

    const estimatedTicks = parseTicks(payload.estimated_cost_ticks);
    const requestedTicks = parseTicks(
      payload.requested_cost_ticks ?? row.requested_cost_ticks,
    );
    return {
      id: row.id,
      leadId: row.lead_id ?? undefined,
      agentRunId: row.agent_run_id ?? undefined,
      businessName: row.lead_id
        ? (nameById.get(row.lead_id) ?? "Unknown business")
        : row.approval_type === "paid_ai_usage"
          ? "Paid AI usage"
          : "Unknown business",
      agentId: isAgentId(slug) ? slug : ("sales" as AgentId),
      type: approvalTypes.has(row.approval_type as ApprovalType)
        ? (row.approval_type as ApprovalType)
        : "website_deployment",
      requestedAction: row.title,
      reason: row.description ?? "",
      status: approvalStatuses.has(row.status as ApprovalStatus)
        ? (row.status as ApprovalStatus)
        : "pending",
      riskLevel: risks.has(risk as RiskLevel) ? (risk as RiskLevel) : "medium",
      model: typeof payload.model === "string" ? payload.model : null,
      purpose: typeof payload.purpose === "string" ? payload.purpose : row.description,
      estimatedCostUsd:
        row.estimated_cost_usd ??
        (estimatedTicks > 0n ? ticksToUsdNumber(estimatedTicks) : null),
      requestedMaxUsd:
        requestedTicks > 0n ? ticksToUsdNumber(requestedTicks) : null,
      approvedCostLimitUsd: row.approved_cost_limit_usd,
      actualCostUsd: row.actual_cost_usd,
      createdAt: row.requested_at,
      approvedAt: row.resolved_at ?? undefined,
    };
  });
}

export async function listPendingApprovals(): Promise<Approval[]> {
  const all = await listApprovals();
  return all.filter((item) => item.status === "pending");
}

async function recordActivity(eventType: string, title: string, description: string) {
  await recordActivityEvent({ eventType, title, description, actorType: "admin" });
}

export async function rejectApproval(id: string): Promise<{ ok: boolean; error?: string }> {
  const rows = await mutateTable<ApprovalRow[] | null>((client) =>
    client
      .from("approvals")
      .update({
        status: "rejected",
        resolved_at: new Date().toISOString(),
        resolved_by: "admin",
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*"),
  );
  const row = rows?.[0];
  if (!row) return { ok: false, error: "Approval is no longer pending." };

  if (row.agent_run_id && row.approval_type === "paid_ai_usage") {
    await mutateTable((client) =>
      client
        .from("agent_runs")
        .update({ status: "rejected" })
        .eq("id", row.agent_run_id!)
        .eq("status", "awaiting_approval")
        .select("id")
        .maybeSingle(),
    );
    await recordActivity(
      "paid_ai_rejected",
      "Paid AI usage rejected",
      row.title,
    );
  }
  return { ok: true };
}

export async function approvePaidAiUsage(
  id: string,
  approvedLimitTicks: bigint,
): Promise<{ ok: boolean; error?: string }> {
  if (approvedLimitTicks <= 0n) {
    return { ok: false, error: "Approved maximum must be greater than zero." };
  }

  const current = await readTable<ApprovalRow | null>((client) =>
    client.from("approvals").select("*").eq("id", id).maybeSingle(),
  );
  if (!current || current.status !== "pending") {
    return { ok: false, error: "Approval is no longer pending." };
  }
  if (current.approval_type !== "paid_ai_usage") {
    return { ok: false, error: "This approval is not paid AI usage." };
  }

  const requested = parseTicks(current.requested_cost_ticks);
  if (requested > 0n && approvedLimitTicks > requested) {
    return {
      ok: false,
      error: "Approved maximum cannot exceed the requested ceiling.",
    };
  }

  const usd = ticksToUsdNumber(approvedLimitTicks);
  const rows = await mutateTable<ApprovalRow[] | null>((client) =>
    client
      .from("approvals")
      .update({
        status: "approved",
        approved_cost_limit_ticks: approvedLimitTicks.toString(),
        approved_cost_limit_usd: usd,
        resolved_at: new Date().toISOString(),
        resolved_by: "admin",
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*"),
  );
  const row = rows?.[0];
  if (!row) return { ok: false, error: "Approval could not be updated." };

  if (row.agent_run_id) {
    await mutateTable((client) =>
      client
        .from("agent_runs")
        .update({
          status: "approved",
          approved_cost_limit_ticks: approvedLimitTicks.toString(),
        })
        .eq("id", row.agent_run_id!)
        .eq("status", "awaiting_approval")
        .select("id")
        .maybeSingle(),
    );
  }

  await recordActivity(
    "paid_ai_approved",
    "Paid AI usage approved",
    row.title,
  );
  return { ok: true };
}

export async function approveGenericApproval(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const current = await readTable<ApprovalRow | null>((client) =>
    client.from("approvals").select("*").eq("id", id).maybeSingle(),
  );
  if (!current || current.status !== "pending") {
    return { ok: false, error: "Approval is no longer pending." };
  }
  if (current.approval_type === "paid_ai_usage") {
    return { ok: false, error: "Paid AI approvals require an explicit dollar ceiling." };
  }
  const rows = await mutateTable<ApprovalRow[] | null>((client) =>
    client
      .from("approvals")
      .update({
        status: "approved",
        resolved_at: new Date().toISOString(),
        resolved_by: "admin",
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*"),
  );
  return rows?.[0] ? { ok: true } : { ok: false, error: "Approval could not be updated." };
}


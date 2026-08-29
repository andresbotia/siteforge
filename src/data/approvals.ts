import { isAgentId } from "@/lib/agents/catalog";
import { asRecord } from "@/lib/json";
import { readTable } from "@/lib/supabase/server";
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

    return {
      id: row.id,
      leadId: row.lead_id ?? undefined,
      businessName: row.lead_id
        ? (nameById.get(row.lead_id) ?? "Unknown business")
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
      estimatedCostUsd: row.estimated_cost_usd,
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

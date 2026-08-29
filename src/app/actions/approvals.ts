"use server";

import { revalidatePath } from "next/cache";
import {
  approveGenericApproval,
  approvePaidAiUsage,
  rejectApproval,
} from "@/data/approvals";
import { usdToTicks } from "@/lib/ai/money";

export type ApprovalActionState = { ok: boolean; error?: string } | null;

export async function rejectApprovalAction(
  _prev: ApprovalActionState,
  formData: FormData,
): Promise<ApprovalActionState> {
  const id = String(formData.get("approvalId") ?? "");
  if (!id) return { ok: false, error: "Missing approval." };
  const result = await rejectApproval(id);
  if (result.ok) {
    revalidatePath("/approvals");
    revalidatePath("/agents");
  }
  return result;
}

export async function approveApprovalAction(
  _prev: ApprovalActionState,
  formData: FormData,
): Promise<ApprovalActionState> {
  const id = String(formData.get("approvalId") ?? "");
  const type = String(formData.get("approvalType") ?? "");
  if (!id) return { ok: false, error: "Missing approval." };

  if (type === "paid_ai_usage") {
    const maxUsd = Number(formData.get("maxUsd"));
    if (!Number.isFinite(maxUsd) || maxUsd <= 0) {
      return { ok: false, error: "Enter a maximum authorization greater than zero." };
    }
    const result = await approvePaidAiUsage(id, usdToTicks(maxUsd));
    if (result.ok) {
      revalidatePath("/approvals");
      revalidatePath("/agents");
      revalidatePath("/settings");
    }
    return result;
  }

  const result = await approveGenericApproval(id);
  if (result.ok) revalidatePath("/approvals");
  return result;
}

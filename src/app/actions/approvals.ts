"use server";

import { revalidatePath } from "next/cache";
import {
  approveGenericApproval,
  approvePaidAiUsage,
  rejectApproval,
} from "@/data/approvals";
import { approvePreviewPublicationApproval } from "@/data/previews";
import { approveExternalPreviewDeploymentApproval, isExternalPreviewDeploymentApprovalPayload } from "@/data/external-sites";
import { usdToTicks } from "@/lib/ai/money";

export type ApprovalActionState =
  | { ok: boolean; error?: string; publicPath?: string }
  | null;

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
  const payloadAction = String(formData.get("approvalPayloadAction") ?? "");
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

  if (type === "website_deployment" && payloadAction === "public_preview_publication") {
    const result = await approvePreviewPublicationApproval(id);
    if (result.ok) {
      revalidatePath("/approvals");
      revalidatePath("/websites");
    }
    return result;
  }

  if (type === "website_deployment" && isExternalPreviewDeploymentApprovalPayload({ action: payloadAction })) {
    const result = await approveExternalPreviewDeploymentApproval(id);
    if (result.ok) {
      revalidatePath("/approvals");
      revalidatePath("/websites");
    }
    return result;
  }

  if (type === "external_email" && payloadAction === "send_outreach_email") {
    const { approveOutreachSendApproval } = await import("@/data/outreach");
    const result = await approveOutreachSendApproval(id);
    if (result.ok) {
      revalidatePath("/approvals");
      revalidatePath("/outreach");
    }
    return result;
  }

  if (type === "payment_action" && payloadAction === "create_stripe_checkout_session") {
    const { approveCommercialOfferApproval } = await import("@/data/payments");
    const result = await approveCommercialOfferApproval(id);
    if (result.ok) {
      revalidatePath("/approvals");
      revalidatePath("/offers");
    }
    return result;
  }

  const result = await approveGenericApproval(id);
  if (result.ok) revalidatePath("/approvals");
  return result;
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requestOutreachSendApproval,
  sendApprovedOutreach,
  updateOutreachDraft,
} from "@/data/outreach";
import { startSalesDraftRun } from "@/data/sales";

export type SalesActionState = { ok: boolean; error?: string; outreachId?: string } | null;

export async function startSalesDraftAction(
  _prev: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  const recipientEmailOverride = String(formData.get("recipientEmail") ?? "").trim() || undefined;

  if (!leadId) return { ok: false, error: "Missing lead." };

  const result = await startSalesDraftRun({
    leadId,
    recipientEmailOverride,
  });

  if (!result.ok) return result;

  revalidatePath("/agents/sales");
  revalidatePath("/outreach");
  revalidatePath(`/leads/${leadId}`);
  redirect(`/outreach/${result.outreachId}`);
}

export async function updateOutreachDraftAction(
  _prev: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  const id = String(formData.get("outreachId") ?? "");
  const subject = String(formData.get("subject") ?? "");
  const body = String(formData.get("body") ?? "");
  const recipientEmail = String(formData.get("recipientEmail") ?? "");

  if (!id) return { ok: false, error: "Missing outreach ID." };

  const result = await updateOutreachDraft({
    id,
    subject,
    body,
    recipientEmail,
  });

  if (result.ok) {
    revalidatePath(`/outreach/${id}`);
    revalidatePath("/outreach");
    revalidatePath("/approvals");
  }

  return result;
}

export async function requestOutreachSendApprovalAction(
  _prev: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  const outreachId = String(formData.get("outreachId") ?? "");
  if (!outreachId) return { ok: false, error: "Missing outreach ID." };

  const result = await requestOutreachSendApproval(outreachId);
  if (result.ok) {
    revalidatePath(`/outreach/${outreachId}`);
    revalidatePath("/outreach");
    revalidatePath("/approvals");
  }
  return result;
}

export async function sendApprovedOutreachAction(
  _prev: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  const outreachId = String(formData.get("outreachId") ?? "");
  if (!outreachId) return { ok: false, error: "Missing outreach ID." };

  const result = await sendApprovedOutreach(outreachId);
  if (result.ok) {
    revalidatePath(`/outreach/${outreachId}`);
    revalidatePath("/outreach");
    revalidatePath("/approvals");
  }
  return result;
}

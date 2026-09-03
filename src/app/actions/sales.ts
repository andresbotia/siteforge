"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requestOutreachSendApproval,
  sendApprovedOutreach,
  updateOutreachDraft,
} from "@/data/outreach";
import { startFollowUpDraftRun, startSalesDraftRun } from "@/data/sales";
import { requireAdminSession } from "@/lib/auth/guard";

export type SalesActionState = { ok: boolean; error?: string; outreachId?: string } | null;

/** M9.9 payment follow-up draft. Deterministic, $0, and still fully approval-gated before any send. */
export async function startFollowUpDraftAction(
  _prev: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  await requireAdminSession();
  const offerId = String(formData.get("offerId") ?? "");
  const recipientEmailOverride = String(formData.get("recipientEmail") ?? "").trim() || undefined;
  if (!offerId) return { ok: false, error: "Missing offer." };

  const result = await startFollowUpDraftRun({ offerId, recipientEmailOverride });
  if (!result.ok) return result;

  revalidatePath("/outreach");
  revalidatePath(`/offers/${offerId}`);
  redirect(`/outreach/${result.outreachId}`);
}

export async function startSalesDraftAction(
  _prev: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  await requireAdminSession();
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
  await requireAdminSession();
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
  await requireAdminSession();
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
  await requireAdminSession();
  const outreachId = String(formData.get("outreachId") ?? "");
  if (!outreachId) return { ok: false, error: "Missing outreach ID." };

  // Only a payment follow-up supplies this: the raw sfb_ purchase link is
  // never persisted, so the operator pastes it here and the backend verifies
  // its hash against the hash the approval bound.
  const purchaseUrl = String(formData.get("purchaseUrl") ?? "").trim() || undefined;

  const result = await sendApprovedOutreach(outreachId, { purchaseUrl });
  if (result.ok) {
    revalidatePath(`/outreach/${outreachId}`);
    revalidatePath("/outreach");
    revalidatePath("/approvals");
  }
  return result;
}

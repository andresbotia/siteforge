"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requestPreviewPublication,
  revokePreviewDeployment,
} from "@/data/previews";

export type PreviewActionState = { ok: boolean; error?: string } | null;

export async function requestPreviewPublicationAction(
  _prev: PreviewActionState,
  formData: FormData,
): Promise<PreviewActionState> {
  const websiteId = String(formData.get("websiteId") ?? "");
  if (!websiteId) return { ok: false, error: "Missing website." };

  const result = await requestPreviewPublication(websiteId);
  if (!result.ok) return result;

  revalidatePath(`/websites/${websiteId}`);
  revalidatePath("/approvals");
  redirect("/approvals");
}

export async function revokePreviewDeploymentAction(
  _prev: PreviewActionState,
  formData: FormData,
): Promise<PreviewActionState> {
  const websiteId = String(formData.get("websiteId") ?? "");
  const deploymentId = String(formData.get("deploymentId") ?? "");
  if (!websiteId || !deploymentId) {
    return { ok: false, error: "Missing preview deployment." };
  }

  const result = await revokePreviewDeployment({ websiteId, deploymentId });
  if (result.ok) {
    revalidatePath(`/websites/${websiteId}`);
    revalidatePath("/approvals");
  }
  return result;
}

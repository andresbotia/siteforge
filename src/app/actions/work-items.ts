"use server";

import { revalidatePath } from "next/cache";
import { dismissWorkItem, snoozeWorkItem } from "@/data/work-items";
import { requireAdminSession } from "@/lib/auth/guard";

export type WorkItemActionState = { ok: boolean; error?: string } | null;

export async function snoozeWorkItemAction(
  _prev: WorkItemActionState,
  formData: FormData,
): Promise<WorkItemActionState> {
  await requireAdminSession();
  const id = String(formData.get("workItemId") ?? "").trim();
  const hours = Number(formData.get("hours") ?? "24");
  if (!id) return { ok: false, error: "Missing work item." };

  const result = await snoozeWorkItem(id, hours);
  if (!result.ok) return result;
  revalidatePath("/today");
  return { ok: true };
}

export async function dismissWorkItemAction(
  _prev: WorkItemActionState,
  formData: FormData,
): Promise<WorkItemActionState> {
  await requireAdminSession();
  const id = String(formData.get("workItemId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "");
  if (!id) return { ok: false, error: "Missing work item." };

  const result = await dismissWorkItem(id, reason);
  if (!result.ok) return result;
  revalidatePath("/today");
  return { ok: true };
}

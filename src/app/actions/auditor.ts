"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { startAuditorRun } from "@/data/auditor";

export type AuditorActionState = { ok: boolean; error?: string } | null;

export async function startAuditorRunAction(
  _prev: AuditorActionState,
  formData: FormData,
): Promise<AuditorActionState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  if (!leadId) return { ok: false, error: "Choose a lead to audit." };
  const result = await startAuditorRun({ leadId });
  if (!result.ok) return result;
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/agents");
  revalidatePath("/agents/auditor");
  revalidatePath(`/audits/${result.auditId}`);
  redirect(`/audits/${result.auditId}`);
}

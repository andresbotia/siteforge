"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { startBuilderRun } from "@/data/builder";

export type BuilderActionState = { ok: boolean; error?: string } | null;

export async function startBuilderRunAction(
  _prev: BuilderActionState,
  formData: FormData,
): Promise<BuilderActionState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  if (!leadId) return { ok: false, error: "Choose a lead to build." };
  const result = await startBuilderRun({ leadId });
  if (!result.ok) return result;
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/agents");
  revalidatePath("/agents/builder");
  revalidatePath("/websites");
  revalidatePath(`/websites/${result.websiteId}`);
  redirect(`/websites/${result.websiteId}`);
}

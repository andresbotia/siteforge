"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { startScoutRun } from "@/data/scout";
import { SCOUT_DEFAULT_CANDIDATES } from "@/lib/scout/limits";

export type ScoutActionState = { ok: boolean; error?: string } | null;

export async function startScoutRunAction(
  _prev: ScoutActionState,
  formData: FormData,
): Promise<ScoutActionState> {
  const location = String(formData.get("location") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const limit = Number(formData.get("limit"));
  if (!location) return { ok: false, error: "Enter a location." };
  if (!categoryId) return { ok: false, error: "Choose a category." };
  const result = await startScoutRun({
    location,
    categoryId,
    limit: Number.isFinite(limit) ? limit : SCOUT_DEFAULT_CANDIDATES,
  });
  if (!result.ok) return result;
  revalidatePath("/leads");
  revalidatePath("/agents");
  revalidatePath("/agents/scout");
  redirect(`/agents/scout/${result.runId}`);
}

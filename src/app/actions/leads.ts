"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createManualPublicProspect, updateLeadVerifiedPublicFacts } from "@/data/leads";
import { requireAdminSession } from "@/lib/auth/guard";
import {
  buildManualPublicProspectFailureState,
  readManualPublicProspectFormValues,
  type ManualPublicProspectFormState,
} from "@/lib/prospects/form-state";
import type { VerifiedPublicFactsInput } from "@/lib/prospects/verified-public-facts";

export type ManualPublicProspectActionState = ManualPublicProspectFormState;

export async function importManualPublicProspectAction(
  _previousState: ManualPublicProspectActionState,
  formData: FormData,
): Promise<ManualPublicProspectActionState> {
  await requireAdminSession();

  const values = readManualPublicProspectFormValues(formData);
  const result = await createManualPublicProspect(values);

  if (!result.ok) {
    return buildManualPublicProspectFailureState(result, values);
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${result.leadId}`);
  redirect(`/leads/${result.leadId}`);
}

export type VerifiedPublicFactsActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string; field?: keyof VerifiedPublicFactsInput };

export async function updateVerifiedPublicFactsAction(
  _previousState: VerifiedPublicFactsActionState,
  formData: FormData,
): Promise<VerifiedPublicFactsActionState> {
  await requireAdminSession();

  const leadId = String(formData.get("leadId") ?? "").trim();
  const facts: VerifiedPublicFactsInput = {
    sourceUrl: String(formData.get("sourceUrl") ?? ""),
    description: String(formData.get("description") ?? ""),
    cuisine: String(formData.get("cuisine") ?? ""),
    hours: String(formData.get("hours") ?? ""),
    rating: String(formData.get("rating") ?? ""),
    reviewCount: String(formData.get("reviewCount") ?? ""),
    socialUrl: String(formData.get("socialUrl") ?? ""),
    menuUrl: String(formData.get("menuUrl") ?? ""),
    orderUrl: String(formData.get("orderUrl") ?? ""),
    reservationUrl: String(formData.get("reservationUrl") ?? ""),
  };

  const result = await updateLeadVerifiedPublicFacts({ leadId, facts });
  if (!result.ok) return result;

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/agents/builder");
  return { ok: true, message: "Verified public facts saved." };
}

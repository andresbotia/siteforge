"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createManualPublicProspect } from "@/data/leads";
import { requireAdminSession } from "@/lib/auth/guard";
import {
  buildManualPublicProspectFailureState,
  readManualPublicProspectFormValues,
  type ManualPublicProspectFormState,
} from "@/lib/prospects/form-state";

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

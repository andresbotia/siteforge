"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createManualPublicProspect } from "@/data/leads";
import { requireAdminSession } from "@/lib/auth/guard";

export type ManualPublicProspectActionState = {
  ok: boolean;
  error?: string;
};

export async function importManualPublicProspectAction(
  _previousState: ManualPublicProspectActionState,
  formData: FormData,
): Promise<ManualPublicProspectActionState> {
  await requireAdminSession();

  const result = await createManualPublicProspect({
    businessName: String(formData.get("businessName") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    location: String(formData.get("location") ?? ""),
    industry: String(formData.get("industry") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    address: String(formData.get("address") ?? ""),
    sourceNote: String(formData.get("sourceNote") ?? ""),
  });

  if (!result.ok) {
    return result;
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${result.leadId}`);
  redirect(`/leads/${result.leadId}`);
}

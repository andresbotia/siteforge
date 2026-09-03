"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createManualPublicProspect,
  updateLeadLifecycleStatus,
  updateLeadSuggestedDomain,
  updateLeadVerifiedPublicFacts,
} from "@/data/leads";
import { requireAdminSession } from "@/lib/auth/guard";
import {
  buildManualPublicProspectFailureState,
  readManualPublicProspectFormValues,
  type ManualPublicProspectFormState,
} from "@/lib/prospects/form-state";
import { DAY_ORDER, type VerifiedPublicFactKey, type VerifiedPublicFactsInput } from "@/lib/prospects/verified-public-facts";

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

export type LeadLifecycleActionState = { ok: boolean; error?: string } | null;

/** M9.9. The allowed-transitions table is re-checked server-side in updateLeadLifecycleStatus. */
export async function updateLeadStatusAction(
  _previousState: LeadLifecycleActionState,
  formData: FormData,
): Promise<LeadLifecycleActionState> {
  await requireAdminSession();

  const leadId = String(formData.get("leadId") ?? "").trim();
  const nextStatus = String(formData.get("nextStatus") ?? "").trim();
  const archivedReason = String(formData.get("archivedReason") ?? "");
  if (!leadId) return { ok: false, error: "Missing lead." };
  if (!nextStatus) return { ok: false, error: "Choose a status." };

  const result = await updateLeadLifecycleStatus({ leadId, nextStatus, archivedReason });
  if (!result.ok) return result;

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

export async function updateLeadSuggestedDomainAction(
  _previousState: LeadLifecycleActionState,
  formData: FormData,
): Promise<LeadLifecycleActionState> {
  await requireAdminSession();

  const leadId = String(formData.get("leadId") ?? "").trim();
  if (!leadId) return { ok: false, error: "Missing lead." };

  const result = await updateLeadSuggestedDomain({
    leadId,
    suggestedDomain: String(formData.get("suggestedDomain") ?? ""),
  });
  if (!result.ok) return result;

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export type VerifiedPublicFactsActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string; field?: VerifiedPublicFactKey };

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
    dailyHours: Object.fromEntries(
      DAY_ORDER.map(({ key }) => [
        key,
        {
          value: String(formData.get(`hours_${key}`) ?? ""),
          closed: formData.get(`hours_${key}_closed`) === "on",
        },
      ]),
    ) as VerifiedPublicFactsInput["dailyHours"],
    socialProfiles: {
      instagram: String(formData.get("social_instagram") ?? ""),
      facebook: String(formData.get("social_facebook") ?? ""),
      tiktok: String(formData.get("social_tiktok") ?? ""),
      youtube: String(formData.get("social_youtube") ?? ""),
      x: String(formData.get("social_x") ?? ""),
      linkedin: String(formData.get("social_linkedin") ?? ""),
    },
    imageAssets: [0, 1, 2, 3].map((index) => ({
      url: String(formData.get(`image_${index}_url`) ?? ""),
      role: String(formData.get(`image_${index}_role`) ?? ""),
      alt: String(formData.get(`image_${index}_alt`) ?? ""),
      sourceType: String(formData.get(`image_${index}_source_type`) ?? ""),
      sourceUrl: String(formData.get(`image_${index}_source_url`) ?? ""),
      rightsStatus: String(formData.get(`image_${index}_rights_status`) ?? ""),
      approvalStatus: String(formData.get(`image_${index}_approval_status`) ?? ""),
    })),
  };

  const result = await updateLeadVerifiedPublicFacts({ leadId, facts });
  if (!result.ok) return result;

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/agents/builder");
  return { ok: true, message: "Verified public facts saved." };
}

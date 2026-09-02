"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCheckoutForApprovedOffer,
  createCommercialOffer,
  publishPurchaseLink,
  requestCommercialOfferApproval,
  revokePurchaseLink,
  updateCommercialOfferDraft,
} from "@/data/payments";
import { parseCents } from "@/lib/payments/money";

export type OfferActionState =
  | { ok: boolean; error?: string; checkoutUrl?: string }
  | null;

export type PurchaseLinkActionState =
  | { ok: boolean; error?: string; url?: string; hint?: string }
  | null;

function boolFromForm(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function offerInput(formData: FormData) {
  const setupAmountCents = parseCents(formData.get("setupAmountCents"));
  const managedMonthlyRaw = String(formData.get("managedMonthlyAmountCents") ?? "").trim();
  const managedMonthlyAmountCents = managedMonthlyRaw
    ? parseCents(managedMonthlyRaw)
    : null;
  if (setupAmountCents === null) {
    return { ok: false as const, error: "Enter setup amount in whole cents." };
  }
  if (managedMonthlyRaw && managedMonthlyAmountCents === null) {
    return { ok: false as const, error: "Enter monthly amount in whole cents." };
  }
  return {
    ok: true as const,
    input: {
      leadId: String(formData.get("leadId") ?? ""),
      generatedWebsiteId: String(formData.get("generatedWebsiteId") ?? "") || null,
      outreachId: String(formData.get("outreachId") ?? "") || null,
      currency: String(formData.get("currency") ?? "usd"),
      setupAmountCents,
      managedMonthlyAmountCents,
      managedPlanSelected: boolFromForm(formData.get("managedPlanSelected")),
      description: String(formData.get("description") ?? ""),
    },
  };
}

export async function createCommercialOfferAction(formData: FormData) {
  const parsed = offerInput(formData);
  if (!parsed.ok) return;
  const result = await createCommercialOffer(parsed.input);
  if (result.ok) {
    revalidatePath("/offers");
    revalidatePath(`/leads/${parsed.input.leadId}`);
    redirect(`/offers/${result.offerId}`);
  }
}

export async function updateCommercialOfferAction(
  _prev: OfferActionState,
  formData: FormData,
): Promise<OfferActionState> {
  const offerId = String(formData.get("offerId") ?? "");
  const parsed = offerInput(formData);
  if (!offerId) return { ok: false, error: "Missing offer." };
  if (!parsed.ok) return parsed;
  const result = await updateCommercialOfferDraft({ ...parsed.input, offerId });
  if (result.ok) {
    revalidatePath(`/offers/${offerId}`);
    revalidatePath("/offers");
  }
  return result;
}

export async function requestCommercialOfferApprovalAction(
  _prev: OfferActionState,
  formData: FormData,
): Promise<OfferActionState> {
  const offerId = String(formData.get("offerId") ?? "");
  if (!offerId) return { ok: false, error: "Missing offer." };
  const result = await requestCommercialOfferApproval(offerId);
  if (result.ok) {
    revalidatePath(`/offers/${offerId}`);
    revalidatePath("/offers");
    revalidatePath("/approvals");
  }
  return result;
}

export async function createCheckoutAction(
  _prev: OfferActionState,
  formData: FormData,
): Promise<OfferActionState> {
  const offerId = String(formData.get("offerId") ?? "");
  if (!offerId) return { ok: false, error: "Missing offer." };
  const result = await createCheckoutForApprovedOffer(offerId);
  if (result.ok) {
    revalidatePath(`/offers/${offerId}`);
    revalidatePath("/offers");
    return { ok: true, checkoutUrl: result.checkoutUrl };
  }
  return result;
}

export async function publishPurchaseLinkAction(
  _prev: PurchaseLinkActionState,
  formData: FormData,
): Promise<PurchaseLinkActionState> {
  const offerId = String(formData.get("offerId") ?? "");
  if (!offerId) return { ok: false, error: "Missing offer." };
  const result = await publishPurchaseLink(offerId);
  if (result.ok) {
    revalidatePath(`/offers/${offerId}`);
    return { ok: true, url: result.url, hint: result.hint };
  }
  return result;
}

export async function revokePurchaseLinkAction(
  _prev: PurchaseLinkActionState,
  formData: FormData,
): Promise<PurchaseLinkActionState> {
  const offerId = String(formData.get("offerId") ?? "");
  if (!offerId) return { ok: false, error: "Missing offer." };
  const result = await revokePurchaseLink(offerId);
  if (result.ok) {
    revalidatePath(`/offers/${offerId}`);
    return { ok: true };
  }
  return result;
}

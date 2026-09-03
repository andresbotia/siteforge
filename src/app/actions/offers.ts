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
import { resolveOfferPlan } from "@/lib/payments/plans";

export type OfferActionState =
  | { ok: boolean; error?: string; checkoutUrl?: string }
  | null;

export type PurchaseLinkActionState =
  | { ok: boolean; error?: string; url?: string; hint?: string }
  | null;

/**
 * M9.9: the browser submits a plan KEY, never an amount. Both amounts and
 * the managed-plan flag are re-derived server-side from the configured plan
 * catalog (`src/lib/payments/plans.ts`), which is locked to the same two
 * amounts the Stripe Price IDs are configured for. An unrecognized key falls
 * back to the first configured plan rather than to a client-supplied number,
 * so no request shape can produce an offer that LiveStripeProvider would
 * later refuse on its price-lock check.
 */
function offerInput(formData: FormData) {
  const plan = resolveOfferPlan(String(formData.get("planKey") ?? ""));
  return {
    ok: true as const,
    input: {
      leadId: String(formData.get("leadId") ?? ""),
      generatedWebsiteId: String(formData.get("generatedWebsiteId") ?? "") || null,
      outreachId: String(formData.get("outreachId") ?? "") || null,
      currency: String(formData.get("currency") ?? "usd"),
      setupAmountCents: plan.setupAmountCents,
      managedMonthlyAmountCents: plan.managedMonthlyAmountCents,
      managedPlanSelected: plan.managedPlanSelected,
      description: String(formData.get("description") ?? ""),
    },
  };
}

export async function createCommercialOfferAction(formData: FormData) {
  const parsed = offerInput(formData);
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
  if (!offerId) return { ok: false, error: "Missing offer." };
  const parsed = offerInput(formData);
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

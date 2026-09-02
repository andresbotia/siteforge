"use server";

import { createPublicCheckoutFromToken, type PublicPlanChoice } from "@/data/payments";

export type PublicPurchaseActionState =
  | { ok: boolean; error?: string; checkoutUrl?: string }
  | null;

/**
 * Public, unauthenticated action invoked from /buy/[token]. The browser
 * supplies only the opaque token and a plan choice between the two allowed
 * variants -- never an amount, never a Stripe price ID. Everything else is
 * re-derived server-side in createPublicCheckoutFromToken from the already-
 * approved offer plus trusted server config.
 */
export async function createPublicCheckoutAction(
  _prev: PublicPurchaseActionState,
  formData: FormData,
): Promise<PublicPurchaseActionState> {
  const token = String(formData.get("token") ?? "");
  const planChoiceRaw = String(formData.get("planChoice") ?? "");
  const planChoice: PublicPlanChoice =
    planChoiceRaw === "website_plus_managed" ? "website_plus_managed" : "website_only";
  if (!token) return { ok: false, error: "Missing purchase link." };

  const result = await createPublicCheckoutFromToken(token, planChoice);
  if (!result.ok) return result;
  return { ok: true, checkoutUrl: result.checkoutUrl };
}
